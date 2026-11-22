// The two summarize tools, the classic pair of GIS tools (ArcGIS calls them
// Summarize Within and Summarize Nearby):
//
// - Summarize within: for each area, the features of another layer in it.
// - Summarize nearby: for each feature, the features of another layer
//   within a distance of it on the ground, such as the people living within
//   2 km of each water pump.
//
// Both count those features and, optionally, work out the sum, mean,
// minimum or maximum of one of their numeric properties.
//
// A point counts where it is; a line or area counts once, where its centre
// is (see centre in toolParts.js). So a shape that straddles two areas
// counts in the one holding its centre, while a point on a shared border
// counts for both.
import { STATS } from '../shared/spec.js';
import { badRequest } from './errors.js';
import { centre, parseMetres, withinMetres } from './toolParts.js';

// Each statistic's SQL aggregate. A sum over no features is 0; the others
// have no value then, so they're null.
const AGGREGATE = {
  sum: (v) => `coalesce(sum(${v}), 0)`,
  mean: (v) => `avg(${v})`,
  min: (v) => `min(${v})`,
  max: (v) => `max(${v})`,
};

/**
 * Summarize within, built like the tools in toolSql.js. Each area keeps its
 * own properties and gains `count`, plus `<field>_<stat>` (such as
 * `pop_est_sum`) when a field is given. Only values stored as numbers are
 * used, as in filters; text, true/false and missing values are skipped.
 *
 * @param {{ areas: object, features: object }} picked the two layers
 * @param {{ field?: string, stat?: string }} params a blank field just counts
 * @param {(value: unknown) => string} bind
 */
export function summarizeSql({ areas: a, features: b }, params, bind) {
  // The bounding-box test (&&) lets the (layer_id, geom) index find the
  // candidates: a feature whose centre is inside an area must overlap its box.
  return summary(a, b, params, bind, {
    name: `${a.name} ${b.name} summary`,
    shape: 'polygon',
    where: `b.geom && a.geom AND ST_Intersects(a.geom, ${centre('b.geom')})`,
  });
}

/**
 * Summarize nearby: like Summarize within, but each feature of `layer`, of
 * any shape, keeps its own shape and gains the summary of the features of
 * `features` whose position (as above) is within the distance of it. With
 * the same layer picked twice, a feature doesn't count itself.
 *
 * @param {{ layer: object, features: object }} picked
 * @param {{ distance: unknown, unit: unknown, field?: string, stat?: string }} params
 * @param {(value: unknown) => string} bind
 */
export function summarizeNearbySql({ layer: a, features: b }, params, bind) {
  const metres = bind(parseMetres(params.distance, params.unit, { zero: true }));
  const self = a.id === b.id ? ' AND b.id <> a.id' : '';
  return summary(a, b, params, bind, {
    name: `${b.name} within ${params.distance} ${params.unit} of ${a.name}`,
    shape: a.shape,
    where: `${withinMetres('a.geom', centre('b.geom'), metres)}${self}`,
  });
}

// The SELECT both tools share: each `a` with the count, and the statistic,
// of the `b` rows matching `where`.
function summary(a, b, { field = '', stat = 'sum' }, bind, { name, shape, where }) {
  if (typeof field !== 'string') throw badRequest('Pick a property to add up, or none to just count.');
  if (field && !STATS.includes(stat)) throw badRequest(`Pick how to add it up: ${STATS.join(', ')}.`);

  let value = "'{}'::jsonb";
  let aggregate = 'NULL::float8';
  if (field) {
    const key = bind(field);
    value = `jsonb_build_object(${bind(`${field}_${stat}`)}::text, s.v)`;
    aggregate = AGGREGATE[stat](`CASE WHEN jsonb_typeof(b.props->${key}::text) = 'number' THEN (b.props->>${key}::text)::float8 END`);
  }
  return {
    name,
    shape,
    sql: `SELECT a.geom, a.props || jsonb_build_object('count', s.n) || ${value} AS props
          FROM ${a.rows} a
          CROSS JOIN LATERAL (SELECT count(*) AS n, ${aggregate} AS v FROM ${b.rows} b WHERE ${where}) s`,
  };
}
