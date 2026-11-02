import { ImportService } from '../../src/imports/import.service.js';
import { MapsService } from '../../src/maps/maps.service.js';
import { collection, count, createTestApp, httpError, point, upload, type TestApp } from '../helpers.js';

let t: TestApp, maps: MapsService, imports: ImportService;

beforeAll(async () => {
  t = await createTestApp('spatial_test_maps');
  maps = t.app.get(MapsService);
  imports = t.app.get(ImportService);
});

afterAll(() => t.app.close());

describe('MapsService', () => {
  test('a new map is empty', async () => {
    const map = await maps.create('Field survey');
    expect(map).toMatchObject({ name: 'Field survey', layer_count: 0 });
    expect(await maps.get(map.id)).toEqual(map);
  });

  test('rename changes the name and moves the map to the top of the list', async () => {
    const map = await maps.create('Draft');
    await maps.create('Later');
    expect((await maps.rename(map.id, 'Final')).name).toBe('Final');
    expect((await maps.list())[0].id).toBe(map.id);
  });

  test('the list puts the most recently edited map first, with layer counts', async () => {
    const older = await maps.create('Older');
    await maps.create('Newer');
    await imports.importFile(await upload('wells.geojson', collection([point(1, 2)])), older.id);
    const [first] = await maps.list();
    expect([first.id, first.layer_count]).toEqual([older.id, 1]);
  });

  test("deleting a map deletes its layers and features, and no other map's", async () => {
    const doomed = await maps.create('Doomed');
    const kept = await maps.create('Kept');
    await imports.importFile(await upload('a.geojson', collection([point(1, 2)], [point(3, 4)])), doomed.id);
    const [keptLayer] = await imports.importFile(await upload('b.geojson', collection([point(5, 6)])), kept.id);
    const [layersBefore, featuresBefore] = [await count(t.db, 'layers'), await count(t.db, 'features')];

    await maps.delete(doomed.id);

    expect(await count(t.db, 'layers')).toBe(layersBefore - 1);
    expect(await count(t.db, 'features')).toBe(featuresBefore - 2);
    expect((await maps.get(kept.id)).layer_count).toBe(1);
    expect(await count(t.db, 'features WHERE layer_id = $1', [keptLayer.id])).toBe(1);
  });

  test('a missing map is a 404', async () => {
    await expect(maps.get(999999)).rejects.toSatisfy(httpError(404));
    await expect(maps.rename(999999, 'Nope')).rejects.toSatisfy(httpError(404));
    await expect(maps.delete(999999)).rejects.toSatisfy(httpError(404));
  });
});
