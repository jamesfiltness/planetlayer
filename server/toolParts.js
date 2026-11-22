// SQL pieces shared by several analysis tools (see toolSql.js).
import { UNITS } from '../shared/spec.js';
import { badRequest } from './errors.js';

/** The longest distance a tool accepts, in metres. */
export const MAX_METRES = 100_000;

/**
 * A distance from a tool's `distance` and `unit` fields, in metres. Throws
 * a 400 unless it's a number of at most MAX_METRES. It must be above zero,
 * or at least zero with `zero` (where zero means "touching").
 *
 * @param {unknown} distance
 * @param {unknown} unit one of UNITS
 * @param {{ zero?: boolean }} [options]
 */
export function parseMetres(distance, unit, { zero = false } = {}) {
  if (!Object.hasOwn(UNITS, unit)) throw badRequest(`Unknown unit: ${unit}`);
  const metres = Number(distance) * UNITS[unit];
  if (!Number.isFinite(metres) || metres < 0 || (!zero && metres === 0) || metres > MAX_METRES) {
    throw badRequest(`Distance must be ${zero ? 'zero or more' : 'more than zero'}, and at most ${MAX_METRES / 1000} km.`);
  }
  return metres;
}

/**
 * True where geometries `a` and `b` (SQL expressions in WGS84) are within
 * `metres` (a placeholder) of each other on the ground.
 *
 * Distances on the ground need geography, which the (layer_id, geom) index
 * can't serve, so a bounding-box test (&&) on `a`'s box, grown by at least
 * that distance in degrees, picks the candidates first. A degree of
 * longitude shrinks towards the poles, so the box is grown by the distance
 * in degrees of longitude at `a`'s latitude furthest from the equator
 * (capped at 85°), which is never less than it is in degrees of latitude.
 */
export function withinMetres(a, b, metres) {
  const lat = `least(85, greatest(abs(ST_YMin(${a})), abs(ST_YMax(${a}))))`;
  const degrees = `(${metres} / (111320 * cos(radians(${lat}))))`;
  return `(${b} && ST_Expand(${a}, ${degrees}) AND ST_DWithin(${a}::geography, ${b}::geography, ${metres}))`;
}

/**
 * Where a feature `geom` is, for counting it once: a point is itself, and a
 * line or area is its centre (its centroid, or a point on it when the
 * centroid falls outside it, as in the Centroid tool).
 */
export const centre = (geom) =>
  `CASE WHEN ST_Intersects(ST_Centroid(${geom}), ${geom}) THEN ST_Centroid(${geom}) ELSE ST_PointOnSurface(${geom}) END`;

/**
 * The properties `own` (a jsonb SQL expression) with those of `other`
 * added. Where both have a property, `own` keeps its value and `other`'s is
 * added as `<name>_2`, so neither is lost (a `<name>_2` already in `own` is
 * replaced). A null `other` adds nothing.
 */
export const mergeProps = (own, other) =>
  `(${own} || coalesce((SELECT jsonb_object_agg(CASE WHEN ${own} ? e.key THEN e.key || '_2' ELSE e.key END, e.value)
                        FROM jsonb_each(${other}) e), '{}'::jsonb))`;
