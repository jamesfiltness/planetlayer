// Layer filters: what each operator matches, saving a filter, the filtered
// GeoJSON and count, saving the matching features as a new layer, and the
// property summaries the Filter tab is built from.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { freshDatabase } from './helpers.js';

let db, map, places, saveLayerFilter, saveFilteredAsLayer, fieldSummaries, listLayers, layerGeoJson;

// Five points, named so a test can say which ones a filter keeps. Between
// them they have numbers, text, booleans, nulls, empty text, a number stored
// as text and missing properties. They're inserted directly rather than
// imported, because GDAL would make each property one type.
const PLACES = [
  { name: 'Alpha', pop: 10, kind: 'town', open: true, note: 'North side' },
  { name: 'Beta', pop: 250, kind: 'city', open: false, note: '' },
  { name: 'Gamma', pop: 3, kind: 'Town', open: true, note: null },
  { name: 'Delta', pop: '7', kind: 'village' },
  { name: 'Echo', kind: 'city', "'; DROP TABLE layers; --": 'yes' },
];

before(async () => {
  db = await freshDatabase('spatial_test_filters');
  ({ saveLayerFilter, saveFilteredAsLayer } = await import('../layerFilter.js'));
  ({ fieldSummaries } = await import('../filter/fields.js'));
  ({ listLayers, layerGeoJson } = await import('../layers.js'));
  const { createMap } = await import('../maps.js');
  const { createLayer } = await import('../layers.js');
  map = await createMap('Filters');
  places = await createLayer(db.pool, map.id, 'places', 'point');
  for (const [i, props] of PLACES.entries()) {
    await db.pool.query(
      'INSERT INTO features (layer_id, geom, props) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $2), 4326), $3)',
      [places.id, i, props],
    );
  }
});

after(() => db.pool.end());

const status = (code) => (error) => error.status === code;
const listed = async (id) => (await listLayers(map.id)).find((layer) => layer.id === id);
const shownNames = async (id) => JSON.parse(await layerGeoJson(id)).features.map((f) => f.properties.name);

// The names of the places a filter with these conditions lets through.
async function matching(conditions, match = 'all') {
  await saveLayerFilter(places.id, { match, conditions });
  return shownNames(places.id);
}
const where = (field, op, value) => [{ field, op, value }];

describe('filter operators', () => {
  test('is and is not compare by the type of the value', async () => {
    assert.deepEqual(await matching(where('kind', 'eq', 'city')), ['Beta', 'Echo']);
    assert.deepEqual(await matching(where('pop', 'eq', 10)), ['Alpha']);
    assert.deepEqual(await matching(where('pop', 'eq', 7)), [], 'the text "7" is not the number 7');
    assert.deepEqual(await matching(where('pop', 'eq', '7')), ['Delta']);
    assert.deepEqual(await matching(where('open', 'eq', false)), ['Beta']);
    // A negation also matches features without the property.
    assert.deepEqual(await matching(where('open', 'ne', true)), ['Beta', 'Delta', 'Echo']);
  });

  test('number comparisons only match numbers', async () => {
    assert.deepEqual(await matching(where('pop', 'lt', 10)), ['Gamma']);
    assert.deepEqual(await matching(where('pop', 'lte', 10)), ['Alpha', 'Gamma']);
    assert.deepEqual(await matching(where('pop', 'gt', 5)), ['Alpha', 'Beta']);
    assert.deepEqual(await matching(where('pop', 'gte', 250)), ['Beta']);
    assert.deepEqual(await matching(where('pop', 'between', [250, 10])), ['Alpha', 'Beta'], 'ends included, in either order');
  });

  test('text operators ignore case', async () => {
    assert.deepEqual(await matching(where('kind', 'contains', 'TOWN')), ['Alpha', 'Gamma']);
    assert.deepEqual(await matching(where('kind', 'not_contains', 'town')), ['Beta', 'Delta', 'Echo']);
    assert.deepEqual(await matching(where('name', 'starts_with', 'ga')), ['Gamma']);
    assert.deepEqual(await matching(where('name', 'ends_with', 'TA')), ['Beta', 'Delta']);
  });

  test('is one of and is not one of', async () => {
    assert.deepEqual(await matching(where('kind', 'in', ['town', 'village'])), ['Alpha', 'Delta']);
    assert.deepEqual(await matching(where('pop', 'in', [3, 250])), ['Beta', 'Gamma']);
    assert.deepEqual(await matching(where('pop', 'not_in', [3, 250])), ['Alpha', 'Delta', 'Echo']);
  });

  test('empty means missing, null or empty text', async () => {
    assert.deepEqual(await matching(where('note', 'empty')), ['Beta', 'Gamma', 'Delta', 'Echo']);
    assert.deepEqual(await matching(where('note', 'not_empty')), ['Alpha']);
  });

  test('conditions combine with all or any', async () => {
    const conditions = [...where('kind', 'eq', 'city'), ...where('pop', 'gt', 100)];
    assert.deepEqual(await matching(conditions, 'all'), ['Beta']);
    assert.deepEqual(await matching([...where('kind', 'eq', 'village'), ...where('pop', 'gt', 100)], 'any'), ['Beta', 'Delta']);
  });

  test('a property name is only ever a key, never SQL', async () => {
    assert.deepEqual(await matching(where("'; DROP TABLE layers; --", 'eq', 'yes')), ['Echo']);
    assert.ok(await listed(places.id));
  });
});

