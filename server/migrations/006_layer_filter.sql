-- Each layer's filter, edited in the layer editor's Filter tab. NULL means
-- the layer has no filter and shows every feature. The value is checked by
-- parseFilter in filter/parse.js before it's stored; see shared/filter.js for
-- its shape.
ALTER TABLE layers ADD COLUMN filter jsonb CHECK (jsonb_typeof(filter) = 'object');
