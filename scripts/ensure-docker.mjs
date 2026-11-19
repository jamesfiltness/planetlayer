#!/usr/bin/env node
/**
 * Makes sure the Docker daemon is reachable before `npm start` runs
 * `docker compose up`.
 *
 * If `docker info` already succeeds this exits straight away. Otherwise it
 * starts Docker Desktop (macOS and Windows), then waits for the daemon to
 * answer. On Linux the daemon is a system service that needs root to start,
 * so it prints the command to run instead of trying.
 *
 * Exits 0 once Docker is ready, or 1 with a message saying what to do.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** How long to wait for Docker Desktop to come up, in milliseconds. */
const STARTUP_TIMEOUT_MS = 120_000;

/** How often to ask the daemon whether it is ready, in milliseconds. */
const POLL_INTERVAL_MS = 2_000;

/** Returns true when the Docker CLI can reach a running daemon. */
function dockerIsRunning() {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}

/** Returns true when the `docker` command is installed at all. */
function dockerIsInstalled() {
  return spawnSync("docker", ["--version"], { stdio: "ignore" }).status === 0;
}

/**
 * Starts Docker Desktop without waiting for it.
 *
 * @returns {boolean} false when there is no way to start it on this platform.
 */
function launchDockerDesktop() {
  if (process.platform === "darwin") {
    return spawnSync("open", ["-a", "Docker"], { stdio: "ignore" }).status === 0;
  }
  if (process.platform === "win32") {
    const exe = join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe");
    if (!existsSync(exe)) return false;
    spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
    return true;
  }
  return false;
}

/** Waits until the daemon answers or the timeout passes. */
async function waitForDocker() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (dockerIsRunning()) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
}

/** Prints a message to stderr and exits with a failure code. */
function fail(message) {
  console.error(message);
  process.exit(1);
}

if (dockerIsRunning()) process.exit(0);

if (!dockerIsInstalled()) {
  fail("Docker isn't installed. Install it from https://docs.docker.com/get-docker/ and run `npm start` again.");
}

if (!launchDockerDesktop()) {
  fail(
    process.platform === "linux"
      ? "Docker isn't running. Start it with `sudo systemctl start docker` and run `npm start` again."
      : "Docker isn't running and Docker Desktop couldn't be started. Start Docker and run `npm start` again.",
  );
}

console.log("Docker isn't running, so starting Docker Desktop. This can take a minute…");

if (!(await waitForDocker())) {
  fail(`Docker didn't become ready within ${STARTUP_TIMEOUT_MS / 1000} seconds. Check Docker Desktop and run \`npm start\` again.`);
}

console.log("Docker is ready.");
