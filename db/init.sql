CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE layers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  shape text NOT NULL CHECK (shape IN ('point', 'line', 'polygon')),
  color text NOT NULL
);

CREATE TABLE features (
  id bigserial PRIMARY KEY,
  layer_id int NOT NULL REFERENCES layers ON DELETE CASCADE,
  geom geometry(Geometry, 4326) NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX ON features USING gist (geom);
CREATE INDEX ON features (layer_id);
