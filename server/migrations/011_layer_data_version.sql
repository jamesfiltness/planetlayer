-- A count that goes up each time a layer's features are changed in place,
-- as Calculate property and changing a property's type do. Browsers showing
-- the layer compare it with what they last saw, to know when to fetch its
-- features and property summaries again.
ALTER TABLE layers ADD COLUMN data_version integer NOT NULL DEFAULT 0;
