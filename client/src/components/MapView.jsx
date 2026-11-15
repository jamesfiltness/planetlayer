import { useState } from 'react';
import { useLayerSync } from '../map/useLayerSync.js';
import { useFeaturePopup } from '../map/useFeaturePopup.js';
import { useMapLibre } from '../map/useMapLibre.js';
import { useSaveView } from '../map/useSaveView.js';
import { useMapLayers } from '../hooks/useMapLayers.js';
import { useStatus } from '../hooks/useStatus.js';
import LayersPanel from './LayersPanel.jsx';
import MapHeader from './MapHeader.jsx';
import StatusBanner from './StatusBanner.jsx';
import Toolbar from './Toolbar.jsx';

export default function MapView({ mapId, name, initialView }) {
  const status = useStatus();
  const [container, map] = useMapLibre(initialView);
  const { layers, importFiles, runTool } = useMapLayers(mapId, status);
  const [hidden, setHidden] = useState(() => new Set());

  useLayerSync(map, layers, hidden);
  useFeaturePopup(map);
  useSaveView(map, mapId, initialView);

  const toggle = (id) =>
    setHidden((h) => {
      const next = new Set(h);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div
      className="relative h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        importFiles([...e.dataTransfer.files]);
      }}
    >
      <div ref={container} className="absolute inset-0" />
      <MapHeader name={name} />
      <LayersPanel layers={layers} hidden={hidden} onToggle={toggle} onImport={importFiles} />
      <StatusBanner status={status.status} onDismiss={status.dismiss} />
      <Toolbar layers={layers} onRun={runTool} />
    </div>
  );
}
