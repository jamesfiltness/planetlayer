-- Each layer's symbology: how its features are coloured and sized from their
-- data, as `{ "type": …, …settings }`. Every existing layer becomes
-- `single`, one colour for every feature, which is how layers were drawn
-- before, so they look the same as they did.
--
-- The value is checked by parseSymbology in symbology.js before it's stored;
-- see shared/symbology.js for the types and their settings.
ALTER TABLE layers
  ADD COLUMN symbology jsonb NOT NULL DEFAULT '{"type": "single"}'
  CHECK (jsonb_typeof(symbology) = 'object' AND jsonb_typeof(symbology -> 'type') = 'string');
