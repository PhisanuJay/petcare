import { useCallback, useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from '../../../shared/utils/storage.js';
import { VISITS_KEY, VITAL_RANGES } from './constants.js';
import { resetSeedVisits, seedVisitsIfEmpty } from './seed.js';

const listeners = new Set();
let cache = null;

function getAll() {
  if (cache === null) {
    seedVisitsIfEmpty();
    cache = readJSON(VISITS_KEY, {});
  }
  return cache;
}

function setAll(next) {
  writeJSON(VISITS_KEY, next);
  cache = next;
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (e) => {
    if (e.key === VISITS_KEY) {
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

export function vitalRangeFor(species) {
  return VITAL_RANGES[species] ?? VITAL_RANGES.default;
}

/**
 * Evaluate vital signs against species reference ranges and return out-of-range flags.
 */
export function vitalFlags(species, vitals = {}) {
  if (!vitals) return [];
  const ranges = vitalRangeFor(species);
  const flags = [];

  for (const key of ['temp', 'heartRate', 'respRate']) {
    const raw = vitals[key];
    if (raw === '' || raw === null || raw === undefined) continue;
    const val = Number(raw);
    if (Number.isNaN(val)) continue;

    const r = ranges[key];
    if (!r) continue;
    if (val < r.min) {
      flags.push({
        key,
        label: r.label,
        value: val,
        unit: r.unit,
        range: `${r.min}–${r.max}`,
        level: 'low',
      });
    } else if (val > r.max) {
      flags.push({
        key,
        label: r.label,
        value: val,
        unit: r.unit,
        range: `${r.min}–${r.max}`,
        level: 'high',
      });
    }
  }
  return flags;
}

export function suggestTriage(species, vitals = {}) {
  const flags = vitalFlags(species, vitals);
  const pain = vitals?.pain === '' || vitals?.pain === undefined ? NaN : Number(vitals.pain);
  if (flags.length >= 2 || (!Number.isNaN(pain) && pain >= 3)) return 'urgent';
  if (flags.length === 1 || (!Number.isNaN(pain) && pain === 2)) return 'soon';
  return 'normal';
}

export function isTriaged(visit) {
  if (!visit) return false;
  const v = visit.vitals ?? {};
  return Boolean(
    v.weight ||
      v.temp ||
      v.heartRate ||
      v.respRate ||
      visit.chiefComplaint?.trim() ||
      visit.triage,
  );
}

export function resetVisitsStore() {
  const fresh = resetSeedVisits();
  cache = fresh;
  listeners.forEach((l) => l());
  return fresh;
}

/** Medical support visit records store keyed by appointmentId. */
export function useVisits() {
  const visitsMap = useSyncExternalStore(subscribe, getAll);

  const getVisit = useCallback(
    (appointmentId) => visitsMap[appointmentId] ?? null,
    [visitsMap],
  );

  const saveVisit = useCallback((appointmentId, patch) => {
    if (!appointmentId) return null;
    const all = getAll();
    const existing = all[appointmentId] ?? {};
    const now = new Date().toISOString();
    const nextVisit = {
      appointmentId,
      patientId: existing.patientId ?? null,
      triage: existing.triage ?? '',
      vitals: {
        weight: '',
        temp: '',
        heartRate: '',
        respRate: '',
        bcs: '',
        pain: '',
        mucous: '',
        crt: '',
        ...existing.vitals,
        ...patch.vitals,
      },
      chiefComplaint: existing.chiefComplaint ?? '',
      checklist: {
        ...existing.checklist,
        ...patch.checklist,
      },
      vetOrders: existing.vetOrders ?? '',
      medications: existing.medications ?? [],
      ownerInstructions: existing.ownerInstructions ?? '',
      followUp: existing.followUp ?? null,
      startedAt: existing.startedAt ?? null,
      completedAt: existing.completedAt ?? null,
      ...patch,
      updatedAt: now,
    };

    // Re-apply merged vitals & checklist if patch included nested objects
    if (patch.vitals) {
      nextVisit.vitals = {
        weight: '',
        temp: '',
        heartRate: '',
        respRate: '',
        bcs: '',
        pain: '',
        mucous: '',
        crt: '',
        ...existing.vitals,
        ...patch.vitals,
      };
    }
    if (patch.checklist) {
      nextVisit.checklist = {
        ...existing.checklist,
        ...patch.checklist,
      };
    }

    setAll({
      ...all,
      [appointmentId]: nextVisit,
    });
    return nextVisit;
  }, []);

  const visitsByPatient = useCallback(
    (patientId) =>
      Object.values(visitsMap)
        .filter((v) => v.patientId === patientId)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [visitsMap],
  );

  const resetVisits = useCallback(() => resetVisitsStore(), []);

  return {
    visitsMap,
    getVisit,
    saveVisit,
    visitsByPatient,
    resetVisits,
  };
}
