import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, NotFoundError } from '../api.js';
import MapView from '../components/MapView.jsx';
import NotFound from './NotFound.jsx';

export default function MapPage() {
  const { mapId } = useParams();
  // undefined while loading; then the map, or { failed: true } if it couldn't be read.
  const [map, setMap] = useState();
  const [missing, setMissing] = useState(false);

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

  if (missing) return <NotFound message="That map doesn't exist. It may have been deleted." />;
  // Wait for the map, so MapLibre starts at its saved view instead of jumping there.
  if (!map) return <div className="h-full bg-gray-100" />;
  // Keyed on the id, so opening another map starts from a fresh map and layer list.
  return <MapView key={mapId} mapId={mapId} name={map.name} initialView={map.view} />;
}
