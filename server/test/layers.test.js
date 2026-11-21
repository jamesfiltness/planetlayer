// Layer styles: the defaults a new layer gets, and saving a changed style.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { collection, freshDatabase, point, square, upload } from './helpers.js';

let db, layers, map, points, areas, track;

before(async () => {
  db = await freshDatabase('spatial_test_layers');
  layers = await import('../layers.js');
  const { createMap } = await import('../maps.js');
  const { importFile } = await import('../import.js');
  map = await createMap('Styles');
  const line = { type: 'LineString', coordinates: [[0, 0], [1, 1]] };
  [points] = await importFile(await upload('points.geojson', collection([point(0, 0)])), map.id);
  [areas] = await importFile(await upload('areas.geojson', collection([square(0, 0)])), map.id);
  [track] = await importFile(await upload('track.geojson', collection([line])), map.id);
});

after(() => db.pool.end());

const status = (code) => (error) => error.status === code;
const listed = async (id) => (await layers.listLayers(map.id)).find((layer) => layer.id === id);
const SINGLE = { type: 'single' };
const STYLE = { fillColor: '#112233', fillOpacity: 0.5, outlineColor: '#445566', outlineWidth: 3, opacity: 0.8, symbology: SINGLE };

describe('listing layers', () => {
  test("each layer has the box around its features, or null with none", async () => {
    assert.deepEqual((await listed(areas.id)).extent, [0, 0, 1, 1]);
    assert.deepEqual((await listed(points.id)).extent, [0, 0, 0, 0]);
    const { createLayer } = layers;
    const empty = await createLayer(db.pool, map.id, 'empty', 'point');
    assert.equal((await listed(empty.id)).extent, null);
    await layers.deleteLayer(empty.id);
  });
});

