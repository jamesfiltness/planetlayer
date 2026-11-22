import { useCallback, useState } from 'react';

/**
 * The status banner's message, and ways to set it.
 *
 * `attempt(message, fn)` shows `message` while `fn` runs, then clears it,
 * or shows `fn`'s error if it throws. If `fn` resolves to some text, such as
 * a warning about a tool's result, that's shown instead of clearing. It
 * resolves to whether `fn` worked.
 */
export function useStatus() {
  const [status, setStatus] = useState(null);

  const attempt = useCallback(async (message, fn) => {
    setStatus({ message });
    try {
      const notice = await fn();
      setStatus(typeof notice === 'string' && notice ? { message: notice } : null);
      return true;
    } catch (error) {
      setStatus({ message: error.message, error: true });
      return false;
    }
  }, []);

  const fail = useCallback((message) => setStatus({ message, error: true }), []);
  const dismiss = useCallback(() => setStatus(null), []);

  return { status, attempt, fail, dismiss };
}
