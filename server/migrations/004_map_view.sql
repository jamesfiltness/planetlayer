-- Where each map was last looked at, so it opens where it was left. All five
-- columns are null until the map is first moved, and then all are set.
ALTER TABLE maps
  ADD COLUMN view_lng double precision CHECK (view_lng BETWEEN -180 AND 180),
  ADD COLUMN view_lat double precision CHECK (view_lat BETWEEN -90 AND 90),
  ADD COLUMN view_zoom double precision CHECK (view_zoom BETWEEN 0 AND 24),
  ADD COLUMN view_bearing double precision CHECK (view_bearing BETWEEN -180 AND 180),
  ADD COLUMN view_pitch double precision CHECK (view_pitch BETWEEN 0 AND 85),
  ADD CONSTRAINT maps_view_complete CHECK (
    num_nulls(view_lng, view_lat, view_zoom, view_bearing, view_pitch) IN (0, 5)
  );
