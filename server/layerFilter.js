// Saving a layer's filter, and copying the features it lets through into a
// new layer. The filter itself is checked in filter/parse.js and turned into
// SQL in filter/sql.js.
import { transaction } from './db.js';
import { badRequest, notFound } from './errors.js';
import { parseFilter } from './filter/parse.js';
import { filterSql } from './filter/sql.js';
import { countMatching, createLayer, touchMap } from './layers.js';
import { parseId } from './validation.js';

/**
 * Replaces the layer's filter; null removes it, so every feature shows.
 *
 * @returns {Promise<{ matching: number }>} how many features the new filter lets through
 */
export async function saveLayerFilter(id, value) {
  const filter = parseFilter(value);
  return transaction(async (db) => {
    const { rows: [saved] } = await db.query('UPDATE layers SET filter = $2 WHERE id = $1 RETURNING id, map_id', [parseId(id), filter]);
    if (!saved) throw notFound('That layer no longer exists.');
    await touchMap(db, saved.map_id);
    return { matching: await countMatching(db, saved.id, filter) };
  });
}

/**
 * Copies the layer's features that match `filter` into a new layer in the
 * same map, and returns the new layer. It gets a colour and style of its own
 * and no filter. The name defaults to "<layer> (filtered)".
 *
 * The filter is the one sent, not the one saved on the layer, so a save that
 * hasn't reached the server yet can't change what's copied.
 *
 * @param {number | string} id the layer to copy from
 * @param {{ filter: object, name?: string }} body
 */
export async function saveFilteredAsLayer(id, body) {
  const filter = parseFilter(body?.filter);
  if (!filter) throw badRequest('Add a condition to filter by first.');
  const custom = typeof body.name === 'string' ? body.name.trim() : '';

  return transaction(async (db) => {
    const { rows: [source] } = await db.query('SELECT id, map_id, name, shape FROM layers WHERE id = $1', [parseId(id)]);
    if (!source) throw notFound('That layer no longer exists.');
    const layer = await createLayer(db, source.map_id, custom || `${source.name} (filtered)`, source.shape);

    const args = [source.id, layer.id];
    const where = filterSql(filter, args);
    const { rowCount } = await db.query(
      `INSERT INTO features (layer_id, geom, props)
       SELECT $2, f.geom, f.props FROM features f WHERE f.layer_id = $1 AND ${where} ORDER BY f.id`,
      args,
    );
    if (!rowCount) throw badRequest('No features match that filter.');
    return layer;
  });
}

