import { useCallback, useEffect, useRef } from 'react';

// Wait this long after the last change, so dragging a slider or typing a
// value is one save.
const SAVE_DELAY_MS = 300;

/**
 * Saves a value per layer a moment after it stops changing: used for layer
 * styles and filters.
 *
 * Saves still waiting are sent straight away when the map closes (e.g. going
 * back to the list) or the page is hidden (reload, closed tab), with
 * `keepalive` set so the request can outlive the page.
 *
 * @param {(id: number, value: unknown, options: { keepalive: boolean }) => void} send
 *   sends one save and reports its own failures; keep it stable with useCallback
 * @returns {{ save: (id: number, value: unknown) => void, cancel: (id: number) => void }}
 *   `save` queues a layer's latest value; `cancel` drops a layer's queued
 *   save, for when the layer is being deleted.
 */
export function useDebouncedSaver(send) {
  const waiting = useRef(new Map()); // layer id → { value, timer }

  const cancel = useCallback((id) => {
    clearTimeout(waiting.current.get(id)?.timer);
    waiting.current.delete(id);
  }, []);

  const sendNow = useCallback((id, keepalive = false) => {
    const { value } = waiting.current.get(id);
    cancel(id);
    send(id, value, { keepalive });
  }, [cancel, send]);

  const save = useCallback((id, value) => {
    cancel(id);
    waiting.current.set(id, { value, timer: setTimeout(() => sendNow(id), SAVE_DELAY_MS) });
  }, [cancel, sendNow]);

  useEffect(() => {
    const flush = () => [...waiting.current.keys()].forEach((id) => sendNow(id, true));
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
    };
  }, [sendNow]);

  return { save, cancel };
}
