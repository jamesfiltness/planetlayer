// Spatial join: gives each feature the properties of the nearest feature of
// another layer within a search distance, as ArcGIS's Spatial Join does with
// its "closest" match option. Such as giving each settlement the id of its
// nearest water pump, so the settlements can then be totalled by pump with
// each counted once.
import { UNITS } from '../shared/spec.js';
import { mergeProps, parseMetres, withinMetres } from './toolParts.js';

/**
 * The tool's SQL, built like the others in toolSql.js.
 *
 * Every feature of `layer` is kept, with its own shape and properties. The
 * nearest feature of `join` within the distance (measured between the
 * shapes, on the ground; zero means touching) adds its properties, a name
 * the feature already has getting `_2`, and `join_distance_<unit>`, how far
 * away it is, such as `join_distance_km`. A feature with nothing in reach
 * gets neither. Ties go to the join feature added first. With the same
 * layer picked twice, a feature never joins itself.
 *
 * @param {{ layer: object, join: object }} picked
 * @param {{ distance: unknown, unit: unknown }} params
 * @param {(value: unknown) => string} bind
 */
export function spatialJoinSql({ layer: a, join: b }, { distance, unit }, bind) {
  const metres = bind(parseMetres(distance, unit, { zero: true }));
  const self = a.id === b.id ? ' AND b.id <> a.id' : '';
  const distanceKey = bind(`join_distance_${unit}`);
  const inUnit = `round((j.d / ${bind(UNITS[unit])}::float8)::numeric, 3)`;
  return {
    name: `${a.name} joined to ${b.name}`,
    shape: a.shape,
    sql: `SELECT a.geom,
                 ${mergeProps('a.props', 'j.props')}
                   || CASE WHEN j.d IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(${distanceKey}::text, ${inUnit}) END AS props
          FROM ${a.rows} a
          LEFT JOIN LATERAL (
            SELECT b.props, ST_Distance(a.geom::geography, b.geom::geography) AS d
            FROM ${b.rows} b
            WHERE ${withinMetres('a.geom', 'b.geom', metres)}${self}
            ORDER BY d, b.id
            LIMIT 1
          ) j ON true`,
  };
}
