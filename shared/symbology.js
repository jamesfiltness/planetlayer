// How a layer's features are coloured and sized from their data: its
// "symbology". Used by both the server (which checks a saved symbology
// against this list) and the client (which builds the Style tab's menus
// from it and draws the layer to match).
//
// A layer's symbology is stored as JSON alongside the rest of its style, as
// `{ type, ...settings }`. The layer's other style values (outline,
// opacities and, for `single`, the fill colour) apply whatever the type.
//
// - `single`: every feature in the layer's fill colour (a line's own colour).
// - `categories`: `{ field, categories: [{ value, color }] }`. A feature
//   whose `field` is one of the values gets that colour; any other value is
//   OTHER_COLOR and no value at all is NO_VALUE_COLOR (see colors.js).
//   Values are compared as text, so the number 3 and the text "3" are the
//   same category, and no two categories may be.
// - `scale`: `{ field, ramp, min, max }`. A number in `field` is coloured
//   along the ramp from `min` to `max`, staying at the ends beyond them;
//   anything else is NO_VALUE_COLOR.
// - `size` (points only): `{ field, min, max, minSize, maxSize }`. Points
//   are the layer's fill colour, their radius growing from `minSize` pixels
//   at `min` to `maxSize` at `max` so that a circle's area, not its radius,
//   follows the value. A point with no number is the smallest size, in
//   NO_VALUE_COLOR.
// - `heatmap` (points only): `{ field, radius, intensity }`, plus `min` and
//   `max` when `field` isn't null. Points blur into a heatmap, each spreading
//   over `radius` pixels; `intensity` brightens the whole of it. With no
//   `field` every point counts the same; otherwise a point counts for more
//   the higher its number, from nothing at `min` to fully at `max`, and a
//   point with no number doesn't count.
// - `cluster` (points only): `{ radius }`. Points closer together than
//   `radius` pixels are drawn as one circle with their count, in the layer's
//   fill colour, splitting apart as the map zooms in.

import { SHAPES } from './spec.js';

/** The most categories a layer can have; the rest of its values are "other". */
export const MAX_CATEGORIES = 24;

/** The most characters a category's value can have, as text; longer ones are "other". */
export const MAX_CATEGORY_TEXT = 200;

/** The most characters a property name can have, as in filters. */
export const MAX_FIELD_NAME = 1000;

/** The range of a `size` style's circle radii, in pixels, ends included. */
export const SIZE_LIMITS = [1, 40];

/** The radii a new `size` style starts with. */
export const DEFAULT_SIZES = Object.freeze({ minSize: 3, maxSize: 15 });

/** The range of a heatmap's settings, ends included: its radius in pixels and its intensity. */
export const HEATMAP_LIMITS = { radius: [2, 60], intensity: [0.1, 5] };

/** The settings a new heatmap starts with. */
export const DEFAULT_HEATMAP = Object.freeze({ radius: 20, intensity: 1 });

/** The range of a cluster style's radius, in pixels, ends included. */
export const CLUSTER_LIMITS = [10, 100];

/** The radius a new cluster style starts with. */
export const DEFAULT_CLUSTER_RADIUS = 50;

// Which of the layer's properties a type can use, judged from its summary
// (see fieldSummaries in server/filter/fields.js). Categories need values
// to list, and numbers only when they're few enough to be categories.
const CATEGORY_TYPES = ['string', 'boolean', 'mixed'];
const fitsCategories = (f) => f.distinct > 0 && (CATEGORY_TYPES.includes(f.type) || (f.type === 'number' && f.distinct <= MAX_CATEGORIES));
const fitsScale = (f) => f.type === 'number' && f.min !== null;

/**
 * Every symbology type, in the order the Style tab lists them.
 *
 * - `shapes`: the layer shapes that can use it.
 * - `fits`: for a type that colours by a property, which properties it can
 *   use, given a property's summary; absent for one that needs none.
 * - `noField`: why the type can't be used when no property fits.
 * - `optionalField`: whether it can also go without a property, so it's
 *   offered even when none fits, and starts with none.
 * - `base`: which of the layer's other style values it draws with, besides
 *   the overall opacity, which every type uses: `fillColor`, `fillOpacity`
 *   and `outline` (the outline's colour and width).
 *
 * @type {Array<{ type: string, label: string, shapes: string[], fits?: (field: object) => boolean, noField?: string, optionalField?: boolean, base: string[] }>}
 */
export const SYMBOLOGY_TYPES = [
  { type: 'single', label: 'Single colour', shapes: SHAPES, base: ['fillColor', 'fillOpacity', 'outline'] },
  {
    type: 'categories', label: 'Categories', shapes: SHAPES, base: ['fillOpacity', 'outline'],
    fits: fitsCategories, noField: 'No property has few enough values',
  },
  {
    type: 'scale', label: 'Colour scale', shapes: SHAPES, base: ['fillOpacity', 'outline'],
    fits: fitsScale, noField: 'No property holds numbers',
  },
  {
    type: 'size', label: 'Size', shapes: ['point'], base: ['fillColor', 'fillOpacity', 'outline'],
    fits: fitsScale, noField: 'No property holds numbers',
  },
  { type: 'heatmap', label: 'Heatmap', shapes: ['point'], base: [], fits: fitsScale, optionalField: true },
  { type: 'cluster', label: 'Cluster', shapes: ['point'], base: ['fillColor', 'fillOpacity', 'outline'] },
];

/** The symbology a new layer gets: every feature in the layer's fill colour. */
export const DEFAULT_SYMBOLOGY = Object.freeze({ type: 'single' });

/** The symbology types a layer of this shape can use. */
export const symbologyTypesFor = (shape) => SYMBOLOGY_TYPES.filter((t) => t.shapes.includes(shape));

/** The entry in SYMBOLOGY_TYPES for `type`, or undefined if there's none. */
export const symbologyType = (type) => SYMBOLOGY_TYPES.find((t) => t.type === type);

/** A category's value as text, as categories are compared (see the top of this file). */
export const categoryKey = (value) => String(value);
