import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useSettings } from '../settings/SettingsContext.js';
import { mapStyleUrl } from '../settings/theme.js';

// Where a map that has never been moved opens.
export const WORLD_VIEW = { center: [0, 20], zoom: 2, bearing: 0, pitch: 0 };

/**
 * Creates the MapLibre map, starting at `initialView` (the map's saved view,
 * or null for the whole world). A position in the URL hash wins over both, so
 * reloading or opening a shared link shows the same place.
 *
 * The base map is the chosen theme's (see shared/themes.js), taken when the
 * map is created. The theme is changed on the settings page, where no map is
 * open, so the map never has to swap styles under the layers drawn on it.
 */
export function useMapLibre(initialView) {
  const container = useRef(null);
  const [map, setMap] = useState(null);
  const { settings } = useSettings();

  useEffect(() => {
    const m = new maplibregl.Map({
      container: container.current,
      style: mapStyleUrl(settings.theme),
      ...(initialView ?? WORLD_VIEW),
      hash: true,
      attributionControl: { compact: false },
    });
    m.on('load', () => setMap(m));
    return () => m.remove();
    // Only the first view and theme matter: the map moves itself after that,
    // and the theme can't change while it's open. Listing them would make a
    // new map (and lose the layers drawn on it) whenever either changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [container, map];
}
