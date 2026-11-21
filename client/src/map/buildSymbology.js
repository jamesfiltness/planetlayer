import { CATEGORY_PALETTE, DEFAULT_RAMP } from '../../../shared/colors.js';
import { categoryKey, MAX_CATEGORIES, MAX_CATEGORY_TEXT, symbologyType } from '../../../shared/symbology.js';

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
 *
 * @param {string} type
 * @param {{ name: string, min: number | null, max: number | null, values: Array<{ value: unknown }> } | undefined} field
 *   the property's summary (from useFieldSummaries); unused by `single`
 * @param {{ type: string }} previous the symbology being replaced
 */
export function buildSymbology(type, field, previous) {
  switch (type) {
    case 'categories':
      return { type, field: field.name, categories: pickCategories(field.values) };
    case 'scale':
      return { type, field: field.name, ramp: previous.type === 'scale' ? previous.ramp : DEFAULT_RAMP, min: field.min, max: field.max };
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
 * the first that fits at all. Undefined if none does, or the type needs none.
 *
 * @param {string} type
 * @param {object[]} fields the layer's property summaries, sorted by name
 */
export function startingField(type, fields) {
  const fits = symbologyType(type)?.fits;
  if (!fits) return undefined;
  const fitting = fields.filter(fits);
  return fitting.find((f) => f.distinct <= MAX_CATEGORIES) ?? fitting[0];
}
