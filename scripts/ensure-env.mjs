#!/usr/bin/env node
/**
 * Makes sure this installation has its own database password before
 * `npm start` runs `docker compose up`.
 *
 * The password lives in `.env` next to docker-compose.yml, which Docker
 * Compose reads by itself, and which git and Docker builds ignore. If `.env`
 * already sets DB_PASSWORD, or DB_PASSWORD is set in the environment, this
 * does nothing.
 *
 * Otherwise it makes a random password. On a new installation that's all:
 * the database takes it when it's first created. An installation from before
 * per-installation passwords already has a database, which keeps the old
 * shared password whatever the compose file says, so this starts the
 * database and changes its password first. That works without the old
 * password because, inside the database's container, connections over its
 * own socket need none. `.env` is only written once the change has worked,
 * so a failure leaves things as they were, and running again tries again.
 *
 * Exits 0 once the password is in place, or 1 with a message saying what to do.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const ENV_FILE = join(ROOT, ".env");

/** The database user, matching POSTGRES_USER in docker-compose.yml. */
const DB_USER = "spatial";

/** Whether `.env` exists and already sets DB_PASSWORD. */
function envFileHasPassword() {
  return existsSync(ENV_FILE) && /^DB_PASSWORD=./m.test(readFileSync(ENV_FILE, "utf8"));
}

/**
 * Runs `docker compose` with DB_PASSWORD set, since the compose file won't
 * load without one.
 *
 * @returns {import("node:child_process").SpawnSyncReturns<string>}
 */
function compose(args, password) {
  return spawnSync("docker", ["compose", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, DB_PASSWORD: password },
  });
}

/** Whether this installation's database volume already exists. */
function databaseExists(password) {
  const config = compose(["config", "--format", "json"], password);
  if (config.status !== 0) fail(`Couldn't read docker-compose.yml:\n${config.stderr}`);
  const volume = JSON.parse(config.stdout).volumes.data.name;
  return spawnSync("docker", ["volume", "inspect", volume], { stdio: "ignore" }).status === 0;
}

/** Starts the database and gives its user `password`. */
function changePassword(password) {
  const up = compose(["up", "--detach", "--wait", "db"], password);
  if (up.status !== 0) fail(`Couldn't start the database to change its password:\n${up.stderr}`);
  // The password is hex, so it can't break out of the SQL string.
  const sql = `ALTER USER ${DB_USER} PASSWORD '${password}'`;
  const alter = compose(["exec", "-T", "db", "psql", "-U", DB_USER, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql], password);
  if (alter.status !== 0) fail(`Couldn't change the database's password:\n${alter.stderr}`);
}

/** Prints a message to stderr and exits with a failure code. */
function fail(message) {
  console.error(message);
  process.exit(1);
}

if (process.env.DB_PASSWORD || envFileHasPassword()) process.exit(0);

const password = randomBytes(32).toString("hex");

if (databaseExists(password)) {
  console.log("Giving your existing database its own password…");
  changePassword(password);
}

// Readable only by you. Appended, so any other settings already there stay.
const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const separator = existing && !existing.endsWith("\n") ? "\n" : "";
writeFileSync(
  ENV_FILE,
  `${existing}${separator}# This installation's database password, made by scripts/ensure-env.mjs. Keep it private.\nDB_PASSWORD=${password}\n`,
  { mode: 0o600 },
);
console.log("Created a database password for this installation in .env.");
