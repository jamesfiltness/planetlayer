import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { collection, freshDatabase, point, square, upload } from './helpers.js';

let db, importFile, runTool;
const layer = {};

// Three areas in a row and an L, points inside, on a border and outside, and
// a line running through the first row.
//
//   C
//   A B        p at (0.5,0.5), (1,0.5) on the A|B border, (1.5,0.5), (5,5)
before(async () => {
  db = await freshDatabase('spatial_test_tools');
  ({ importFile } = await import('../import.js'));
  ({ runTool } = await import('../tools.js'));
  const add = async (name, fc) => ([layer[name]] = await importFile(await upload(`${name}.geojson`, fc)));
  await add('areas', collection(
    [square(0, 0), { name: 'A', kind: 'x' }],
    [square(1, 0), { name: 'B', kind: 'x' }],
    [square(0, 1), { name: 'C', kind: 'y' }],
  ));
  await add('points', collection([point(0.5, 0.5)], [point(1, 0.5)], [point(1.5, 0.5)], [point(5, 5)]));
  await add('line', collection([{ type: 'LineString', coordinates: [[-0.5, 0.5], [2.5, 0.5]] }, { name: 'road' }]));
  await add('more', collection([square(10, 10), { name: 'D' }]));
});

after(() => db.pool.end());

const features = async (l) =>
  (await db.pool.query(
    'SELECT props, ST_AsText(geom) AS wkt, ST_Length(geom) AS length, ST_Area(geom::geography) AS area FROM features WHERE layer_id = $1 ORDER BY id',
    [l.id],
  )).rows;
const layerCount = async () => (await db.pool.query('SELECT count(*)::int AS n FROM layers')).rows[0].n;

describe('tools', () => {
  test('count: a point on a shared border counts for both areas', async () => {
    const out = await runTool('count', { areas: layer.areas.id, points: layer.points.id });
    assert.equal(out.shape, 'polygon');
    assert.deepEqual((await features(out)).map((f) => [f.props.name, f.props.count]), [['A', 2], ['B', 2], ['C', 0]]);
  });

  test('intersect: keeps the parts of the line inside each area, with both sets of properties', async () => {
    const out = await runTool('intersect', { layer: layer.line.id, areas: layer.areas.id });
    const rows = await features(out);
    assert.equal(out.shape, 'line');
    assert.deepEqual(rows.map((f) => f.props.kind).sort(), ['x', 'x']);
    assert.ok(rows.every((f) => f.props.name === 'road'));
    assert.ok(Math.abs(rows.reduce((sum, f) => sum + f.length, 0) - 2) < 1e-9);
  });

  test('subtract: keeps the parts of the line outside every area', async () => {
    const rows = await features(await runTool('subtract', { layer: layer.line.id, areas: layer.areas.id }));
    assert.equal(rows.length, 1);
    assert.ok(Math.abs(rows[0].length - 1) < 1e-9);
  });

  test('dissolve: merges by a property, or everything', async () => {
    const byKind = await features(await runTool('dissolve', { layer: layer.areas.id, field: 'kind' }));
    assert.deepEqual(byKind.map((f) => [f.props.kind, f.props.count]).sort(), [['x', 2], ['y', 1]]);
    const all = await features(await runTool('dissolve', { layer: layer.areas.id, field: '' }));
    assert.deepEqual(all.map((f) => f.props.count), [3]);
  });

  test('centroid: one point per area, at its centre', async () => {
    const out = await runTool('centroid', { layer: layer.areas.id });
    assert.equal(out.shape, 'point');
    assert.deepEqual((await features(out)).map((f) => f.wkt), ['POINT(0.5 0.5)', 'POINT(1.5 0.5)', 'POINT(0.5 1.5)']);
  });

  test('buffer: draws a circle of the given radius around each point', async () => {
    const rows = await features(await runTool('buffer', { layer: layer.points.id, distance: 1, unit: 'km', merge: false }));
    assert.equal(rows.length, 4);
    for (const f of rows) assert.ok(Math.abs(f.area / (Math.PI * 1e6) - 1) < 0.02, `area ${f.area}`);
  });

  test('buffer: merging joins overlapping buffers', async () => {
    // At 60 km the three points in a row overlap; the far one stays apart.
    const rows = await features(await runTool('buffer', { layer: layer.points.id, distance: 60, unit: 'km', merge: true }));
    assert.equal(rows.length, 2);
  });

  test('combine: puts two layers of the same shape together, with a custom name', async () => {
    const out = await runTool('combine', { layer: layer.areas.id, other: layer.more.id, name: '  Everything  ' });
    assert.equal(out.name, 'Everything');
    assert.equal((await features(out)).length, 4);
  });

  describe('rejects bad input with a 400', () => {
    const rejects = (tool, params, message) =>
      assert.rejects(runTool(tool, params), (error) => error.status === 400 && message.test(error.message));

    test('unknown tool', () => rejects('explode', {}, /Unknown tool/));
    test('missing layer', () => rejects('centroid', {}, /Pick a layer for "Layer"/));
    test('non-numeric layer id', () => rejects('centroid', { layer: 'abc' }, /Pick a layer/));
    test('wrong shape', () => rejects('count', { areas: layer.points.id, points: layer.points.id }, /must be a polygon layer/));
    test('combine across shapes', () => rejects('combine', { layer: layer.areas.id, other: layer.points.id }, /must be a polygon layer/));
    test('distance over 100 km', () => rejects('buffer', { layer: layer.points.id, distance: 200, unit: 'km' }, /at most 100 km/));
    test('unknown unit', () => rejects('buffer', { layer: layer.points.id, distance: 1, unit: 'parsec' }, /Unknown unit/));
    test('negative buffer on points', () => rejects('buffer', { layer: layer.points.id, distance: -1, unit: 'km' }, /negative/));
    test('a JSON body that is not an object', () => rejects('centroid', 'nope', /JSON object/));
  });

  test('a tool that produces nothing leaves no empty layer behind', async () => {
    const [far] = await importFile(await upload('far.geojson', collection([point(50, 50)])));
    const before = await layerCount();
    await assert.rejects(runTool('intersect', { layer: far.id, areas: layer.areas.id }), /produced no features/);
    assert.equal(await layerCount(), before);
  });

  test('new layers get stable colours from their id', async () => {
    const { rows } = await db.pool.query('SELECT id, color FROM layers ORDER BY id LIMIT 2');
    assert.notEqual(rows[0].color, rows[1].color);
  });
});
