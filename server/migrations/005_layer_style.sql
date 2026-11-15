-- Each layer's style, editable from the layer editor. The single `color`
-- becomes the fill colour, and the values the client used to hard-code for
-- each shape become the starting values of the new columns, so existing
-- layers look the same as before.
--
-- A line layer has no fill: only its outline columns and opacity are drawn.
ALTER TABLE layers RENAME COLUMN color TO fill_color;

ALTER TABLE layers
  ADD COLUMN fill_opacity double precision,
  ADD COLUMN outline_color text,
  ADD COLUMN outline_width double precision,
  ADD COLUMN opacity double precision;

UPDATE layers SET
  fill_opacity = CASE shape WHEN 'polygon' THEN 0.35 ELSE 1 END,
  outline_color = CASE shape WHEN 'point' THEN '#ffffff' ELSE fill_color END,
  outline_width = CASE shape WHEN 'line' THEN 2.5 ELSE 1.5 END,
  opacity = 1;

-- The limits match parseStyle in validation.js.
ALTER TABLE layers
  ALTER COLUMN fill_opacity SET NOT NULL,
  ALTER COLUMN outline_color SET NOT NULL,
  ALTER COLUMN outline_width SET NOT NULL,
  ALTER COLUMN opacity SET NOT NULL,
  ADD CHECK (fill_color ~ '^#[0-9a-f]{6}$'),
  ADD CHECK (fill_opacity BETWEEN 0 AND 1),
  ADD CHECK (outline_color ~ '^#[0-9a-f]{6}$'),
  ADD CHECK (outline_width BETWEEN 0 AND 10),
  ADD CHECK (opacity BETWEEN 0 AND 1);
