import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { BASE_STYLE } from './style.js';

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
