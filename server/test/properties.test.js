// Calculating a property (server/properties/), as the Properties tab and
// the calculate_property tool do.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { freshDatabase } from './helpers.js';

let db, calculateProperty, layerId;

// Features are added straight to the table, so their values stay exactly as
// given: an import would already turn all-numeric text into numbers.
async function layerWith(...props) {
  const { createLayer } = await import('../layers.js');
  const { createMap } = await import('../maps.js');
  const map = await createMap('Properties');
  const layer = await createLayer(db.pool, map.id, 'places', 'point');
  for (const p of props) {
    await db.pool.query('INSERT INTO features (layer_id, geom, props) VALUES ($1, ST_MakePoint(0, 0), $2)', [layer.id, p]);
  }
  return layer.id;
}
const values = async (name) =>
  (await db.pool.query('SELECT props -> $2 AS v FROM features WHERE layer_id = $1 ORDER BY id', [layerId, name])).rows.map((r) => r.v);
const rejects = (promise, message) => assert.rejects(promise, (error) => error.status === 400 && message.test(error.message));

before(async () => {
  db = await freshDatabase('spatial_test_properties');
  ({ calculateProperty } = await import('../properties/calculate.js'));
});

after(() => db.pool.end());

describe('calculate a property', () => {
  test('works out the expression for every feature, leaving empty what it can\'t', async () => {
    layerId = await layerWith(
      { pop: 100, houses: 4, 'area sq km': 2 }, { pop: 10, houses: 0, 'area sq km': 1 }, { pop: '50', houses: 5, 'area sq km': 1 },
    );
    const result = await calculateProperty(layerId, { name: ' per_house ', expression: 'pop / houses' });
    assert.deepEqual(result, { name: 'per_house', numbers: 1, empty: 2 }, 'divide by zero and text are empty');
    assert.deepEqual(await values('per_house'), [25, null, null]);

    await calculateProperty(layerId, { name: 'density', expression: 'round(-pop / "area sq km" * 1.005, 1)' });
    assert.deepEqual(await values('density'), [-50.3, -10.1, null]);
    await calculateProperty(layerId, { name: 'm', expression: 'max(abs(houses - 3), round(2.5))' });
    assert.deepEqual(await values('m'), [3, 3, 3], 'round takes halves away from zero');
  });

  test('number() reads numbers written as text, and leaves anything else empty', async () => {
    layerId = await layerWith({ pop: ' 23.5 ' }, { pop: '007' }, { pop: 4 }, { pop: 'n/a' }, { pop: true }, { pop: { a: 1 } }, {});
    assert.deepEqual(await calculateProperty(layerId, { name: 'pop', expression: 'number(pop)' }), { name: 'pop', numbers: 3, empty: 4 });
    assert.deepEqual(await values('pop'), [23.5, 7, 4, null, null, null, null]);
  });

  test('replaces an existing property, and tells browsers to fetch the features again', async () => {
    layerId = await layerWith({ x: 1 });
    const { getLayer } = await import('../layers.js');
    await calculateProperty(layerId, { name: 'x', expression: 'x * 10' });
    assert.deepEqual(await values('x'), [10]);
    assert.equal((await getLayer(layerId)).data_version, 1);
    await calculateProperty(layerId, { name: 'x', expression: 'x + 1' });
    assert.equal((await getLayer(layerId)).data_version, 2);
  });

  test('explains mistakes, and a property that does not exist', async () => {
    layerId = await layerWith({ pop: 1 });
    await rejects(calculateProperty(layerId, { name: 'y', expression: 'pop +' }), /ends too soon/);
    await rejects(calculateProperty(layerId, { name: 'y', expression: 'pop + popp + "z z"' }), /no properties "popp", "z z"/);
    await rejects(calculateProperty(layerId, { name: ' ', expression: 'pop' }), /Name a property/);
    await rejects(calculateProperty(layerId, { name: 'y', expression: '1e300 * 1e300' }), /couldn't be worked out/);
    const { rows: [{ set }] } = await db.pool.query('SELECT bool_or(props ? $2) AS set FROM features WHERE layer_id = $1', [layerId, 'y']);
    assert.equal(set, false, 'nothing was set');
  });
});
