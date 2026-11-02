import { useCallback, useState } from 'react';

/**
 * A one-line status message for long-running actions ("Importing…") and
 * their errors, shown by StatusBanner.
 *
 * @returns {{
 *   status: { message: string, error?: boolean } | null,
 *   attempt: (message: string, fn: () => Promise<void>) => Promise<boolean>,
 *   fail: (message: string) => void,
 *   dismiss: () => void,
 * }}
 *   `attempt` shows `message` while `fn` runs, then clears it, or shows the
 *   error if `fn` throws; it resolves to whether `fn` succeeded.
 */
export function useStatus() {
  const [status, setStatus] = useState(null);

  const attempt = useCallback(async (message, fn) => {
    setStatus({ message });
    try {
      await fn();
      setStatus(null);
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
