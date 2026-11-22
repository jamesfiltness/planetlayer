// Turns a parsed expression (see shared/expression.js) into SQL that works
// out its value for one feature, `f`. Property names and numbers are bound
// as parameters, and only the operators and functions the parser allows are
// written into the SQL, so an expression can't run anything else.
//
// Values follow the usual rules of field calculators with empty values:
//
// - a property counts only where it's stored as a number; text, true/false
//   and missing values are empty (null), as in filters and Summarize.
//   number(property) also reads numbers written as text.
// - arithmetic with an empty value is empty, and so is dividing by zero
// - min() and max() skip empty values, and are empty only if all are
//
// The result is a float8 (double), or null.

const OPERATORS = new Set(['+', '-', '*', '/']);

// Text number() reads as a number, once spaces around it are trimmed: an
// optional sign, digits with an optional decimal part (or a bare decimal
// part, as in ".5") and an optional exponent of at most two digits, so it
// always fits a double. Unlike an import (see number_text() in
// migrations/012_number_text.sql), it takes leading zeros and long whole
// numbers too: asking for a number says the text is one.
const NUMBER_TEXT = '^[-+]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][-+]?[0-9]{1,2})?$';

/**
 * @param {object} tree from parseExpression
 * @param {(value: unknown) => string} bind adds a parameter, returning its placeholder
 * @returns {string} a SQL expression of type float8
 */
export function expressionSql(tree, bind) {
  const sql = (node) => {
    switch (node.type) {
      case 'number':
        return `${bind(node.value)}::float8`;
      case 'property': {
        const key = `${bind(node.name)}::text`;
        return `(CASE WHEN jsonb_typeof(f.props -> ${key}) = 'number' THEN (f.props ->> ${key})::float8 END)`;
      }
      case 'negate':
        return `(-${sql(node.arg)})`;
      case 'binary':
        if (!OPERATORS.has(node.op)) throw new Error(`Unknown operator ${node.op}`);
        return node.op === '/' ? `(${sql(node.left)} / NULLIF(${sql(node.right)}, 0))` : `(${sql(node.left)} ${node.op} ${sql(node.right)})`;
      case 'call':
        return node.name === 'number' ? numberSql(`${bind(node.args[0].name)}::text`) : call(node.name, node.args.map(sql));
      default:
        throw new Error(`Unknown expression node ${node.type}`);
    }
  };
  return sql(tree);
}

// number(property): its number, or its text read as one, or null.
function numberSql(key) {
  const value = `f.props -> ${key}`;
  const trimmed = `btrim(f.props ->> ${key})`;
  return `(CASE WHEN jsonb_typeof(${value}) = 'number' THEN (f.props ->> ${key})::float8
                WHEN jsonb_typeof(${value}) = 'string' AND ${trimmed} ~ '${NUMBER_TEXT}' THEN ${trimmed}::float8 END)`;
}

// A function's SQL. round works on numeric, which rounds halves away from
// zero (2.5 → 3), as people expect; float8 would round them to even.
function call(name, args) {
  switch (name) {
    case 'round':
      return args.length === 1
        ? `round(${args[0]}::numeric)::float8`
        : `round(${args[0]}::numeric, trunc(${args[1]})::int)::float8`;
    case 'abs':
      return `abs(${args[0]})`;
    case 'min':
      return `LEAST(${args.join(', ')})`;
    case 'max':
      return `GREATEST(${args.join(', ')})`;
    default:
      throw new Error(`Unknown function ${name}`);
  }
}

/** The names of the properties an expression's tree reads, each once. */
export function expressionProperties(tree) {
  const names = new Set();
  const visit = (node) => {
    if (node.type === 'property') names.add(node.name);
    else if (node.type === 'negate') visit(node.arg);
    else if (node.type === 'binary') {
      visit(node.left);
      visit(node.right);
    } else if (node.type === 'call') node.args.forEach(visit);
  };
  visit(tree);
  return [...names];
}
