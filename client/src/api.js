export class NotFoundError extends Error {}

async function request(path, options) {
  const res = await fetch(`/api${path}`, options);
  if (!res.ok) {
    const message = (await res.json().catch(() => ({}))).error ?? res.statusText;
    throw res.status === 404 ? new NotFoundError(message) : new Error(message);
  }
  return res.headers.get('content-type')?.includes('json') ? res.json() : null;
}

const send = (method, path, body, options) =>
  request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...options });

// Absolute, because MapLibre fetches GeoJSON from a worker. A new `revision`
// gives a new address, so the map fetches the features again after the
// layer's filter changes.
export const geojsonUrl = (layerId, revision = 0) =>
  `${location.origin}/api/layers/${layerId}/geojson${revision ? `?v=${revision}` : ''}`;

// The stream of a map's changes, for an EventSource (see useMapChanges).
export const mapEventsUrl = (mapId) => `/api/maps/${mapId}/events`;

export const api = {
  maps: () => request('/maps'),
  map: (id) => request(`/maps/${id}`),
  createMap: (name) => send('POST', '/maps', { name }),
  // Resolves to the new map.
  duplicateMap: (id, name) => send('POST', `/maps/${id}/duplicate`, { name }),
  renameMap: (id, name) => send('PATCH', `/maps/${id}`, { name }),
  deleteMap: (id) => request(`/maps/${id}`, { method: 'DELETE' }),
  // `keepalive` lets the request finish after the page has gone.
  saveMapView: (id, view, { keepalive = false } = {}) => send('PUT', `/maps/${id}/view`, view, { keepalive }),

  layers: (mapId) => request(`/maps/${mapId}/layers`),
  // `keepalive` as for saveMapView.
  saveLayerStyle: (id, style, { keepalive = false } = {}) => send('PUT', `/layers/${id}/style`, style, { keepalive }),
  // Resolves to `{ matching }`, the number of features the filter lets through.
  // `keepalive` as for saveMapView.
  saveLayerFilter: (id, filter, { keepalive = false } = {}) => send('PUT', `/layers/${id}/filter`, { filter }, { keepalive }),
  // Shows (true) or hides (false) a layer; it's saved, so it lasts.
  setLayerVisibility: (id, visible) => send('PUT', `/layers/${id}/visible`, { visible }),
  layerFields: (id) => request(`/layers/${id}/fields`),
  // Resolves to `{ name, numbers, empty }`.
  calculateProperty: (id, name, expression) => send('POST', `/layers/${id}/properties/calculate`, { name, expression }),
  saveFilteredAsLayer: (id, filter, name) => send('POST', `/layers/${id}/filtered`, { filter, name }),
  deleteLayer: (id) => request(`/layers/${id}`, { method: 'DELETE' }),
  // Resolves to the new layer, with any `warnings` about the result.
  runTool: (mapId, tool, params) => send('POST', `/maps/${mapId}/tools/${tool}`, params),

  settings: () => request('/settings'),
  // Changes only the settings named, and resolves to all of them.
  saveSettings: (changes) => send('PATCH', '/settings', changes),
  importFile: (mapId, file) => {
    const body = new FormData();
    body.append('file', file);
    return request(`/maps/${mapId}/import`, { method: 'POST', body });
  },
};
