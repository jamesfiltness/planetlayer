import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export function useMapLayers(mapId, { attempt, fail }) {
  const [layers, setLayers] = useState([]);

  const refresh = useCallback(() => api.layers(mapId).then(setLayers), [mapId]);

  useEffect(() => {
    refresh().catch((error) => fail(`Couldn't load layers: ${error.message}`));
  }, [refresh, fail]);

  // One import at a time. The list is refreshed even when a file fails,
  // because the files before it were saved.
  const importing = useRef(false);
  const importFiles = async (files) => {
    if (importing.current || !files.length) return;
    importing.current = true;
    await attempt('Importing…', async () => {
      try {
        for (const file of files) await api.importFile(mapId, file);
      } finally {
        await refresh().catch(() => {});
      }
    });
    importing.current = false;
  };

  // Throws if the delete fails, so the confirmation modal can show why. Once
  // deleted, a failed reload is reported in the status banner instead.
  const deleteLayer = async (layer) => {
    await api.deleteLayer(layer.id);
    await refresh().catch((error) => fail(`Deleted, but couldn't reload the layers: ${error.message}`));
  };

  // Resolves to whether the tool succeeded, so its form knows whether to close.
  const runTool = (tool, params) =>
    attempt('Running…', async () => {
      await api.runTool(mapId, tool, params);
      await refresh();
    });

  return { layers, importFiles, deleteLayer, runTool };
}
