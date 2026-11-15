import { useEffect } from 'react';
import { api } from '../api.js';
import { WORLD_VIEW } from './useMapLibre.js';

// Wait this long after the map stops moving, so a run of pans is one save.
const SAVE_DELAY_MS = 500;

/**
 * Saves where the map is being looked at, so it opens there next time.
 * `initialView` is the view it opened with (null for the world view), so an
 * unmoved map isn't saved.
 *
 * A save that's still waiting is sent straight away when the map closes
 * (e.g. going back to the list) or the page is hidden (reload, closed tab).
 */
export function useSaveView(map, mapId, initialView) {
  useEffect(() => {
    if (!map) return;
    let timer = null;
    let pending = null; // read when the move ends, as the map may be removed before the save
    let saved = JSON.stringify(initialView ?? WORLD_VIEW);

    const save = (keepalive = false) => {
      clearTimeout(timer);
      timer = null;
      const json = JSON.stringify(pending);
      if (!pending || json === saved) return;
      saved = json;
      // A lost view isn't worth interrupting anyone over: the map just opens
      // where it was last saved.
      api.saveMapView(mapId, pending, { keepalive }).catch(() => {});
    };
    const onMoveEnd = () => {
      pending = currentView(map);
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
    };
    const flush = () => timer && save(true);

    map.on('moveend', onMoveEnd);
    // The map can move before it has loaded and this hook is attached (a quick
    // pan, or a position in the URL hash), so check where it is now.
    onMoveEnd();
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      map.off('moveend', onMoveEnd);
      window.removeEventListener('pagehide', flush);
    };
    // initialView is fixed for the life of the map, like in useMapLibre.
  }, [map, mapId]);
}

// Rounded so an unchanged view compares equal: 6 decimal places of a degree
// is about 10 cm. The centre is wrapped into -180..180, which the server requires.
function currentView(map) {
  const { lng, lat } = map.getCenter().wrap();
  const round = (n, places) => Number(n.toFixed(places));
  return {
    center: [round(lng, 6), round(lat, 6)],
    zoom: round(map.getZoom(), 2),
    bearing: round(map.getBearing(), 2),
    pitch: round(map.getPitch(), 2),
  };
}
