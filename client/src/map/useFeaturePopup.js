import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { SOURCE_PREFIX } from './style.js';

export function useFeaturePopup(map) {
  useEffect(() => {
    if (!map) return;
    const onClick = (e) => {
      const ids = map.getStyle().layers.filter((l) => l.source?.startsWith(SOURCE_PREFIX)).map((l) => l.id);
      const [feature] = map.queryRenderedFeatures(e.point, { layers: ids });
      if (!feature) return;
      const rows = Object.entries(feature.properties)
        .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
        .join('');
      new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<table>${rows || '<tr><td>No properties</td></tr>'}</table>`).addTo(map);
    };
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [map]);
}

// Properties come from imported files, so they're escaped.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
