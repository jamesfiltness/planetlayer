import { geojsonUrl } from '../api.js';
import { drawLayer } from './renderers/index.js';
import { SOURCE_PREFIX, sourceId } from './style.js';

/**
 * Brings the MapLibre map in line with our layer list, changing only what
 * differs: removes the sources and style layers of layers that are gone,
 * adds new ones, restyles the rest, and shows or hides each.
 *
 * A layer's features are fetched again when its address changes (its
 * `revision` is bumped after a new filter is saved), and its source is
 * regrouped when its clustering options change. When its symbology type
 * changes, its old style layers are removed and the new type's added (see
 * the rules in renderers/index.js).
 *
 * New style layers go on top, so whenever any are added, every layer's are
 * moved back into list order: the first layer at the bottom, the last on top.
 *
 * @param {import('maplibre-gl').Map} map
 * @param {Array<{ id: number, revision: number, shape: string, style: object }>} layers
 * @param {Set<number>} hidden the ids of the layers to hide
 * @param {Map<string, { data: string, options: string }>} loaded what each
 *   source was last given; kept by the caller between calls
 */
export function syncLayers(map, layers, hidden, loaded) {
  const drawn = layers.map((layer) => ({ layer, ...drawLayer(layer) }));
  removeGone(map, new Set(layers.map((l) => sourceId(l.id))), loaded);

  let added = false;
  for (const { layer, sourceOptions, styleLayers } of drawn) {
    const source = sourceId(layer.id);
    syncSource(map, source, geojsonUrl(layer.id, layer.revision), sourceOptions, loaded);
    added = syncStyleLayers(map, source, styleLayers, hidden.has(layer.id) ? 'none' : 'visible') || added;
  }
  if (added) for (const { styleLayers } of drawn) for (const { id } of styleLayers) map.moveLayer(id);
}

// Removes the style layers drawn from `source`, except those `keep` returns
// true for. A source can only be removed once none are left.
function removeStyleLayers(map, source, keep = () => false) {
  for (const { id, source: from } of map.getStyle().layers) {
    if (from === source && !keep(id)) map.removeLayer(id);
  }
}

// Removes every source of ours, with its style layers, whose layer is gone.
function removeGone(map, wanted, loaded) {
  for (const source of Object.keys(map.getStyle().sources)) {
    if (!source.startsWith(SOURCE_PREFIX) || wanted.has(source)) continue;
    removeStyleLayers(map, source);
    map.removeSource(source);
    loaded.delete(source);
  }
}

// Adds the source, or points it at new data and changes its clustering, if
// either changed. `sourceOptions` only ever holds clustering options (see
// renderers/index.js), which a source can change in place; with none, it
// stops clustering.
function syncSource(map, source, data, sourceOptions, loaded) {
  const options = JSON.stringify(sourceOptions);
  const last = loaded.get(source);
  const existing = map.getSource(source);
  if (!existing) map.addSource(source, { ...sourceOptions, type: 'geojson', data });
  else {
    if (last?.data !== data) existing.setData(data);
    if (last?.options !== options) existing.setClusterOptions({ cluster: false, ...sourceOptions });
  }
  loaded.set(source, { data, options });
}

// Removes the source's style layers that aren't wanted any more, adds the new
// ones and restyles the rest; MapLibre ignores values that haven't changed.
// Returns whether any were added.
function syncStyleLayers(map, source, styleLayers, visibility) {
  const ids = new Set(styleLayers.map((l) => l.id));
  removeStyleLayers(map, source, (id) => ids.has(id));
  let added = false;
  for (const styleLayer of styleLayers) {
    const layout = { ...styleLayer.layout, visibility };
    if (!map.getLayer(styleLayer.id)) {
      map.addLayer({ ...styleLayer, layout });
      added = true;
      continue;
    }
    for (const [name, value] of Object.entries(styleLayer.paint ?? {})) map.setPaintProperty(styleLayer.id, name, value);
    for (const [name, value] of Object.entries(layout)) map.setLayoutProperty(styleLayer.id, name, value);
    if ('filter' in styleLayer) map.setFilter(styleLayer.id, styleLayer.filter);
  }
  return added;
}
