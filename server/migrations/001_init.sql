-- The original schema. IF NOT EXISTS (and index names matching the ones
-- Postgres generated) make this a no-op on databases created by the old
-- db/init.sql.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS layers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  shape text NOT NULL CHECK (shape IN ('point', 'line', 'polygon')),
  color text NOT NULL
);

CREATE TABLE IF NOT EXISTS features (
  id bigserial PRIMARY KEY,
  layer_id int NOT NULL REFERENCES layers ON DELETE CASCADE,
  geom geometry(Geometry, 4326) NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS features_geom_idx ON features USING gist (geom);
CREATE INDEX IF NOT EXISTS features_layer_id_idx ON features (layer_id);
