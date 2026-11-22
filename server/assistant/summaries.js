// How maps and layers are described in tool results: what a model needs to
// pick its next step, without colours and other drawing details.
import { getLayer } from '../layers.js';

/** A map, without its saved view. */
export const mapSummary = ({ id, name, layer_count, updated_at }) => ({ id, name, layer_count, updated_at });

/**
 * A layer as listLayers or getLayer in layers.js gives it. `count` is every
 * feature; `matching` is how many its filter lets through, which is what
 * the map shows and the analysis tools use. `visible` is false when the
 * layer is hidden on the map (the tools still use it). `fields` lists property names
 * seen on its first 100 features (describe_layer reads them all).
 */
export function layerSummary(layer) {
  const { id, map_id, name, shape, visible, count, matching, filter, fields, extent, style } = layer;
  return { id, map_id, name, shape, visible, count, matching, filter, fields, extent, style: style.symbology };
}

/**
 * A layer just made by an import or a tool, described as layerSummary does.
 * Those return only its id, name and shape, so it's looked up again for
 * its feature count and properties, which say whether the step worked.
 */
export const newLayerSummary = async ({ id }) => layerSummary(await getLayer(id));
