// The assistant tools (assistant/registry.js), run directly against PostGIS.
// mcp.test.js checks they're served over MCP; this checks what they do.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { collection, freshDatabase, point, square } from './helpers.js';

let db, tools;

before(async () => {
  db = await freshDatabase('spatial_test_assistant_tools');
  ({ ASSISTANT_TOOLS: tools } = await import('../assistant/registry.js'));
});

after(() => db.pool.end());

const call = (name, args = {}) => tools.find((t) => t.name === name).run(args, { baseUrl: 'http://localhost:8080' });
const status = (code) => (error) => error.status === code;

// A map with pumps (points: two broken, one working) and three settlements
// (squares with a population, one stored as text).
async function pumpsMap() {
  const { map } = await call('create_map', { name: 'Water' });
  const { layers: [pumps] } = await call('add_features', {
    map_id: map.id, name: 'pumps',
    geojson: collection(
      [point(0.5, 0.5), { status: 'broken' }], [point(2.5, 0.5), { status: 'broken' }], [point(4.5, 0.5), { status: 'working' }],
    ),
  });
  const { layers: [places] } = await call('add_features', {
    map_id: map.id, name: 'places',
    geojson: collection([square(0, 0), { pop: '100' }], [square(2, 0), { pop: '300' }], [square(4, 0), { pop: '50' }]),
  });
  return { map, pumps, places };
}

describe('maps and layers', () => {
  test('create_map, list_maps and get_map', async () => {
    const { map, pumps } = await pumpsMap();
    assert.equal(map.name, 'Water');
    assert.ok((await call('list_maps')).maps.some((m) => m.id === map.id));
    const opened = await call('get_map', { map_id: map.id });
    assert.deepEqual(opened.layers.map((l) => [l.name, l.shape, l.count]), [['pumps', 'point', 3], ['places', 'polygon', 3]]);
    assert.equal(opened.layers[0].id, pumps.id);
    assert.equal(opened.layers[0].style.type, 'single');
  });

  test('duplicate_map copies the layers into a new map, leaving the original as it was', async () => {
    const { map } = await pumpsMap();
    const { map: copy } = await call('duplicate_map', { map_id: map.id, name: 'Water (copy)' });
    assert.notEqual(copy.id, map.id);
    assert.deepEqual([copy.name, copy.layer_count], ['Water (copy)', 2]);
    const layers = async (id) => (await call('get_map', { map_id: id })).layers.map((l) => [l.name, l.shape, l.count]);
    assert.deepEqual(await layers(copy.id), await layers(map.id));
    await assert.rejects(call('duplicate_map', { map_id: 999999, name: 'Nope' }), status(404));
  });

  test('add_features names the layer as asked, even with a slash, and stores numbers written as text as numbers', async () => {
    const { map } = await call('create_map', { name: 'Names' });
    const { layers: [layer] } = await call('add_features', {
      map_id: map.id, name: 'north/south', geojson: collection([point(1, 1), { n: '5' }]),
    });
    assert.equal(layer.name, 'north/south');
    const { features: [feature] } = await call('get_features', { layer_id: layer.id });
    assert.equal(feature.properties.n, 5);
  });

  test('rename_layer needs a name, and delete_layer removes the layer', async () => {
    const { map, pumps } = await pumpsMap();
    assert.equal((await call('rename_layer', { layer_id: pumps.id, name: ' Wells ' })).layer.name, 'Wells');
    await assert.rejects(call('rename_layer', { layer_id: pumps.id, name: ' ' }), status(400));
    assert.deepEqual(await call('delete_layer', { layer_id: pumps.id }), { deleted: { id: pumps.id, name: 'Wells' } });
    assert.equal((await call('get_map', { map_id: map.id })).layers.length, 1);
    await assert.rejects(call('delete_layer', { layer_id: pumps.id }), status(404));
  });
});

describe('reading data', () => {
  test('describe_layer lists every property with its real values', async () => {
    const { pumps } = await pumpsMap();
    const { layer, properties } = await call('describe_layer', { layer_id: pumps.id });
    assert.equal(layer.fields, undefined);
    assert.deepEqual(properties, [{
      name: 'status', type: 'string', min: null, max: null, distinct: 2,
      values: [{ value: 'broken', count: 2 }, { value: 'working', count: 1 }],
    }]);
  });

  test('get_features sorts by a number, pages, and picks properties', async () => {
    const { places } = await pumpsMap();
    const first = await call('get_features', { layer_id: places.id, sort_by: 'pop', order: 'desc', limit: 2 });
    assert.deepEqual(first.features.map((f) => f.properties.pop), [300, 100]);
    assert.deepEqual([first.total, first.next_offset], [3, 2]);
    assert.equal(first.features[0].geometry, undefined);
    assert.equal(typeof first.features[0].id, 'number');
    const last = await call('get_features', { layer_id: places.id, sort_by: 'pop', order: 'desc', offset: 2, properties: ['nope'] });
    assert.deepEqual(last.features.map((f) => f.properties), [{}]);
    assert.equal(last.next_offset, null);
  });

  test('get_features gives centroids or full geometry when asked, and only what the filter lets through', async () => {
    const { places } = await pumpsMap();
    await call('set_layer_filter', { layer_id: places.id, filter: { conditions: [{ field: 'pop', op: 'gte', value: 100 }] } });
    const { total, features } = await call('get_features', { layer_id: places.id, geometry: 'centroid', sort_by: 'pop' });
    assert.equal(total, 2);
    assert.deepEqual(features[0].geometry, point(0.5, 0.5));
    const full = await call('get_features', { layer_id: places.id, geometry: 'full', limit: 1 });
    assert.equal(full.features[0].geometry.type, 'Polygon');
    await assert.rejects(call('get_features', { layer_id: places.id, limit: 101 }), status(400));
  });
});

