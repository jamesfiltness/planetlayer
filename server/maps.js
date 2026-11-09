// An id that can't be valid is treated like a missing one (404).
import { pool } from './db.js';
import { notFound } from './errors.js';
import { parseId, parseMapName, parseView } from './validation.js';

// `view` is null until the map has been moved (the columns are all set or all null).
const COLUMNS = `m.id, m.name, m.created_at, m.updated_at,
                 (SELECT count(*)::int FROM layers WHERE map_id = m.id) AS layer_count,
                 CASE WHEN m.view_zoom IS NOT NULL THEN json_build_object(
                   'center', json_build_array(m.view_lng, m.view_lat),
                   'zoom', m.view_zoom, 'bearing', m.view_bearing, 'pitch', m.view_pitch)
                 END AS view`;

export async function listMaps() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM maps m ORDER BY m.updated_at DESC, m.id DESC`);
  return rows;
}

export async function getMap(id) {
  const { rows: [map] } = await pool.query(`SELECT ${COLUMNS} FROM maps m WHERE m.id = $1`, [parseId(id)]);
  if (!map) throw mapNotFound();
  return map;
}

export async function createMap(name) {
  const { rows: [{ id }] } = await pool.query('INSERT INTO maps (name) VALUES ($1) RETURNING id', [parseMapName(name)]);
  return getMap(id);
}

export async function renameMap(id, name) {
  const { rowCount } = await pool.query(
    'UPDATE maps SET name = $2, updated_at = now() WHERE id = $1',
    [parseId(id), parseMapName(name)],
  );
  if (!rowCount) throw mapNotFound();
  return getMap(id);
}

// Leaves updated_at alone: looking around a map isn't editing it, and the
// list shouldn't reorder every time a map is panned.
export async function saveMapView(id, view) {
  const { lng, lat, zoom, bearing, pitch } = parseView(view);
  const { rowCount } = await pool.query(
    `UPDATE maps SET view_lng = $2, view_lat = $3, view_zoom = $4, view_bearing = $5, view_pitch = $6
     WHERE id = $1`,
    [parseId(id), lng, lat, zoom, bearing, pitch],
  );
  if (!rowCount) throw mapNotFound();
}

export async function deleteMap(id) {
  const { rowCount } = await pool.query('DELETE FROM maps WHERE id = $1', [parseId(id)]);
  if (!rowCount) throw mapNotFound();
}

const mapNotFound = () => notFound("That map doesn't exist. It may have been deleted.");
