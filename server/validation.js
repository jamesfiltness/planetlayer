import { badRequest } from './errors.js';

/** Longest map name accepted, in characters. */
export const MAX_MAP_NAME = 200;

/**
 * Reads a database id (a `serial` column) from a route parameter or request
 * body. Accepts numbers and numeric strings.
 *
 * @param {unknown} value
 * @returns {number | null} the id, or null if it can't be one: not an
 *   integer, or outside 1 to 2³¹ − 1, which Postgres would reject.
 */
export function parseId(value) {
  const n = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 2 ** 31 - 1 ? n : null;
}

/**
 * Checks a map name from a request and returns it trimmed.
 *
 * @param {unknown} value
 * @returns {string}
 * @throws a 400 error if it isn't a non-empty string of at most MAX_MAP_NAME characters.
 */
export function parseMapName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw badRequest('Give the map a name.');
  if (name.length > MAX_MAP_NAME) throw badRequest(`Map names can be at most ${MAX_MAP_NAME} characters.`);
  return name;
}
