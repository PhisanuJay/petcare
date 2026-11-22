import { useEffect, useState } from 'react';

/** Returns the current Date and refreshes every `intervalMs` (default 60s). */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
