import { NO_VALUE_COLOR, RAMPS } from '../../../../shared/colors.js';
import { drawShapes } from './shapes.js';

/**
 * Colours each feature along a ramp by the number in its property (the
 * `scale` symbology; see shared/symbology.js). A smooth gradient: values
 * between the ramp's colours get a blend of the two either side.
 */
export function scale(layer, prefix, source) {
  return drawShapes(layer, prefix, source, scaleColor(layer.style.symbology));
}

/** The expression that picks a feature's colour; exported for tests. */
export function scaleColor({ field, ramp, min, max }) {
  const colors = (RAMPS[ramp] ?? Object.values(RAMPS)[0]).colors;
  // With every value the same there's no range to spread the ramp across,
  // and `interpolate` needs its stops in increasing order, so use the middle.
  const color = min === max
    ? colors[Math.floor(colors.length / 2)]
    : ['interpolate', ['linear'], ['get', field], ...colors.flatMap((c, i) => [min + ((max - min) * i) / (colors.length - 1), c])];
  // Only numbers are placed on the ramp; text, missing and null values aren't.
  return ['case', ['==', ['typeof', ['get', field]], 'number'], color, NO_VALUE_COLOR];
}
