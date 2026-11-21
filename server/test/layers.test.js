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

  test('a missing layer is a 404', async () => {
    await assert.rejects(layers.saveLayerStyle(999999, STYLE), status(404));
    await assert.rejects(layers.saveLayerStyle('nope', STYLE), status(404));
  });
});
