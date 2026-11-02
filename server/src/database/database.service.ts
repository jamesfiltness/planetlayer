import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import { AppConfig } from '../config/app-config.js';
import { migrate } from './migrate.js';

// The pool, a client inside a transaction, or this service.
export interface Db {
  query<R extends pg.QueryResultRow = any>(sql: string, params?: unknown[]): Promise<pg.QueryResult<R>>;
}

@Injectable()
export class DatabaseService implements Db, OnModuleInit, OnModuleDestroy {
  readonly pool: pg.Pool;

  constructor(config: AppConfig) {
    this.pool = new pg.Pool({ connectionString: config.databaseUrl });
  }

  // Runs before the app takes requests, so the schema is always current.
  async onModuleInit() {
    await migrate(this);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  query<R extends pg.QueryResultRow = any>(sql: string, params?: unknown[]) {
    return this.pool.query<R>(sql, params);
  }

  async transaction<T>(fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
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
}
