import { drawShapes } from './shapes.js';

/**
 * Draws every feature alike (the `single` symbology): in the layer's fill
 * colour, or a line layer's own colour, which is its outline colour.
 */
export function single(layer, prefix, source) {
  const { shape, style } = layer;
  return drawShapes(layer, prefix, source, shape === 'line' ? style.outlineColor : style.fillColor);
}