describe('layer styles', () => {
  test('a new layer is styled for its shape, in its own colour', async () => {
    const color = areas.style.fillColor;
    assert.match(color, /^#[0-9a-f]{6}$/);
    assert.deepEqual(areas.style, { fillColor: color, fillOpacity: 0.35, outlineColor: color, outlineWidth: 1.5, opacity: 1, symbology: SINGLE });
    assert.deepEqual({ ...points.style, fillColor: null }, { fillColor: null, fillOpacity: 1, outlineColor: '#ffffff', outlineWidth: 1.5, opacity: 1, symbology: SINGLE });
    assert.equal(track.style.outlineColor, track.style.fillColor);
    assert.equal(track.style.outlineWidth, 2.5);
    assert.deepEqual((await listed(areas.id)).style, areas.style);
  });

  test('a saved style replaces the old one, with colours in lower case', async () => {
    await layers.saveLayerStyle(String(areas.id), { ...STYLE, fillColor: '#AABBCC' });
    assert.deepEqual((await listed(areas.id)).style, { ...STYLE, fillColor: '#aabbcc' });
    assert.deepEqual((await listed(points.id)).style, points.style);
  });

  test('saving a style marks the map as edited', async () => {
    const { getMap } = await import('../maps.js');
    const before = (await getMap(map.id)).updated_at;
    await layers.saveLayerStyle(points.id, STYLE);
    assert.ok((await getMap(map.id)).updated_at > before);
  });

  test('every field is required and must be in range', async () => {
    const bad = [
      undefined, 'red', {},
      { ...STYLE, fillColor: 'red' }, { ...STYLE, fillColor: '#abc' }, { ...STYLE, outlineColor: 123 },
      { ...STYLE, fillOpacity: 1.1 }, { ...STYLE, fillOpacity: '0.5' }, { ...STYLE, opacity: -0.1 },
      { ...STYLE, outlineWidth: 11 }, { ...STYLE, outlineWidth: NaN }, { ...STYLE, opacity: undefined },
      { ...STYLE, symbology: undefined }, { ...STYLE, symbology: 'single' }, { ...STYLE, symbology: {} },
      { ...STYLE, symbology: { type: 'rainbow' } }, { ...STYLE, symbology: { type: 'toString' } },
    ];
    for (const style of bad) {
      await assert.rejects(layers.saveLayerStyle(track.id, style), status(400), `accepted ${JSON.stringify(style)}`);
    }
    assert.deepEqual((await listed(track.id)).style, track.style);
  });

  test('a symbology keeps only the settings its type uses', async () => {
    await layers.saveLayerStyle(track.id, { ...STYLE, symbology: { type: 'single', field: 'name', extra: [1, 2] } });
    assert.deepEqual((await listed(track.id)).style.symbology, SINGLE);
  });

  test('categories and colour scales are saved, tidied up', async () => {
    const categories = { type: 'categories', field: 'kind', categories: [{ value: 'well', color: '#AABBCC' }, { value: 3, color: '#112233' }, { value: false, color: '#445566' }], extra: 1 };
    await layers.saveLayerStyle(areas.id, { ...STYLE, symbology: categories });
    assert.deepEqual((await listed(areas.id)).style.symbology, {
      type: 'categories', field: 'kind', categories: [{ value: 'well', color: '#aabbcc' }, { value: 3, color: '#112233' }, { value: false, color: '#445566' }],
    });
    const scale = { type: 'scale', field: 'depth', ramp: 'blues', min: -2, max: 40 };
    await layers.saveLayerStyle(track.id, { ...STYLE, symbology: scale });
    assert.deepEqual((await listed(track.id)).style.symbology, scale);
  });

  test('points can be sized by a number, and only points', async () => {
    const size = { type: 'size', field: 'depth', min: 0, max: 10, minSize: 1, maxSize: 40 };
    await layers.saveLayerStyle(points.id, { ...STYLE, symbology: size });
    assert.deepEqual((await listed(points.id)).style.symbology, size);
    for (const layer of [areas, track]) {
      await assert.rejects(layers.saveLayerStyle(layer.id, { ...STYLE, symbology: size }), status(400));
    }
    const bad = [
      { ...size, minSize: 0 }, { ...size, maxSize: 41 }, { ...size, minSize: 9, maxSize: 8 },
      { ...size, min: 5, max: 4 }, { ...size, field: undefined }, { ...size, maxSize: '20' },
    ];
    for (const symbology of bad) {
      await assert.rejects(layers.saveLayerStyle(points.id, { ...STYLE, symbology }), status(400), `accepted ${JSON.stringify(symbology)}`);
    }
  });

  test("a categories or colour scale style's settings must be valid", async () => {
    const category = (value, color = '#112233') => ({ value, color });
    const many = Array.from({ length: 25 }, (_, i) => category(i));
    const bad = [
      { type: 'categories', categories: [] }, { type: 'categories', field: '', categories: [] },
      { type: 'categories', field: 'x'.repeat(1001), categories: [] }, { type: 'categories', field: 'kind' },
      { type: 'categories', field: 'kind', categories: many }, { type: 'categories', field: 'kind', categories: [category('a', 'red')] },
      { type: 'categories', field: 'kind', categories: [category(null)] }, { type: 'categories', field: 'kind', categories: [category({})] },
      { type: 'categories', field: 'kind', categories: [category('x'.repeat(201))] },
      { type: 'categories', field: 'kind', categories: [category(3), category('3')] },
      { type: 'categories', field: 'kind', categories: [null] },
      { type: 'scale', field: 'depth', ramp: 'rainbow', min: 0, max: 1 }, { type: 'scale', field: 'depth', ramp: 'toString', min: 0, max: 1 },
      { type: 'scale', field: 'depth', ramp: 'blues', min: 2, max: 1 }, { type: 'scale', field: 'depth', ramp: 'blues', min: '0', max: 1 },
      { type: 'scale', field: 'depth', ramp: 'blues', min: 0, max: Infinity }, { type: 'scale', ramp: 'blues', min: 0, max: 1 },
    ];
    for (const symbology of bad) {
      await assert.rejects(layers.saveLayerStyle(points.id, { ...STYLE, symbology }), status(400), `accepted ${JSON.stringify(symbology)}`);
    }
  });

  test('points can be a heatmap, weighted by a number or not, or clustered', async () => {
    const heatmaps = [
      { type: 'heatmap', field: null, radius: 20, intensity: 1 },
      { type: 'heatmap', field: 'depth', min: 0, max: 5, radius: 60, intensity: 0.1 },
    ];
    for (const symbology of [...heatmaps, { type: 'cluster', radius: 50 }]) {
      await layers.saveLayerStyle(points.id, { ...STYLE, symbology });
      assert.deepEqual((await listed(points.id)).style.symbology, symbology);
      await assert.rejects(layers.saveLayerStyle(areas.id, { ...STYLE, symbology }), status(400));
    }
    // A heatmap with no weight drops a range it doesn't use.
    await layers.saveLayerStyle(points.id, { ...STYLE, symbology: { ...heatmaps[0], min: 0, max: 1 } });
    assert.deepEqual((await listed(points.id)).style.symbology, heatmaps[0]);
  });

  test("a heatmap or cluster style's settings must be in range", async () => {
    const heatmap = { type: 'heatmap', field: null, radius: 20, intensity: 1 };
    const bad = [
      { ...heatmap, radius: 1 }, { ...heatmap, radius: 61 }, { ...heatmap, intensity: 0 }, { ...heatmap, intensity: 6 },
      { ...heatmap, field: undefined }, { ...heatmap, field: 'depth' }, { ...heatmap, field: 'depth', min: 2, max: 1 },
      { type: 'cluster', radius: 9 }, { type: 'cluster', radius: 101 }, { type: 'cluster' },
    ];
    for (const symbology of bad) {
      await assert.rejects(layers.saveLayerStyle(points.id, { ...STYLE, symbology }), status(400), `accepted ${JSON.stringify(symbology)}`);
    }
  });

  test('a missing layer is a 404', async () => {
    await assert.rejects(layers.saveLayerStyle(999999, STYLE), status(404));
    await assert.rejects(layers.saveLayerStyle('nope', STYLE), status(404));
  });
});
