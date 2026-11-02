import { SHAPES, TOOLS, UNITS } from '../shared/spec.js';
import { transaction } from './db.js';
import { badRequest } from './errors.js';
import { createLayer } from './layers.js';
import { parseId } from './validation.js';

// Stored geometries are made valid on import, so the tools use them as they
// are and can lean on the (layer_id, geom) index.

// ST_CollectionExtract type for each shape.
const TYPE = Object.fromEntries(SHAPES.map((shape, i) => [shape, i + 1]));

// Each tool returns the SELECT whose (geom, props) rows become the new layer.
// Only constants go into the SQL; anything from the request goes in `args`.
const SQL = {
  buffer({ layer: a }, { distance, unit, merge }) {
    if (!Object.hasOwn(UNITS, unit)) throw badRequest(`Unknown unit: ${unit}`);
    const metres = Number(distance) * UNITS[unit];
    if (!metres || Math.abs(metres) > 100_000) throw badRequest('Distance must be non-zero and at most 100 km.');
    if (metres < 0 && a.shape !== 'polygon') throw badRequest('Only area layers can take a negative distance.');
    const buffered = 'ST_Buffer(geom::geography, $2)::geometry';
    return {
      name: `${a.name} buffer`,
      shape: 'polygon',
      args: [a.id, metres],
      sql: merge
        ? `SELECT d.geom, '{}'::jsonb AS props
           FROM (SELECT ST_Union(${buffered}) AS u FROM features WHERE layer_id = $1) x, ST_Dump(x.u) d`
        : `SELECT ST_CollectionExtract(${buffered}, 3) AS geom, props FROM features WHERE layer_id = $1`,
    };
  },

  intersect({ layer: a, areas: b }) {
    return {
      name: `${a.name} inside ${b.name}`,
      shape: a.shape,
      args: [a.id, b.id],
      sql: `SELECT ST_CollectionExtract(ST_Intersection(a.geom, b.geom), ${TYPE[a.shape]}) AS geom, b.props || a.props AS props
            FROM features a
            JOIN features b ON b.layer_id = $2 AND ST_Intersects(a.geom, b.geom)
            WHERE a.layer_id = $1`,
    };
  },

  subtract({ layer: a, areas: b }) {
    return {
      name: `${a.name} outside ${b.name}`,
      shape: a.shape,
      args: [a.id, b.id],
      sql: `SELECT CASE WHEN m.u IS NULL THEN a.geom
                   ELSE ST_CollectionExtract(ST_Difference(a.geom, m.u), ${TYPE[a.shape]}) END AS geom,
                   a.props
            FROM features a
            CROSS JOIN LATERAL (
              SELECT ST_Union(b.geom) AS u FROM features b
              WHERE b.layer_id = $2 AND ST_Intersects(a.geom, b.geom)
            ) m
            WHERE a.layer_id = $1`,
    };
  },

  dissolve({ layer: a }, { field }) {
    const merged = a.shape === 'line'
      ? 'ST_LineMerge(ST_CollectionExtract(ST_Union(geom), 2))'
      : 'ST_CollectionExtract(ST_Union(geom), 3)';
    if (!field) {
      return {
        name: `${a.name} dissolved`,
        shape: a.shape,
        args: [a.id],
        sql: `SELECT ${merged} AS geom, jsonb_build_object('count', count(*)) AS props FROM features WHERE layer_id = $1`,
      };
    }
    if (typeof field !== 'string') throw badRequest('Pick a property to merge by.');
    return {
      name: `${a.name} dissolved by ${field}`,
      shape: a.shape,
      args: [a.id, field],
      sql: `SELECT ${merged} AS geom, jsonb_build_object($2::text, v, 'count', count(*)) AS props
            FROM (SELECT geom, props->>$2::text AS v FROM features WHERE layer_id = $1) s
            GROUP BY v`,
    };
  },

  // A point on the border between two areas counts for both.
  count({ areas: a, points: b }) {
    return {
      name: `${a.name} ${b.name} count`,
      shape: 'polygon',
      args: [a.id, b.id],
      sql: `SELECT a.geom, a.props || jsonb_build_object('count', c.n) AS props
            FROM features a
            CROSS JOIN LATERAL (
              SELECT count(*) AS n FROM features b
              WHERE b.layer_id = $2 AND ST_Intersects(a.geom, b.geom)
            ) c
            WHERE a.layer_id = $1`,
    };
  },

  centroid({ layer: a }) {
    return {
      name: `${a.name} centroids`,
      shape: 'point',
      args: [a.id],
      sql: `SELECT CASE WHEN ST_Intersects(c.geom, f.geom) THEN c.geom ELSE ST_PointOnSurface(f.geom) END AS geom,
                   f.props
            FROM features f, ST_Centroid(f.geom) AS c(geom)
            WHERE f.layer_id = $1`,
    };
  },

  combine({ layer: a, other: b }) {
    return {
      name: `${a.name} + ${b.name}`,
      shape: a.shape,
      args: [a.id, b.id],
      sql: 'SELECT geom, props FROM features WHERE layer_id IN ($1, $2)',
    };
  },
};

export async function runTool(mapId, id, params = {}) {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool || !Object.hasOwn(SQL, id)) throw badRequest(`Unknown tool: ${id}`);
  if (typeof params !== 'object' || params === null) throw badRequest('Expected a JSON object.');

  return transaction(async (db) => {
    const picked = {};
    for (const field of tool.fields) {
      const shapes = field.shapes ?? (field.sameShapeAs && [picked[field.sameShapeAs].shape]);
      if (shapes) picked[field.key] = await loadLayer(db, mapId, params[field.key], field.label, shapes);
    }
    const { name, shape, args, sql } = SQL[id](picked, params);
    const custom = typeof params.name === 'string' ? params.name.trim() : '';
    const layer = await createLayer(db, mapId, custom || name, shape);

    // The new layer's id is bound after the tool's own parameters.
    const target = `$${args.length + 1}`;
    const { rowCount } = await db.query(
      `INSERT INTO features (layer_id, geom, props)
       SELECT ${target}, geom, props FROM (${sql}) r
       WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)`,
      [...args, layer.id],
    );
    if (!rowCount) throw badRequest('That produced no features.');
    return layer;
  });
}

// Only layers in the tool's own map can be picked.
async function loadLayer(db, mapId, id, label, shapes) {
  const { rows: [layer] } = await db.query('SELECT * FROM layers WHERE id = $1 AND map_id = $2', [parseId(id), mapId]);
  if (!layer) throw badRequest(`Pick a layer for "${label}".`);
  if (!shapes.includes(layer.shape)) throw badRequest(`"${layer.name}" must be a ${shapes.join(' or ')} layer.`);
  return layer;
}
