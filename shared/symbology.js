// How a layer's features are coloured and sized from their data: its
// "symbology". Used by both the server (which checks a saved symbology
// against this list) and the client (which builds the Style tab's menu from
// it and draws the layer to match).
//
// A layer's symbology is stored as JSON alongside the rest of its style, as
// `{ type, ...settings }`. Each type has its own settings; `single` has none.
// The layer's other style values (outline, opacities and, for `single`, the
// fill colour) apply whatever the type.

import { SHAPES } from './spec.js';

/**
 * Every symbology type, in the order the Style tab lists them.
 * `shapes` lists the layer shapes that can use it.
 *
 * @type {Array<{ type: string, label: string, shapes: string[] }>}
 */
export const SYMBOLOGY_TYPES = [
  { type: 'single', label: 'Single colour', shapes: SHAPES },
];

/** The symbology a new layer gets: every feature in the layer's fill colour. */
export const DEFAULT_SYMBOLOGY = Object.freeze({ type: 'single' });

/** The symbology types a layer of this shape can use. */
export const symbologyTypesFor = (shape) => SYMBOLOGY_TYPES.filter((t) => t.shapes.includes(shape));

/** The entry in SYMBOLOGY_TYPES for `type`, or undefined if there's none. */
export const symbologyType = (type) => SYMBOLOGY_TYPES.find((t) => t.type === type);
