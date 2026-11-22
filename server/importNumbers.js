// Numbers written as text, such as "pop_est": "23.5", are common in real
// files (and GDAL writes a property as text when its values mix types). Kept
// as text they can't be filtered as numbers, coloured along a scale or added
// up, so on import a property whose values are all numbers, or empty, is
// stored as numbers.
//
// What counts as a number or as empty is number_text(), a database function
// (migrations/012_number_text.sql), which the same migration used to convert
// layers imported before this. In short: plain numbers convert, empty text
// and "no value" markers such as "n/a" become empty, and a leading zero
// ("007"), a whole number of more than 15 digits or any word keeps the whole
// property as text.

/**
 * Converts, in the import's `staging` table, every property whose values
 * are all numbers, empty, or text number_text() can read, as long as it has
 * some text to convert and at least one number. Its text values become JSON
 * numbers or null; properties with any other text are left exactly as they
 * are.
 *
 * Call it once all of one source layer's features are staged, before they're
 * copied into layers, so the decision is made over every feature.
 *
 * @param {import('pg').PoolClient} db the import's transaction
 * @returns {Promise<string[]>} the names of the properties converted
 */
export async function convertNumberText(db) {
  const text = "(e.value #>> '{}')";
  const { rows } = await db.query(
    `SELECT e.key FROM staging s, jsonb_each(s.props) e
     GROUP BY e.key
     HAVING bool_and(jsonb_typeof(e.value) IN ('number', 'null')
                     OR (jsonb_typeof(e.value) = 'string' AND number_text(${text}) IS NOT NULL))
        AND bool_or(jsonb_typeof(e.value) = 'string')
        AND bool_or(jsonb_typeof(e.value) = 'number' OR jsonb_typeof(number_text(${text})) = 'number')
     ORDER BY e.key`,
  );
  const keys = rows.map((row) => row.key);
  if (!keys.length) return keys;

  // Only the text values of those keys are replaced; numbers and nulls stay.
  await db.query(
    `UPDATE staging s SET props = s.props || coalesce((
       SELECT jsonb_object_agg(k, number_text(s.props->>k))
       FROM unnest($1::text[]) k
       WHERE jsonb_typeof(s.props->k) = 'string'
     ), '{}')
     WHERE s.props ?| $1::text[]`,
    [keys],
  );
  return keys;
}
