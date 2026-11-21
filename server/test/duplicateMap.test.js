// Duplicating a map: the copy matches the original, and the two are independent.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { collection, freshDatabase, point, square, upload } from './helpers.js';

let db, maps, layers, duplicateMap, source, wells;

before(async () => {
  db = await freshDatabase('spatial_test_duplicate');
  maps = await import('../maps.js');
  layers = await import('../layers.js');
  ({ duplicateMap } = await import('../duplicateMap.js'));
  const { importFile } = await import('../import.js');
  const { saveLayerFilter } = await import('../layerFilter.js');

  source = await maps.createMap('Survey');
  await maps.saveMapView(source.id, { center: [32.5, 1.3], zoom: 7, bearing: 10, pitch: 20 });
  [wells] = await importFile(await upload('wells.geojson', collection(
    [point(1, 2), { depth: 10 }], [point(3, 4), { depth: 40 }],
  )), source.id);
  await importFile(await upload('areas.geojson', collection([square(0, 0), { name: 'A' }])), source.id);
  // Give the layers a style, symbology and filter of their own, so the test
  // shows they're copied rather than defaulted.
  await layers.saveLayerStyle(wells.id, {
    fillColor: '#112233', fillOpacity: 0.5, outlineColor: '#445566', outlineWidth: 3, opacity: 0.8,
    symbology: { type: 'size', field: 'depth', min: 10, max: 40, minSize: 4, maxSize: 20 },
  });
  await saveLayerFilter(wells.id, { match: 'all', conditions: [{ field: 'depth', op: 'gt', value: 20 }] });
  source = await maps.getMap(source.id);
});

after(() => db.pool.end());

const status = (code) => (error) => error.status === code;
// A layer as listed, without what's expected to differ in a copy.
const comparable = ({ id: _id, map_id: _mapId, ...layer }) => layer;
const features = async (layerId) =>
  (await db.pool.query('SELECT ST_AsText(geom) AS geom, props FROM features WHERE layer_id = $1 ORDER BY id', [layerId])).rows;

describe('duplicating a map', () => {
  test('the copy has the new name, the same view, and copies of every layer in order', async () => {
    const copy = await duplicateMap(source.id, '  Survey (copy)  ');
    assert.notEqual(copy.id, source.id);
    assert.equal(copy.name, 'Survey (copy)');
    assert.deepEqual(copy.view, source.view);
    assert.equal(copy.layer_count, 2);

    const original = await layers.listLayers(source.id);
    const copied = await layers.listLayers(copy.id);
    assert.deepEqual(copied.map(comparable), original.map(comparable));
    for (const [i, layer] of copied.entries()) {
      assert.notEqual(layer.id, original[i].id);
      assert.deepEqual(await features(layer.id), await features(original[i].id));
    }
  });

  test('the copy is the most recently edited map, and the original is not edited', async () => {
    const copy = await duplicateMap(source.id, 'Newest');
    const [first] = await maps.listMaps();
    assert.equal(first.id, copy.id);
    assert.equal((await maps.getMap(source.id)).updated_at.getTime(), source.updated_at.getTime());
  });

  test('a map with no layers or view copies as an empty map with no view', async () => {
    const empty = await maps.createMap('Empty');
    const copy = await duplicateMap(empty.id, 'Empty copy');
    assert.deepEqual([copy.layer_count, copy.view], [0, null]);
  });

  test('the copy is independent: deleting the original leaves it whole', async () => {
    const doomed = await duplicateMap(source.id, 'Doomed');
    const copy = await duplicateMap(doomed.id, 'Survivor');
    await maps.deleteMap(doomed.id);
    const copied = await layers.listLayers(copy.id);
    assert.deepEqual(copied.map((layer) => layer.count), [2, 1]);
  });

  test('the name is checked like any map name', async () => {
    for (const name of [undefined, '', '   ', 'x'.repeat(201)]) {
      await assert.rejects(duplicateMap(source.id, name), status(400), `accepted ${JSON.stringify(name)}`);
    }
  });

  test('copying a missing map is not found, and makes nothing', async () => {
    const before = (await maps.listMaps()).length;
    for (const id of [999999, 'abc']) {
      await assert.rejects(duplicateMap(id, 'Nope'), status(404), `found ${id}`);
    }
    assert.equal((await maps.listMaps()).length, before);
  });
});
