import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

// Each test file gets its own fresh database next to the app's one, so test
// files can run in parallel and never touch real data. Returns the db module,
// bound to that database.
export async function freshDatabase(name) {
  const base = process.env.DATABASE_URL ?? 'postgres://spatial:spatial@localhost:5432/spatial';
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const url = new URL(base);
  url.pathname = `/${name}`;
  process.env.DATABASE_URL = url.toString();
  const db = await import('../db.js');
  await db.migrate();
  return db;
}

export const point = (x, y) => ({ type: 'Point', coordinates: [x, y] });
export const square = (x, y, size = 1) => ({
  type: 'Polygon',
  coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
});

// Writes a GeoJSON file to a temp folder, shaped like a multer upload.
export async function upload(filename, content) {
  const dir = await mkdtemp(path.join(tmpdir(), 'spatial-test-'));
  const file = path.join(dir, filename);
  await writeFile(file, typeof content === 'string' ? content : JSON.stringify(content));
  return { originalname: filename, path: file };
}

export const fixture = (filename) => ({ originalname: filename, path: path.join(import.meta.dirname, 'fixtures', filename) });

export const collection = (...features) => ({
  type: 'FeatureCollection',
  features: features.map(([geometry, properties = {}]) => ({ type: 'Feature', properties, geometry })),
});
