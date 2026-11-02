import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { BASE_STYLE } from './style.js';

/**
 * Creates a MapLibre map in a container element and removes it on unmount.
 * The view (centre and zoom) is kept in the URL hash, so a reload or shared
 * link opens at the same place.
 *
 * @returns {[import('react').RefObject<HTMLElement>, maplibregl.Map | null]}
 *   a ref to attach to the container, and the map once its style has loaded
 */
export function useMapLibre() {
  const container = useRef(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    const m = new maplibregl.Map({
      container: container.current,
      style: BASE_STYLE,
      center: [0, 20],
      zoom: 2,
      hash: true,
      attributionControl: { compact: false },
    });
    m.on('load', () => setMap(m));
    return () => m.remove();
  }, []);

  return [container, map];
}
