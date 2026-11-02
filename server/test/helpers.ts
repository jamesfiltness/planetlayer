import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { AppModule } from '../src/app.module.js';
import { AppConfig } from '../src/config/app-config.js';
import { DatabaseService } from '../src/database/database.service.js';
import { setUpApp } from '../src/setup.js';

// Starts the whole app against a fresh database of its own, next to the app's
// one, so test files can run in parallel and never touch real data. The schema
// is migrated by app.init(), as it is in production.
export async function createTestApp(name: string) {
  const base = process.env.DATABASE_URL ?? 'postgres://spatial:spatial@localhost:5432/spatial';
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const url = new URL(base);
  url.pathname = `/${name}`;
  const clientDir = await mkdtemp(path.join(tmpdir(), 'spatial-client-'));
  await writeFile(path.join(clientDir, 'index.html'), '<!doctype html><title>Spatial Analysis</title>');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useValue(new AppConfig({ databaseUrl: url.toString(), clientDir, allowedHosts: [] }))
    .compile();
  const app = setUpApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }));
  await app.init();
  return { app, db: app.get(DatabaseService) };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

export const point = (x: number, y: number) => ({ type: 'Point', coordinates: [x, y] });
export const square = (x: number, y: number, size = 1) => ({
  type: 'Polygon',
  coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
});

export const collection = (...features: [object, Record<string, unknown>?][]) => ({
  type: 'FeatureCollection',
  features: features.map(([geometry, properties = {}]) => ({ type: 'Feature', properties, geometry })),
});

// Writes a file to a temp folder, shaped like a multer upload.
export async function upload(filename: string, content: string | object) {
  const dir = await mkdtemp(path.join(tmpdir(), 'spatial-test-'));
  const file = path.join(dir, filename);
  await writeFile(file, typeof content === 'string' ? content : JSON.stringify(content));
  return { originalname: filename, path: file };
}

export const fixture = (filename: string) => ({ originalname: filename, path: path.join(import.meta.dirname, 'fixtures', filename) });

export const count = async (db: DatabaseService, sql: string, params: unknown[] = []) =>
  (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0].n;

// An HttpException with this status (and a message matching `message`).
export const httpError = (status: number, message = /./) => (error: any) =>
  error?.getStatus?.() === status && message.test(error.message);
