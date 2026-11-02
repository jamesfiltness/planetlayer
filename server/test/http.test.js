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
  test('maps can be created, read, renamed, listed and deleted', async () => {
    const created = await fetch(`${base}/api/maps`, json('POST', { name: 'Survey' }));
    assert.equal(created.status, 201);
    const map = await created.json();
    assert.equal(map.name, 'Survey');

    assert.equal((await (await fetch(`${base}/api/maps/${map.id}`)).json()).name, 'Survey');
    assert.equal((await (await fetch(`${base}/api/maps/${map.id}`, json('PATCH', { name: 'Final' }))).json()).name, 'Final');
    assert.ok((await (await fetch(`${base}/api/maps`)).json()).some((m) => m.id === map.id));
    assert.deepEqual(await (await fetch(`${base}/api/maps/${map.id}/layers`)).json(), []);

    assert.equal((await fetch(`${base}/api/maps/${map.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${base}/api/maps/${map.id}`)).status, 404);
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

  test('unknown host names and cross-site writes are refused', async () => {
    assert.equal(await rawRequest('GET', { Host: 'evil.example' }), 403);
    assert.equal(await rawRequest('POST', { Origin: 'https://evil.example' }), 403);
    assert.equal(await rawRequest('GET', { Origin: 'https://evil.example' }), 200);
  });
});
