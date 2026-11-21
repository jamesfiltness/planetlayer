// Layer filters, used by both the server (which checks and runs them) and the
// client (which builds them in the layer editor's Filter tab).
//
// A filter is `{ match: 'all' | 'any', conditions: [{ field, op, value }] }`,
// and a layer with no filter has `null`. Each condition tests one property of
// a feature; `match` says whether a feature must pass every condition or just
// one of them.
//
// Rules every operator follows:
// - A property is *empty* when the feature doesn't have it, its value is
//   null, or its value is the empty string.
// - The negative operators (`ne`, `not_contains`, `not_in`) match features
//   that don't have the property at all.
// - The number operators only match values stored as numbers, so "less than
//   5" never matches the text "3". (Import stores a property as numbers when
//   all its values are numbers written as text; see server/importNumbers.js.)
// - `eq`, `ne`, `in` and `not_in` compare by the type of the value given: a
//   number to numbers, text to the property's text, true or false to booleans.
// - Text operators ignore case.

/** The property types the Filter tab tells apart. A field holding more than one type is `mixed`, and is filtered as text. */
export const FIELD_TYPES = ['string', 'number', 'boolean', 'mixed'];

/** How a feature must match a filter's conditions: every one of them, or at least one. */
export const FILTER_MATCHES = ['all', 'any'];

export const MAX_FILTER_CONDITIONS = 20;
export const MAX_FILTER_VALUES = 200; // in one "is one of" list
const MAX_TEXT = 1000; // characters, in a property name or text value

/**
 * The most bytes a whole filter can take up, sent as the body of a save.
 *
 * The limits above allow far bigger filters than anyone builds by hand, so
 * this is what really bounds one. It's set by the browser: a save still
 * waiting when the page closes is sent with `keepalive`, and the browser
 * refuses keepalive requests over 64 KiB in total. This leaves room for the
 * other saves (styles, the map's view) going out at the same moment.
 */
export const MAX_FILTER_BYTES = 48 * 1024;

/**
 * Whether `filter` is too big to save (see MAX_FILTER_BYTES), measured as
 * its save request's body: `{ "filter": … }` in UTF-8.
 */
export const filterTooBig = (filter) => new TextEncoder().encode(JSON.stringify({ filter })).length > MAX_FILTER_BYTES;

/** What the user is told when filterTooBig is true. */
export const FILTER_TOO_BIG = 'This filter is too big to save. Use fewer conditions or values.';

const ANY_TYPE = ['string', 'number', 'boolean', 'mixed'];
const TEXT = ['string', 'mixed'];
const NUMBER = ['number'];

/**
 * Every operator a condition can use.
 *
 * - `types`: the field types the Filter tab offers it for.
 * - `value`: the shape of the condition's value: `none`, `one` value, `two`
 *   numbers (a range, ends included) or `many` values (a list).
 * - `accepts`: the JavaScript types its value (or each item of it) can have.
 */
export const FILTER_OPS = [
  { id: 'eq', label: 'is', types: ANY_TYPE, value: 'one', accepts: ['string', 'number', 'boolean'] },
  { id: 'ne', label: 'is not', types: ANY_TYPE, value: 'one', accepts: ['string', 'number', 'boolean'] },
  { id: 'lt', label: 'is less than', types: NUMBER, value: 'one', accepts: ['number'] },
  { id: 'lte', label: 'is at most', types: NUMBER, value: 'one', accepts: ['number'] },
  { id: 'gt', label: 'is more than', types: NUMBER, value: 'one', accepts: ['number'] },
  { id: 'gte', label: 'is at least', types: NUMBER, value: 'one', accepts: ['number'] },
  { id: 'between', label: 'is between', types: NUMBER, value: 'two', accepts: ['number'] },
  { id: 'contains', label: 'contains', types: TEXT, value: 'one', accepts: ['string'] },
  { id: 'not_contains', label: "doesn't contain", types: TEXT, value: 'one', accepts: ['string'] },
  { id: 'starts_with', label: 'starts with', types: TEXT, value: 'one', accepts: ['string'] },
  { id: 'ends_with', label: 'ends with', types: TEXT, value: 'one', accepts: ['string'] },
  { id: 'in', label: 'is one of', types: [...TEXT, 'number'], value: 'many', accepts: ['string', 'number'] },
  { id: 'not_in', label: 'is not one of', types: [...TEXT, 'number'], value: 'many', accepts: ['string', 'number'] },
  { id: 'empty', label: 'is empty', types: ANY_TYPE, value: 'none', accepts: [] },
  { id: 'not_empty', label: 'is not empty', types: ANY_TYPE, value: 'none', accepts: [] },
];

const OPS = Object.fromEntries(FILTER_OPS.map((op) => [op.id, op]));

/** The operator with this id, or undefined. */
export const filterOp = (id) => (typeof id === 'string' && Object.hasOwn(OPS, id) ? OPS[id] : undefined);

/** The operators offered for a field of this type (see FIELD_TYPES). */
export const opsForType = (type) => FILTER_OPS.filter((op) => op.types.includes(type));

/**
 * What's wrong with a condition, as a message for the user, or null if it's
 * complete and valid. The client uses this to tell finished conditions from
 * ones still being filled in; the server rejects any condition it fails.
 */
export function conditionProblem(condition) {
  const { field, op: id, value } = condition ?? {};
  if (typeof field !== 'string' || !field) return 'Pick a property.';
  if (field.length > MAX_TEXT) return `Property names can be at most ${MAX_TEXT} characters.`;
  const op = filterOp(id);
  if (!op) return 'Pick a comparison.';

  switch (op.value) {
    case 'none':
      return null;
    case 'one':
      return valueProblem(value, op.accepts);
    case 'two':
      if (!Array.isArray(value) || value.length !== 2) return 'Enter both ends of the range.';
      return valueProblem(value[0], op.accepts) ?? valueProblem(value[1], op.accepts);
    case 'many': {
      if (!Array.isArray(value) || !value.length) return 'Pick at least one value.';
      if (value.length > MAX_FILTER_VALUES) return `Pick at most ${MAX_FILTER_VALUES} values.`;
      if (new Set(value.map((v) => typeof v)).size > 1) return 'The values must be all numbers or all text.';
      for (const item of value) {
        const problem = valueProblem(item, op.accepts);
        if (problem) return problem;
      }
      return null;
    }
  }
}

function valueProblem(value, accepts) {
  if (value === '' || value === null || value === undefined) return 'Enter a value.';
  if (!accepts.includes(typeof value)) return accepts.length === 1 && accepts[0] === 'number' ? 'Enter a number.' : 'Enter a value.';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'Enter a number.';
  if (typeof value === 'string' && value.length > MAX_TEXT) return `Values can be at most ${MAX_TEXT} characters.`;
  return null;
}
