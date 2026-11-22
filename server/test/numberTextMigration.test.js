// migrations/012_number_text.sql converts layers imported before imports
// stored numbers written as text as numbers. A fresh database has nothing to
// convert when it's migrated, so these tests add old-style layers and run
// the migration again.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { freshDatabase } from './helpers.js';

let db;

before(async () => {
  db = await freshDatabase('spatial_test_number_text');
});

after(() => db.pool.end());

test('converts each layer\'s all-number text properties, as an import now would, and bumps their data version', async () => {
  const { createLayer, getLayer } = await import('../layers.js');
  const { createMap } = await import('../maps.js');
  const map = await createMap('Old');
  const add = async (name, rows) => {
    const layer = await createLayer(db.pool, map.id, name, 'point');
    for (const props of rows) await db.pool.query('INSERT INTO features (layer_id, geom, props) VALUES ($1, ST_MakePoint(0, 0), $2)', [layer.id, props]);
    return layer;
  };
  const old = await add('old', [{ pop: '23.5', code: '007', note: 'n/a' }, { pop: 'n/a', code: '12', note: '-' }, { pop: '4', code: '3' }]);
  const untouched = await add('fine', [{ pop: 5 }]);
  // The same property name, but this layer has a word in it, so it stays text.
  const wordy = await add('wordy', [{ pop: '5' }, { pop: 'many' }]);

  const sql = await readFile(path.join(import.meta.dirname, '../migrations/012_number_text.sql'), 'utf8');
  await db.transaction(async (client) => {
    await client.query('DROP FUNCTION number_text(text)');
    await client.query(sql);
  });

  const values = async (layer, key) =>
    (await db.pool.query('SELECT props -> $2 AS v FROM features WHERE layer_id = $1 ORDER BY id', [layer.id, key])).rows.map((r) => r.v);
  assert.deepEqual(await values(old, 'pop'), [23.5, null, 4], 'numbers convert and "n/a" becomes empty');
  assert.deepEqual(await values(old, 'code'), ['007', '12', '3'], 'a leading zero keeps it as text');
  assert.deepEqual(await values(old, 'note'), ['n/a', '-', null], 'with no numbers at all it stays as it is');
  assert.deepEqual(await values(wordy, 'pop'), ['5', 'many']);
  assert.equal((await getLayer(old.id)).data_version, 1);
  assert.equal((await getLayer(untouched.id)).data_version, 0);
  assert.equal((await getLayer(wordy.id)).data_version, 0);
});
