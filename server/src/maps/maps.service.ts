import { Injectable, NotFoundException } from '@nestjs/common';
import { MAP_NOT_FOUND } from '../common/messages.js';
import { DatabaseService } from '../database/database.service.js';
import type { MapRow } from './map.js';

const COLUMNS = `m.id, m.name, m.created_at, m.updated_at,
                 (SELECT count(*)::int FROM layers WHERE map_id = m.id) AS layer_count`;

// Names arrive checked and trimmed by MapNameDto.
@Injectable()
export class MapsService {
  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<MapRow[]> {
    const { rows } = await this.db.query<MapRow>(`SELECT ${COLUMNS} FROM maps m ORDER BY m.updated_at DESC, m.id DESC`);
    return rows;
  }

  async get(id: number): Promise<MapRow> {
    const { rows: [map] } = await this.db.query<MapRow>(`SELECT ${COLUMNS} FROM maps m WHERE m.id = $1`, [id]);
    if (!map) throw new NotFoundException(MAP_NOT_FOUND);
    return map;
  }

  async create(name: string): Promise<MapRow> {
    const { rows: [{ id }] } = await this.db.query<{ id: number }>('INSERT INTO maps (name) VALUES ($1) RETURNING id', [name]);
    return this.get(id);
  }

  async rename(id: number, name: string): Promise<MapRow> {
    const { rowCount } = await this.db.query('UPDATE maps SET name = $2, updated_at = now() WHERE id = $1', [id, name]);
    if (!rowCount) throw new NotFoundException(MAP_NOT_FOUND);
    return this.get(id);
  }

  async delete(id: number): Promise<void> {
    const { rowCount } = await this.db.query('DELETE FROM maps WHERE id = $1', [id]);
    if (!rowCount) throw new NotFoundException(MAP_NOT_FOUND);
  }
}
