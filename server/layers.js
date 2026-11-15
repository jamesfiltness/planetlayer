import { pool } from './db.js';
import { notFound } from './errors.js';
import { parseId, parseStyle } from './validation.js';

// New layers take a colour from this list by their id, so a layer's colour is
// stable and layers created one after another differ.
const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];

// A layer's style as the API gives it, built from the columns of `layers l`.
const STYLE = `json_build_object('fillColor', l.fill_color, 'fillOpacity', l.fill_opacity,
  'outlineColor', l.outline_color, 'outlineWidth', l.outline_width, 'opacity', l.opacity) AS style`;

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

// Call inside the transaction that adds the layer's features.
export async function createLayer(db, mapId, name, shape) {
  // Updating the map first also locks it, so it can't be deleted until the
  // transaction ends.
  await touchMap(db, mapId);
  const { rows: [{ id }] } = await db.query("SELECT nextval(pg_get_serial_sequence('layers', 'id'))::int AS id");
  const style = defaultStyle(shape, COLORS[id % COLORS.length]);
  const { rows } = await db.query(
    `INSERT INTO layers AS l (id, map_id, name, shape, fill_color, fill_opacity, outline_color, outline_width, opacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING l.id, l.map_id, l.name, l.shape, ${STYLE}`,
    [id, mapId, name, shape, style.fillColor, style.fillOpacity, style.outlineColor, style.outlineWidth, style.opacity],
  );
  return rows[0];
}

export async function listLayers(mapId) {
  const { rows } = await pool.query(
    `SELECT l.id, l.map_id, l.name, l.shape, ${STYLE},
            (SELECT count(*)::int FROM features WHERE layer_id = l.id) AS count,
            (SELECT coalesce(array_agg(DISTINCT k), '{}') FROM (SELECT props FROM features WHERE layer_id = l.id LIMIT 100) s,
                    jsonb_object_keys(s.props) k) AS fields
     FROM layers l WHERE l.map_id = $1 ORDER BY l.id`,
    [mapId],
  );
  return rows;
}

// Replaces the whole style; see parseStyle for its fields.
export async function saveLayerStyle(id, value) {
  const style = parseStyle(value);
  const { rows: [saved] } = await pool.query(
    `UPDATE layers SET fill_color = $2, fill_opacity = $3, outline_color = $4, outline_width = $5, opacity = $6
     WHERE id = $1 RETURNING map_id`,
    [parseId(id), style.fillColor, style.fillOpacity, style.outlineColor, style.outlineWidth, style.opacity],
  );
  if (!saved) throw notFound('That layer no longer exists.');
  await touchMap(pool, saved.map_id);
}

export async function deleteLayer(id) {
  const { rows: [deleted] } = await pool.query('DELETE FROM layers WHERE id = $1 RETURNING map_id', [parseId(id)]);
  if (!deleted) throw notFound('That layer no longer exists.');
  await touchMap(pool, deleted.map_id);
}

// Postgres builds the JSON text, which is sent as is.
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
