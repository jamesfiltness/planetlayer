// Used by both the server (to check a chosen theme) and the client (to draw it).

/**
 * The app's themes. Each one is an OpenFreeMap base map style, served from
 * `https://tiles.openfreemap.org/styles/<id>`, and the colours of the app's
 * own chrome go with it: `dark` themes put light text on dark panels, the rest
 * dark text on light ones. The chrome has only those two looks; the map is what
 * tells the themes apart.
 *
 * `land` and `water` are colours taken from the style itself, so the settings
 * page can show a small preview of each map without loading it. They're for
 * that preview only, and fall out of date harmlessly if OpenFreeMap changes a
 * style.
 *
 * Listed in the order the settings page shows them: light ones, then dark.
 */
export const THEMES = [
  { id: 'positron', label: 'Light', hint: 'Pale greys that let your layers stand out', dark: false, land: '#f2f3f0', water: '#c2c8ca' },
  { id: 'bright', label: 'Bright', hint: 'A full-colour road map', dark: false, land: '#f8f4f0', water: '#aecfe2' },
  { id: 'liberty', label: 'Liberty', hint: 'Full colour, in the classic OpenStreetMap style', dark: false, land: '#f8f4f0', water: '#9ebdff' },
  { id: 'dark', label: 'Dark', hint: 'Near-black, for bright layers at night', dark: true, land: '#0c0c0c', water: '#1b1b1d' },
  { id: 'fiord', label: 'Fiord', hint: 'Deep blue-grey', dark: true, land: '#45516e', water: '#38435c' },
];

export const DEFAULT_THEME = 'positron';

/** The theme with this id, or the default one if there's no such theme. */
export const findTheme = (id) => THEMES.find((theme) => theme.id === id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME);
