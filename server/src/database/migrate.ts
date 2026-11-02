import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseService } from './database.service.js';

const MIGRATIONS = path.join(import.meta.dirname, 'migrations');

// Applies each .sql file in migrations/ once, in name order, each in its own transaction.
export async function migrate(db: DatabaseService) {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const { rows } = await db.query<{ name: string }>('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.name));
  const files = (await readdir(MIGRATIONS)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS, file), 'utf8');
    await db.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
  }
}
