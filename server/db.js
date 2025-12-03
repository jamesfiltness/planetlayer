import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://spatial:spatial@localhost:5432/spatial',
});

const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];
const MIGRATIONS = path.join(import.meta.dirname, 'migrations');

// Applies each migrations/*.sql file once, in name order.
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

export async function createLayer(db, name, shape) {
  const { rows: [{ n }] } = await db.query('SELECT count(*)::int AS n FROM layers');
  const { rows } = await db.query(
    'INSERT INTO layers (name, shape, color) VALUES ($1, $2, $3) RETURNING *',
    [name, shape, COLORS[n % COLORS.length]],
  );
  return rows[0];
}

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

export function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}
