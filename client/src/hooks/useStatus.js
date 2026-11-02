import { useCallback, useState } from 'react';

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
