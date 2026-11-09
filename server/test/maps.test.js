import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { collection, freshDatabase, point, upload } from './helpers.js';

let db, maps, importFile;

before(async () => {
  db = await freshDatabase('spatial_test_maps');
  maps = await import('../maps.js');
  ({ importFile } = await import('../import.js'));
});

after(() => db.pool.end());

const status = (code) => (error) => error.status === code;
const count = async (table) => (await db.pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;

describe('maps', () => {
  test('a new map is empty and its name is trimmed', async () => {
    const map = await maps.createMap('  Field survey  ');
    assert.equal(map.name, 'Field survey');
    assert.equal(map.layer_count, 0);
    assert.deepEqual(await maps.getMap(String(map.id)), map);
  });

  test('names must be non-empty strings of at most 200 characters', async () => {
    for (const name of [undefined, 42, '', '   ', 'x'.repeat(201)]) {
      await assert.rejects(maps.createMap(name), status(400), `accepted ${JSON.stringify(name)}`);
    }
    assert.equal((await maps.createMap('x'.repeat(200))).name.length, 200);
  });

  test('rename changes the name and checks it the same way', async () => {
    const map = await maps.createMap('Draft');
    assert.equal((await maps.renameMap(map.id, ' Final ')).name, 'Final');
    await assert.rejects(maps.renameMap(map.id, ''), status(400));
  });

  test('the list puts the most recently edited map first, with layer counts', async () => {
    const older = await maps.createMap('Older');
    await maps.createMap('Newer');
    await importFile(await upload('wells.geojson', collection([point(1, 2)])), older.id);
    const [first] = await maps.listMaps();
    assert.deepEqual([first.id, first.layer_count], [older.id, 1]);
  });

  test("deleting a map deletes its layers and features, and no other map's", async () => {
    const doomed = await maps.createMap('Doomed');
    const kept = await maps.createMap('Kept');
    await importFile(await upload('a.geojson', collection([point(1, 2)], [point(3, 4)])), doomed.id);
    const [keptLayer] = await importFile(await upload('b.geojson', collection([point(5, 6)])), kept.id);
    const [layersBefore, featuresBefore] = [await count('layers'), await count('features')];

    await maps.deleteMap(doomed.id);

    assert.equal(await count('layers'), layersBefore - 1);
    assert.equal(await count('features'), featuresBefore - 2);
    assert.equal((await maps.getMap(kept.id)).layer_count, 1);
    const { rowCount } = await db.pool.query('SELECT 1 FROM features WHERE layer_id = $1', [keptLayer.id]);
    assert.equal(rowCount, 1);
  });

  test('a new map has no saved view', async () => {
    assert.equal((await maps.createMap('Unmoved')).view, null);
  });

  test('a saved view comes back from the map and the list, with bearing and pitch defaulting to 0', async () => {
    const map = await maps.createMap('Viewed');
    await maps.saveMapView(map.id, { center: [-0.1276, 51.5072], zoom: 12.5 });
    const expected = { center: [-0.1276, 51.5072], zoom: 12.5, bearing: 0, pitch: 0 };
    assert.deepEqual((await maps.getMap(map.id)).view, expected);
    assert.deepEqual((await maps.listMaps()).find((m) => m.id === map.id).view, expected);

    await maps.saveMapView(map.id, { center: [10, 20], zoom: 3, bearing: -45, pitch: 30 });
    assert.deepEqual((await maps.getMap(map.id)).view, { center: [10, 20], zoom: 3, bearing: -45, pitch: 30 });
  });

  test('saving a view is not an edit: updated_at and the list order stay put', async () => {
    const older = await maps.createMap('Looked at');
    const newer = await maps.createMap('Edited');
    await maps.saveMapView(older.id, { center: [1, 2], zoom: 4 });
    assert.equal((await maps.getMap(older.id)).updated_at.getTime(), older.updated_at.getTime());
    const ids = (await maps.listMaps()).map((m) => m.id);
    assert.ok(ids.indexOf(newer.id) < ids.indexOf(older.id));
  });

  test('impossible views are rejected', async () => {
    const map = await maps.createMap('Strict');
    for (const view of [
      undefined, {}, { zoom: 3 }, { center: [1], zoom: 3 }, { center: [1, 2, 3], zoom: 3 },
      { center: ['1', 2], zoom: 3 }, { center: [1, 2], zoom: 'NaN' }, { center: [1, 2], zoom: NaN },
      { center: [1, 91], zoom: 3 }, { center: [181, 2], zoom: 3 }, { center: [1, 2], zoom: -1 },
      { center: [1, 2], zoom: 3, pitch: 90 }, { center: [1, 2], zoom: 3, bearing: 200 },
    ]) {
      await assert.rejects(maps.saveMapView(map.id, view), status(400), `accepted ${JSON.stringify(view)}`);
    }
    assert.equal((await maps.getMap(map.id)).view, null);
  });

  test('unknown or impossible ids are not found', async () => {
    for (const id of [999999, '999999', 'abc', -1, 2 ** 31]) {
      await assert.rejects(maps.getMap(id), status(404), `found ${id}`);
    }
    await assert.rejects(maps.renameMap(999999, 'Nope'), status(404));
    await assert.rejects(maps.deleteMap(999999), status(404));
    await assert.rejects(maps.saveMapView(999999, { center: [1, 2], zoom: 3 }), status(404));
  });
});
