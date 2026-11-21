import { symbologyType, SYMBOLOGY_TYPES } from '../shared/symbology.js';
import { badRequest } from './errors.js';

// Checks the settings of each type and returns them tidied up, keeping only
// the keys that type uses. Each is given the whole value, its `type` already
// known to be valid.
const SETTINGS = {
  single: () => ({ type: 'single' }),
};

/**
 * A layer's symbology, checked against the layer's shape: `{ type, ...settings }`,
 * where `type` is one of SYMBOLOGY_TYPES in shared/symbology.js and the
 * layer's shape must be one that type allows. Keys the type doesn't use are
 * dropped.
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
