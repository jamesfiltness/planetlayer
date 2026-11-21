import { afterCommit, pool } from './db.js';
import { badRequest, notFound } from './errors.js';
import { filterSql } from './filter/sql.js';
import { announceMapChanged } from './mapEvents.js';
import { parseSymbology } from './symbology.js';
import { fitLayerName, parseId, parseLayerName, parseStyle } from './validation.js';

// New layers take a colour from this list by their id, so a layer's colour is
// stable and layers created one after another differ.
const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];

// A layer's style as the API gives it, built from the columns of `layers l`.
// A new layer's symbology is the column's default, `single`.
const STYLE = `json_build_object('fillColor', l.fill_color, 'fillOpacity', l.fill_opacity,
  'outlineColor', l.outline_color, 'outlineWidth', l.outline_width, 'opacity', l.opacity,
  'symbology', l.symbology) AS style`;

// How a new layer looks until it's restyled: translucent areas outlined in
// their own colour, solid points ringed in white, and lines (which have no
// fill, so only the outline is drawn) a little thicker than an area's edge.
function defaultStyle(shape, color) {
  return {
    fillColor: color,
    fillOpacity: shape === 'polygon' ? 0.35 : 1,
    outlineColor: shape === 'point' ? '#ffffff' : color,
    outlineWidth: shape === 'line' ? 2.5 : 1.5,
    opacity: 1,
  };
}

// Call inside the transaction that adds the layer's features. A name that's
// too long is cut short (see fitLayerName); check names people type first,
// with parseLayerName.
export async function createLayer(db, mapId, name, shape) {
  // Updating the map first also locks it, so it can't be deleted until the
  // transaction ends.
  await touchMap(db, mapId);
  const { rows: [{ id }] } = await db.query("SELECT nextval(pg_get_serial_sequence('layers', 'id'))::int AS id");
  const style = defaultStyle(shape, COLORS[id % COLORS.length]);
  const { rows } = await db.query(
    `INSERT INTO layers AS l (id, map_id, name, shape, fill_color, fill_opacity, outline_color, outline_width, opacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING l.id, l.map_id, l.name, l.shape, ${STYLE}`,
    [id, mapId, fitLayerName(name), shape, style.fillColor, style.fillOpacity, style.outlineColor, style.outlineWidth, style.opacity],
  );
  return rows[0];
}

/**
 * The map's layers, oldest first. Each has its `style`, its `filter` (or
 * null), its feature `count`, how many of those features the filter lets
 * through (`matching`; the same as `count` with no filter), the names of
 * the properties found on its first 100 features (`fields`), and the box
 * around all its features as `[west, south, east, north]` in degrees
 * (`extent`; null with no features). The extent ignores the filter.
 */
export async function listLayers(mapId) {
  return layerRows('l.map_id = $1', [mapId]);
}

/** One layer, described as in listLayers. Throws a 404 if it doesn't exist. */
export async function getLayer(id) {
  const [layer] = await layerRows('l.id = $1', [parseId(id)]);
  if (!layer) throw notFound('That layer no longer exists.');
  return layer;
}

async function layerRows(where, args) {
  const { rows } = await pool.query(
    `SELECT l.id, l.map_id, l.name, l.shape, ${STYLE}, l.filter,
            (SELECT count(*)::int FROM features WHERE layer_id = l.id) AS count,
            (SELECT CASE WHEN e IS NULL THEN NULL ELSE json_build_array(ST_XMin(e), ST_YMin(e), ST_XMax(e), ST_YMax(e)) END
             FROM (SELECT ST_Extent(geom) AS e FROM features WHERE layer_id = l.id) x) AS extent,
            (SELECT coalesce(array_agg(DISTINCT k), '{}') FROM (SELECT props FROM features WHERE layer_id = l.id LIMIT 100) s,
                    jsonb_object_keys(s.props) k) AS fields
     FROM layers l WHERE ${where} ORDER BY l.id`,
    args,
  );
  await Promise.all(rows.map(async (layer) => {
    layer.matching = layer.filter ? await countMatching(pool, layer.id, layer.filter) : layer.count;
  }));
  return rows;
}

/** How many of the layer's features match `filter` (all of them for null). */
export async function countMatching(db, layerId, filter) {
  const args = [layerId];
  const where = filterSql(filter, args);
  const { rows: [{ n }] } = await db.query(`SELECT count(*)::int AS n FROM features f WHERE f.layer_id = $1 AND ${where}`, args);
  return n;
}

/**
 * Replaces the whole style: the fields parseStyle checks, and a `symbology`
 * that parseSymbology checks against the layer's shape. Both are required.
 */
export async function saveLayerStyle(id, value) {
  const style = parseStyle(value);
  const layerId = parseId(id);
  // The symbology can only be checked once the layer's shape is known.
  const { rows: [layer] } = await pool.query('SELECT shape FROM layers WHERE id = $1', [layerId]);
  if (!layer) throw notFound('That layer no longer exists.');
  const symbology = parseSymbology(value.symbology, layer.shape);
  const { rows: [saved] } = await pool.query(
    `UPDATE layers SET fill_color = $2, fill_opacity = $3, outline_color = $4, outline_width = $5, opacity = $6, symbology = $7
     WHERE id = $1 RETURNING map_id`,
    [layerId, style.fillColor, style.fillOpacity, style.outlineColor, style.outlineWidth, style.opacity, symbology],
  );
  if (!saved) throw notFound('That layer no longer exists.');
  await touchMap(pool, saved.map_id);
}

/** Renames a layer. Unlike a new layer's name, this one is required. */
export async function renameLayer(id, value) {
  const name = parseLayerName(value);
  if (!name) throw badRequest('Give the layer a name.');
  const { rows: [renamed] } = await pool.query('UPDATE layers SET name = $2 WHERE id = $1 RETURNING map_id', [parseId(id), name]);
  if (!renamed) throw notFound('That layer no longer exists.');
  await touchMap(pool, renamed.map_id);
  return getLayer(id);
}

export async function deleteLayer(id) {
  const { rows: [deleted] } = await pool.query('DELETE FROM layers WHERE id = $1 RETURNING map_id', [parseId(id)]);
  if (!deleted) throw notFound('That layer no longer exists.');
  await touchMap(pool, deleted.map_id);
}

/**
 * The layer's features as GeoJSON text, built by Postgres and sent as is.
 * Only the features its filter lets through are included.
 */
export async function layerGeoJson(id) {
  const { rows: [layer] } = await pool.query('SELECT id, filter FROM layers WHERE id = $1', [parseId(id)]);
  if (!layer) throw notFound('That layer no longer exists.');
  const args = [layer.id];
  const where = filterSql(layer.filter, args);
  const { rows: [{ fc }] } = await pool.query(
    `SELECT json_build_object('type', 'FeatureCollection', 'features', coalesce(json_agg(json_build_object(
              'type', 'Feature', 'id', f.id, 'geometry', ST_AsGeoJSON(f.geom, 7)::json, 'properties', f.props) ORDER BY f.id), '[]'))::text AS fc
     FROM features f WHERE f.layer_id = $1 AND ${where}`,
    args,
  );
  return fc;
}

// Marks the map as just edited, and tells browsers showing it once the edit
// is saved (see mapEvents.js). Every change to a map's layers calls this.
// Throws if the map no longer exists.
export async function touchMap(db, mapId) {
  const { rowCount } = await db.query('UPDATE maps SET updated_at = now() WHERE id = $1', [mapId]);
  if (!rowCount) throw notFound('That map no longer exists.');
  afterCommit(db, () => announceMapChanged(mapId));
}
