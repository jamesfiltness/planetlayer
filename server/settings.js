// The app's settings: one row (see migrations/007_settings.sql), read and
// changed as a whole object such as `{ theme: 'positron' }`.
import { pool } from './db.js';
import { badRequest } from './errors.js';
import { THEMES } from '../shared/themes.js';

/**
 * Each setting's check: it takes the value sent and returns the one to store,
 * or throws a 400. A setting's key is also its column, so only keys listed
 * here ever reach the SQL below.
 */
const SETTINGS = {
  theme(value) {
    if (!THEMES.some((theme) => theme.id === value)) {
      throw badRequest(`The theme must be one of ${THEMES.map((theme) => theme.id).join(', ')}.`);
    }
    return value;
  },
};

const COLUMNS = Object.keys(SETTINGS).join(', ');

export async function getSettings() {
  const { rows: [settings] } = await pool.query(`SELECT ${COLUMNS} FROM settings`);
  return settings;
}

/**
 * Changes the settings named in `changes` and leaves the rest alone. Every
 * named setting is checked before any is saved, and an unknown name is
 * rejected rather than ignored, so a mistyped one doesn't look saved.
 * Returns all the settings.
 */
export async function updateSettings(changes) {
  if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) {
    throw badRequest('Send the settings to change as an object, such as { "theme": "dark" }.');
  }
  const entries = Object.entries(changes);
  if (!entries.length) throw badRequest('Name at least one setting to change.');
  const values = entries.map(([key, value]) => {
    if (!Object.hasOwn(SETTINGS, key)) throw badRequest(`There's no setting called "${key}".`);
    return SETTINGS[key](value);
  });
  const assignments = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  await pool.query(`UPDATE settings SET ${assignments}`, values);
  return getSettings();
}
