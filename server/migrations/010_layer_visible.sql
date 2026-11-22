-- Whether each layer is drawn on the map. It used to be kept only in the
-- browser, so a hidden layer came back on reload and assistants couldn't
-- hide one; now it's saved with the layer like its style. Every existing
-- layer starts shown, as it did before.
ALTER TABLE layers ADD COLUMN visible boolean NOT NULL DEFAULT true;
