import { badRequest, createLayer, transaction } from './db.js';

// Stored geometries are made valid on import, so the tools use them as they
// are and can lean on the GiST index.
const DIM = { point: 1, line: 2, polygon: 3 };
const UNITS = { m: 1, km: 1000, mi: 1609.344 };

// Each tool checks its inputs and returns the SELECT whose (geom, props) rows
// become the new layer.
const TOOLS = {
  async buffer(load, { layer, distance, unit, merge }) {
    const a = await load(layer);
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

  async intersect(load, { layer, areas }) {
    const a = await load(layer);
    const b = await load(areas, 'polygon');
    return {
      name: `${a.name} inside ${b.name}`,
      shape: a.shape,
      args: [a.id, b.id],
      sql: `SELECT ST_CollectionExtract(ST_Intersection(a.geom, b.geom), ${DIM[a.shape]}) AS geom, b.props || a.props AS props
            FROM features a
            JOIN features b ON b.layer_id = $2 AND a.geom && b.geom AND ST_Intersects(a.geom, b.geom)
            WHERE a.layer_id = $1`,
    };
  },

  async subtract(load, { layer, areas }) {
    const a = await load(layer);
    const b = await load(areas, 'polygon');
    return {
      name: `${a.name} outside ${b.name}`,
      shape: a.shape,
      args: [a.id, b.id],
      sql: `SELECT CASE WHEN m.u IS NULL THEN a.geom
                   ELSE ST_CollectionExtract(ST_Difference(a.geom, m.u), ${DIM[a.shape]}) END AS geom,
                   a.props
            FROM features a
            CROSS JOIN LATERAL (
              SELECT ST_Union(b.geom) AS u FROM features b
              WHERE b.layer_id = $2 AND a.geom && b.geom AND ST_Intersects(a.geom, b.geom)
            ) m
            WHERE a.layer_id = $1`,
    };
  },

  async dissolve(load, { layer, field }) {
    const a = await load(layer, 'line', 'polygon');
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
    return {
      name: `${a.name} dissolved by ${field}`,
      shape: a.shape,
      args: [a.id, field],
      sql: `SELECT ${merged} AS geom, jsonb_build_object($2::text, v, 'count', count(*)) AS props
            FROM (SELECT geom, props->>$2::text AS v FROM features WHERE layer_id = $1) s
            GROUP BY v`,
    };
  },

  async count(load, { areas, points }) {
    const a = await load(areas, 'polygon');
    const b = await load(points, 'point');
    return {
      name: `${a.name} ${b.name} count`,
      shape: 'polygon',
      args: [a.id, b.id],
      sql: `SELECT a.geom, a.props || jsonb_build_object('count', c.n) AS props
            FROM features a
            CROSS JOIN LATERAL (
              SELECT count(*) AS n FROM features b
              WHERE b.layer_id = $2 AND a.geom && b.geom AND ST_Intersects(a.geom, b.geom)
            ) c
            WHERE a.layer_id = $1`,
    };
  },

  async centroid(load, { layer }) {
    const a = await load(layer, 'line', 'polygon');
    return {
      name: `${a.name} centroids`,
      shape: 'point',
      args: [a.id],
      sql: `SELECT CASE WHEN ST_Intersects(ST_Centroid(geom), geom) THEN ST_Centroid(geom)
                   ELSE ST_PointOnSurface(geom) END AS geom,
                   props
            FROM features WHERE layer_id = $1`,
    };
  },

  async combine(load, { layer, other }) {
    const a = await load(layer);
    const b = await load(other, a.shape);
    return {
      name: `${a.name} + ${b.name}`,
      shape: a.shape,
      args: [a.id, b.id],
      sql: 'SELECT geom, props FROM features WHERE layer_id IN ($1, $2)',
    };
  },
};

export async function runTool(tool, params) {
  if (!Object.hasOwn(TOOLS, tool)) throw badRequest(`Unknown tool: ${tool}`);
  return transaction(async (db) => {
    const load = async (id, ...shapes) => {
      const { rows: [layer] } = await db.query('SELECT * FROM layers WHERE id = $1', [Number(id)]);
      if (!layer) throw badRequest('Pick a layer.');
      if (shapes.length && !shapes.includes(layer.shape)) {
        throw badRequest(`"${layer.name}" must be a ${shapes.join(' or ')} layer.`);
      }
      return layer;
    };
    const { name, shape, args, sql } = await TOOLS[tool](load, params);
    const layer = await createLayer(db, params.name?.trim() || name, shape);
    const { rowCount } = await db.query(
      `INSERT INTO features (layer_id, geom, props)
       SELECT $${args.length + 1}, geom, props FROM (${sql}) r
       WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)`,
      [...args, layer.id],
    );
    if (!rowCount) throw badRequest('That produced no features.');
    return layer;
  });
}
