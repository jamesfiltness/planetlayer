// Limits on names and layer styles, used by both the server (which enforces
// them, backed by CHECKs in the migrations) and the client (which keeps its
// inputs inside them). Filter limits live with filters, in shared/filter.js.

/** The most characters a map's name can have. Matches migrations/008_name_limits.sql. */
export const MAX_MAP_NAME = 200;

/**
 * The most characters a layer's name can have. A name someone types is
 * refused past this; a name the app makes up (from a file, or a tool's
 * inputs such as "<layer> inside <areas>") is cut short to fit.
 * Matches migrations/008_name_limits.sql.
 */
export const MAX_LAYER_NAME = 200;

/**
 * The range of each number in a layer's style, ends included: opacities run
 * from 0 to 1 and the outline width is in pixels. Matches the CHECKs in
 * migrations/005_layer_style.sql.
 */
export const STYLE_LIMITS = {
  fillOpacity: [0, 1],
  outlineWidth: [0, 10],
  opacity: [0, 1],
};
