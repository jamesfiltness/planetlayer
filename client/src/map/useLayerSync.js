import { useEffect, useRef } from 'react';
import { syncLayers } from './syncLayers.js';

/**
 * Keeps the MapLibre map in step with the layer list, the layers' styles and
 * which are hidden. See syncLayers for what each change does.
 *
 * @param {import('maplibre-gl').Map | null} map null until the map has loaded
 * @param {object[]} layers as useMapLayers gives them
 * @param {Set<number>} hidden the ids of the layers to hide
 */
export function useLayerSync(map, layers, hidden) {
  const loaded = useRef(new Map()); // source id → what it was last given

  useEffect(() => {
    if (map) syncLayers(map, layers, hidden, loaded.current);
  }, [map, layers, hidden]);
}
