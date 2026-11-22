// Telling open browsers that a map has changed, so they show the change
// without a reload, whoever made it: the MCP server, another tab or another
// device.
//
// A browser with a map open keeps a Server-Sent Events stream open to
// /api/maps/:id/events (streamMapChanges). When the map or its layers
// change, announceMapChanged sends a `changed` event down each stream for
// that map, and the browser fetches the map's layers again. The event holds
// no data: the browser already knows how to load the map, and this way it
// never sees a half-made change.
//
// Streams are kept in memory, which suits the app: it runs as one process.
// Running several would need the announcements to pass between them (such
// as through Postgres LISTEN/NOTIFY).

/** How often an idle stream gets a comment line, so nothing between closes it as dead. */
export const HEARTBEAT_MS = 25_000;

const listeners = new Map(); // map id → Set of callbacks

/**
 * Calls `listener` whenever map `mapId` changes, until the returned
 * function is called.
 *
 * @param {number} mapId
 * @param {() => void} listener
 * @returns {() => void} stops listening
 */
export function onMapChanged(mapId, listener) {
  if (!listeners.has(mapId)) listeners.set(mapId, new Set());
  listeners.get(mapId).add(listener);
  return () => {
    const set = listeners.get(mapId);
    set?.delete(listener);
    if (!set?.size) listeners.delete(mapId);
  };
}

/**
 * Tells everyone listening that map `mapId` has changed. Call it once the
 * change is saved (see afterCommit in db.js), or a browser may fetch the
 * map before the change is there to see.
 *
 * @param {number} mapId
 */
export function announceMapChanged(mapId) {
  for (const listener of listeners.get(mapId) ?? []) listener();
}

/**
 * Serves the stream of a map's changes on `res` until the browser goes.
 * Each change is an event named `changed`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {number} mapId a map known to exist
 */
export function streamMapChanges(req, res, mapId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  // A comment, so the browser knows the stream is open straight away.
  res.write(': listening\n\n');

  const stop = onMapChanged(mapId, () => res.write('event: changed\ndata: \n\n'));
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_MS);
  req.on('close', () => {
    clearInterval(heartbeat);
    stop();
  });
}
