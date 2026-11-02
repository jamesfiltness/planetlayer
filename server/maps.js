// An id that can't be valid is treated like a missing one (404).
import { pool } from './db.js';
import { notFound } from './errors.js';
import { parseId, parseMapName } from './validation.js';

const COLUMNS = `m.id, m.name, m.created_at, m.updated_at,
                 (SELECT count(*)::int FROM layers WHERE map_id = m.id) AS layer_count`;

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

export async function deleteMap(id) {
  const { rowCount } = await pool.query('DELETE FROM maps WHERE id = $1', [parseId(id)]);
  if (!rowCount) throw mapNotFound();
}

const mapNotFound = () => notFound("That map doesn't exist. It may have been deleted.");
