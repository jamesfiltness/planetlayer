import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { BASE_STYLE } from './style.js';

// Where a map that has never been moved opens.
export const WORLD_VIEW = { center: [0, 20], zoom: 2, bearing: 0, pitch: 0 };

/**
 * Creates the MapLibre map, starting at `initialView` (the map's saved view,
 * or null for the whole world). A position in the URL hash wins over both, so
 * reloading or opening a shared link shows the same place.
 */
export function useMapLibre(initialView) {
  const container = useRef(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    const m = new maplibregl.Map({
      container: container.current,
      style: BASE_STYLE,
      ...(initialView ?? WORLD_VIEW),
      hash: true,
      attributionControl: { compact: false },
    });
    m.on('load', () => setMap(m));
    return () => m.remove();
    // Only the first view matters: the map moves itself after that.
  }, []);

  return [container, map];
}
