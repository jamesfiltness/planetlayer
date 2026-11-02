// The HTTP layer: routes, status codes, validation, the client page fallback
// and the host/origin guard. The work behind each route is tested in the
// service tests next to this one.
import request from 'supertest';
import { collection, createTestApp, point, type TestApp } from '../helpers.js';

let t: TestApp, api: ReturnType<typeof request>;

beforeAll(async () => {
  t = await createTestApp('spatial_test_http');
  api = request(t.app.getHttpServer());
});

afterAll(() => t.app.close());

const geojson = (fc: object) => Buffer.from(JSON.stringify(fc));

describe('maps', () => {
  test('can be created, read, renamed, listed and deleted', async () => {
    const { body: map } = await api.post('/api/maps').send({ name: 'Survey' }).expect(201);
    expect(map.name).toBe('Survey');

    expect((await api.get(`/api/maps/${map.id}`).expect(200)).body.name).toBe('Survey');
    expect((await api.patch(`/api/maps/${map.id}`).send({ name: ' Final ' }).expect(200)).body.name).toBe('Final');
    expect((await api.get('/api/maps').expect(200)).body.some((m: { id: number }) => m.id === map.id)).toBe(true);
    expect((await api.get(`/api/maps/${map.id}/layers`).expect(200)).body).toEqual([]);

    await api.delete(`/api/maps/${map.id}`).expect(204);
    await api.get(`/api/maps/${map.id}`).expect(404);
  });

  test.each([
    ['missing', undefined, /Give the map a name/],
    ['not a string', 42, /Give the map a name/],
    ['blank', '   ', /Give the map a name/],
    ['too long', 'x'.repeat(201), /at most 200 characters/],
  ])('a %s name is a 400 with a message', async (_, name, message) => {
    const res = await api.post('/api/maps').send({ name }).expect(400);
    expect(res.body.error).toMatch(message);
  });

  test('a 200-character name is fine, and names are trimmed', async () => {
    expect((await api.post('/api/maps').send({ name: ` ${'x'.repeat(200)} ` }).expect(201)).body.name).toHaveLength(200);
  });

  test.each(['999999', 'abc', '-1', String(2 ** 31)])('map id %s is a 404', async (id) => {
    expect((await api.get(`/api/maps/${id}`).expect(404)).body.error).toMatch(/doesn't exist/);
  });

  test('malformed JSON is a 400', async () => {
    await api.post('/api/maps').set('Content-Type', 'application/json').send('{"name":').expect(400);
  });
});

describe('layers, imports and tools', () => {
  test('a file can be imported, analysed, fetched as GeoJSON and deleted', async () => {
    const { body: map } = await api.post('/api/maps').send({ name: 'Layers' }).expect(201);
    const { body: [layer] } = await api
      .post(`/api/maps/${map.id}/import`)
      .attach('file', geojson(collection([point(1, 2), { name: 'well' }])), 'wells.geojson')
      .expect(200);
    expect(layer).toMatchObject({ name: 'wells', shape: 'point', map_id: map.id });

    const { body: listed } = await api.get(`/api/maps/${map.id}/layers`).expect(200);
    expect(listed).toMatchObject([{ id: layer.id, count: 1, fields: ['name'] }]);

    const { body: buffered } = await api
      .post(`/api/maps/${map.id}/tools/buffer`)
      .send({ layer: layer.id, distance: 1, unit: 'km' })
      .expect(200);
    expect(buffered.shape).toBe('polygon');

    const fc = await api.get(`/api/layers/${layer.id}/geojson`).expect(200).expect('Content-Type', /json/);
    expect(fc.body.features[0]).toMatchObject({ geometry: { type: 'Point', coordinates: [1, 2] }, properties: { name: 'well' } });

    await api.delete(`/api/layers/${layer.id}`).expect(204);
    await api.delete(`/api/layers/${layer.id}`).expect(404);
    await api.get(`/api/layers/${layer.id}/geojson`).expect(404);
  });

  test('an import without a file is a 400', async () => {
    const { body: map } = await api.post('/api/maps').send({ name: 'Empty' }).expect(201);
    expect((await api.post(`/api/maps/${map.id}/import`).expect(400)).body.error).toMatch(/No file/);
  });

  test('routes under a missing map are 404s, before any upload is read', async () => {
    for (const [method, url] of [['get', '/api/maps/999999/layers'], ['post', '/api/maps/999999/import'], ['post', '/api/maps/abc/tools/centroid']] as const) {
      const res = await api[method](url).expect(404);
      expect(res.body.error).toBeTruthy();
    }
  });
});

describe('the client and the guard', () => {
  test('unknown API paths are JSON 404s, not the client page', async () => {
    await api.get('/api/nope').expect(404).expect('Content-Type', /json/);
    await api.post('/api/nope').expect(404).expect('Content-Type', /json/);
  });

  test("the client's own pages get index.html, so they can be reloaded", async () => {
    for (const url of ['/', '/maps/1']) {
      expect((await api.get(url).expect(200)).text).toMatch(/<title>Spatial Analysis/);
    }
  });

  test('unknown host names and cross-site writes are refused', async () => {
    await api.get('/api/maps').set('Host', 'evil.example').expect(403);
    await api.post('/api/maps').set('Origin', 'https://evil.example').send({ name: 'x' }).expect(403);
    await api.get('/api/maps').set('Origin', 'https://evil.example').expect(200);
  });
});
