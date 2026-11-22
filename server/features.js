// Reading a layer's features a page at a time, for the MCP server's
// get_features tool. The client draws whole layers from layerGeoJson in
// layers.js instead; this is for reading the data, not drawing it, so
// geometry is left out unless asked for.
import { pool } from './db.js';
import { badRequest, notFound } from './errors.js';
import { filterSql } from './filter/sql.js';
import { parseId } from './validation.js';

/** The most features one page can hold. */
export const MAX_PAGE = 100;

/** How each page can describe a feature's geometry. */
export const GEOMETRY_MODES = ['none', 'centroid', 'full'];

// Each mode's SQL, as a JSON column named `geometry`. A centroid is the
// shape's centre, or a point on it when the centre falls outside it, as in
// the Centroid tool. Coordinates are rounded to 6 decimal places, about
// 10 cm, which is as precise as the data is ever likely to be.
const GEOMETRY_SQL = {
  none: 'NULL::json',
  centroid: `ST_AsGeoJSON(CASE WHEN ST_Intersects(ST_Centroid(f.geom), f.geom) THEN ST_Centroid(f.geom)
             ELSE ST_PointOnSurface(f.geom) END, 6)::json`,
  full: 'ST_AsGeoJSON(f.geom, 6)::json',
};

/**
 * One page of a layer's features, only those its filter lets through (what
 * the map shows), as `{ id, properties, geometry? }`.
 *
 * @param {number | string} layerId
 * @param {object} [options]
 * @param {number} [options.limit] features per page, 1 to MAX_PAGE (default 20)
 * @param {number} [options.offset] how many to skip (default 0)
 * @param {string} [options.sortBy] a property to sort by; features without it come last
 * @param {'asc' | 'desc'} [options.order] the sort direction (default asc)
 * @param {'none' | 'centroid' | 'full'} [options.geometry] see GEOMETRY_MODES (default none)
 * @param {string[]} [options.properties] the properties to include (default all)
 * @returns {Promise<{ total: number, offset: number, next_offset: number | null, features: object[] }>}
 *   `total` counts every matching feature, and `next_offset` is where the
 *   next page starts, or null when this is the last one.
 */
export async function getFeatures(layerId, { limit = 20, offset = 0, sortBy, order = 'asc', geometry = 'none', properties } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) throw badRequest(`limit must be a whole number from 1 to ${MAX_PAGE}.`);
  if (!Number.isInteger(offset) || offset < 0) throw badRequest('offset must be a whole number, 0 or more.');
  if (!['asc', 'desc'].includes(order)) throw badRequest('order must be asc or desc.');
  if (!GEOMETRY_MODES.includes(geometry)) throw badRequest(`geometry must be one of ${GEOMETRY_MODES.join(', ')}.`);

  const { rows: [layer] } = await pool.query('SELECT id, filter FROM layers WHERE id = $1', [parseId(layerId)]);
  if (!layer) throw notFound('That layer no longer exists.');

  const args = [layer.id];
  const where = filterSql(layer.filter, args);
  const { rows: [{ total }] } = await pool.query(`SELECT count(*)::int AS total FROM features f WHERE f.layer_id = $1 AND ${where}`, args);

  // jsonb sorts numbers as numbers and text as text, so a numeric property
  // ranks properly. A missing property is SQL NULL and goes last either way.
  const sort = sortBy ? `f.props -> $${args.push(sortBy)} ${order === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, ` : '';
  const props = properties
    ? `(SELECT coalesce(jsonb_object_agg(k, v), '{}') FROM jsonb_each(f.props) e(k, v) WHERE k = ANY($${args.push(properties)}))`
    : 'f.props';
  const { rows } = await pool.query(
    `SELECT f.id, ${props} AS properties, ${GEOMETRY_SQL[geometry]} AS geometry
     FROM features f WHERE f.layer_id = $1 AND ${where}
     ORDER BY ${sort}f.id LIMIT $${args.push(limit)} OFFSET $${args.push(offset)}`,
    args,
  );

  // Feature ids are bigints, which pg gives as text; they're far below the
  // largest exact number, so they're numbers here, like layer and map ids.
  const features = rows.map(({ id, properties: p, geometry: g }) => ({
    id: Number(id), properties: p, ...(geometry === 'none' ? {} : { geometry: g }),
  }));
  const next = offset + rows.length;
  return { total, offset, next_offset: next < total ? next : null, features };
}
