// A positive Postgres integer, or null. Callers treat null like a missing row,
// so an id that can't be valid gets the same 404 as one that doesn't exist.
export function parseId(value: unknown): number | null {
  const n = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 2 ** 31 - 1 ? n : null;
}
