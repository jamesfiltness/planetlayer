import { useMemo, useState } from 'react';
import { useLayerSync } from '../map/useLayerSync.js';
import { useFeaturePopup } from '../map/useFeaturePopup.js';
import { useMapLibre } from '../map/useMapLibre.js';
import { useSaveView } from '../map/useSaveView.js';
import { useMapLayers } from '../hooks/useMapLayers.js';
import { useStatus } from '../hooks/useStatus.js';
import LayersPanel from './LayersPanel.jsx';
import LayerEditor from './LayerEditor.jsx';
import StatusBanner from './StatusBanner.jsx';
import Toolbar from './Toolbar.jsx';

export default function MapView({ mapId, initialView, changes }) {
  const status = useStatus();
  const [container, map] = useMapLibre(initialView);
  const {
    layers, importFiles, setLayerStyle, setLayerFilter, setLayerVisibility, saveFilteredAsLayer, deleteLayer, runTool,
    calculateProperty,
  } = useMapLayers(mapId, status, changes);
  // Whether each layer is shown is saved with it (see useLayerVisibility).
  const hidden = useMemo(() => new Set(layers.filter((l) => !l.visible).map((l) => l.id)), [layers]);

  // Kept as an id, so the editor always shows the layer's latest settings and
  // closes by itself if the layer goes away.
  const [editingId, setEditingId] = useState(null);
  const editing = layers.find((layer) => layer.id === editingId);

  useLayerSync(map, layers, hidden);
  useFeaturePopup(map);
  useSaveView(map, mapId, initialView);

  const toggle = (id) => setLayerVisibility(id, hidden.has(id));

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
      <LayersPanel layers={layers} hidden={hidden} onToggle={toggle} editingId={editingId} onEdit={setEditingId} onImport={importFiles} />
      {editing && (
        <LayerEditor
          layer={editing}
          onStyleChange={(style) => setLayerStyle(editing.id, style)}
          onFilterChange={(filter) => setLayerFilter(editing.id, filter)}
          onSaveFiltered={(filter, name) => saveFilteredAsLayer(editing.id, filter, name)}
          onCalculateProperty={(name, expression) => calculateProperty(editing.id, name, expression)}
          onDelete={() => deleteLayer(editing)}
          onClose={() => setEditingId(null)}
        />
      )}
      <StatusBanner status={status.status} onDismiss={status.dismiss} />
      <Toolbar layers={layers} onRun={runTool} />
    </div>
  );
}
