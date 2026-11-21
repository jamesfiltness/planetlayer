// The SQL of each analysis tool (see TOOLS in shared/spec.js). tools.js
// checks the request, picks the layers and runs it.
//
// Each builder is given:
// - the picked layers, by field key. Each has its usual columns, a `name` for
//   naming the result ("(filtered)" added when the layer has a filter), and
//   `rows`: a subquery of its features that its filter lets through, with
//   `id`, `geom` and `props`. Tools read features only through `rows`, so
//   they always see what the map shows.
// - the request's parameters.
// - `bind(value)`, which adds a parameter to the query and returns its
//   placeholder, such as `$3`. Only constants go into the SQL text; anything
//   from the request is bound.
//
// It returns `{ name, shape, sql }`: the new layer's default name and shape,
// and the SELECT whose (geom, props) rows become its features.
//
// Stored geometries are made valid on import, so the tools use them as they
// are, and the (layer_id, geom) index serves the spatial joins.
import { SHAPES, UNITS } from '../shared/spec.js';
import { badRequest } from './errors.js';
import { summarizeSql } from './summarize.js';

// ST_CollectionExtract type for each shape.
const TYPE = Object.fromEntries(SHAPES.map((shape, i) => [shape, i + 1]));

export const SQL = {
  buffer({ layer: a }, { distance, unit, merge = false }, bind) {
    if (!Object.hasOwn(UNITS, unit)) throw badRequest(`Unknown unit: ${unit}`);
    // Strictly true or false: as text, "false" would be truthy and merge.
    if (typeof merge !== 'boolean') throw badRequest('Merge must be true or false.');
    const metres = Number(distance) * UNITS[unit];
    if (!metres || Math.abs(metres) > 100_000) throw badRequest('Distance must be non-zero and at most 100 km.');
    if (metres < 0 && a.shape !== 'polygon') throw badRequest('Only area layers can take a negative distance.');
    const buffered = `ST_Buffer(a.geom::geography, ${bind(metres)})::geometry`;
    return {
      name: `${a.name} buffer`,
      shape: 'polygon',
      sql: merge
        ? `SELECT d.geom, '{}'::jsonb AS props
           FROM (SELECT ST_Union(${buffered}) AS u FROM ${a.rows} a) x, ST_Dump(x.u) d`
        : `SELECT ST_CollectionExtract(${buffered}, 3) AS geom, a.props FROM ${a.rows} a`,
    };
  },

  intersect({ layer: a, areas: b }) {
    return {
      name: `${a.name} inside ${b.name}`,
      shape: a.shape,
      sql: `SELECT ST_CollectionExtract(ST_Intersection(a.geom, b.geom), ${TYPE[a.shape]}) AS geom, b.props || a.props AS props
            FROM ${a.rows} a
            JOIN ${b.rows} b ON ST_Intersects(a.geom, b.geom)`,
    };
  },

  subtract({ layer: a, areas: b }) {
    return {
      name: `${a.name} outside ${b.name}`,
      shape: a.shape,
      sql: `SELECT CASE WHEN m.u IS NULL THEN a.geom
                   ELSE ST_CollectionExtract(ST_Difference(a.geom, m.u), ${TYPE[a.shape]}) END AS geom,
                   a.props
            FROM ${a.rows} a
            CROSS JOIN LATERAL (SELECT ST_Union(b.geom) AS u FROM ${b.rows} b WHERE ST_Intersects(a.geom, b.geom)) m`,
    };
  },

  dissolve({ layer: a }, { field }, bind) {
    const merged = a.shape === 'line'
      ? 'ST_LineMerge(ST_CollectionExtract(ST_Union(geom), 2))'
      : 'ST_CollectionExtract(ST_Union(geom), 3)';
    if (!field) {
      return {
        name: `${a.name} dissolved`,
        shape: a.shape,
        sql: `SELECT ${merged} AS geom, jsonb_build_object('count', count(*)) AS props FROM ${a.rows} a`,
      };
    }
    if (typeof field !== 'string') throw badRequest('Pick a property to merge by.');
    const key = bind(field);
    return {
      name: `${a.name} dissolved by ${field}`,
      shape: a.shape,
      sql: `SELECT ${merged} AS geom, jsonb_build_object(${key}::text, v, 'count', count(*)) AS props
            FROM (SELECT a.geom, a.props->>${key}::text AS v FROM ${a.rows} a) s
            GROUP BY v`,
    };
  },

  summarize: summarizeSql,

  centroid({ layer: a }) {
    return {
      name: `${a.name} centroids`,
      shape: 'point',
      sql: `SELECT CASE WHEN ST_Intersects(c.geom, a.geom) THEN c.geom ELSE ST_PointOnSurface(a.geom) END AS geom,
                   a.props
            FROM ${a.rows} a, ST_Centroid(a.geom) AS c(geom)`,
    };
  },

  combine({ layer: a, other: b }) {
    return {
      name: `${a.name} + ${b.name}`,
      shape: a.shape,
      sql: `SELECT a.geom, a.props FROM ${a.rows} a UNION ALL SELECT b.geom, b.props FROM ${b.rows} b`,
    };
  },
};
