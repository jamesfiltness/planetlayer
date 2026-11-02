/**
 * The Postgres connection pool, schema migrations and transactions. Queries
 * for maps, layers and features live in their own modules.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://spatial:spatial@localhost:5432/spatial',
});

const MIGRATIONS = path.join(import.meta.dirname, 'migrations');

/**
 * Applies each migrations/*.sql file once, in name order, each in its own
 * transaction. Run at startup, before the server accepts requests.
 */
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
 * Runs `fn` with a client inside a transaction: committed if it resolves,
 * rolled back if it throws.
 *
 * @template T
 * @param {(db: pg.PoolClient) => Promise<T>} fn
 * @returns {Promise<T>} what `fn` returned
 */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
