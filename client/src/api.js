async function request(path, options) {
  const res = await fetch(`/api${path}`, options);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.headers.get('content-type')?.includes('json') ? res.json() : null;
}

const post = (path, body) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Absolute, because MapLibre fetches GeoJSON from a worker.
export const geojsonUrl = (id) => `${location.origin}/api/layers/${id}/geojson`;

export const api = {
  layers: () => request('/layers'),
  deleteLayer: (id) => request(`/layers/${id}`, { method: 'DELETE' }),
  runTool: (tool, params) => post(`/tools/${tool}`, params),
  importFile: (file) => {
    const body = new FormData();
    body.append('file', file);
    return request('/import', { method: 'POST', body });
  },
};
