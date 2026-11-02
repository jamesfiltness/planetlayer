-- Every spatial query is limited to one layer, so index (layer_id, geom)
-- together rather than searching a geometry index that covers every layer.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE INDEX IF NOT EXISTS features_layer_geom_idx ON features USING gist (layer_id, geom);
DROP INDEX IF EXISTS features_geom_idx;
