// Checks a tool makes on the data it's given, before running, so it doesn't
// quietly give a misleading answer.
import { badRequest } from './errors.js';
import { filterSql } from './filter/sql.js';

// What to do about numbers stored as text, for the error and the warning.
const FIX = 'Recalculate it as number(<property>) first, in the layer editor\'s Properties tab (or with calculate_property).';

/**
 * Checks that property `field` of a layer's features, those its filter lets
 * through, holds numbers to add up. Text such as "23.5" isn't added up, so:
 *
 * - if it holds text and no numbers at all, the tool would give only zeros
 *   or empty values, so this throws a 400 saying so;
 * - if it holds some of each, it resolves to a warning saying how many
 *   values were left out;
 * - otherwise it resolves to null.
 *
 * Empty values and features without the property aren't counted either way.
 *
 * @param {import('pg').PoolClient} db
 * @param {{ id: number, filter: object | null }} layer as loaded from the layers table
 * @param {string} field
 * @returns {Promise<string | null>}
 */
export async function checkNumbers(db, layer, field) {
  const args = [layer.id, field];
  const { rows: [{ numbers, texts }] } = await db.query(
    `SELECT count(*) FILTER (WHERE jsonb_typeof(f.props -> $2::text) = 'number')::int AS numbers,
            count(*) FILTER (WHERE jsonb_typeof(f.props -> $2::text) IN ('string', 'boolean'))::int AS texts
     FROM features f WHERE f.layer_id = $1 AND ${filterSql(layer.filter, args)}`,
    args,
  );
  if (!texts) return null;
  if (!numbers) throw badRequest(`"${field}" has no numbers to add up: its values are stored as text. ${FIX}`);
  return `${texts} of the ${numbers + texts} values of "${field}" aren't numbers and were left out. ${FIX}`;
}
