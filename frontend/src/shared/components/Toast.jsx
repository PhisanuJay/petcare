import { useCallback, useEffect, useState } from 'react';

/** Minimal self-dismissing toast. */
export function useToast(duration = 2500) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(''), duration);
    return () => clearTimeout(t);
  }, [message, duration]);

  const show = useCallback((text) => setMessage(text), []);

  const toast = message ? (
    <div className="toast-soft" role="status">
      <i className="bi bi-check-circle-fill text-success me-2" />
      {message}
    </div>
  ) : null;

  return { show, toast };
}
