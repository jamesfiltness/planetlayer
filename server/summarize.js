// "Summarize within": for each area, how many features of another layer are
// in it and, optionally, the sum, mean, minimum or maximum of one of their
// numeric properties. It's the classic summarize-within (or spatial join with
// statistics) of GIS tools, and is how, say, the population living within
// reach of each water pump is added up.
import { STATS } from '../shared/spec.js';
import { badRequest } from './errors.js';

// Each statistic's SQL aggregate. A sum over no features is 0; the others
// have no value then, so they're null.
const AGGREGATE = {
  sum: (v) => `coalesce(sum(${v}), 0)`,
  mean: (v) => `avg(${v})`,
  min: (v) => `min(${v})`,
  max: (v) => `max(${v})`,
};

// Where a feature is, for deciding which areas it's in: a point is itself,
// and a line or area is its centre (its centroid, or a point on it when the
// centroid falls outside it, as in the Centroid tool). So a shape that
// straddles two areas counts once, in the area holding its centre, while a
// point on a shared border counts for both.
const CENTRE = 'CASE WHEN ST_Intersects(ST_Centroid(b.geom), b.geom) THEN ST_Centroid(b.geom) ELSE ST_PointOnSurface(b.geom) END';

/**
 * The tool's SQL, in the shape the other tools in tools.js use. Each area
 * keeps its own properties and gains `count`, plus `<field>_<stat>` (such as
 * `pop_est_sum`) when a field is given. Only values stored as numbers are
 * used, as in filters; text, true/false and missing values are skipped.
 *
 * @param {{ areas: object, features: object }} picked the two layers
 * @param {{ field?: string, stat?: string }} params a blank field just counts
 */
export function summarizeSql({ areas: a, features: b }, { field = '', stat = 'sum' }) {
  if (typeof field !== 'string') throw badRequest('Pick a property to add up, or none to just count.');
  if (field && !STATS.includes(stat)) throw badRequest(`Pick how to add it up: ${STATS.join(', ')}.`);

  // The bounding-box test (&&) lets the (layer_id, geom) index find the
  // candidates: a feature whose centre is inside an area must overlap its box.
  const inside = `b.layer_id = $2 AND b.geom && a.geom AND ST_Intersects(a.geom, ${CENTRE})`;
  const args = [a.id, b.id];
  let value = "'{}'::jsonb";
  let aggregate = 'NULL::float8';
  if (field) {
    args.push(field, `${field}_${stat}`);
    value = 'jsonb_build_object($4::text, s.v)';
    aggregate = AGGREGATE[stat]("CASE WHEN jsonb_typeof(b.props->$3::text) = 'number' THEN (b.props->>$3::text)::float8 END");
  }
  return {
    name: `${a.name} ${b.name} summary`,
    shape: 'polygon',
    args,
    sql: `SELECT a.geom, a.props || jsonb_build_object('count', s.n) || ${value} AS props
          FROM features a
          CROSS JOIN LATERAL (SELECT count(*) AS n, ${aggregate} AS v FROM features b WHERE ${inside}) s
          WHERE a.layer_id = $1`,
  };
}
