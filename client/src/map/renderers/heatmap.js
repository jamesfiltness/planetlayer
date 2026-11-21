import { HEATMAP_COLORS } from '../../../../shared/colors.js';
import { isNumber } from './shapes.js';

/**
 * Blurs the points into a heatmap (the `heatmap` symbology; see
 * shared/symbology.js), coloured by HEATMAP_COLORS from sparse to dense.
 * Only the overall opacity of the layer's other style values applies.
 */
export function heatmap({ style }, prefix, source) {
  const { radius, intensity } = style.symbology;
  return [{ id: `${prefix}-heat`, type: 'heatmap', source, paint: {
    'heatmap-weight': heatmapWeight(style.symbology),
    'heatmap-radius': radius,
    'heatmap-intensity': intensity,
    'heatmap-opacity': style.opacity,
    // Density runs from 0 where there are no points; that stays clear, and
    // the colours spread evenly over the rest.
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0, 0, 0, 0)',
      ...HEATMAP_COLORS.flatMap((color, i) => [(i + 1) / HEATMAP_COLORS.length, color])],
  } }];
}

/**
 * The expression for how much a point counts, from 0 to 1; exported for
 * tests. With no property every point counts fully; otherwise its number
 * is placed between `min` (nothing) and `max` (fully), and a point with no
 * number doesn't count.
 */
export function heatmapWeight({ field, min, max }) {
  if (field === null) return 1;
  // `interpolate` needs its stops in increasing order, so a property with
  // one value throughout counts fully.
  const weight = min === max ? 1 : ['interpolate', ['linear'], ['get', field], min, 0, max, 1];
  return ['case', isNumber(field), weight, 0];
}
