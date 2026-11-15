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

// Absolute, because MapLibre fetches GeoJSON from a worker.
export const geojsonUrl = (layerId) => `${location.origin}/api/layers/${layerId}/geojson`;

export const api = {
  maps: () => request('/maps'),
  map: (id) => request(`/maps/${id}`),
  createMap: (name) => send('POST', '/maps', { name }),
  renameMap: (id, name) => send('PATCH', `/maps/${id}`, { name }),
  deleteMap: (id) => request(`/maps/${id}`, { method: 'DELETE' }),
  // `keepalive` lets the request finish after the page has gone.
  saveMapView: (id, view, { keepalive = false } = {}) => send('PUT', `/maps/${id}/view`, view, { keepalive }),

  layers: (mapId) => request(`/maps/${mapId}/layers`),
  deleteLayer: (id) => request(`/layers/${id}`, { method: 'DELETE' }),
  runTool: (mapId, tool, params) => send('POST', `/maps/${mapId}/tools/${tool}`, params),
  importFile: (mapId, file) => {
    const body = new FormData();
    body.append('file', file);
    return request(`/maps/${mapId}/import`, { method: 'POST', body });
  },
};
