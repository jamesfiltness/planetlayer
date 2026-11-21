import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { DEFAULT_THEME } from '../../shared/themes.js';
import { freshDatabase } from './helpers.js';

let db, settings;

before(async () => {
  db = await freshDatabase('spatial_test_settings');
  settings = await import('../settings.js');
});

after(() => db.pool.end());

const status = (code) => (error) => error.status === code;

describe('settings', () => {
  test('start on the default theme', async () => {
    assert.deepEqual(await settings.getSettings(), { theme: DEFAULT_THEME });
  });

  test('a change is saved and every setting comes back', async () => {
    assert.deepEqual(await settings.updateSettings({ theme: 'dark' }), { theme: 'dark' });
    assert.deepEqual(await settings.getSettings(), { theme: 'dark' });
  });

  test('a theme must be one of the listed ones', async () => {
    for (const theme of ['midnight', '', null, 3, 'DARK']) {
      await assert.rejects(settings.updateSettings({ theme }), status(400), `accepted ${JSON.stringify(theme)}`);
    }
  });

  test('changes must be an object naming known settings, and a bad one saves nothing', async () => {
    await settings.updateSettings({ theme: 'fiord' });
    for (const changes of [undefined, null, 'dark', ['dark'], {}, { colour: 'red' }, { theme: 'bright', colour: 'red' }]) {
      await assert.rejects(settings.updateSettings(changes), status(400), `accepted ${JSON.stringify(changes)}`);
    }
    assert.deepEqual(await settings.getSettings(), { theme: 'fiord' });
  });

  test('there is only ever one row of settings', async () => {
    await assert.rejects(db.pool.query('INSERT INTO settings DEFAULT VALUES'));
    await assert.rejects(db.pool.query('INSERT INTO settings (id) VALUES (false)'));
  });
});
