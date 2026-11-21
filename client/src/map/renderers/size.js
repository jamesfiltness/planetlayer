import { NO_VALUE_COLOR } from '../../../../shared/colors.js';
import { drawShapes, isNumber } from './shapes.js';

/**
 * Sizes each point by the number in its property (the `size` symbology; see
 * shared/symbology.js), in the layer's fill colour. Smaller circles are
 * drawn over bigger ones, so a big circle never hides a small one.
 */
export function size(layer, prefix, source) {
  const { field } = layer.style.symbology;
  return drawShapes(layer, prefix, source, ['case', isNumber(field), layer.style.fillColor, NO_VALUE_COLOR], {
    radius: sizeRadius(layer.style.symbology),
    // Circles with a higher key are drawn on top.
    layout: { 'circle-sort-key': ['case', isNumber(field), ['-', ['get', field]], 0] },
  });
}

/**
 * The expression for a point's radius; exported for tests. The radius
 * follows the square root of how far the value is above `min`, so that a
 * circle's area grows in step with the value. Values beyond `min` and `max`
 * stay at the smallest and biggest sizes.
 */
export function sizeRadius({ field, min, max, minSize, maxSize }) {
  // `interpolate` needs its stops in increasing order, so a property with
  // one value throughout is drawn halfway between the sizes.
  const radius = min === max
    ? (minSize + maxSize) / 2
    : ['interpolate', ['linear'], ['sqrt', ['max', 0, ['-', ['get', field], min]]], 0, minSize, Math.sqrt(max - min), maxSize];
  return ['case', isNumber(field), radius, minSize];
}
