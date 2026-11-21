import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

// There's deliberately no default: each installation has its own database
// password (see scripts/ensure-env.mjs), so a built-in one would be wrong
// everywhere, and a shared, published one would be unsafe.
if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL to the database to use, such as postgres://spatial:<password>@localhost:5432/spatial.');
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS = path.join(import.meta.dirname, 'migrations');

export async function migrate() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.name));
  const files = (await readdir(MIGRATIONS)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS, file), 'utf8');
    await transaction(async (db) => {
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
  }
}

/**
 * Runs `fn` with a client inside a transaction: committed if `fn` resolves,
 * rolled back if it throws, and the error rethrown.
 *
 * If the rollback fails too, the connection is broken: it's thrown away
 * rather than returned to the pool, and the original error (the one that
 * explains what happened) is the one rethrown.
 *
 * @template T
 * @param {(db: pg.PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function transaction(fn) {
  const client = await pool.connect();
  let broken;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      broken = rollbackError;
    }
    throw error;
  } finally {
    // Passing an error makes the pool close this connection instead of reusing it.
    client.release(broken);
  }
}
