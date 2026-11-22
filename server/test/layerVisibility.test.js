// Showing and hiding layers (layerVisibility.js), and the assistant tool.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { collection, freshDatabase, point, upload } from './helpers.js';

let db, map, layer, getLayer, setLayerVisibility;

before(async () => {
  db = await freshDatabase('spatial_test_visibility');
  const { importFile } = await import('../import.js');
  const { createMap } = await import('../maps.js');
  ({ getLayer } = await import('../layers.js'));
  ({ setLayerVisibility } = await import('../layerVisibility.js'));
  map = await createMap('Visibility');
  [layer] = await importFile(await upload('pumps.geojson', collection([point(0, 0)])), map.id);
});

after(() => db.pool.end());

test('a new layer is shown, and hiding it is saved', async () => {
  assert.equal(layer.visible ?? (await getLayer(layer.id)).visible, true);
  await setLayerVisibility(layer.id, false);
  assert.equal((await getLayer(layer.id)).visible, false);
  await setLayerVisibility(layer.id, true);
  assert.equal((await getLayer(layer.id)).visible, true);
});

test('only true or false, for a layer that exists', async () => {
  await assert.rejects(setLayerVisibility(layer.id, 'false'), (error) => error.status === 400 && /true or false/.test(error.message));
  await assert.rejects(setLayerVisibility(999999, false), (error) => error.status === 404);
});

test('a duplicated map keeps which layers are hidden', async () => {
  const { duplicateMap } = await import('../duplicateMap.js');
  await setLayerVisibility(layer.id, false);
  const copy = await duplicateMap(map.id, 'Copy');
  const { listLayers } = await import('../layers.js');
  assert.deepEqual((await listLayers(copy.id)).map((l) => l.visible), [false]);
});

test('set_layer_visibility hides a layer and says so', async () => {
  const { ASSISTANT_TOOLS } = await import('../assistant/registry.js');
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'set_layer_visibility');
  assert.equal((await tool.run({ layer_id: layer.id, visible: true })).layer.visible, true);
  assert.equal((await tool.run({ layer_id: layer.id, visible: false })).layer.visible, false);
});