describe('saving a filter', () => {
  test('the layer list gives the filter and how many features it lets through', async () => {
    const filter = { match: 'all', conditions: where('kind', 'eq', 'city') };
    assert.deepEqual(await saveLayerFilter(String(places.id), filter), { matching: 2 });
    const layer = await listed(places.id);
    assert.deepEqual(layer.filter, filter);
    assert.equal(layer.count, 5);
    assert.equal(layer.matching, 2);
  });

  test('null, or no conditions, removes the filter', async () => {
    for (const none of [null, { match: 'any', conditions: [] }]) {
      await saveLayerFilter(places.id, { conditions: where('kind', 'eq', 'city') });
      assert.deepEqual(await saveLayerFilter(places.id, none), { matching: 5 });
      assert.equal((await listed(places.id)).filter, null);
      assert.equal((await shownNames(places.id)).length, 5);
    }
  });

  test('saving a filter marks the map as edited', async () => {
    const { getMap } = await import('../maps.js');
    const before = (await getMap(map.id)).updated_at;
    await saveLayerFilter(places.id, null);
    assert.ok((await getMap(map.id)).updated_at > before);
  });

  test('a malformed filter is rejected and the old one kept', async () => {
    const filter = { match: 'all', conditions: where('kind', 'eq', 'town') };
    await saveLayerFilter(places.id, filter);
    const bad = [
      undefined, 'kind = town', [], { conditions: 'x' }, { match: 'some', conditions: [] },
      { conditions: where('', 'eq', 'x') }, { conditions: where('kind', 'like', 'x') },
      { conditions: where('kind', 'eq', '') }, { conditions: where('kind', 'eq', {}) },
      { conditions: where('pop', 'lt', '5') }, { conditions: where('pop', 'lt', Infinity) },
      { conditions: where('pop', 'between', [1]) }, { conditions: where('kind', 'contains', 5) },
      { conditions: where('kind', 'in', []) }, { conditions: where('kind', 'in', ['a', 1]) },
      { conditions: Array(21).fill(where('kind', 'empty')[0]) },
      // Within every per-condition limit, but too big to save as a whole.
      { conditions: Array(20).fill(where('kind', 'in', Array.from({ length: 200 }, (_, i) => `${i}`.padEnd(100, 'x')))[0]) },
    ];
    for (const value of bad) {
      await assert.rejects(saveLayerFilter(places.id, value), status(400), `accepted ${JSON.stringify(value)}`);
    }
    assert.deepEqual((await listed(places.id)).filter, filter);
    await assert.rejects(saveLayerFilter(999999, null), status(404));
  });
});

describe('saving the matching features as a new layer', () => {
  test('copies only the matching features, with a style of its own and no filter', async () => {
    await saveLayerFilter(places.id, null);
    const filter = { match: 'all', conditions: where('kind', 'eq', 'city') };
    const copy = await saveFilteredAsLayer(places.id, { filter });
    assert.equal(copy.name, 'places (filtered)');
    assert.equal(copy.shape, 'point');
    assert.notEqual(copy.style.fillColor, places.style.fillColor);
    assert.deepEqual(await shownNames(copy.id), ['Beta', 'Echo']);
    assert.equal((await listed(copy.id)).filter, null);
    assert.equal((await listed(places.id)).count, 5, 'the original is untouched');

    const named = await saveFilteredAsLayer(places.id, { filter, name: '  Cities ' });
    assert.equal(named.name, 'Cities');
  });

  test('needs a filter, and something to match', async () => {
    const layerCount = async () => (await listLayers(map.id)).length;
    const before = await layerCount();
    await assert.rejects(saveFilteredAsLayer(places.id, { filter: null }), status(400));
    await assert.rejects(saveFilteredAsLayer(places.id, {}), status(400));
    await assert.rejects(saveFilteredAsLayer(places.id, { filter: { conditions: where('kind', 'eq', 'none') } }), status(400));
    await assert.rejects(saveFilteredAsLayer(999999, { filter: { conditions: where('kind', 'empty') } }), status(404));
    assert.equal(await layerCount(), before, 'nothing half-made is left behind');
  });
});

describe('property summaries', () => {
  test('give each property its type, range and most common values', async () => {
    const fields = Object.fromEntries((await fieldSummaries(places.id)).map((f) => [f.name, f]));
    assert.deepEqual(Object.keys(fields), ["'; DROP TABLE layers; --", 'kind', 'name', 'note', 'open', 'pop']);
    assert.equal(fields.kind.type, 'string');
    assert.equal(fields.open.type, 'boolean');
    assert.equal(fields.pop.type, 'mixed', 'a number stored as text makes it mixed');
    assert.equal(fields.name.distinct, 5);
    assert.deepEqual(fields.kind.values[0], { value: 'city', count: 2 });
    assert.deepEqual(fields.open.values, [{ value: true, count: 2 }, { value: false, count: 1 }]);
    assert.equal(fields.pop.min, 3);
    assert.equal(fields.pop.max, 250);
    await assert.rejects(fieldSummaries(999999), status(404));
  });
});
