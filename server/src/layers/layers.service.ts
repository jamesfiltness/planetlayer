import { Injectable, NotFoundException } from '@nestjs/common';
import { LAYER_NOT_FOUND } from '../common/messages.js';
import { DatabaseService, type Db } from '../database/database.service.js';
import type { LayerRow, Shape } from './layer.js';

// New layers take a colour from this list by their id, so a layer's colour is
// stable and layers created one after another differ.
const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];

export type LayerWithStats = LayerRow & { count: number; fields: string[] };

@Injectable()
export class LayersService {
  constructor(private readonly db: DatabaseService) {}

  // Call inside the transaction that adds the layer's features.
  async create(db: Db, mapId: number, name: string, shape: Shape): Promise<LayerRow> {
    // Updating the map first also locks it, so it can't be deleted until the
    // transaction ends.
    await touchMap(db, mapId);
    const { rows: [{ id }] } = await db.query("SELECT nextval(pg_get_serial_sequence('layers', 'id'))::int AS id");
    const { rows: [layer] } = await db.query(
      'INSERT INTO layers (id, map_id, name, shape, color) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, mapId, name, shape, COLORS[id % COLORS.length]],
    );
    return layer;
  }

  // `fields` samples the first 100 features, which is enough for the tool form.
  async list(mapId: number): Promise<LayerWithStats[]> {
    const { rows } = await this.db.query<LayerWithStats>(
      `SELECT l.*,
              (SELECT count(*)::int FROM features WHERE layer_id = l.id) AS count,
              (SELECT coalesce(array_agg(DISTINCT k), '{}') FROM (SELECT props FROM features WHERE layer_id = l.id LIMIT 100) s,
                      jsonb_object_keys(s.props) k) AS fields
       FROM layers l WHERE l.map_id = $1 ORDER BY l.id`,
      [mapId],
    );
    return rows;
  }

  async delete(id: number): Promise<void> {
    const { rows: [deleted] } = await this.db.query<{ map_id: number }>('DELETE FROM layers WHERE id = $1 RETURNING map_id', [id]);
    if (!deleted) throw new NotFoundException(LAYER_NOT_FOUND);
    await touchMap(this.db, deleted.map_id);
  }

  // Postgres builds the JSON text, which is sent as is.
  async geoJson(id: number): Promise<string> {
    const { rows: [layer] } = await this.db.query<{ fc: string }>(
      `SELECT (SELECT json_build_object('type', 'FeatureCollection', 'features', coalesce(json_agg(json_build_object(
                 'type', 'Feature', 'id', f.id, 'geometry', ST_AsGeoJSON(f.geom, 7)::json, 'properties', f.props)), '[]'))
               FROM features f WHERE f.layer_id = l.id)::text AS fc
       FROM layers l WHERE l.id = $1`,
      [id],
    );
    if (!layer) throw new NotFoundException(LAYER_NOT_FOUND);
    return layer.fc;
  }
}

async function touchMap(db: Db, mapId: number) {
  const { rowCount } = await db.query('UPDATE maps SET updated_at = now() WHERE id = $1', [mapId]);
  if (!rowCount) throw new NotFoundException('That map no longer exists.');
}
