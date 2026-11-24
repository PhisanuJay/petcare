import { useCallback, useEffect, useState } from 'react';
import { vetRequest } from './vetApi.js';

/** The clinic report for `from`..`to` (both 'YYYY-MM-DD'), from `/api/veterinarian/reports`. */
export function useReport(from, to) {
  const [state, setState] = useState({ key: '', report: null, error: '' });
  const key = `${from}|${to}`;

  const load = useCallback(async () => {
    try {
      const report = await vetRequest(`/reports?from=${from}&to=${to}`);
      setState({ key: `${from}|${to}`, report, error: '' });
    } catch (err) {
      setState({ key: `${from}|${to}`, report: null, error: err.message });
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // Until the request for the current range finishes, report "loading" (a stale report is hidden).
  const ready = state.key === key;
  return {
    report: ready ? state.report : null,
    error: ready ? state.error : '',
    loading: !ready,
    reload: load,
  };
}
