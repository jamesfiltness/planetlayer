import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';
import { collection, freshDatabase, point, square, upload } from './helpers.js';

let db, map, importFile, runTool, run;
const layer = {};

// Three areas in a row and an L, points inside, on a border and outside, two
// small areas, and a line running through the first row.
//
//   C
//   A B        p at (0.5,0.5), (1,0.5) on the A|B border, (1.5,0.5), (5,5)
before(async () => {
  db = await freshDatabase('spatial_test_tools');
  ({ importFile } = await import('../import.js'));
  ({ runTool } = await import('../tools.js'));
  const { createMap } = await import('../maps.js');
  map = await createMap('Tools');
  run = (tool, params) => runTool(map.id, tool, params);
  const add = async (name, fc) => ([layer[name]] = await importFile(await upload(`${name}.geojson`, fc), map.id));
  await add('areas', collection(
    [square(0, 0), { name: 'A', kind: 'x' }],
    [square(1, 0), { name: 'B', kind: 'x' }],
    [square(0, 1), { name: 'C', kind: 'y' }],
  ));
  await add('points', collection(
    [point(0.5, 0.5), { pop: 10, label: 'a' }],
    [point(1, 0.5), { pop: 20, label: 'b' }],
    [point(1.5, 0.5), { pop: 5, label: 'c' }],
    [point(5, 5), { pop: 1, label: 'd' }],
  ));
  // One small area inside A, and one straddling A and B with its centre in B.
  await add('blobs', collection([square(0.2, 0.2, 0.4)], [square(0.8, 0.2, 0.6)]));
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
  describe('summarize', () => {
    const summarize = async (params) =>
      (await features(await run('summarize', { areas: layer.areas.id, ...params }))).map((f) => f.props);

    test('counts the features in each area; a point on a shared border counts for both', async () => {
      const out = await run('summarize', { areas: layer.areas.id, features: layer.points.id, field: '' });
      assert.equal(out.shape, 'polygon');
      assert.equal(out.name, 'areas points summary');
      const props = (await features(out)).map((f) => f.props);
      assert.deepEqual(props.map((p) => [p.name, p.count]), [['A', 2], ['B', 2], ['C', 0]]);
      assert.deepEqual(Object.keys(props[0]).sort(), ['count', 'kind', 'name'], 'nothing added up');
    });

    test('a line or area counts once, in the area holding its centre', async () => {
      const props = await summarize({ features: layer.blobs.id });
      assert.deepEqual(props.map((p) => [p.name, p.count]), [['A', 1], ['B', 1], ['C', 0]]);
    });

    test('adds up a property as a sum, mean, minimum or maximum', async () => {
      const stat = async (name) => (await summarize({ features: layer.points.id, field: 'pop', stat: name })).map((p) => p[`pop_${name}`]);
      assert.deepEqual(await stat('sum'), [30, 25, 0], 'an empty area sums to 0');
      assert.deepEqual(await stat('mean'), [15, 12.5, null], 'and has no mean');
      assert.deepEqual(await stat('min'), [10, 5, null]);
      assert.deepEqual(await stat('max'), [20, 20, null]);
    });

    test('values that are not numbers are skipped, but still counted', async () => {
      const props = await summarize({ features: layer.points.id, field: 'label', stat: 'sum' });
      assert.deepEqual(props.map((p) => [p.count, p.label_sum]), [[2, 0], [2, 0], [0, 0]]);
    });
  });

  test('intersect: keeps the parts of the line inside each area, with both sets of properties', async () => {
    const out = await run('intersect', { layer: layer.line.id, areas: layer.areas.id });
    const rows = await features(out);
    assert.equal(out.shape, 'line');
    assert.deepEqual(rows.map((f) => f.props.kind).sort(), ['x', 'x']);
    assert.ok(rows.every((f) => f.props.name === 'road'));
    assert.ok(Math.abs(rows.reduce((sum, f) => sum + f.length, 0) - 2) < 1e-9);
  });

  test('subtract: keeps the parts of the line outside every area', async () => {
    const rows = await features(await run('subtract', { layer: layer.line.id, areas: layer.areas.id }));
    assert.equal(rows.length, 1);
    assert.ok(Math.abs(rows[0].length - 1) < 1e-9);
  });

  test('dissolve: merges by a property, or everything', async () => {
    const byKind = await features(await run('dissolve', { layer: layer.areas.id, field: 'kind' }));
    assert.deepEqual(byKind.map((f) => [f.props.kind, f.props.count]).sort(), [['x', 2], ['y', 1]]);
    const all = await features(await run('dissolve', { layer: layer.areas.id, field: '' }));
    assert.deepEqual(all.map((f) => f.props.count), [3]);
  });

  test('centroid: one point per area, at its centre', async () => {
    const out = await run('centroid', { layer: layer.areas.id });
    assert.equal(out.shape, 'point');
    assert.deepEqual((await features(out)).map((f) => f.wkt), ['POINT(0.5 0.5)', 'POINT(1.5 0.5)', 'POINT(0.5 1.5)']);
  });

  test('buffer: draws a circle of the given radius around each point', async () => {
    const rows = await features(await run('buffer', { layer: layer.points.id, distance: 1, unit: 'km', merge: false }));
    assert.equal(rows.length, 4);
    for (const f of rows) assert.ok(Math.abs(f.area / (Math.PI * 1e6) - 1) < 0.02, `area ${f.area}`);
  });

  test('buffer: merging joins overlapping buffers', async () => {
    // At 60 km the three points in a row overlap; the far one stays apart.
    const rows = await features(await run('buffer', { layer: layer.points.id, distance: 60, unit: 'km', merge: true }));
    assert.equal(rows.length, 2);
  });

  test('combine: puts two layers of the same shape together, with a custom name', async () => {
    const out = await run('combine', { layer: layer.areas.id, other: layer.more.id, name: '  Everything  ' });
    assert.equal(out.name, 'Everything');
    assert.equal((await features(out)).length, 4);
  });

  describe('rejects bad input with a 400', () => {
    const rejects = (tool, params, message) =>
      assert.rejects(run(tool, params), (error) => error.status === 400 && message.test(error.message));

    test('unknown tool', () => rejects('explode', {}, /Unknown tool/));
    test('missing layer', () => rejects('centroid', {}, /Pick a layer for "Layer"/));
    test('non-numeric layer id', () => rejects('centroid', { layer: 'abc' }, /Pick a layer/));
    test('wrong shape', () => rejects('summarize', { areas: layer.points.id, features: layer.points.id }, /must be a polygon layer/));
    test('unknown statistic', () => rejects('summarize', { areas: layer.areas.id, features: layer.points.id, field: 'pop', stat: 'median' }, /how to add it up/));
    test('Count points is now Summarize within', () => rejects('count', { areas: layer.areas.id, points: layer.points.id }, /Unknown tool/));
    test('combine across shapes', () => rejects('combine', { layer: layer.areas.id, other: layer.points.id }, /must be a polygon layer/));
    test('distance over 100 km', () => rejects('buffer', { layer: layer.points.id, distance: 200, unit: 'km' }, /at most 100 km/));
    test('unknown unit', () => rejects('buffer', { layer: layer.points.id, distance: 1, unit: 'parsec' }, /Unknown unit/));
    test('negative buffer on points', () => rejects('buffer', { layer: layer.points.id, distance: -1, unit: 'km' }, /negative/));
    test('a JSON body that is not an object', () => rejects('centroid', 'nope', /JSON object/));
    test('merge sent as text', () => rejects('buffer', { layer: layer.points.id, distance: 1, unit: 'km', merge: 'false' }, /true or false/));
    test('a name over 200 characters', () => rejects('centroid', { layer: layer.areas.id, name: 'x'.repeat(201) }, /at most 200/));
  });

  test("a made-up name that's too long is cut short, not refused", async () => {
    const { createLayer } = await import('../layers.js');
    const long = await createLayer(db.pool, map.id, 'y'.repeat(250), 'polygon');
    assert.equal(Array.from(long.name).length, 200);
    assert.ok(long.name.endsWith('…'));
    await db.pool.query('INSERT INTO features (layer_id, geom) VALUES ($1, ST_MakeEnvelope(0, 0, 1, 1, 4326))', [long.id]);
    const out = await run('centroid', { layer: long.id });
    assert.equal(Array.from(out.name).length, 200);
  });

  test('a tool that produces nothing leaves no empty layer behind', async () => {
    const [far] = await importFile(await upload('far.geojson', collection([point(50, 50)])), map.id);
    const before = await layerCount();
    await assert.rejects(run('intersect', { layer: far.id, areas: layer.areas.id }), /produced no features/);
    assert.equal(await layerCount(), before);
  });

  test('a layer from another map cannot be used, and results stay in their own map', async () => {
    const { createMap } = await import('../maps.js');
    const other = await createMap('Other');
    await assert.rejects(runTool(other.id, 'centroid', { layer: layer.areas.id }), (error) => error.status === 400 && /Pick a layer/.test(error.message));
    const out = await run('centroid', { layer: layer.areas.id });
    assert.equal(out.map_id, map.id);
  });

  describe('use only the features a filter lets through', () => {
    let saveLayerFilter;
    before(async () => ({ saveLayerFilter } = await import('../layerFilter.js')));
    const filter = (l, conditions) => saveLayerFilter(l.id, conditions && { match: 'all', conditions });
    afterEach(async () => {
      for (const l of [layer.points, layer.areas]) await filter(l, null);
    });

    test('buffer, naming the result after the filtered layer', async () => {
      await filter(layer.points, [{ field: 'pop', op: 'gte', value: 10 }]);
      const out = await run('buffer', { layer: layer.points.id, distance: 1, unit: 'km' });
      assert.equal(out.name, 'points (filtered) buffer');
      assert.deepEqual((await features(out)).map((f) => f.props.pop), [10, 20]);
    });

    test('summarize counts and adds up only the matching features', async () => {
      await filter(layer.points, [{ field: 'pop', op: 'gte', value: 10 }]);
      const out = await run('summarize', { areas: layer.areas.id, features: layer.points.id, field: 'pop', stat: 'sum' });
      assert.deepEqual((await features(out)).map((f) => [f.props.name, f.props.count, f.props.pop_sum]), [['A', 2, 30], ['B', 1, 20], ['C', 0, 0]]);
    });

    test('combine, with only one of the layers filtered', async () => {
      await filter(layer.areas, [{ field: 'kind', op: 'eq', value: 'x' }]);
      const out = await run('combine', { layer: layer.areas.id, other: layer.more.id });
      assert.equal(out.name, 'areas (filtered) + more');
      assert.deepEqual((await features(out)).map((f) => f.props.name).sort(), ['A', 'B', 'D']);
    });

    test('a filter that lets nothing through says so', async () => {
      await filter(layer.points, [{ field: 'pop', op: 'gt', value: 1000 }]);
      await assert.rejects(run('buffer', { layer: layer.points.id, distance: 1, unit: 'km' }),
        (error) => error.status === 400 && /Check the filters/.test(error.message));
    });
  });

  test('new layers get stable colours from their id', async () => {
    const { rows } = await db.pool.query('SELECT id, fill_color FROM layers ORDER BY id LIMIT 2');
    assert.notEqual(rows[0].fill_color, rows[1].fill_color);
  });
});
