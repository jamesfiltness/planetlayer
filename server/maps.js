/**
 * Maps: a named collection of layers. Deleting a map deletes its layers and
 * their features (see migrations/003_maps.sql).
 *
 * Every function that takes an id accepts it as the client sent it; an id
 * that can't be valid is treated like one that doesn't exist (a 404).
 */
import { pool } from './db.js';
import { notFound } from './errors.js';
import { parseId, parseMapName } from './validation.js';

// Each map row as the API returns it.
const COLUMNS = `m.id, m.name, m.created_at, m.updated_at,
                 (SELECT count(*)::int FROM layers WHERE map_id = m.id) AS layer_count`;

/**
 * @typedef {object} Map
 * @property {number} id
 * @property {string} name
 * @property {Date} created_at
 * @property {Date} updated_at when the map or its layers last changed
 * @property {number} layer_count
 */

/**
 * Lists every map, most recently edited first.
 *
 * @returns {Promise<Map[]>}
 */
export async function listMaps() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM maps m ORDER BY m.updated_at DESC, m.id DESC`);
  return rows;
}

/**
 * @param {unknown} id
 * @returns {Promise<Map>}
 * @throws a 404 error if there's no such map
 */
export async function getMap(id) {
  const { rows: [map] } = await pool.query(`SELECT ${COLUMNS} FROM maps m WHERE m.id = $1`, [parseId(id)]);
  if (!map) throw mapNotFound();
  return map;
}

/**
 * @param {unknown} name trimmed; see parseMapName for the rules
 * @returns {Promise<Map>} the new, empty map
 */
export async function createMap(name) {
  const { rows: [{ id }] } = await pool.query('INSERT INTO maps (name) VALUES ($1) RETURNING id', [parseMapName(name)]);
  return getMap(id);
}

/**
 * @param {unknown} id
 * @param {unknown} name trimmed; see parseMapName for the rules
 * @returns {Promise<Map>} the renamed map
 * @throws a 404 error if there's no such map
 */
export async function renameMap(id, name) {
  const { rowCount } = await pool.query(
    'UPDATE maps SET name = $2, updated_at = now() WHERE id = $1',
    [parseId(id), parseMapName(name)],
  );
  if (!rowCount) throw mapNotFound();
  return getMap(id);
}

/**
 * Deletes a map with all its layers and features.
 *
 * @param {unknown} id
 * @throws a 404 error if there's no such map
 */
export async function deleteMap(id) {
  const { rowCount } = await pool.query('DELETE FROM maps WHERE id = $1', [parseId(id)]);
  if (!rowCount) throw mapNotFound();
}

const mapNotFound = () => notFound("That map doesn't exist. It may have been deleted.");
