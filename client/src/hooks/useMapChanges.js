import { useEffect, useRef } from 'react';
import { mapEventsUrl } from '../api.js';

// A tool run or an assistant's work can change a map several times in a
// moment. Changes this close together are taken as one, so the map loads
// once, after the last of them.
const SETTLE_MS = 250;

/**
 * Calls `onChange` when map `mapId` changes on the server, whoever changed
 * it: an assistant over MCP, another tab or another device. This page's own
 * changes come back too; loading the map again after them is harmless.
 *
 * It listens to the server's stream of the map's changes (see
 * server/mapEvents.js). The browser reconnects by itself if the stream
 * drops, as it does when the app restarts, and `onChange` is called then
 * too, in case something changed while it was away.
 *
 * @param {number | string} mapId
 * @param {() => void} onChange need not be stable: the latest one is called
 */
export function useMapChanges(mapId, onChange) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    let timer;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), SETTLE_MS);
    };

    const events = new EventSource(mapEventsUrl(mapId));
    let opened = false;
    events.addEventListener('changed', changed);
    // `open` fires on every connection. The first is the page's own load; a
    // later one is a reconnection, after which the map may be out of date.
    events.addEventListener('open', () => {
      if (opened) changed();
      opened = true;
    });

    return () => {
      clearTimeout(timer);
      events.close();
    };
  }, [mapId]);
}
