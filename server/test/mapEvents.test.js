// Announcing map changes to open browsers (mapEvents.js): when changes are
// announced, that it's only once they're saved, and the stream itself.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { collection, freshDatabase, point, upload } from './helpers.js';

let db, maps, layers, events, importFile, server, base;

before(async () => {
  db = await freshDatabase('spatial_test_map_events');
  maps = await import('../maps.js');
  layers = await import('../layers.js');
  events = await import('../mapEvents.js');
  ({ importFile } = await import('../import.js'));
  const { createApp } = await import('../app.js');
  server = createApp({ clientDir: await mkdtemp(path.join(tmpdir(), 'spatial-client-')), allowedHosts: [] }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.pool.end();
});

// Counts the announcements for a map, and how many layers the database
// held at each, as seen by a new connection: what a browser would load.
function listen(mapId) {
  const seen = [];
  const stop = events.onMapChanged(mapId, () => seen.push(db.pool.query('SELECT count(*)::int AS n FROM layers WHERE map_id = $1', [mapId])));
  return { stop, layerCounts: async () => (await Promise.all(seen)).map(({ rows: [{ n }] }) => n) };
}

describe('announcing changes', () => {
  test('an import is announced once, after its transaction commits', async () => {
    const map = await maps.createMap('Imports');
    const { stop, layerCounts } = listen(map.id);
    await importFile(await upload('wells.geojson', collection([point(1, 2)])), map.id);
    stop();
    assert.deepEqual(await layerCounts(), [1]);
  });

  test('a failed import is never announced', async () => {
    const map = await maps.createMap('Failed');
    const { stop, layerCounts } = listen(map.id);
    await assert.rejects(importFile(await upload('empty.geojson', collection()), map.id));
    stop();
    assert.deepEqual(await layerCounts(), []);
  });

  test('restyling, renaming and deleting a layer, and renaming and deleting the map, are each announced', async () => {
    const map = await maps.createMap('Edits');
    const [layer] = await importFile(await upload('wells.geojson', collection([point(1, 2)])), map.id);
    const { stop, layerCounts } = listen(map.id);
    await layers.saveLayerStyle(layer.id, layer.style);
    await layers.renameLayer(layer.id, 'Wells');
    await layers.deleteLayer(layer.id);
    await maps.renameMap(map.id, 'Edited');
    await maps.deleteMap(map.id);
    stop();
    assert.equal((await layerCounts()).length, 5);
  });

  test("saving the view isn't announced: looking around isn't a change", async () => {
    const map = await maps.createMap('View');
    const { stop, layerCounts } = listen(map.id);
    await maps.saveMapView(map.id, { center: [1, 2], zoom: 3 });
    stop();
    assert.deepEqual(await layerCounts(), []);
  });

  test('a listener that stops hears nothing more, and other maps are not affected', async () => {
    let heard = 0;
    const stop = events.onMapChanged(1001, () => heard++);
    events.announceMapChanged(1002);
    events.announceMapChanged(1001);
    stop();
    events.announceMapChanged(1001);
    assert.equal(heard, 1);
  });
});

describe('the event stream', () => {
  test('a browser on the stream hears a change', async () => {
    const map = await maps.createMap('Streamed');
    const controller = new AbortController();
    const res = await fetch(`${base}/api/maps/${map.id}/events`, { signal: controller.signal });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    assert.match((await reader.read()).value, /^: listening/);

    await fetch(`${base}/api/maps/${map.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Renamed' }),
    });
    assert.equal((await reader.read()).value, 'event: changed\ndata: \n\n');
    controller.abort();
  });

  test("a map that doesn't exist has no stream", async () => {
    assert.equal((await fetch(`${base}/api/maps/999999/events`)).status, 404);
  });
});
