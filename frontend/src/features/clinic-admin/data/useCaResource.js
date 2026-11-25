import { useCallback, useEffect, useRef, useState } from 'react';
import { caRequest } from './caApi.js';

/**
 * Fetch a Clinic Admin API resource on mount/url change with `reload()` support.
 * Guards against setting state after unmount or letting stale responses overwrite newer ones.
 */
export function useCaResource(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return null;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError('');
    try {
      const result = await caRequest(url);
      if (!mountedRef.current || reqId !== reqIdRef.current) return null;
      setData(result);
      return result;
    } catch (err) {
      if (!mountedRef.current || reqId !== reqIdRef.current) return null;
      setError(err.message || 'ไม่สามารถโหลดข้อมูลได้');
      return null;
    } finally {
      if (mountedRef.current && reqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, setData, loading, error, reload: load };
}
