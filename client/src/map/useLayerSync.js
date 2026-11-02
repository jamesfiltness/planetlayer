import { useEffect } from 'react';
import { geojsonUrl } from '../api.js';
import { mapLayers, SOURCE_PREFIX, sourceId } from './style.js';

export function useLayerSync(map, layers, hidden) {
  useEffect(() => {
    if (!map) return;
    const wanted = new Set(layers.map((l) => sourceId(l.id)));
    // Style layers first: a source can't be removed while a layer uses it.
    for (const layer of map.getStyle().layers) {
      if (layer.source?.startsWith(SOURCE_PREFIX) && !wanted.has(layer.source)) map.removeLayer(layer.id);
    }
    for (const source of Object.keys(map.getStyle().sources)) {
      if (source.startsWith(SOURCE_PREFIX) && !wanted.has(source)) map.removeSource(source);
    }
    for (const layer of layers) {
      const source = sourceId(layer.id);
      if (!map.getSource(source)) map.addSource(source, { type: 'geojson', data: geojsonUrl(layer.id) });
      for (const style of mapLayers(layer)) {
        if (!map.getLayer(style.id)) map.addLayer(style);
        map.setLayoutProperty(style.id, 'visibility', hidden.has(layer.id) ? 'none' : 'visible');
      }
    }
  }, [map, layers, hidden]);
}
