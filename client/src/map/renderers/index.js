import { sourceId } from '../style.js';
import { single } from './single.js';

// One renderer per symbology type in shared/symbology.js. Each is called as
// `render(layer, prefix, source)` and returns the MapLibre style layers that
// draw the layer, bottom first.
//
// The rules every renderer keeps, which syncLayers relies on:
// - Each style layer's id starts with `prefix`, which names the symbology
//   type, so switching type swaps the style layers instead of restyling them
//   (MapLibre can't change a style layer's type in place).
// - A style layer with a given id always has the same paint and layout keys,
//   whatever the settings: a key left out later would keep its old value.
// - `visibility` is left to syncLayers, which hides and shows layers.
const RENDERERS = { single };

/**
 * How to draw one of our layers: the options its GeoJSON source needs on top
 * of its data (none yet; clustering will need some), and its style layers.
 * A symbology type with no renderer is drawn as `single`, so a layer saved
 * by a newer version of the app still shows.
 *
 * @param {{ id: number, shape: string, style: object }} layer
 * @returns {{ sourceOptions: object, styleLayers: object[] }}
 */
export function drawLayer(layer) {
  const type = Object.hasOwn(RENDERERS, layer.style.symbology?.type) ? layer.style.symbology.type : 'single';
  const source = sourceId(layer.id);
  return { sourceOptions: {}, styleLayers: RENDERERS[type](layer, `${source}-${type}`, source) };
}
