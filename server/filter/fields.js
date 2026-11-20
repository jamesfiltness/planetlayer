import { pool } from '../db.js';
import { notFound } from '../errors.js';
import { parseId } from '../validation.js';

// How many of a field's most common values are listed.
const TOP_VALUES = 100;

const SCALARS = new Set(['string', 'number', 'boolean']);

/**
 * A summary of every property the layer's features have, for building
 * filters: what type of value it holds, its range if it's a number, and its
 * most common values with how many features have each.
 *
 * Unlike the `fields` in listLayers, which samples a few features, this reads
 * every feature, so no property is missed.
 *
 * @returns {Promise<Array<{
 *   name: string,
 *   type: 'string' | 'number' | 'boolean' | 'mixed',
 *   min: number | null, max: number | null,
 *   distinct: number,
 *   values: Array<{ value: string | number | boolean, count: number }>
 * }>>} sorted by name. `type` is `string` for a property that is always
 *   null, and `mixed` for one holding more than one type of value (or
 *   objects or lists). `distinct` counts the different non-null values;
 *   `values` lists at most 100 of them, most common first.
 */
export async function fieldSummaries(layerId) {
  const id = parseId(layerId);
  const { rowCount } = await pool.query('SELECT 1 FROM layers WHERE id = $1', [id]);
  if (!rowCount) throw notFound('That layer no longer exists.');

  const [{ rows: fields }, { rows: values }] = await Promise.all([
    pool.query(
      `SELECT e.key AS name,
              coalesce(array_agg(DISTINCT jsonb_typeof(e.value)) FILTER (WHERE jsonb_typeof(e.value) <> 'null'), '{}') AS types,
              min((e.value #>> '{}')::float8) FILTER (WHERE jsonb_typeof(e.value) = 'number') AS min,
              max((e.value #>> '{}')::float8) FILTER (WHERE jsonb_typeof(e.value) = 'number') AS max,
              count(DISTINCT e.value) FILTER (WHERE jsonb_typeof(e.value) <> 'null')::int AS distinct
       FROM features f, jsonb_each(f.props) e
       WHERE f.layer_id = $1
       GROUP BY e.key ORDER BY e.key`,
      [id],
    ),
    pool.query(
      `SELECT name, value, count FROM (
         SELECT e.key AS name, e.value, count(*)::int AS count,
                row_number() OVER (PARTITION BY e.key ORDER BY count(*) DESC, e.value) AS rank
         FROM features f, jsonb_each(f.props) e
         WHERE f.layer_id = $1 AND jsonb_typeof(e.value) IN ('string', 'number', 'boolean')
         GROUP BY e.key, e.value
       ) s WHERE rank <= $2 ORDER BY name, rank`,
      [id, TOP_VALUES],
    ),
  ]);

  const byName = Map.groupBy(values, (row) => row.name);
  return fields.map(({ name, types, min, max, distinct }) => ({
    name,
    type: fieldType(types),
    min,
    max,
    distinct,
    values: (byName.get(name) ?? []).map(({ value, count }) => ({ value, count })),
  }));
}

function fieldType(types) {
  if (!types.length) return 'string';
  return types.length === 1 && SCALARS.has(types[0]) ? types[0] : 'mixed';
}
