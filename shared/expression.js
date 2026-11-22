// Expressions for the Calculate property tool, such as
// `pop_est / building_count` or `round("area sq km" * 100, 1)`. Used by the
// client, to point out mistakes as they're typed, and by the server, which
// turns the parsed expression into SQL (server/properties/expressionSql.js).
//
// The language is arithmetic on numbers, much like a field calculator's:
//
// - numbers: `12`, `0.5`, `.5`, `1e3`
// - properties: a plain name such as `pop_est` (letters, digits and _, not
//   starting with a digit), or any name in double quotes, such as
//   `"area sq km"` (a " inside is written twice: `"say ""hi"""`)
// - `+ - * /`, with * and / before + and -, a leading minus, and brackets
// - functions: round(x) or round(x, digits), abs(x), min(a, b, …), max(a, b, …)
// - number(property): the property's value as a number, reading numbers
//   written as text ("23.5", " 007 ") too; anything else is empty. It takes
//   a property's name, not a sum, because arithmetic only ever uses numbers
//   (see server/properties/expressionSql.js), so the text would be gone.
//
// Parsing never runs anything: it only builds a tree of plain objects.
//
//   { type: 'number', value }            { type: 'property', name }
//   { type: 'negate', arg }              { type: 'binary', op, left, right }
//   { type: 'call', name, args }

/** The longest expression accepted, in characters. */
export const MAX_EXPRESSION = 1000;

// Each function's name → how many arguments it takes, as [fewest, most].
export const FUNCTIONS = {
  round: [1, 2],
  abs: [1, 1],
  min: [2, 20],
  max: [2, 20],
  number: [1, 1],
};

// How deeply brackets and calls may nest, so a hostile expression can't
// exhaust the stack here or in Postgres.
const MAX_DEPTH = 40;

/** A mistake in an expression; `message` says what and where, for people. */
export class ExpressionError extends Error {}

const TOKEN = /\s*(?:(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|"((?:[^"]|"")*)"|([-+*/(),]))/y;

// Splits the text into tokens: { kind: 'number' | 'name' | 'quoted' | 'symbol', text, at }.
function tokenize(text) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    const start = TOKEN.lastIndex;
    if (!text.slice(start).trim()) break;
    const m = TOKEN.exec(text);
    if (!m) {
      const at = start + (text.slice(start).length - text.slice(start).trimStart().length);
      const bad = text[at];
      throw new ExpressionError(bad === '"' ? `A quoted name starting at character ${at + 1} has no closing ".`
        : `Unexpected "${bad}" at character ${at + 1}.`);
    }
    const at = m.index + m[0].length - m[0].trimStart().length;
    if (m[1] !== undefined) tokens.push({ kind: 'number', text: m[1], at });
    else if (m[2] !== undefined) tokens.push({ kind: 'name', text: m[2], at });
    else if (m[3] !== undefined) tokens.push({ kind: 'quoted', text: m[3].replaceAll('""', '"'), at });
    else tokens.push({ kind: 'symbol', text: m[4], at });
  }
  return tokens;
}

/**
 * Parses an expression into its tree, or throws an ExpressionError saying
 * what's wrong with it.
 *
 * @param {unknown} text
 * @returns {object} the tree's root (see the top of this file)
 */
export function parseExpression(text) {
  if (typeof text !== 'string' || !text.trim()) throw new ExpressionError('Write an expression, such as pop_est / building_count.');
  if (text.length > MAX_EXPRESSION) throw new ExpressionError(`An expression can be at most ${MAX_EXPRESSION} characters.`);
  const tokens = tokenize(text);
  let i = 0;
  const peek = () => tokens[i];
  const isSymbol = (s) => peek()?.kind === 'symbol' && peek().text === s;
  const where = () => (peek() ? `at character ${peek().at + 1}` : 'at the end');
  const expect = (s) => {
    if (!isSymbol(s)) throw new ExpressionError(`Expected "${s}" ${where()}.`);
    i++;
  };

  // Each level of the grammar, loosest first: sums, then products, then a
  // leading minus, then a single value.
  function sum(depth) {
    let left = product(depth);
    while (isSymbol('+') || isSymbol('-')) {
      const op = tokens[i++].text;
      left = { type: 'binary', op, left, right: product(depth) };
    }
    return left;
  }
  function product(depth) {
    let left = unary(depth);
    while (isSymbol('*') || isSymbol('/')) {
      const op = tokens[i++].text;
      left = { type: 'binary', op, left, right: unary(depth) };
    }
    return left;
  }
  function unary(depth) {
    if (depth > MAX_DEPTH) throw new ExpressionError('The expression is nested too deeply.');
    if (isSymbol('-')) {
      i++;
      return { type: 'negate', arg: unary(depth + 1) };
    }
    if (isSymbol('+')) {
      i++;
      return unary(depth + 1);
    }
    return value(depth);
  }
  function value(depth) {
    const token = peek();
    if (!token) throw new ExpressionError('The expression ends too soon.');
    if (token.kind === 'number') {
      i++;
      const number = Number(token.text);
      if (!Number.isFinite(number)) throw new ExpressionError(`${token.text} is too large a number.`);
      return { type: 'number', value: number };
    }
    if (token.kind === 'quoted') {
      i++;
      return { type: 'property', name: token.text };
    }
    if (token.kind === 'name') {
      i++;
      if (!isSymbol('(')) return { type: 'property', name: token.text };
      return call(token, depth);
    }
    if (isSymbol('(')) {
      i++;
      const inner = sum(depth + 1);
      expect(')');
      return inner;
    }
    throw new ExpressionError(`Unexpected "${token.text}" ${where()}.`);
  }
  function call(token, depth) {
    const name = token.text.toLowerCase();
    if (!Object.hasOwn(FUNCTIONS, name)) {
      throw new ExpressionError(`There's no function "${token.text}". Use ${Object.keys(FUNCTIONS).join(', ')}, or put a property's name in double quotes.`);
    }
    i++; // the (
    const args = [];
    while (!isSymbol(')')) {
      args.push(sum(depth + 1));
      if (!isSymbol(',')) break;
      i++; // the ,
    }
    expect(')');
    const [fewest, most] = FUNCTIONS[name];
    if (args.length < fewest || args.length > most) {
      const wanted = fewest === most ? `${fewest}` : most > 2 ? `at least ${fewest}` : `${fewest} or ${most}`;
      throw new ExpressionError(`${name}() takes ${wanted} ${most === 1 ? 'value' : 'values'}.`);
    }
    if (name === 'number' && args[0].type !== 'property') {
      throw new ExpressionError('number() takes a property\'s name, such as number(pop_est).');
    }
    return { type: 'call', name, args };
  }

  const tree = sum(0);
  if (peek()) throw new ExpressionError(`Unexpected "${peek().text}" ${where()}.`);
  return tree;
}

/**
 * How to write property `name` in an expression: as it is when it's a plain
 * name (and not a function's), else in double quotes, with any " doubled.
 */
export function propertyReference(name) {
  const plain = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !Object.hasOwn(FUNCTIONS, name.toLowerCase());
  return plain ? name : `"${name.replaceAll('"', '""')}"`;
}
