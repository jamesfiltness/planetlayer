import { RAMPS } from '../shared/colors.js';
import {
  categoryKey, MAX_CATEGORIES, MAX_CATEGORY_TEXT, MAX_FIELD_NAME, symbologyType, SYMBOLOGY_TYPES,
} from '../shared/symbology.js';
import { badRequest } from './errors.js';

const COLOR = /^#[0-9a-f]{6}$/;

// Checks the settings of each type (see shared/symbology.js) and returns them
// tidied up, keeping only the keys that type uses. Each is given the whole
// value, its `type` already known to be valid.
const SETTINGS = {
  single: () => ({ type: 'single' }),

  categories: (value) => {
    const field = parseField(value.field);
    const list = value.categories;
    if (!Array.isArray(list) || list.length > MAX_CATEGORIES) {
      throw badRequest(`A categories style needs a list of at most ${MAX_CATEGORIES} categories.`);
    }
    const seen = new Set();
    const categories = list.map((category) => {
      const parsed = { value: parseCategoryValue(category?.value), color: parseColor(category?.color, 'category') };
      const key = categoryKey(parsed.value);
      if (seen.has(key)) throw badRequest(`The value "${key}" is in more than one category.`);
      seen.add(key);
      return parsed;
    });
    return { type: 'categories', field, categories };
  },

  scale: (value) => {
    const field = parseField(value.field);
    if (typeof value.ramp !== 'string' || !Object.hasOwn(RAMPS, value.ramp)) {
      throw badRequest(`A colour scale's ramp must be one of ${Object.keys(RAMPS).join(', ')}.`);
    }
    const { min, max } = value;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw badRequest("A colour scale's min and max must be numbers, with min no bigger than max.");
    }
    return { type: 'scale', field, ramp: value.ramp, min, max };
  },
};

/**
 * A layer's symbology, checked against the layer's shape: `{ type, ...settings }`,
 * where `type` is one of SYMBOLOGY_TYPES in shared/symbology.js and the
 * layer's shape must be one that type allows. Keys the type doesn't use are
 * dropped. Whether the property it names exists isn't checked: a style
 * naming a property no feature has just draws every feature as "no value".
 *
 * @param {unknown} value
 * @param {string} shape the layer's shape: point, line or polygon
 * @returns {{ type: string }}
 */
export function parseSymbology(value, shape) {
  const entry = symbologyType(value?.type);
  if (!entry) {
    const types = SYMBOLOGY_TYPES.map((t) => t.type).join(', ');
    throw badRequest(`The style's symbology needs a type: one of ${types}.`);
  }
  if (!entry.shapes.includes(shape)) throw badRequest(`A ${shape} layer can't use the "${entry.label}" style.`);
  return SETTINGS[entry.type](value);
}

function parseField(field) {
  if (typeof field !== 'string' || !field || field.length > MAX_FIELD_NAME) {
    throw badRequest(`The style needs a property name of at most ${MAX_FIELD_NAME} characters.`);
  }
  return field;
}

function parseColor(color, what) {
  const lower = typeof color === 'string' ? color.toLowerCase() : '';
  if (!COLOR.test(lower)) throw badRequest(`Each ${what}'s colour must be like #1a2b3c.`);
  return lower;
}

function parseCategoryValue(value) {
  const ok = (typeof value === 'string' && value.length <= MAX_CATEGORY_TEXT) || typeof value === 'boolean' || Number.isFinite(value);
  if (!ok) throw badRequest(`Each category's value must be a number, true or false, or text of at most ${MAX_CATEGORY_TEXT} characters.`);
  return value;
}
