import { useCallback, useEffect, useRef } from 'react';
import { api } from '../api.js';

// Wait this long after the last change, so dragging a slider is one save.
const SAVE_DELAY_MS = 300;

/**
 * Saves layer styles to the server a moment after they stop changing.
 * `fail` reports a save that didn't work.
 *
 * Saves still waiting are sent straight away when the map closes (e.g. going
 * back to the list) or the page is hidden (reload, closed tab).
 *
 * @returns {{ save: (id: number, style: object) => void, cancel: (id: number) => void }}
 *   `save` queues a layer's latest style; `cancel` drops a layer's queued
 *   save, for when the layer is being deleted.
 */
export function useStyleSaver(fail) {
  const waiting = useRef(new Map()); // layer id → { style, timer }

  const cancel = useCallback((id) => {
    clearTimeout(waiting.current.get(id)?.timer);
    waiting.current.delete(id);
  }, []);

  const send = useCallback((id, keepalive = false) => {
    const { style } = waiting.current.get(id);
    cancel(id);
    api.saveLayerStyle(id, style, { keepalive }).catch((error) => fail(`Couldn't save the layer's style: ${error.message}`));
  }, [cancel, fail]);

  const save = useCallback((id, style) => {
    cancel(id);
    waiting.current.set(id, { style, timer: setTimeout(() => send(id), SAVE_DELAY_MS) });
  }, [cancel, send]);

  useEffect(() => {
    const flush = () => [...waiting.current.keys()].forEach((id) => send(id, true));
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
    };
  }, [send]);

  return { save, cancel };
}
