// The Summarize nearby and Spatial join tools, and the warning about a
// property that's partly text.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { collection, freshDatabase, point, square, upload } from './helpers.js';

let db, map, run;
const layer = {};

// Near the equator a degree is about 111 km. Pumps 1 and 2 are 0.01° (1.1 km)
// apart; pump 3 is far away. Houses sit near the pumps, and one area's
// centre is near pump 1.
//
//   pumps:  P1 (0, 0)   P2 (0.01, 0)   P3 (1, 1)
//   houses: (0.005, 0) people 10, (0.015, 0) people 20, (0.5, 0.5) people 40
before(async () => {
  db = await freshDatabase('spatial_test_nearby_join');
  const { importFile } = await import('../import.js');
  const { runTool } = await import('../tools.js');
  const { createMap } = await import('../maps.js');
  map = await createMap('Nearby');
  run = (tool, params) => runTool(map.id, tool, params);
  const add = async (name, fc) => ([layer[name]] = await importFile(await upload(`${name}.geojson`, fc), map.id));
  await add('pumps', collection([point(0, 0), { name: 'P1' }], [point(0.01, 0), { name: 'P2' }], [point(1, 1), { name: 'P3' }]));
  await add('houses', collection(
    [point(0.005, 0), { name: 'h1', people: 10 }], [point(0.015, 0), { name: 'h2', people: 20 }], [point(0.5, 0.5), { name: 'h3', people: 40 }],
  ));
  await add('fields', collection([square(-0.002, -0.002, 0.004), { crop: 'maize' }]));
});

after(() => db.pool.end());

const props = async (l) => (await db.pool.query('SELECT props FROM features WHERE layer_id = $1 ORDER BY id', [l.id])).rows.map((r) => r.props);

describe('summarize nearby', () => {
  test('counts and adds up the features within the distance of each feature, keeping its shape', async () => {
    const out = await run('summarize_nearby', { layer: layer.pumps.id, features: layer.houses.id, distance: 1, unit: 'km', field: 'people', stat: 'sum' });
    assert.equal(out.shape, 'point');
    assert.equal(out.name, 'houses within 1 km of pumps');
    assert.deepEqual((await props(out)).map((p) => [p.name, p.count, p.people_sum]), [['P1', 1, 10], ['P2', 2, 30], ['P3', 0, 0]]);
  });

  test('an area counts by its centre', async () => {
    const out = await run('summarize_nearby', { layer: layer.pumps.id, features: layer.fields.id, distance: 100, unit: 'm' });
    assert.deepEqual((await props(out)).map((p) => p.count), [1, 0, 0]);
  });

  test('with the same layer twice, a feature does not count itself', async () => {
    const out = await run('summarize_nearby', { layer: layer.pumps.id, features: layer.pumps.id, distance: 2, unit: 'km' });
    assert.deepEqual((await props(out)).map((p) => p.count), [1, 1, 0]);
  });

  test('warns when some values of the property are text', async () => {
    // Added straight to the table: an import would store both values as text.
    const { createLayer } = await import('../layers.js');
    const mixed = await createLayer(db.pool, map.id, 'mixed', 'point');
    for (const people of [5, 'lots']) {
      await db.pool.query('INSERT INTO features (layer_id, geom, props) VALUES ($1, ST_SetSRID(ST_MakePoint(0.005, 0), 4326), $2)', [mixed.id, { people }]);
    }
    const out = await run('summarize_nearby', { layer: layer.pumps.id, features: mixed.id, distance: 1, unit: 'km', field: 'people' });
    assert.deepEqual(out.warnings, ['1 of the 2 values of "people" aren\'t numbers and were left out. '
      + 'Recalculate it as number(<property>) first, in the layer editor\'s Properties tab (or with calculate_property).']);
  });

  test('refuses a negative or too large distance', async () => {
    const rejects = (distance, unit) => assert.rejects(
      run('summarize_nearby', { layer: layer.pumps.id, features: layer.houses.id, distance, unit }),
      (error) => error.status === 400 && /zero or more, and at most 100 km/.test(error.message));
    await rejects(-1, 'km');
    await rejects(101, 'km');
    await rejects('far', 'km');
  });
});

describe('spatial join', () => {
  test('gives each feature the nearest one\'s properties within reach, and how far it was', async () => {
    const out = await run('spatial_join', { layer: layer.houses.id, join: layer.pumps.id, distance: 1, unit: 'km' });
    assert.equal(out.shape, 'point');
    assert.equal(out.name, 'houses joined to pumps');
    const rows = await props(out);
    assert.deepEqual(rows.map((p) => [p.name, p.name_2]), [['h1', 'P1'], ['h2', 'P2'], ['h3', undefined]],
      'a name both have comes from the join as name_2; ties go to the first; nothing in reach adds nothing');
    assert.ok(Math.abs(rows[0].join_distance_km - 0.557) < 0.002, `${rows[0].join_distance_km}`);
    assert.equal(rows[2].join_distance_km, undefined);
  });

  test('a distance of zero means touching', async () => {
    const out = await run('spatial_join', { layer: layer.pumps.id, join: layer.fields.id, distance: 0, unit: 'm' });
    assert.deepEqual((await props(out)).map((p) => [p.crop, p.join_distance_m]), [['maize', 0], [undefined, undefined], [undefined, undefined]]);
  });

  test('with the same layer twice, each feature joins its nearest other feature', async () => {
    const out = await run('spatial_join', { layer: layer.pumps.id, join: layer.pumps.id, distance: 5, unit: 'km' });
    assert.deepEqual((await props(out)).map((p) => p.name_2), ['P2', 'P1', undefined]);
  });
});
