import { useCallback, useRef } from 'react';
import { api } from '../api.js';

/**
 * Showing and hiding layers, for useMapLayers. Whether a layer is shown is
 * saved with it (its `visible`), so it lasts, and an assistant can change it
 * too.
 *
 * A layer is shown or hidden straight away and saved at once. Until the
 * save is done, `visibilitySaving` says so, so a reload of the list in the
 * meantime doesn't flip it back (see mergeLayers). If the save fails, it's
 * put back and the failure reported.
 *
 * @param {(id: number, change: object) => void} update changes a layer on screen
 * @param {(message: string) => void} fail reports a failure in the status banner
 */
export function useLayerVisibility(update, fail) {
  const saves = useRef(new Map()); // layer id → how many saves are under way

  const visibilitySaving = useCallback((id) => saves.current.has(id), []);

  const setLayerVisibility = async (id, visible) => {
    update(id, { visible });
    saves.current.set(id, (saves.current.get(id) ?? 0) + 1);
    try {
      await api.setLayerVisibility(id, visible);
    } catch (error) {
      update(id, { visible: !visible });
      fail(`Couldn't ${visible ? 'show' : 'hide'} the layer: ${error.message}`);
    } finally {
      const left = saves.current.get(id) - 1;
      if (left) saves.current.set(id, left);
      else saves.current.delete(id);
    }
  };

  return { setLayerVisibility, visibilitySaving };
}
