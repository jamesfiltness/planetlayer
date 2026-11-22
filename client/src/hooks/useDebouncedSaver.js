import { useCallback, useEffect, useRef } from 'react';

// Wait this long after the last change, so dragging a slider or typing a
// value is one save.
const SAVE_DELAY_MS = 300;

/**
 * Saves a value per layer a moment after it stops changing: used for layer
 * styles and filters.
 *
 * A layer's saves reach the server one at a time, in the order they were
 * made: each waits for the one before it to finish. Otherwise a slow save
 * could land after a newer one and put the older value back.
 *
 * Saves still waiting are sent straight away when the map closes (e.g. going
 * back to the list) or the page is hidden (reload, closed tab), with
 * `keepalive` set so the request can outlive the page. Those don't wait for
 * an earlier save still under way, as the page may be gone before it ends.
 *
 * @param {(id: number, value: unknown, options: { keepalive: boolean }) => Promise<unknown>} send
 *   sends one save and reports its own failures; keep it stable with useCallback
 * @returns {{ save: (id: number, value: unknown) => void, cancel: (id: number) => void, pending: (id: number) => boolean }}
 *   `save` queues a layer's latest value; `cancel` drops a layer's queued
 *   save, for when the layer is being deleted; `pending` says whether a
 *   layer has a save waiting or under way, so the server's copy of its
 *   value may be older than the one on screen.
 */
export function useDebouncedSaver(send) {
  const waiting = useRef(new Map()); // layer id → { value, timer }
  const sending = useRef(new Map()); // layer id → the latest save's promise, settled when it's done

  const cancel = useCallback((id) => {
    clearTimeout(waiting.current.get(id)?.timer);
    waiting.current.delete(id);
  }, []);

  const sendNow = useCallback((id, keepalive = false) => {
    const { value } = waiting.current.get(id);
    cancel(id);
    if (keepalive) {
      send(id, value, { keepalive });
      return;
    }
    // `send` reports its own failures, so a failed save doesn't hold up the next.
    const previous = sending.current.get(id) ?? Promise.resolve();
    const done = previous.then(() => send(id, value, { keepalive })).catch(() => {});
    sending.current.set(id, done);
    done.then(() => {
      if (sending.current.get(id) === done) sending.current.delete(id);
    });
  }, [cancel, send]);

  const save = useCallback((id, value) => {
    cancel(id);
    waiting.current.set(id, { value, timer: setTimeout(() => sendNow(id), SAVE_DELAY_MS) });
  }, [cancel, sendNow]);

  const pending = useCallback((id) => waiting.current.has(id) || sending.current.has(id), []);

  useEffect(() => {
    const flush = () => [...waiting.current.keys()].forEach((id) => sendNow(id, true));
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
    };
  }, [sendNow]);

  return { save, cancel, pending };
}
