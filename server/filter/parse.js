import { conditionProblem, FILTER_MATCHES, FILTER_TOO_BIG, filterOp, filterTooBig, MAX_FILTER_CONDITIONS } from '../../shared/filter.js';
import { badRequest } from '../errors.js';

/**
 * Checks a filter sent by the client and returns a clean copy of it, or null
 * for no filter. See shared/filter.js for its shape and meaning.
 *
 * `match` defaults to `all`. A filter with no conditions is no filter, so it
 * becomes null. A condition with no value (such as "is empty") gets a null
 * one, and a range is put in order, smallest first. Anything malformed is
 * rejected with a message naming the condition at fault, and so is a filter
 * too big to save (see MAX_FILTER_BYTES).
 */
export function parseFilter(value) {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw badRequest('A filter must be an object, or null for none.');

  const { match = 'all', conditions } = value;
  if (!FILTER_MATCHES.includes(match)) throw badRequest(`A filter's match must be ${FILTER_MATCHES.join(' or ')}.`);
  if (!Array.isArray(conditions)) throw badRequest("A filter's conditions must be a list.");
  if (conditions.length > MAX_FILTER_CONDITIONS) throw badRequest(`A filter can have at most ${MAX_FILTER_CONDITIONS} conditions.`);

  const parsed = conditions.map((condition, i) => {
    const problem = conditionProblem(condition);
    if (problem) throw badRequest(`Condition ${i + 1}: ${problem}`);
    return normalize(condition);
  });
  if (!parsed.length) return null;
  const filter = { match, conditions: parsed };
  if (filterTooBig(filter)) throw badRequest(FILTER_TOO_BIG);
  return filter;
}

// Only the known keys are kept, so nothing else is stored.
function normalize({ field, op, value }) {
  switch (filterOp(op).value) {
    case 'none': return { field, op, value: null };
    case 'two': return { field, op, value: [Math.min(...value), Math.max(...value)] };
    case 'many': return { field, op, value: [...value] };
    default: return { field, op, value };
  }
}
