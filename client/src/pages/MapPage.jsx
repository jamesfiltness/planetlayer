import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, NotFoundError } from '../api.js';
import MapView from '../components/MapView.jsx';
import NotFound from './NotFound.jsx';

export default function MapPage() {
  const { mapId } = useParams();
  const [name, setName] = useState();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let current = true;
    setName(undefined);
    setMissing(false);
    api.map(mapId).then(
      (map) => current && setName(map.name),
      // Any other failure also shows up when the layers fail to load, so
      // it's left to the map view's status banner.
      (error) => current && error instanceof NotFoundError && setMissing(true),
    );
    return () => { current = false; };
  }, [mapId]);

  useEffect(() => {
    document.title = name ? `${name} · Spatial Analysis` : 'Spatial Analysis';
  }, [name]);

  if (missing) return <NotFound message="That map doesn't exist. It may have been deleted." />;
  // Keyed on the id, so opening another map starts from a fresh map and layer list.
  return <MapView key={mapId} mapId={mapId} name={name} />;
}
