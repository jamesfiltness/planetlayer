-- Maps: each layer now belongs to exactly one map, and deleting a map deletes
-- its layers (and, through layers, their features).
--
-- Layers created before maps existed are moved into a single map called
-- "My map", so upgrading keeps every layer. An empty database gets no map.
CREATE TABLE maps (
  id serial PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Bumped whenever the map or its layers change, so the list can show the
  -- most recently edited maps first.
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE layers ADD COLUMN map_id int REFERENCES maps ON DELETE CASCADE;

WITH existing AS (
  INSERT INTO maps (name) SELECT 'My map' WHERE EXISTS (SELECT 1 FROM layers)
  RETURNING id
)
UPDATE layers SET map_id = existing.id FROM existing;

ALTER TABLE layers ALTER COLUMN map_id SET NOT NULL;
CREATE INDEX layers_map_id_idx ON layers (map_id);