describe('filters and styles', () => {
  test('set_layer_filter changes what matches, and null clears it', async () => {
    const { pumps } = await pumpsMap();
    const filter = { conditions: [{ field: 'status', op: 'eq', value: 'broken' }] };
    assert.equal((await call('set_layer_filter', { layer_id: pumps.id, filter })).layer.matching, 2);
    assert.equal((await call('set_layer_filter', { layer_id: pumps.id, filter: null })).layer.matching, 3);
  });

  test('save_filtered_layer copies the matching features into a new layer', async () => {
    const { pumps } = await pumpsMap();
    const filter = { conditions: [{ field: 'status', op: 'eq', value: 'working' }] };
    const { layer } = await call('save_filtered_layer', { layer_id: pumps.id, filter, name: 'Working pumps' });
    assert.deepEqual([layer.name, layer.count], ['Working pumps', 1]);
  });

  test('style_layer fills in categories and a scale from the data', async () => {
    const { pumps, places } = await pumpsMap();
    const categories = await call('style_layer', { layer_id: pumps.id, symbology: { type: 'categories' } });
    assert.deepEqual(categories.layer.style.categories.map((c) => c.value), ['broken', 'working']);
    const scale = await call('style_layer', { layer_id: places.id, symbology: { type: 'scale', field: 'pop', ramp: 'reds' }, opacity: 0.5 });
    assert.deepEqual(scale.layer.style, { type: 'scale', field: 'pop', ramp: 'reds', min: 50, max: 300 });
  });

  test("style_layer refuses a property the layer doesn't have, or one that doesn't suit the type", async () => {
    const { pumps } = await pumpsMap();
    await assert.rejects(call('style_layer', { layer_id: pumps.id, symbology: { type: 'scale', field: 'nope' } }), /no property "nope"/);
    await assert.rejects(call('style_layer', { layer_id: pumps.id, symbology: { type: 'scale', field: 'status' } }), /doesn't suit/);
    await assert.rejects(call('style_layer', { layer_id: pumps.id, symbology: { type: 'size' } }), /No property holds numbers/);
  });
});

describe('analysis', () => {
  test('buffer takes its defaults from the spec, and summarize adds up a property per area', async () => {
    const { pumps, places } = await pumpsMap();
    const { layer: catchments } = await call('buffer', { layer: pumps.id, name: 'Catchments' });
    assert.deepEqual([catchments.name, catchments.shape, catchments.count], ['Catchments', 'polygon', 3]);
    const { layer: summary } = await call('summarize', { areas: catchments.id, features: places.id, field: 'pop' });
    const { features } = await call('get_features', { layer_id: summary.id, sort_by: 'pop_sum', order: 'desc', properties: ['pop_sum'] });
    assert.deepEqual(features.map((f) => f.properties.pop_sum), [300, 100, 50]);
  });

  test('a tool refuses layers from another map', async () => {
    const one = await pumpsMap();
    const other = await pumpsMap();
    await assert.rejects(call('intersect', { layer: one.pumps.id, areas: other.places.id }), status(400));
  });
});

describe('uploads and playbooks', () => {
  test('upload_file gives a command that quotes the path for the shell and for curl', async () => {
    const { map } = await call('create_map', { name: 'Uploads' });
    const { command } = await call('upload_file', { map_id: map.id, path: "data/it's \"a\";b.geojson" });
    assert.equal(command, `curl -sS --fail-with-body -F 'file=@"data/it'\\''s \\"a\\";b.geojson"' 'http://localhost:8080/api/maps/${map.id}/import'`);
    await assert.rejects(call('upload_file', { map_id: map.id, path: 'notes.txt' }), /Unsupported file type: \.txt/);
    await assert.rejects(call('upload_file', { map_id: 999999, path: 'a.geojson' }), status(404));
  });

  test('read_playbook returns the guide', async () => {
    const { playbook } = await call('read_playbook', { name: 'facility-prioritisation' });
    assert.match(playbook, /^# Prioritising facilities/);
  });
});
