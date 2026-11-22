import { useCallback, useSyncExternalStore } from 'react';
import { newId, readJSON, writeJSON } from '../../../shared/utils/storage.js';
import { STATUS_TRANSITIONS, STORAGE_KEY } from './constants.js';
import { resetSeedAppointments, seedIfEmpty } from './seed.js';
import { resetVisitsStore } from './useVisits.js';

const listeners = new Set();
let cache = null;

function getAll() {
  if (cache === null) {
    seedIfEmpty();
    cache = readJSON(STORAGE_KEY, []);
  }
  return cache;
}

function setAll(next) {
  writeJSON(STORAGE_KEY, next);
  cache = next;
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Appointments store persisted in localStorage for Medical Assistant module. */
export function useAppointments() {
  const appointments = useSyncExternalStore(subscribe, getAll);

  const getAppointment = useCallback(
    (id) => appointments.find((a) => a.id === id) ?? null,
    [appointments],
  );

  const addAppointment = useCallback((data) => {
    const now = new Date().toISOString();
    const item = {
      petId: null,
      status: 'pending',
      source: 'walk_in',
      durationMin: 30,
      reason: '',
      notes: '',
      requestedAt: now,
      ...data,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    setAll([...getAll(), item]);
    return item;
  }, []);

  const updateAppointment = useCallback((id, patch) => {
    const now = new Date().toISOString();
    setAll(
      getAll().map((a) =>
        a.id === id ? { ...a, ...patch, id: a.id, createdAt: a.createdAt, updatedAt: now } : a,
      ),
    );
  }, []);

  const setStatus = useCallback((id, nextStatus) => {
    const current = getAll().find((a) => a.id === id);
    if (!current) return false;
    const allowed = STATUS_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(nextStatus)) return false;

    const now = new Date().toISOString();
    setAll(
      getAll().map((a) => {
        if (a.id !== id) return a;
        const extra = {};
        if (nextStatus === 'checked_in') {
          extra.checkedInAt = a.checkedInAt ?? now;
        } else if (nextStatus === 'in_treatment') {
          extra.checkedInAt = a.checkedInAt ?? now;
          extra.treatmentStartedAt = a.treatmentStartedAt ?? now;
        } else if (nextStatus === 'completed') {
          extra.completedAt = a.completedAt ?? now;
        }
        return { ...a, status: nextStatus, ...extra, updatedAt: now };
      }),
    );
    return true;
  }, []);

  const approveBooking = useCallback((id, { vet, date, time, durationMin } = {}) => {
    const current = getAll().find((a) => a.id === id);
    if (!current) return false;
    const allowed = STATUS_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes('confirmed')) return false;

    const now = new Date().toISOString();
    const nextVet = vet ?? current.vet;
    const nextDate = date ?? current.date;
    const nextTime = time ?? current.time;
    const nextDuration = Number(durationMin ?? current.durationMin) || 30;
    const timeChanged = nextDate !== current.date || nextTime !== current.time;

    setAll(
      getAll().map((a) =>
        a.id === id
          ? {
              ...a,
              vet: nextVet,
              date: nextDate,
              time: nextTime,
              durationMin: nextDuration,
              status: 'confirmed',
              handledAt: now,
              updatedAt: now,
              ...(timeChanged
                ? { rescheduledFrom: current.rescheduledFrom ?? { date: current.date, time: current.time } }
                : {}),
            }
          : a,
      ),
    );
    return true;
  }, []);

  const rejectBooking = useCallback((id, { reason, note = '' } = {}) => {
    const current = getAll().find((a) => a.id === id);
    if (!current) return false;
    const allowed = STATUS_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes('rejected')) return false;

    const now = new Date().toISOString();
    setAll(
      getAll().map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'rejected',
              rejectReason: reason || '',
              rejectNote: note || '',
              handledAt: now,
              updatedAt: now,
            }
          : a,
      ),
    );
    return true;
  }, []);

  const rescheduleAppointment = useCallback((id, { date, time, vet, durationMin } = {}) => {
    const all = getAll();
    const current = all.find((a) => a.id === id);
    if (!current || current.status !== 'no_show') return null;
    const allowed = STATUS_TRANSITIONS.pending ?? [];
    if (!allowed.includes('confirmed')) return null;

    const now = new Date().toISOString();
    const nextDate = date ?? current.date;
    const nextTime = time ?? current.time;
    const nextVet = vet ?? current.vet;
    const nextDuration = Number(durationMin ?? current.durationMin) || 30;

    const newItem = {
      id: newId(),
      petId: current.petId ?? null,
      petName: current.petName,
      species: current.species,
      ownerName: current.ownerName,
      ownerPhone: current.ownerPhone,
      vet: nextVet,
      service: current.service,
      date: nextDate,
      time: nextTime,
      durationMin: nextDuration,
      status: 'confirmed',
      reason: current.reason ?? '',
      notes: current.notes ?? '',
      source: current.source ?? 'walk_in',
      requestedAt: current.requestedAt ?? current.createdAt ?? now,
      handledAt: now,
      rescheduledFrom: { date: current.date, time: current.time },
      createdAt: now,
      updatedAt: now,
    };

    const noteLine = `เลื่อนนัดไปวันที่ ${nextDate} เวลา ${nextTime} น.`;
    const updatedNotes = current.notes ? `${current.notes}\n${noteLine}` : noteLine;

    const nextAll = all.map((a) =>
      a.id === id
        ? {
            ...a,
            notes: updatedNotes,
            rescheduledTo: { id: newItem.id, date: nextDate, time: nextTime },
            updatedAt: now,
          }
        : a,
    );

    setAll([...nextAll, newItem]);
    return newItem;
  }, []);

  const deleteAppointment = useCallback((id) => {
    setAll(getAll().filter((a) => a.id !== id));
  }, []);

  const resetAppointments = useCallback(() => {
    const fresh = resetSeedAppointments();
    cache = fresh;
    listeners.forEach((l) => l());
    resetVisitsStore();
    return fresh;
  }, []);

  return {
    appointments,
    getAppointment,
    addAppointment,
    updateAppointment,
    setStatus,
    approveBooking,
    rejectBooking,
    rescheduleAppointment,
    deleteAppointment,
    resetAppointments,
  };
}
