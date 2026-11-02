const TILES = import.meta.env.VITE_TILES ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const BASE_STYLE = {
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

export const SOURCE_PREFIX = 'layer-';

export const sourceId = (layerId) => `${SOURCE_PREFIX}${layerId}`;

export function mapLayers({ id, shape, color }) {
  const source = sourceId(id);
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
