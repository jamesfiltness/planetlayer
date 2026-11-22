import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router';
import { api, NotFoundError } from '../api.js';
import MapView from '../components/MapView.jsx';
import { useMapChanges } from '../hooks/useMapChanges.js';
import NotFound from './NotFound.jsx';

export default function MapPage() {
  const { mapId } = useParams();
  const { setMapName } = useOutletContext();
  // undefined while loading; then the map, or { failed: true } if it couldn't be read.
  const [map, setMap] = useState();
  const [missing, setMissing] = useState(false);
  // How many times the map has changed on the server since it opened, such
  // as an assistant adding a layer or renaming it. Each change reloads the
  // map's name here and its layers in the map view.
  const [changes, setChanges] = useState(0);

  useMapChanges(mapId, () => {
    setChanges((n) => n + 1);
    api.map(mapId).then(
      (loaded) => setMap((shown) => (shown ? { ...shown, name: loaded.name } : shown)),
      (error) => error instanceof NotFoundError && setMissing(true),
    );
  });

  useEffect(() => {
    let current = true;
    setMap(undefined);
    setMissing(false);
    api.map(mapId).then(
      (loaded) => current && setMap(loaded),
      (error) => {
        if (!current) return;
        if (error instanceof NotFoundError) setMissing(true);
        // Any other failure also shows up when the layers fail to load, so
        // it's left to the map view's status banner.
        else setMap({ failed: true });
      },
    );
    return () => { current = false; };
  }, [mapId]);

  useEffect(() => {
    document.title = map?.name ? `${map.name} · Spatial Analysis` : 'Spatial Analysis';
  }, [map?.name]);

  // The header shows the open map's name, and drops it on the way out.
  useEffect(() => {
    setMapName(map?.name ?? null);
    return () => setMapName(null);
  }, [map?.name, setMapName]);

  if (missing) return <NotFound message="That map doesn't exist. It may have been deleted." />;
  // Wait for the map, so MapLibre starts at its saved view instead of jumping there.
  if (!map) return <div className="h-full bg-page" />;
  // Keyed on the id, so opening another map starts from a fresh map and layer list.
  return <MapView key={mapId} mapId={mapId} initialView={map.view} changes={changes} />;
}
