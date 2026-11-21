// Used by both the client (the Style tab) and the server (the MCP server's style_layer tool).
import { CATEGORY_PALETTE, DEFAULT_RAMP } from './colors.js';
import {
  categoryKey, DEFAULT_CLUSTER_RADIUS, DEFAULT_HEATMAP, DEFAULT_SIZES, MAX_CATEGORIES, MAX_CATEGORY_TEXT, symbologyType,
} from './symbology.js';

/**
 * The symbology of `type` for the layer's property `field`, as the Style tab
 * makes it when either is chosen (see shared/symbology.js for each type).
 *
 * - `categories`: the property's most common values, up to MAX_CATEGORIES,
 *   each with the next colour of CATEGORY_PALETTE. A value too long to be a
 *   category, or the same as one already listed once compared as text,
 *   is left to "other".
 * - `scale`: runs from the property's lowest value to its highest, with the
 *   ramp `previous` had if it was a colour scale too, else DEFAULT_RAMP.
 * - `size`: likewise, with the circle sizes `previous` had if it was a size
 *   style too, else DEFAULT_SIZES.
 * - `heatmap`: weighted by `field` over its range, or by nothing if there's
 *   no `field`, with the radius and intensity `previous` had if it was a
 *   heatmap too, else DEFAULT_HEATMAP.
 * - `cluster`: the radius `previous` had if it was clustered too, else
 *   DEFAULT_CLUSTER_RADIUS.
 *
 * @param {string} type
 * @param {{ name: string, min: number | null, max: number | null, values: Array<{ value: unknown }> } | undefined} field
 *   the property's summary (from useFieldSummaries); unused by `single` and
 *   `cluster`, and optional for `heatmap`
 * @param {{ type: string }} previous the symbology being replaced
 */
export function buildSymbology(type, field, previous) {
  switch (type) {
    case 'categories':
      return { type, field: field.name, categories: pickCategories(field.values) };
    case 'scale':
      return { type, field: field.name, ramp: previous.type === 'scale' ? previous.ramp : DEFAULT_RAMP, min: field.min, max: field.max };
    case 'size': {
      const { minSize, maxSize } = previous.type === 'size' ? previous : DEFAULT_SIZES;
      return { type, field: field.name, min: field.min, max: field.max, minSize, maxSize };
    }
    case 'heatmap': {
      const { radius, intensity } = previous.type === 'heatmap' ? previous : DEFAULT_HEATMAP;
      const weight = field ? { field: field.name, min: field.min, max: field.max } : { field: null };
      return { type, ...weight, radius, intensity };
    }
    case 'cluster':
      return { type, radius: previous.type === 'cluster' ? previous.radius : DEFAULT_CLUSTER_RADIUS };
    default:
      return { type: 'single' };
  }
}

function pickCategories(values) {
  const categories = [];
  const seen = new Set();
  for (const { value } of values) {
    if (categories.length === MAX_CATEGORIES) break;
    const key = categoryKey(value);
    if ((typeof value === 'string' && value.length > MAX_CATEGORY_TEXT) || seen.has(key)) continue;
    seen.add(key);
    categories.push({ value, color: CATEGORY_PALETTE[categories.length] });
  }
  return categories;
}

/**
 * The property a type starts with when it's chosen: the first that fits it
 * (see SYMBOLOGY_TYPES) with few enough values to all be categories, else
 * the first that fits at all. Undefined if none does, or the type needs
 * none, or can go without one (a heatmap starts with every point counting
 * the same).
 *
 * @param {string} type
 * @param {object[]} fields the layer's property summaries, sorted by name
 */
export function startingField(type, fields) {
  const { fits, optionalField } = symbologyType(type) ?? {};
  if (!fits || optionalField) return undefined;
  const fitting = fields.filter(fits);
  return fitting.find((f) => f.distinct <= MAX_CATEGORIES) ?? fitting[0];
}
