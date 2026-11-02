import { ImportService } from '../../src/imports/import.service.js';
import type { LayerRow } from '../../src/layers/layer.js';
import type { MapRow } from '../../src/maps/map.js';
import { MapsService } from '../../src/maps/maps.service.js';
import { ToolsService } from '../../src/tools/tools.service.js';
import { collection, count, createTestApp, httpError, point, square, upload, type TestApp } from '../helpers.js';

let t: TestApp, map: MapRow, tools: ToolsService, imports: ImportService;
const layer: Record<string, LayerRow> = {};
const run = (tool: string, params: unknown) => tools.run(map.id, tool, params);

// Three areas in a row and an L, points inside, on a border and outside, and
// a line running through the first row.
//
//   C
//   A B        p at (0.5,0.5), (1,0.5) on the A|B border, (1.5,0.5), (5,5)
beforeAll(async () => {
  t = await createTestApp('spatial_test_tools');
  tools = t.app.get(ToolsService);
  imports = t.app.get(ImportService);
  map = await t.app.get(MapsService).create('Tools');
  const add = async (name: string, fc: object) => ([layer[name]] = await imports.importFile(await upload(`${name}.geojson`, fc), map.id));
  await add('areas', collection(
    [square(0, 0), { name: 'A', kind: 'x' }],
    [square(1, 0), { name: 'B', kind: 'x' }],
    [square(0, 1), { name: 'C', kind: 'y' }],
  ));
  await add('points', collection([point(0.5, 0.5)], [point(1, 0.5)], [point(1.5, 0.5)], [point(5, 5)]));
  await add('line', collection([{ type: 'LineString', coordinates: [[-0.5, 0.5], [2.5, 0.5]] }, { name: 'road' }]));
  await add('more', collection([square(10, 10), { name: 'D' }]));
});

afterAll(() => t.app.close());

const features = async (l: LayerRow) =>
  (await t.db.query(
    'SELECT props, ST_AsText(geom) AS wkt, ST_Length(geom) AS length, ST_Area(geom::geography) AS area FROM features WHERE layer_id = $1 ORDER BY id',
    [l.id],
  )).rows;

describe('ToolsService', () => {
  test('count: a point on a shared border counts for both areas', async () => {
    const out = await run('count', { areas: layer.areas.id, points: layer.points.id });
    expect(out.shape).toBe('polygon');
    expect((await features(out)).map((f) => [f.props.name, f.props.count])).toEqual([['A', 2], ['B', 2], ['C', 0]]);
  });

  test('intersect: keeps the parts of the line inside each area, with both sets of properties', async () => {
    const out = await run('intersect', { layer: layer.line.id, areas: layer.areas.id });
    const rows = await features(out);
    expect(out.shape).toBe('line');
    expect(rows.map((f) => f.props.kind).sort()).toEqual(['x', 'x']);
    expect(rows.every((f) => f.props.name === 'road')).toBe(true);
    expect(rows.reduce((sum, f) => sum + f.length, 0)).toBeCloseTo(2, 9);
  });

  test('subtract: keeps the parts of the line outside every area', async () => {
    const rows = await features(await run('subtract', { layer: layer.line.id, areas: layer.areas.id }));
    expect(rows).toHaveLength(1);
    expect(rows[0].length).toBeCloseTo(1, 9);
  });

  test('dissolve: merges by a property, or everything', async () => {
    const byKind = await features(await run('dissolve', { layer: layer.areas.id, field: 'kind' }));
    expect(byKind.map((f) => [f.props.kind, f.props.count]).sort()).toEqual([['x', 2], ['y', 1]]);
    const all = await features(await run('dissolve', { layer: layer.areas.id, field: '' }));
    expect(all.map((f) => f.props.count)).toEqual([3]);
  });

  test('centroid: one point per area, at its centre', async () => {
    const out = await run('centroid', { layer: layer.areas.id });
    expect(out.shape).toBe('point');
    expect((await features(out)).map((f) => f.wkt)).toEqual(['POINT(0.5 0.5)', 'POINT(1.5 0.5)', 'POINT(0.5 1.5)']);
  });

  test('buffer: draws a circle of the given radius around each point', async () => {
    const rows = await features(await run('buffer', { layer: layer.points.id, distance: 1, unit: 'km', merge: false }));
    expect(rows).toHaveLength(4);
    for (const f of rows) expect(Math.abs(f.area / (Math.PI * 1e6) - 1)).toBeLessThan(0.02);
  });

  test('buffer: merging joins overlapping buffers', async () => {
    // At 60 km the three points in a row overlap; the far one stays apart.
    const rows = await features(await run('buffer', { layer: layer.points.id, distance: 60, unit: 'km', merge: true }));
    expect(rows).toHaveLength(2);
  });

  test('combine: puts two layers of the same shape together, with a custom name', async () => {
    const out = await run('combine', { layer: layer.areas.id, other: layer.more.id, name: '  Everything  ' });
    expect(out.name).toBe('Everything');
    expect(await features(out)).toHaveLength(4);
  });

  describe('rejects bad input with a 400', () => {
    test.each<[string, string, () => unknown, RegExp]>([
      ['unknown tool', 'explode', () => ({}), /Unknown tool/],
      ['missing layer', 'centroid', () => ({}), /Pick a layer for "Layer"/],
      ['non-numeric layer id', 'centroid', () => ({ layer: 'abc' }), /Pick a layer/],
      ['wrong shape', 'count', () => ({ areas: layer.points.id, points: layer.points.id }), /must be a polygon layer/],
      ['combine across shapes', 'combine', () => ({ layer: layer.areas.id, other: layer.points.id }), /must be a polygon layer/],
      ['distance over 100 km', 'buffer', () => ({ layer: layer.points.id, distance: 200, unit: 'km' }), /at most 100 km/],
      ['unknown unit', 'buffer', () => ({ layer: layer.points.id, distance: 1, unit: 'parsec' }), /Unknown unit/],
      ['negative buffer on points', 'buffer', () => ({ layer: layer.points.id, distance: -1, unit: 'km' }), /negative/],
      ['a body that is not an object', 'centroid', () => 'nope', /JSON object/],
    ])('%s', async (_, tool, params, message) => {
      await expect(run(tool, params())).rejects.toSatisfy(httpError(400, message));
    });
  });

  test('a tool that produces nothing leaves no empty layer behind', async () => {
    const [far] = await imports.importFile(await upload('far.geojson', collection([point(50, 50)])), map.id);
    const before = await count(t.db, 'layers');
    await expect(run('intersect', { layer: far.id, areas: layer.areas.id })).rejects.toSatisfy(httpError(400, /produced no features/));
    expect(await count(t.db, 'layers')).toBe(before);
  });

  test('a layer from another map cannot be used, and results stay in their own map', async () => {
    const other = await t.app.get(MapsService).create('Other');
    await expect(tools.run(other.id, 'centroid', { layer: layer.areas.id })).rejects.toSatisfy(httpError(400, /Pick a layer/));
    expect((await run('centroid', { layer: layer.areas.id })).map_id).toBe(map.id);
  });

  test('new layers get stable colours from their id', async () => {
    const { rows } = await t.db.query('SELECT id, color FROM layers ORDER BY id LIMIT 2');
    expect(rows[0].color).not.toBe(rows[1].color);
  });
});
