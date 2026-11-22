-- Numbers written as text, such as "pop_est": "23.5", can't be added up,
-- filtered as numbers or coloured along a scale. Imports store a property
-- as numbers when its values are all numbers written as text (see
-- importNumbers.js). This migration:
--
-- 1. defines number_text(), the one rule for reading such text, so the
--    import and step 2 can't drift apart;
-- 2. converts the layers imported before that rule existed, as a fresh
--    import of the same file would now.

-- What a text value becomes when its property is stored as numbers:
--
-- - a JSON number, for text that is unmistakably a plain number once spaces
--   around it are trimmed: an optional minus, digits with an optional
--   decimal part, and an optional exponent of at most two digits (so it
--   fits a double). A whole number with a leading zero ("007") or more than
--   15 digits isn't one, as it's usually a code or an ID that would lose
--   its zeros or digits. A decimal may have any number of digits.
-- - JSON null (empty), for empty text and the usual ways of writing "no
--   value": n/a, na, null, none and -, in any case.
-- - SQL NULL for anything else, which keeps the whole property as text.
CREATE FUNCTION number_text(t text) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT CASE
    WHEN lower(btrim(t)) IN ('', 'n/a', 'na', 'null', 'none', '-') THEN 'null'::jsonb
    WHEN btrim(t) ~ '^-?(0|[1-9][0-9]*)([.][0-9]+)?([eE][-+]?[0-9]{1,2})?$'
         AND (btrim(t) ~ '[.eE]' OR length(ltrim(btrim(t), '-')) <= 15)
      THEN to_jsonb(btrim(t)::numeric)
  END
$$;

-- A layer's property is converted when every value is a number, empty, or
-- text number_text() can read, and it has some text to convert and at
-- least one number: a property that's only "n/a" stays as it is.
CREATE TEMPORARY TABLE convertible ON COMMIT DROP AS
  SELECT f.layer_id, e.key
  FROM features f, jsonb_each(f.props) e
  GROUP BY f.layer_id, e.key
  HAVING bool_and(jsonb_typeof(e.value) IN ('number', 'null')
                  OR (jsonb_typeof(e.value) = 'string' AND number_text(e.value #>> '{}') IS NOT NULL))
     AND bool_or(jsonb_typeof(e.value) = 'string')
     AND bool_or(jsonb_typeof(e.value) = 'number' OR jsonb_typeof(number_text(e.value #>> '{}')) = 'number');

-- Only the text values of those properties change; numbers and nulls stay.
-- Each changed layer's data_version goes up, so open browsers fetch it again.
WITH updated AS (
  UPDATE features f SET props = f.props || c.converted
  FROM (
    SELECT f2.id, jsonb_object_agg(c.key, number_text(f2.props ->> c.key)) AS converted
    FROM convertible c JOIN features f2 ON f2.layer_id = c.layer_id AND jsonb_typeof(f2.props -> c.key) = 'string'
    GROUP BY f2.id
  ) c
  WHERE f.id = c.id
  RETURNING f.layer_id
)
UPDATE layers SET data_version = data_version + 1 WHERE id IN (SELECT layer_id FROM updated);
