// Running an analysis tool: checking the request, loading the layers it
// picks, and storing what the tool's SQL (toolSql.js) produces as a new layer
// in the same map, all in one transaction.
import { TOOLS } from '../shared/spec.js';
import { transaction } from './db.js';
import { badRequest } from './errors.js';
import { filterSql } from './filter/sql.js';
import { createLayer } from './layers.js';
import { checkNumbers } from './toolChecks.js';
import { SQL } from './toolSql.js';
import { parseId, parseLayerName } from './validation.js';

/**
 * Runs tool `id` on layers of map `mapId` and returns the new layer.
 *
 * Each picked layer contributes only the features its filter lets through,
 * so a tool works on what the map shows. The result is named after them,
 * with "(filtered)" for a filtered layer, unless `params.name` is given.
 *
 * A property to add up (a field marked `numbers`) is checked first (see
 * checkNumbers): one with no numbers at all is refused, and one with some
 * text gives a warning.
 *
 * @param {number} mapId
 * @param {string} id one of TOOLS in shared/spec.js
 * @param {Record<string, unknown>} params the tool's fields, by key, and an optional `name`
 * @returns {Promise<object>} the new layer, with `warnings`: things to tell
 *   the person about the result (usually none)
 */
export async function runTool(mapId, id, params = {}) {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool || !Object.hasOwn(SQL, id)) throw badRequest(`Unknown tool: ${id}`);
  if (typeof params !== 'object' || params === null) throw badRequest('Expected a JSON object.');
  const custom = parseLayerName(params.name);

  return transaction(async (db) => {
    // The query's parameters, shared by the layers' subqueries, the tool's
    // own values and the new layer's id.
    const args = [];
    const bind = (value) => `$${args.push(value)}`;

    const picked = {};
    for (const field of tool.fields) {
      const shapes = field.shapes ?? (field.sameShapeAs && [picked[field.sameShapeAs].shape]);
      if (shapes) picked[field.key] = withRows(await loadLayer(db, mapId, params[field.key], field.label, shapes), args);
    }
    const warnings = [];
    for (const field of tool.fields) {
      if (!field.numbers || !params[field.key] || typeof params[field.key] !== 'string') continue;
      const warning = await checkNumbers(db, picked[field.fieldOf], params[field.key]);
      if (warning) warnings.push(warning);
    }
    const { name, shape, sql } = SQL[id](picked, params, bind);
    const layer = await createLayer(db, mapId, custom || name, shape);

    const { rowCount } = await db.query(
      `INSERT INTO features (layer_id, geom, props)
       SELECT ${bind(layer.id)}, geom, props FROM (${sql}) r
       WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)`,
      args,
    );
    if (!rowCount) {
      const filtered = Object.values(picked).some((l) => l.filter);
      throw badRequest(`That produced no features.${filtered ? ' Check the filters on the layers you picked.' : ''}`);
    }
    return { ...layer, warnings };
  });
}

// Only layers in the tool's own map can be picked.
async function loadLayer(db, mapId, id, label, shapes) {
  const { rows: [layer] } = await db.query('SELECT * FROM layers WHERE id = $1 AND map_id = $2', [parseId(id), mapId]);
  if (!layer) throw badRequest(`Pick a layer for "${label}".`);
  if (!shapes.includes(layer.shape)) throw badRequest(`"${layer.name}" must be a ${shapes.join(' or ')} layer.`);
  return layer;
}

// The layer as the tools see it (see toolSql.js): `rows` is a subquery of the
// features its filter lets through, and a filtered layer's name says so.
function withRows(layer, args) {
  const rows = `(SELECT f.id, f.geom, f.props FROM features f
                 WHERE f.layer_id = $${args.push(layer.id)} AND ${filterSql(layer.filter, args)})`;
  return { ...layer, rows, name: layer.filter ? `${layer.name} (filtered)` : layer.name };
}
