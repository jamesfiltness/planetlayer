import { useEffect, useRef } from 'react';
import { geojsonUrl } from '../api.js';
import { mapLayers, SOURCE_PREFIX, sourceId } from './style.js';

/**
 * Keeps the MapLibre map in step with the layer list: adds and removes each
 * layer's source and style layers, restyles them, shows or hides them, and
 * fetches a layer's features again when its `revision` changes (after a new
 * filter is saved).
 */
export function useLayerSync(map, layers, hidden) {
  const loadedFrom = useRef(new Map()); // source id → the address its features came from

  useEffect(() => {
    if (!map) return;
    const wanted = new Set(layers.map((l) => sourceId(l.id)));
    // Style layers first: a source can't be removed while a layer uses it.
    for (const layer of map.getStyle().layers) {
      if (layer.source?.startsWith(SOURCE_PREFIX) && !wanted.has(layer.source)) map.removeLayer(layer.id);
    }
    for (const source of Object.keys(map.getStyle().sources)) {
      if (source.startsWith(SOURCE_PREFIX) && !wanted.has(source)) {
        map.removeSource(source);
        loadedFrom.current.delete(source);
      }
    }
    for (const layer of layers) {
      const source = sourceId(layer.id);
      const url = geojsonUrl(layer.id, layer.revision);
      if (!map.getSource(source)) map.addSource(source, { type: 'geojson', data: url });
      else if (loadedFrom.current.get(source) !== url) map.getSource(source).setData(url);
      loadedFrom.current.set(source, url);

      for (const style of mapLayers(layer)) {
        if (!map.getLayer(style.id)) map.addLayer(style);
        // Restyle a layer that's already drawn. MapLibre ignores unchanged values.
        else for (const [name, value] of Object.entries(style.paint)) map.setPaintProperty(style.id, name, value);
        map.setLayoutProperty(style.id, 'visibility', hidden.has(layer.id) ? 'none' : 'visible');
      }
    }
  }, [map, layers, hidden]);
}
