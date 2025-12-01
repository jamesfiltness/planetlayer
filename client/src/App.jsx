import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { api, geojsonUrl } from './api.js';
import Toolbar from './Toolbar.jsx';

const TILES = import.meta.env.VITE_TILES ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

// The map layers drawn for one data layer, by its shape.
function mapLayers({ id, shape, color }) {
  const source = `layer-${id}`;
  if (shape === 'point') {
    return [{ id: `${source}-circle`, type: 'circle', source, paint: {
      'circle-color': color, 'circle-radius': 6, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } }];
  }
  if (shape === 'line') {
    return [{ id: `${source}-line`, type: 'line', source, paint: { 'line-color': color, 'line-width': 2.5 } }];
  }
  return [
    { id: `${source}-fill`, type: 'fill', source, paint: { 'fill-color': color, 'fill-opacity': 0.35 } },
    { id: `${source}-line`, type: 'line', source, paint: { 'line-color': color, 'line-width': 1.5 } },
  ];
}

export default function App() {
  const container = useRef(null);
  const [map, setMap] = useState(null);
  const [layers, setLayers] = useState([]);
  const [hidden, setHidden] = useState(new Set());
  const [status, setStatus] = useState(null);

  const refresh = () => api.layers().then(setLayers);

  const attempt = async (message, fn) => {
    setStatus({ message });
    try {
      await fn();
      setStatus(null);
      return true;
    } catch (error) {
      setStatus({ message: error.message, error: true });
      return false;
    }
  };

  const importFiles = (files) =>
    attempt('Importing…', async () => {
      for (const file of files) await api.importFile(file);
      await refresh();
    });

  useEffect(() => {
    const m = new maplibregl.Map({ container: container.current, style: STYLE, center: [0, 20], zoom: 2, hash: true, attributionControl: { compact: false } });
    m.on('load', () => setMap(m));
    refresh();
    return () => m.remove();
  }, []);

  // Add, restyle and remove map sources to match the layer list.
  useEffect(() => {
    if (!map) return;
    const wanted = new Set(layers.map((l) => `layer-${l.id}`));
    for (const layer of map.getStyle().layers) {
      if (layer.source?.startsWith('layer-') && !wanted.has(layer.source)) map.removeLayer(layer.id);
    }
    for (const source of Object.keys(map.getStyle().sources)) {
      if (source.startsWith('layer-') && !wanted.has(source)) map.removeSource(source);
    }
    for (const layer of layers) {
      const source = `layer-${layer.id}`;
      if (!map.getSource(source)) map.addSource(source, { type: 'geojson', data: geojsonUrl(layer.id) });
      for (const style of mapLayers(layer)) {
        if (!map.getLayer(style.id)) map.addLayer(style);
        map.setLayoutProperty(style.id, 'visibility', hidden.has(layer.id) ? 'none' : 'visible');
      }
    }
  }, [map, layers, hidden]);

  // Clicking a feature shows its properties.
  useEffect(() => {
    if (!map) return;
    const onClick = (e) => {
      const ids = map.getStyle().layers.filter((l) => l.source?.startsWith('layer-')).map((l) => l.id);
      const [feature] = map.queryRenderedFeatures(e.point, { layers: ids });
      if (!feature) return;
      const rows = Object.entries(feature.properties)
        .map(([k, v]) => `<tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`)
        .join('');
      new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<table>${rows || '<tr><td>No properties</td></tr>'}</table>`).addTo(map);
    };
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [map]);

  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        importFiles([...e.dataTransfer.files]);
      }}
    >
      <div ref={container} className="map" />
      {status && (
        <div className={`status ${status.error ? 'error' : ''}`} role={status.error ? 'alert' : 'status'}>
          <span className="message">{status.message}</span>
          <button className="close" title="Dismiss" aria-label="Dismiss" onClick={() => setStatus(null)}>×</button>
        </div>
      )}
      <Toolbar
        layers={layers}
        hidden={hidden}
        onToggle={(id) => setHidden((h) => new Set(h.has(id) ? [...h].filter((x) => x !== id) : [...h, id]))}
        onDelete={(layer) => attempt('Deleting…', async () => { await api.deleteLayer(layer.id); await refresh(); })}
        onImport={importFiles}
        onRun={(tool, params) => attempt('Running…', async () => { await api.runTool(tool, params); await refresh(); })}
      />
    </div>
  );
}

function escape(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
