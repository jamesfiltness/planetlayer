-- The app's settings. There is one user, so there is one row: `id` can only be
-- true, which makes a second row a primary key violation. Each setting is its
-- own typed column, with its default here, so a new setting is a new column.
CREATE TABLE settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- One of the ids in shared/themes.js. Checked by the server, not here, so
  -- the list lives in one place.
  theme text NOT NULL DEFAULT 'positron'
);

INSERT INTO settings DEFAULT VALUES;
