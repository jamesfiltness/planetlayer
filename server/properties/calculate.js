// Calculate property: works out a value for every feature of a layer from
// an expression (see shared/expression.js) and stores it as a property,
// new or existing. It's the field calculator of GIS tools, used for things
// like people per building or turning square metres into hectares.
import { ExpressionError, parseExpression } from '../../shared/expression.js';
import { transaction } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { touchLayerData } from '../layers.js';
import { parseId } from '../validation.js';
import { expressionProperties, expressionSql } from './expressionSql.js';
import { parsePropertyName } from './name.js';

// Postgres's "data exception" errors, such as a number too large for a
// double; the expression is at fault, not the app.
const DATA_EXCEPTION = /^22/;

/**
 * Sets property `name` of every feature in the layer (whatever its filter)
 * to the value of `expression` for that feature, replacing the property if
 * it exists. Where the value can't be worked out, as when a property it
 * reads is empty or text, the property is set but empty (null).
 *
 * @param {number | string} layerId
 * @param {{ name: unknown, expression: unknown }} request
 * @returns {Promise<{ name: string, numbers: number, empty: number }>} the
 *   property's name, and how many features got a number and how many an
 *   empty value
 */
export async function calculateProperty(layerId, { name, expression }) {
  const id = parseId(layerId);
  const property = parsePropertyName(typeof name === 'string' ? name.trim() : name);
  let tree;
  try {
    tree = parseExpression(expression);
  } catch (error) {
    if (error instanceof ExpressionError) throw badRequest(error.message);
    throw error;
  }

  return transaction(async (db) => {
    const { rows: [layer] } = await db.query('SELECT map_id FROM layers WHERE id = $1 FOR UPDATE', [id]);
    if (!layer) throw notFound('That layer no longer exists.');

    // A misspelt property would quietly make every value empty, so each one
    // read must exist on at least one feature.
    const { rows: missing } = await db.query(
      `SELECT k FROM unnest($2::text[]) k
       WHERE NOT EXISTS (SELECT 1 FROM features WHERE layer_id = $1 AND props ? k)`,
      [id, expressionProperties(tree)],
    );
    if (missing.length) {
      const names = missing.map(({ k }) => `"${k}"`).join(', ');
      throw badRequest(`The layer has no ${missing.length === 1 ? 'property' : 'properties'} ${names}. A name with spaces or other characters goes in double quotes.`);
    }

    const args = [id];
    const bind = (value) => `$${args.push(value)}`;
    const value = expressionSql(tree, bind);
    try {
      const { rows: [counts] } = await db.query(
        `WITH updated AS (
           UPDATE features f SET props = f.props || jsonb_build_object(${bind(property)}::text, to_jsonb(${value}))
           WHERE f.layer_id = $1
           RETURNING f.props -> ${bind(property)}::text AS v
         )
         SELECT count(*) FILTER (WHERE jsonb_typeof(v) = 'number')::int AS numbers,
                count(*) FILTER (WHERE jsonb_typeof(v) = 'null')::int AS empty
         FROM updated`,
        args,
      );
      await touchLayerData(db, id);
      return { name: property, ...counts };
    } catch (error) {
      if (DATA_EXCEPTION.test(error.code ?? '')) throw badRequest(`The expression couldn't be worked out: ${error.message}.`);
      throw error;
    }
  });
}
