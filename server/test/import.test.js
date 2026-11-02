import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { collection, fixture, freshDatabase, point, square, upload } from './helpers.js';

let db, map, importInto;

before(async () => {
  db = await freshDatabase('spatial_test_import');
  const { importFile } = await import('../import.js');
  const { createMap } = await import('../maps.js');
  map = await createMap('Imports');
  importInto = (file) => importFile(file, map.id);
});

after(() => db.pool.end());

const count = async (l) => (await db.pool.query('SELECT count(*)::int AS n FROM features WHERE layer_id = $1', [l.id])).rows[0].n;
const layerCount = async () => (await db.pool.query('SELECT count(*)::int AS n FROM layers')).rows[0].n;
const rejects400 = (promise, message) => assert.rejects(promise, (error) => error.status === 400 && message.test(error.message));

describe('import', () => {
  test('GeoJSON becomes one layer named after the file', async () => {
    const [layer, ...rest] = await importInto(await upload('wells.geojson', collection([point(1, 2), { depth: 30 }], [point(3, 4)])));
    assert.equal(rest.length, 0);
    assert.deepEqual([layer.name, layer.shape, await count(layer)], ['wells', 'point', 2]);
  });

  test('a GeometryCollection mixing points and areas is split, not cut down to areas', async () => {
    const mixed = { type: 'GeometryCollection', geometries: [point(0.5, 5), square(0, 0)] };
    const layers = await importInto(await upload('mixed.geojson', collection([mixed, { id: 1 }], [point(9, 9), { id: 2 }])));
    assert.deepEqual(layers.map((l) => [l.name, l.shape]), [['mixed (points)', 'point'], ['mixed (polygons)', 'polygon']]);
    assert.deepEqual([await count(layers[0]), await count(layers[1])], [2, 1]);
  });

  test('a polygon that collapses when repaired stays a polygon layer', async () => {
    // A bow tie with a spike: ST_MakeValid gives polygons plus a stray line.
    const spiky = { type: 'Polygon', coordinates: [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0], [-1, 0], [0, 0]]] };
    const layers = await importInto(await upload('spiky.geojson', collection([spiky])));
    assert.deepEqual(layers.map((l) => l.shape), ['polygon']);
  });

  test('zipped shapefiles in subfolders are found and read in place', async () => {
    const layers = await importInto(fixture('nested.zip'));
    assert.deepEqual(layers.map((l) => [l.name, l.shape]).sort(), [['areas', 'polygon'], ['points', 'point']]);
  });

  test('KMZ is read', async () => {
    const [layer] = await importInto(fixture('places.kmz'));
    assert.equal(layer.shape, 'point');
    assert.equal(await count(layer), 3);
  });

  test('a failing layer rolls back the whole file', async () => {
    const before = await layerCount();
    await rejects400(importInto(fixture('half-bad.zip')), /has no coordinate system/);
    assert.equal(await layerCount(), before);
  });

  test('a VRT disguised as .json cannot read other files', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'spatial-secret-'));
    const secret = path.join(dir, 'secret.csv');
    await writeFile(secret, 'name,x,y\nSECRET_VALUE,1,2\n');
    const vrt = `<OGRVRTDataSource><OGRVRTLayer name="leak"><SrcDataSource>${secret}</SrcDataSource><SrcLayer>secret</SrcLayer>
      <GeometryType>wkbPoint</GeometryType><GeometryField encoding="PointFromColumns" x="x" y="y"/></OGRVRTLayer></OGRVRTDataSource>`;
    await rejects400(importInto(await upload('evil.json', vrt)), /Could not read that file/);
    const { rowCount } = await db.pool.query("SELECT 1 FROM features WHERE props->>'name' = 'SECRET_VALUE'");
    assert.equal(rowCount, 0);
  });

  test('importing into a map that no longer exists stores nothing', async () => {
    const { importFile } = await import('../import.js');
    const before = await layerCount();
    await assert.rejects(importFile(await upload('lost.geojson', collection([point(1, 1)])), 999999), (error) => error.status === 404);
    assert.equal(await layerCount(), before);
  });

  test('unsupported extensions are refused', () => rejects400(importInto({ originalname: 'notes.txt', path: '/dev/null' }), /Unsupported file type/));
});
