import { badRequest } from './errors.js';

export const MAX_MAP_NAME = 200;

export function parseId(value) {
  const n = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 2 ** 31 - 1 ? n : null;
}

export function parseMapName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw badRequest('Give the map a name.');
  if (name.length > MAX_MAP_NAME) throw badRequest(`Map names can be at most ${MAX_MAP_NAME} characters.`);
  return name;
}
