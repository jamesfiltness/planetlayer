-- Limits on map and layer names, matching MAX_MAP_NAME and MAX_LAYER_NAME in
-- shared/limits.js, which the server checks first. Layers had no limit at
-- all, and could have a blank name.
--
-- Names already longer are cut short the way fitLayerName in validation.js
-- does it (199 characters and an ellipsis), and blank layer names become
-- "Untitled layer", so the CHECKs can be added to any existing database.
UPDATE maps SET name = rtrim(left(name, 199)) || '…' WHERE char_length(name) > 200;

UPDATE layers SET name = 'Untitled layer' WHERE btrim(name) = '';
UPDATE layers SET name = rtrim(left(name, 199)) || '…' WHERE char_length(name) > 200;

ALTER TABLE maps ADD CHECK (char_length(name) <= 200);
ALTER TABLE layers ADD CHECK (btrim(name) <> '' AND char_length(name) <= 200);
