import { useCallback } from 'react';
import { maRequest } from './maApi.js';
import {
  reloadMaStore,
  reloadPatientsSilent,
  replaceAppointmentInStore,
  useMaStore,
} from './maStore.js';

export function useAppointments() {
  const { appointments, loading, error, meta, lastLoadedAt } = useMaStore();

  const reload = useCallback(() => reloadMaStore({ silent: false }), []);

  const mutate = useCallback(async (url, body) => {
    const updated = await maRequest(url, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    replaceAppointmentInStore(updated);
    reloadPatientsSilent();
    return updated;
  }, []);

  const confirm = useCallback(
    (id, { vetId, vet, durationMin, note = '' }) =>
      mutate(`/appointments/${encodeURIComponent(id)}/status`, {
        status: 'confirmed',
        ...(vetId ? { vetId } : { vet }),
        durationMin: Number(durationMin),
        note,
      }),
    [mutate],
  );

  const reject = useCallback(
    (id, { reason, note = '' }) =>
      mutate(`/appointments/${encodeURIComponent(id)}/status`, {
        status: 'rejected',
        reason,
        note,
      }),
    [mutate],
  );

  const markNoShow = useCallback(
    (id, note = '') =>
      mutate(`/appointments/${encodeURIComponent(id)}/status`, {
        status: 'no_show',
        note,
      }),
    [mutate],
  );

  const reschedule = useCallback(
    (id, { date, time }) =>
      mutate(`/appointments/${encodeURIComponent(id)}/reschedule`, {
        date,
        time,
      }),
    [mutate],
  );

  const checkIn = useCallback(
    (id) => mutate(`/appointments/${encodeURIComponent(id)}/check-in`),
    [mutate],
  );

  const startTreatment = useCallback(
    (id) => mutate(`/appointments/${encodeURIComponent(id)}/start-treatment`),
    [mutate],
  );

  const markContacted = useCallback(
    (id) => mutate(`/appointments/${encodeURIComponent(id)}/contacted`),
    [mutate],
  );

  return {
    appointments,
    loading,
    error,
    reload,
    meta,
    lastLoadedAt,
    confirm,
    reject,
    markNoShow,
    reschedule,
    checkIn,
    startTreatment,
    markContacted,
  };
}
