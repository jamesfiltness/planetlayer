import { badRequest } from './errors.js';

export const MAX_MAP_NAME = 200;

export function parseId(value) {
  const n = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 2 ** 31 - 1 ? n : null;
}

export function parseMapName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw badRequest('Give the map a name.');
  if (name.length > MAX_MAP_NAME) throw badRequest(`Map names can be at most ${MAX_MAP_NAME} characters.`);
  return name;
}

// The limits match the CHECKs in migrations/004_map_view.sql.
const VIEW_LIMITS = { lng: [-180, 180], lat: [-90, 90], zoom: [0, 24], bearing: [-180, 180], pitch: [0, 85] };

/**
 * A map view as MapLibre describes it: `{ center: [lng, lat], zoom, bearing?, pitch? }`.
 * Bearing and pitch default to 0. Out-of-range values are rejected, not clamped.
 */
export function parseView(value) {
  const { center, zoom, bearing = 0, pitch = 0 } = value ?? {};
  if (!Array.isArray(center) || center.length !== 2) throw badRequest('A view needs a center of [longitude, latitude].');
  const view = { lng: center[0], lat: center[1], zoom, bearing, pitch };
  for (const [key, [min, max]] of Object.entries(VIEW_LIMITS)) {
    const n = view[key];
    if (typeof n !== 'number' || !(n >= min && n <= max)) throw badRequest(`The view's ${key} must be a number from ${min} to ${max}.`);
  }
  return view;
}

const COLOR = /^#[0-9a-f]{6}$/;
// The limits match the CHECKs in migrations/005_layer_style.sql.
const STYLE_LIMITS = { fillOpacity: [0, 1], outlineWidth: [0, 10], opacity: [0, 1] };

/**
 * A layer's style: `{ fillColor, fillOpacity, outlineColor, outlineWidth, opacity }`.
 * Colours are six-digit hex (`#1a2b3c`, returned in lower case), opacities run
 * from 0 to 1 and the outline width is in pixels. Every field is required, and
 * out-of-range values are rejected, not clamped.
 */
export function parseStyle(value) {
  const style = {};
  for (const key of ['fillColor', 'outlineColor']) {
    const color = typeof value?.[key] === 'string' ? value[key].toLowerCase() : '';
    if (!COLOR.test(color)) throw badRequest(`The style's ${key} must be a colour like #1a2b3c.`);
    style[key] = color;
  }
  for (const [key, [min, max]] of Object.entries(STYLE_LIMITS)) {
    const n = value[key];
    if (typeof n !== 'number' || !(n >= min && n <= max)) throw badRequest(`The style's ${key} must be a number from ${min} to ${max}.`);
    style[key] = n;
  }
  return style;
}
