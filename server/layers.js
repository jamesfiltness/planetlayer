/**
 * Layers: a named set of features of one shape (point, line or polygon),
 * belonging to one map. Imports and tools create them; this module creates,
 * lists, deletes and serves them.
 */
import { pool } from './db.js';
import { notFound } from './errors.js';
import { parseId } from './validation.js';

// New layers take a colour from this list by their id, so a layer's colour is
// stable and layers created one after another differ.
const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];

/**
 * Creates an empty layer in a map and marks the map as edited. Call it inside
 * the transaction that adds the layer's features.
 *
 * @param {import('pg').PoolClient} db a client in a transaction
 * @param {number} mapId
 * @param {string} name
 * @param {'point' | 'line' | 'polygon'} shape
 * @returns the new layer row
 * @throws a 404 error if the map doesn't exist (e.g. it was deleted mid-import)
 */
export async function createLayer(db, mapId, name, shape) {
  // Updating the map first also locks it, so it can't be deleted until the
  // transaction ends.
  await touchMap(db, mapId);
  const { rows: [{ id }] } = await db.query("SELECT nextval(pg_get_serial_sequence('layers', 'id'))::int AS id");
  const { rows } = await db.query(
    'INSERT INTO layers (id, map_id, name, shape, color) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [id, mapId, name, shape, COLORS[id % COLORS.length]],
  );
  return rows[0];
}

/**
 * Lists a map's layers, oldest first, with their feature count and the
 * property names found in their first 100 features (for the tool forms).
 *
 * @param {number} mapId
 */
export async function listLayers(mapId) {
  const { rows } = await pool.query(
    `SELECT l.*,
            (SELECT count(*)::int FROM features WHERE layer_id = l.id) AS count,
            (SELECT coalesce(array_agg(DISTINCT k), '{}') FROM (SELECT props FROM features WHERE layer_id = l.id LIMIT 100) s,
                    jsonb_object_keys(s.props) k) AS fields
     FROM layers l WHERE l.map_id = $1 ORDER BY l.id`,
    [mapId],
  );
  return rows;
}

/**
 * Deletes a layer and its features, and marks its map as edited.
 *
 * @param {unknown} id the layer id, as sent by the client
 * @throws a 404 error if there's no such layer
 */
export async function deleteLayer(id) {
  const { rows: [deleted] } = await pool.query('DELETE FROM layers WHERE id = $1 RETURNING map_id', [parseId(id)]);
  if (!deleted) throw notFound('That layer no longer exists.');
  await touchMap(pool, deleted.map_id);
}

/**
 * A layer's features as GeoJSON text. Postgres builds the JSON, which is sent
 * as is rather than parsed and serialised again.
 *
 * @param {unknown} id the layer id, as sent by the client
 * @returns {Promise<string>} a FeatureCollection, with coordinates to 7 decimal places (about 1 cm)
 * @throws a 404 error if there's no such layer
 */
export async function layerGeoJson(id) {
  const { rows: [layer] } = await pool.query(
    `SELECT (SELECT json_build_object('type', 'FeatureCollection', 'features', coalesce(json_agg(json_build_object(
               'type', 'Feature', 'id', f.id, 'geometry', ST_AsGeoJSON(f.geom, 7)::json, 'properties', f.props)), '[]'))
             FROM features f WHERE f.layer_id = l.id)::text AS fc
     FROM layers l WHERE l.id = $1`,
    [parseId(id)],
  );
  if (!layer) throw notFound('That layer no longer exists.');
  return layer.fc;
}

async function touchMap(db, mapId) {
  const { rowCount } = await db.query('UPDATE maps SET updated_at = now() WHERE id = $1', [mapId]);
  if (!rowCount) throw notFound('That map no longer exists.');
}
