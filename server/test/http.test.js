// The HTTP layer: routes, status codes, the client page fallback and the
// host/origin guard. Runs the real app on a spare port; the work behind each
// route is tested in the other files.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { freshDatabase } from './helpers.js';

let db, server, base;

before(async () => {
  db = await freshDatabase('spatial_test_http');
  const clientDir = await mkdtemp(path.join(tmpdir(), 'spatial-client-'));
  await writeFile(path.join(clientDir, 'index.html'), '<!doctype html><title>Spatial Analysis</title>');
  const { createApp } = await import('../app.js');
  server = createApp({ clientDir, allowedHosts: [] }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.pool.end();
});

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// fetch won't let a request set its own Host header, so this uses node:http.
function rawRequest(method, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${base}/api/maps`, { method, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('HTTP', () => {
  test('maps can be created, read, renamed, listed, duplicated and deleted', async () => {
    const created = await fetch(`${base}/api/maps`, json('POST', { name: 'Survey' }));
    assert.equal(created.status, 201);
    const map = await created.json();
    assert.equal(map.name, 'Survey');

    assert.equal((await (await fetch(`${base}/api/maps/${map.id}`)).json()).name, 'Survey');
    assert.equal((await (await fetch(`${base}/api/maps/${map.id}`, json('PATCH', { name: 'Final' }))).json()).name, 'Final');
    assert.ok((await (await fetch(`${base}/api/maps`)).json()).some((m) => m.id === map.id));
    assert.deepEqual(await (await fetch(`${base}/api/maps/${map.id}/layers`)).json(), []);
    assert.equal((await fetch(`${base}/api/maps/${map.id}/view`, json('PUT', { center: [1, 2], zoom: 3 }))).status, 204);
    assert.equal((await fetch(`${base}/api/maps/${map.id}/view`, json('PUT', { zoom: 3 }))).status, 400);
    assert.deepEqual((await (await fetch(`${base}/api/maps/${map.id}`)).json()).view, { center: [1, 2], zoom: 3, bearing: 0, pitch: 0 });

    const copied = await fetch(`${base}/api/maps/${map.id}/duplicate`, json('POST', { name: 'Final (copy)' }));
    assert.equal(copied.status, 201);
    const copy = await copied.json();
    assert.deepEqual([copy.name, copy.view.zoom], ['Final (copy)', 3]);
    assert.equal((await fetch(`${base}/api/maps/${map.id}/duplicate`, json('POST', {}))).status, 400);
    assert.equal((await fetch(`${base}/api/maps/999999/duplicate`, json('POST', { name: 'Nope' }))).status, 404);

    assert.equal((await fetch(`${base}/api/maps/${map.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${base}/api/maps/${map.id}`)).status, 404);
  });

  test('settings can be read and changed, and a bad change is a 400', async () => {
    assert.deepEqual(await (await fetch(`${base}/api/settings`)).json(), { theme: 'positron' });
    assert.deepEqual(await (await fetch(`${base}/api/settings`, json('PATCH', { theme: 'dark' }))).json(), { theme: 'dark' });
    assert.equal((await fetch(`${base}/api/settings`, json('PATCH', { theme: 'midnight' }))).status, 400);
    assert.deepEqual(await (await fetch(`${base}/api/settings`)).json(), { theme: 'dark' });
  });

  test('a bad name is a 400 with a message', async () => {
    const res = await fetch(`${base}/api/maps`, json('POST', { name: ' ' }));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /name/);
  });

  test('routes under a missing map are 404s, before any upload is read', async () => {
    for (const [method, url] of [['GET', '/api/maps/999999/layers'], ['POST', '/api/maps/999999/import'], ['POST', '/api/maps/999999/tools/centroid']]) {
      const res = await fetch(base + url, { method });
      assert.equal(res.status, 404, `${method} ${url}`);
      assert.ok((await res.json()).error);
    }
  });

  test("a layer's style is saved with a PUT, and checked first", async () => {
    const style = { fillColor: '#112233', fillOpacity: 1, outlineColor: '#445566', outlineWidth: 1, opacity: 1, symbology: { type: 'single' } };
    assert.equal((await fetch(`${base}/api/layers/999999/style`, json('PUT', style))).status, 404);
    const res = await fetch(`${base}/api/layers/999999/style`, json('PUT', { ...style, opacity: 2 }));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /opacity/);
  });

  test("a layer's filter, property summaries and filtered copy have routes", async () => {
    const map = await (await fetch(`${base}/api/maps`, json('POST', { name: 'Filters' }))).json();
    const { createLayer } = await import('../layers.js');
    const layer = await createLayer(db.pool, map.id, 'places', 'point');
    await db.pool.query(
      `INSERT INTO features (layer_id, geom, props) VALUES ($1, ST_Point(0, 0, 4326), '{"kind": "town"}'), ($1, ST_Point(1, 1, 4326), '{"kind": "city"}')`,
      [layer.id],
    );
    const filter = { match: 'all', conditions: [{ field: 'kind', op: 'eq', value: 'town' }] };

    const saved = await fetch(`${base}/api/layers/${layer.id}/filter`, json('PUT', { filter }));
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { matching: 1 });
    assert.equal((await (await fetch(`${base}/api/layers/${layer.id}/geojson`)).json()).features.length, 1);
    assert.equal((await fetch(`${base}/api/layers/${layer.id}/filter`, json('PUT', { filter: { conditions: 'x' } }))).status, 400);
    assert.equal((await fetch(`${base}/api/layers/${layer.id}/filter`, json('PUT', {}))).status, 400);
    assert.equal((await fetch(`${base}/api/layers/999999/filter`, json('PUT', { filter: null }))).status, 404);

    const fields = await (await fetch(`${base}/api/layers/${layer.id}/fields`)).json();
    assert.deepEqual(fields.map((f) => [f.name, f.type]), [['kind', 'string']]);
    assert.equal((await fetch(`${base}/api/layers/999999/fields`)).status, 404);

    const copied = await fetch(`${base}/api/layers/${layer.id}/filtered`, json('POST', { filter, name: 'Towns' }));
    assert.equal(copied.status, 201);
    assert.equal((await copied.json()).name, 'Towns');
    assert.equal((await fetch(`${base}/api/layers/${layer.id}/filtered`, json('POST', { filter: null }))).status, 400);
  });

  test('unknown API paths are JSON 404s, not the client page', async () => {
    const res = await fetch(`${base}/api/nope`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /json/);
  });

  test("the client's own pages get index.html, so they can be reloaded", async () => {
    const res = await fetch(`${base}/maps/1`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<title>Spatial Analysis/);
  });

  test('pages and API answers carry the security headers', async () => {
    for (const url of ['/', '/api/maps']) {
      const res = await fetch(base + url);
      assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/, url);
      assert.equal(res.headers.get('x-frame-options'), 'DENY', url);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff', url);
      assert.equal(res.headers.get('x-powered-by'), null, url);
    }
  });

  test('unknown host names and cross-site writes are refused', async () => {
    assert.equal(await rawRequest('GET', { Host: 'evil.example' }), 403);
    assert.equal(await rawRequest('POST', { Origin: 'https://evil.example' }), 403);
    assert.equal(await rawRequest('GET', { Origin: 'https://evil.example' }), 200);
  });
});
