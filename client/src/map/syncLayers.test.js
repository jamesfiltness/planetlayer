// What syncLayers asks of MapLibre as layers are added, restyled, hidden,
// refiltered and removed. The map is a stand-in that keeps just enough state:
// its sources, and its style layers in drawing order (bottom first).
import { describe, expect, test, vi } from 'vitest';
import { drawLayer } from './renderers/index.js';
import { syncLayers } from './syncLayers.js';

// The real renderers, which a test can override once to stand in for
// symbology types (and source options) that don't exist yet.
vi.mock('./renderers/index.js', async (original) => {
  const real = await original();
  return { drawLayer: vi.fn(real.drawLayer) };
});

function fakeMap() {
  const sources = new Map();
  let layers = [];
  const find = (id) => layers.find((l) => l.id === id);
  return {
    getStyle: () => ({ layers: layers.map(({ id, source }) => ({ id, source })), sources: Object.fromEntries(sources) }),
    getSource: (id) => sources.get(id),
    addSource: vi.fn((id, spec) => sources.set(id, { ...spec, setData: vi.fn(), setClusterOptions: vi.fn() })),
    removeSource: vi.fn((id) => {
      if (layers.some((l) => l.source === id)) throw new Error(`source ${id} is still in use`);
      sources.delete(id);
    }),
    getLayer: find,
    addLayer: vi.fn((layer) => { layers.push(structuredClone(layer)); }),
    removeLayer: vi.fn((id) => { layers = layers.filter((l) => l.id !== id); }),
    moveLayer: vi.fn((id) => { const layer = find(id); layers = [...layers.filter((l) => l !== layer), layer]; }),
    setPaintProperty: vi.fn((id, name, value) => { find(id).paint[name] = value; }),
    setLayoutProperty: vi.fn((id, name, value) => { find(id).layout[name] = value; }),
    setFilter: vi.fn(),
    ids: () => layers.map((l) => l.id),
    find,
  };
}

const STYLE = { fillColor: '#112233', fillOpacity: 0.5, outlineColor: '#445566', outlineWidth: 2, opacity: 1, symbology: { type: 'single' } };
const layer = (id, shape, change = {}) => ({ id, shape, revision: 0, style: STYLE, ...change });

describe('syncLayers', () => {
  test('draws each layer from its own source, in list order', () => {
    const map = fakeMap();
    syncLayers(map, [layer(1, 'polygon'), layer(2, 'point')], new Set(), new Map());
    expect(map.ids()).toEqual(['layer-1-single-fill', 'layer-1-single-line', 'layer-2-single-circle']);
    expect(map.getSource('layer-1').data).toMatch(/\/api\/layers\/1\/geojson$/);
    expect(map.find('layer-2-single-circle').paint['circle-color']).toBe('#112233');
  });

  test('restyles a drawn layer in place, and hides and shows it', () => {
    const map = fakeMap();
    const loaded = new Map();
    syncLayers(map, [layer(1, 'point')], new Set(), loaded);
    syncLayers(map, [layer(1, 'point', { style: { ...STYLE, fillColor: '#abcdef' } })], new Set([1]), loaded);
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.find('layer-1-single-circle').paint['circle-color']).toBe('#abcdef');
    expect(map.find('layer-1-single-circle').layout.visibility).toBe('none');
  });

  test('fetches the features again only when the revision changes', () => {
    const map = fakeMap();
    const loaded = new Map();
    syncLayers(map, [layer(1, 'line')], new Set(), loaded);
    syncLayers(map, [layer(1, 'line')], new Set(), loaded);
    expect(map.getSource('layer-1').setData).not.toHaveBeenCalled();
    syncLayers(map, [layer(1, 'line', { revision: 1 })], new Set(), loaded);
    expect(map.getSource('layer-1').setData).toHaveBeenCalledWith(expect.stringMatching(/\/geojson\?v=1$/));
  });

  test('a symbology with no renderer is drawn as a single colour', () => {
    const map = fakeMap();
    syncLayers(map, [layer(1, 'point', { style: { ...STYLE, symbology: { type: 'someday' } } })], new Set(), new Map());
    expect(map.ids()).toEqual(['layer-1-single-circle']);
  });

  test("a removed layer's style layers and source go", () => {
    const map = fakeMap();
    const loaded = new Map();
    syncLayers(map, [layer(1, 'polygon'), layer(2, 'line')], new Set(), loaded);
    syncLayers(map, [layer(2, 'line')], new Set(), loaded);
    expect(map.ids()).toEqual(['layer-2-single-line']);
    expect(map.getSource('layer-1')).toBeUndefined();
    expect(loaded.has('layer-1')).toBe(false);
  });

  test('a new layer goes on top, and existing ones keep their order', () => {
    const map = fakeMap();
    const loaded = new Map();
    syncLayers(map, [layer(1, 'line')], new Set(), loaded);
    syncLayers(map, [layer(1, 'line'), layer(2, 'point')], new Set(), loaded);
    expect(map.ids()).toEqual(['layer-1-single-line', 'layer-2-single-circle']);
  });

  test("switching symbology type swaps the layer's style layers, keeping its place", () => {
    const map = fakeMap();
    const loaded = new Map();
    syncLayers(map, [layer(1, 'point'), layer(2, 'line')], new Set(), loaded);
    drawLayer.mockReturnValueOnce({ sourceOptions: {}, styleLayers: [{ id: 'layer-1-heat-map', type: 'heatmap', source: 'layer-1', paint: {} }] });
    syncLayers(map, [layer(1, 'point'), layer(2, 'line')], new Set(), loaded);
    expect(map.ids()).toEqual(['layer-1-heat-map', 'layer-2-single-line']);
    expect(map.addSource).toHaveBeenCalledTimes(2);
  });

  test("clustering is turned on, changed and off on the same source", () => {
    const map = fakeMap();
    const loaded = new Map();
    syncLayers(map, [layer(1, 'point')], new Set(), loaded);
    const source = map.getSource('layer-1');
    const clustered = (radius) => ({ ...STYLE, symbology: { type: 'cluster', radius } });

    syncLayers(map, [layer(1, 'point', { style: clustered(50) })], new Set(), loaded);
    expect(source.setClusterOptions).toHaveBeenLastCalledWith({ cluster: true, clusterRadius: 50, clusterMaxZoom: 14 });
    expect(map.ids()).toEqual(['layer-1-cluster-circle', 'layer-1-cluster-clusters', 'layer-1-cluster-counts']);
    expect(map.find('layer-1-cluster-circle').filter).toEqual(['!', ['has', 'point_count']]);

    syncLayers(map, [layer(1, 'point', { style: clustered(50) })], new Set(), loaded);
    expect(source.setClusterOptions).toHaveBeenCalledTimes(1);
    expect(map.setFilter).toHaveBeenCalledWith('layer-1-cluster-clusters', ['has', 'point_count']);

    syncLayers(map, [layer(1, 'point', { style: clustered(80) })], new Set(), loaded);
    expect(source.setClusterOptions).toHaveBeenLastCalledWith({ cluster: true, clusterRadius: 80, clusterMaxZoom: 14 });

    syncLayers(map, [layer(1, 'point')], new Set(), loaded);
    expect(source.setClusterOptions).toHaveBeenLastCalledWith({ cluster: false });
    expect(map.ids()).toEqual(['layer-1-single-circle']);
    expect(map.addSource).toHaveBeenCalledTimes(1);
  });
});
