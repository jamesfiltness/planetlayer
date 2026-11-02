import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ImportService } from '../../src/imports/import.service.js';
import type { MapRow } from '../../src/maps/map.js';
import { MapsService } from '../../src/maps/maps.service.js';
import { collection, count, createTestApp, fixture, httpError, point, square, upload, type TestApp } from '../helpers.js';

let t: TestApp, map: MapRow, imports: ImportService;
let importInto: (file: { originalname: string; path: string }) => ReturnType<ImportService['importFile']>;

beforeAll(async () => {
  t = await createTestApp('spatial_test_import');
  imports = t.app.get(ImportService);
  map = await t.app.get(MapsService).create('Imports');
  importInto = (file) => imports.importFile(file, map.id);
});

afterAll(() => t.app.close());

const features = (layer: { id: number }) => count(t.db, 'features WHERE layer_id = $1', [layer.id]);
const layerCount = () => count(t.db, 'layers');

describe('ImportService', () => {
  test('GeoJSON becomes one layer named after the file', async () => {
    const layers = await importInto(await upload('wells.geojson', collection([point(1, 2), { depth: 30 }], [point(3, 4)])));
    expect(layers.map((l) => [l.name, l.shape])).toEqual([['wells', 'point']]);
    expect(await features(layers[0])).toBe(2);
  });

  test('a GeometryCollection mixing points and areas is split, not cut down to areas', async () => {
    const mixed = { type: 'GeometryCollection', geometries: [point(0.5, 5), square(0, 0)] };
    const layers = await importInto(await upload('mixed.geojson', collection([mixed, { id: 1 }], [point(9, 9), { id: 2 }])));
    expect(layers.map((l) => [l.name, l.shape])).toEqual([['mixed (points)', 'point'], ['mixed (polygons)', 'polygon']]);
    expect([await features(layers[0]), await features(layers[1])]).toEqual([2, 1]);
  });

  test('a polygon that collapses when repaired stays a polygon layer', async () => {
    // A bow tie with a spike: ST_MakeValid gives polygons plus a stray line.
    const spiky = { type: 'Polygon', coordinates: [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0], [-1, 0], [0, 0]]] };
    const layers = await importInto(await upload('spiky.geojson', collection([spiky])));
    expect(layers.map((l) => l.shape)).toEqual(['polygon']);
  });

  test('zipped shapefiles in subfolders are found and read in place', async () => {
    const layers = await importInto(fixture('nested.zip'));
    expect(layers.map((l) => [l.name, l.shape]).sort()).toEqual([['areas', 'polygon'], ['points', 'point']]);
  });

  test('KMZ is read', async () => {
    const [layer] = await importInto(fixture('places.kmz'));
    expect(layer.shape).toBe('point');
    expect(await features(layer)).toBe(3);
  });

  test('a failing layer rolls back the whole file', async () => {
    const before = await layerCount();
    await expect(importInto(fixture('half-bad.zip'))).rejects.toSatisfy(httpError(400, /has no coordinate system/));
    expect(await layerCount()).toBe(before);
  });

  test('a VRT disguised as .json cannot read other files', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'spatial-secret-'));
    const secret = path.join(dir, 'secret.csv');
    await writeFile(secret, 'name,x,y\nSECRET_VALUE,1,2\n');
    const vrt = `<OGRVRTDataSource><OGRVRTLayer name="leak"><SrcDataSource>${secret}</SrcDataSource><SrcLayer>secret</SrcLayer>
      <GeometryType>wkbPoint</GeometryType><GeometryField encoding="PointFromColumns" x="x" y="y"/></OGRVRTLayer></OGRVRTDataSource>`;
    await expect(importInto(await upload('evil.json', vrt))).rejects.toSatisfy(httpError(400, /Could not read that file/));
    expect(await count(t.db, "features WHERE props->>'name' = 'SECRET_VALUE'")).toBe(0);
  });

  test('importing into a map that no longer exists stores nothing', async () => {
    const before = await layerCount();
    const file = await upload('lost.geojson', collection([point(1, 1)]));
    await expect(imports.importFile(file, 999999)).rejects.toSatisfy(httpError(404));
    expect(await layerCount()).toBe(before);
  });

  test('unsupported extensions are refused', async () => {
    await expect(importInto({ originalname: 'notes.txt', path: '/dev/null' })).rejects.toSatisfy(httpError(400, /Unsupported file type/));
  });
});
