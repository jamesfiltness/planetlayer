// Turns a layer filter into SQL. This is the one place a filter's meaning is
// defined: the layer's GeoJSON, its count of matching features and "Save as
// new layer" all use it, so what's drawn, counted and saved always agree.
// The rules it follows are described in shared/filter.js.

/**
 * A boolean SQL expression that is true for the rows of `features f` that
 * match `filter`, or `true` for no filter. The filter must already have been
 * checked by parseFilter.
 *
 * The values it needs are appended to `args`, and the expression refers to
 * them by position, so pass the same array to the query. Property names and
 * values are only ever bound as parameters; the SQL text is made of constants.
 *
 * @param {{ match: 'all' | 'any', conditions: object[] } | null} filter
 * @param {unknown[]} args the query's parameters so far; added to in place
 * @returns {string}
 */
export function filterSql(filter, args) {
  if (!filter) return 'true';
  const bind = (value) => `$${args.push(value)}`;
  const parts = filter.conditions.map((condition) => `(${conditionSql(condition, bind)})`);
  return `(${parts.join(filter.match === 'any' ? ' OR ' : ' AND ')})`;
}

// Negative operators are the positive ones turned around. The positive form
// is NULL when the property is missing, so coalesce makes it false and the
// negation true: "is not X" matches features without the property.
const NEGATIONS = { ne: 'eq', not_contains: 'contains', not_in: 'in', not_empty: 'empty' };

const COMPARISONS = { lt: '<', lte: '<=', gt: '>', gte: '>=' };

function conditionSql({ field, op, value }, bind) {
  if (Object.hasOwn(NEGATIONS, op)) {
    return `NOT coalesce(${conditionSql({ field, op: NEGATIONS[op], value }, bind)}, false)`;
  }

  const key = `${bind(field)}::text`;
  const json = `f.props->${key}`; // the value as jsonb
  const text = `(f.props->>${key})`; // as text: NULL when missing or JSON null
  // As a number, but only when it's stored as one: never cast text.
  const number = `(CASE WHEN jsonb_typeof(${json}) = 'number' THEN (${text})::float8 END)`;
  const lower = `lower(${text})`;

  switch (op) {
    case 'empty':
      return `coalesce(${text}, '') = ''`;
    case 'eq':
      if (typeof value === 'number') return `${number} = ${bind(value)}::float8`;
      if (typeof value === 'boolean') return `${json} = to_jsonb(${bind(value)}::boolean)`;
      return `${text} = ${bind(value)}::text`;
    case 'in':
      return typeof value[0] === 'number'
        ? `${number} = ANY(${bind(value)}::float8[])`
        : `${text} = ANY(${bind(value)}::text[])`;
    case 'between':
      return `${number} BETWEEN ${bind(value[0])}::float8 AND ${bind(value[1])}::float8`;
    case 'contains':
      return `strpos(${lower}, lower(${bind(value)}::text)) > 0`;
    case 'starts_with':
      return `starts_with(${lower}, lower(${bind(value)}::text))`;
    case 'ends_with': {
      const end = bind(value);
      return `right(${lower}, length(${end}::text)) = lower(${end}::text)`;
    }
    default:
      if (Object.hasOwn(COMPARISONS, op)) return `${number} ${COMPARISONS[op]} ${bind(value)}::float8`;
      throw new Error(`Unknown filter operator: ${op}`);
  }
}
