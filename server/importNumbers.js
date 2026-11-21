// Numbers written as text, such as "pop_est": "23.5", are common in real
// files (and GDAL writes a property as text when its values mix types). Kept
// as text they can't be filtered as numbers, coloured along a scale or added
// up, so on import a property whose every value looks like a number is
// stored as numbers instead.
//
// Only text that is unmistakably a plain number is converted. Text with a
// leading zero ("007") is left alone because it's usually a code, and so is a
// whole number of more than 15 digits, which is usually an ID that would lose
// digits as a number. (A decimal may have any number of digits: rounding its
// last ones, as "23.23288965934862" may be, doesn't matter.) Exponents are
// limited to two digits, so every converted value also fits a double ("1e400"
// stays text).
const NUMBER = '^-?(0|[1-9][0-9]*)([.][0-9]+)?([eE][-+]?[0-9]{1,2})?$';
const MAX_WHOLE_DIGITS = 15;

// True when the text `t` (a SQL expression) is a number we convert. The CASE
// makes sure the digits are only counted once the pattern has matched.
const isNumberText = (t) =>
  `CASE WHEN ${t} ~ $1 THEN ${t} ~ '[.eE]' OR length(ltrim(${t}, '-')) <= $2 ELSE false END`;

/**
 * Converts, in the import's `staging` table, every property whose values are
 * all numbers, numbers written as text, empty text or null, as long as at
 * least one is a number written as text. The text becomes a JSON number and
 * empty text becomes null (an empty value, as filters already treat it).
 * Properties with any other text are left exactly as they are.
 *
 * Call it once all of one source layer's features are staged, before they're
 * copied into layers, so the decision is made over every feature.
 *
 * @param {import('pg').PoolClient} db the import's transaction
 * @returns {Promise<string[]>} the names of the properties converted
 */
export async function convertNumberText(db) {
  const text = "(e.value #>> '{}')";
  const isText = "jsonb_typeof(e.value) = 'string'";
  const { rows } = await db.query(
    `SELECT e.key FROM staging s, jsonb_each(s.props) e
     GROUP BY e.key
     HAVING bool_and(jsonb_typeof(e.value) IN ('number', 'null')
                     OR (${isText} AND (${text} = '' OR ${isNumberText(text)})))
        AND bool_or(${isText} AND ${text} <> '')
     ORDER BY e.key`,
    [NUMBER, MAX_WHOLE_DIGITS],
  );
  const keys = rows.map((row) => row.key);
  if (!keys.length) return keys;

  // Only the text values of those keys are replaced; numbers and nulls stay.
  await db.query(
    `UPDATE staging s SET props = s.props || coalesce((
       SELECT jsonb_object_agg(k, CASE WHEN s.props->>k = '' THEN 'null'::jsonb ELSE to_jsonb((s.props->>k)::numeric) END)
       FROM unnest($1::text[]) k
       WHERE jsonb_typeof(s.props->k) = 'string'
     ), '{}')
     WHERE s.props ?| $1::text[]`,
    [keys],
  );
  return keys;
}
