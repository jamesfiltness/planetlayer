import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { mergeLayers } from './mergeLayers.js';
import { useDebouncedSaver } from './useDebouncedSaver.js';

/**
 * A map's layers as the server lists them (see listLayers in
 * server/layers.js), and everything that changes them.
 *
 * Each layer also gets a client-only `revision`, bumped whenever a new
 * filter has been saved, so the map knows to fetch its features again.
 * Its `matching` is null from when its filter changes until that save is
 * done (and stays null if the save fails).
 *
 * The list is loaded again whenever `changes` goes up, which MapPage does
 * when the map changes on the server (see useMapChanges), such as when an
 * assistant adds a layer. mergeLayers decides what of the list on screen
 * to keep.
 *
 * @param {number | string} mapId
 * @param {{ attempt: Function, fail: Function }} status from useStatus
 * @param {number} [changes] how many times the map has changed on the server
 */
export function useMapLayers(mapId, { attempt, fail }, changes = 0) {
  const [layers, setLayers] = useState([]);
  const update = (id, change) => setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...change } : layer)));

  // Restyles the layer on the map straight away; the save follows shortly.
  const styleSaver = useDebouncedSaver(useCallback((id, style, options) =>
    api.saveLayerStyle(id, style, options).catch((error) => fail(`Couldn't save the layer's style: ${error.message}`)), [fail]));
  const setLayerStyle = (id, style) => {
    update(id, { style });
    styleSaver.save(id, style);
  };

  // The filter is applied by the server, so the map changes once the save is
  // done. Saves finish in order (see useDebouncedSaver), but only the latest
  // one's count is shown: an earlier one's would be for a filter already
  // replaced on screen.
  const latestFilterSave = useRef(new Map()); // layer id → the newest save's token
  const filterSaver = useDebouncedSaver(useCallback((id, filter, options) => {
    const token = {};
    latestFilterSave.current.set(id, token);
    return api.saveLayerFilter(id, filter, options).then(
      ({ matching }) => latestFilterSave.current.get(id) === token &&
        setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, matching, revision: layer.revision + 1 } : layer))),
      (error) => fail(`Couldn't save the layer's filter: ${error.message}`),
    );
  }, [fail]));
  // Until then the count of matching features isn't known, so it's null
  // rather than the last filter's count.
  const setLayerFilter = (id, filter) => {
    update(id, { filter, matching: null });
    filterSaver.save(id, filter);
  };

  // Loads can overlap (an import's own reload, then the change it caused),
  // and finish in any order, so only the latest one's list is used: an
  // older one could put back a layer just deleted.
  const latestLoad = useRef(0);
  const { pending: styleSaving } = styleSaver;
  const { pending: filterSaving } = filterSaver;
  const refresh = useCallback(async () => {
    const load = ++latestLoad.current;
    const loaded = await api.layers(mapId);
    if (load === latestLoad.current) setLayers((current) => mergeLayers(loaded, current, { styleSaving, filterSaving }));
  }, [mapId, styleSaving, filterSaving]);

  useEffect(() => {
    refresh().catch((error) => fail(`Couldn't load layers: ${error.message}`));
  }, [refresh, fail, changes]);

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

  // Resolves to whether it worked, so the form knows whether to clear itself.
  const saveFilteredAsLayer = (id, filter, name) =>
    attempt('Saving…', async () => {
      await api.saveFilteredAsLayer(id, filter, name);
      await refresh();
    });

  // Throws if the delete fails, so the confirmation modal can show why. Once
  // deleted, a failed reload is reported in the status banner instead.
  const deleteLayer = async (layer) => {
    styleSaver.cancel(layer.id);
    filterSaver.cancel(layer.id);
    await api.deleteLayer(layer.id);
    await refresh().catch((error) => fail(`Deleted, but couldn't reload the layers: ${error.message}`));
  };

  // Resolves to whether the tool succeeded, so its form knows whether to close.
  const runTool = (tool, params) =>
    attempt('Running…', async () => {
      await api.runTool(mapId, tool, params);
      await refresh();
    });

  return { layers, importFiles, setLayerStyle, setLayerFilter, saveFilteredAsLayer, deleteLayer, runTool };
}
