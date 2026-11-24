import { useSyncExternalStore } from 'react';
import { maRequest } from './maApi.js';

const POLL_INTERVAL_MS = 30000;

let state = {
  appointments: [],
  patients: [],
  meta: null,
  loading: true,
  error: '',
  lastLoadedAt: null,
};

const listeners = new Set();
let pollTimer = null;
let visibilityBound = false;
let inFlightReload = null;
let hasStartedInitialLoad = false;
let mutationVersion = 0;

function emit() {
  for (const listener of listeners) listener();
}

function setState(updater) {
  state = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
  emit();
}

function sortAppointmentsAsc(list) {
  return [...list].sort((a, b) =>
    `${a.date ?? ''} ${a.time ?? ''}`.localeCompare(`${b.date ?? ''} ${b.time ?? ''}`),
  );
}

function computeStageFromVisit(appt, visit) {
  if (appt.status === 'confirmed') {
    if (visit?.treatmentStartedAt) return 'in_treatment';
    if (visit?.checkedInAt) return 'checked_in';
    return 'confirmed';
  }
  return appt.status;
}

export async function reloadMaStore({ silent = false } = {}) {
  if (inFlightReload) return inFlightReload;

  if (!silent) {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
  }

  const startVersion = mutationVersion;
  let staleAfterMutation = false;

  inFlightReload = (async () => {
    try {
      const [appointments, patients, meta] = await Promise.all([
        maRequest('/appointments'),
        maRequest('/patients'),
        state.meta ? Promise.resolve(state.meta) : maRequest('/meta'),
      ]);

      // Discard stale poll response if a mutation committed while this fetch was in flight
      if (mutationVersion !== startVersion) {
        staleAfterMutation = true;
        setState((prev) => ({
          ...prev,
          meta: meta ?? prev.meta,
          loading: false,
          error: '',
        }));
        return;
      }

      setState({
        appointments: Array.isArray(appointments) ? sortAppointmentsAsc(appointments) : [],
        patients: Array.isArray(patients) ? patients : [],
        meta: meta ?? state.meta,
        loading: false,
        error: '',
        lastLoadedAt: new Date().toISOString(),
      });
    } catch (err) {
      if (mutationVersion !== startVersion) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      }));
    } finally {
      inFlightReload = null;
    }
  })();

  await inFlightReload;

  if (staleAfterMutation && listeners.size > 0) {
    return reloadMaStore({ silent: true });
  }
  return undefined;
}

export async function reloadPatientsSilent() {
  const startVersion = mutationVersion;
  try {
    const patients = await maRequest('/patients');
    if (mutationVersion !== startVersion) {
      if (listeners.size > 0) reloadPatientsSilent();
      return;
    }
    if (Array.isArray(patients)) {
      setState((prev) => ({ ...prev, patients }));
    }
  } catch {
    // Silent background refresh of derived patient summaries should not disrupt an already succeeded action
  }
}

export function replaceAppointmentInStore(updatedAppt) {
  if (!updatedAppt?.id) return;
  mutationVersion += 1;
  setState((prev) => {
    const exists = prev.appointments.some((a) => a.id === updatedAppt.id);
    const nextList = exists
      ? prev.appointments.map((a) => (a.id === updatedAppt.id ? updatedAppt : a))
      : [...prev.appointments, updatedAppt];
    return {
      ...prev,
      appointments: sortAppointmentsAsc(nextList),
    };
  });
}

export function updateVisitInStore(bookingId, visit) {
  if (!bookingId) return;
  mutationVersion += 1;
  setState((prev) => ({
    ...prev,
    appointments: prev.appointments.map((a) =>
      a.id === bookingId
        ? {
            ...a,
            visit,
            stage: computeStageFromVisit(a, visit),
          }
        : a,
    ),
  }));
}

function handleVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    reloadMaStore({ silent: true });
  }
}

function startSync() {
  if (!hasStartedInitialLoad || state.error) {
    hasStartedInitialLoad = true;
    reloadMaStore({ silent: false });
  }
  if (!pollTimer && typeof window !== 'undefined') {
    pollTimer = window.setInterval(() => {
      reloadMaStore({ silent: true });
    }, POLL_INTERVAL_MS);
  }
  if (!visibilityBound && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityBound = true;
  }
}

function stopSync() {
  if (pollTimer && typeof window !== 'undefined') {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  if (visibilityBound && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    visibilityBound = false;
  }
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    startSync();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopSync();
    }
  };
}

function getSnapshot() {
  return state;
}

export function useMaStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
