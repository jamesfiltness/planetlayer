import { findTheme } from '../../../shared/themes.js';

// Where the last theme shown is remembered, so a reload can paint in it
// before the settings arrive from the server.
const STORAGE_KEY = 'theme';

// `data-theme` on <html> is what switches the colours in theme.css, so every
// token changes at once.
const paint = (id) => {
  document.documentElement.dataset.theme = findTheme(id).dark ? 'dark' : 'light';
};

/**
 * Puts the app in a theme, and remembers it for the next page load (see
 * `applyRememberedTheme`).
 *
 * @param {string} id one of the ids in shared/themes.js; an unknown one gets the default theme
 */
export function applyTheme(id) {
  paint(id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage can be blocked or full. The next load then starts light until
    // the settings arrive, which is all this was saving.
  }
}

/**
 * Applies the theme remembered from the last visit. Called before the first
 * render, so someone using a dark theme doesn't see the app flash light while
 * the settings load. The server's settings still decide; this is a guess.
 */
export function applyRememberedTheme() {
  let id = null;
  try {
    id = localStorage.getItem(STORAGE_KEY);
  } catch {
    // As above: without storage, start on the default.
  }
  paint(id);
}

/** The URL of the MapLibre style for a theme: OpenFreeMap's style of the same name. */
export const mapStyleUrl = (id) => `https://tiles.openfreemap.org/styles/${findTheme(id).id}`;
