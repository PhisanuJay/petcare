import { useCallback } from 'react';
import { VITAL_RANGES } from './constants.js';
import { maRequest } from './maApi.js';
import { updateVisitInStore, useMaStore } from './maStore.js';

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

/** Medical support visit records read from appointment.visit in store and persisted via API. */
export function useVisits() {
  const { appointments } = useMaStore();

  const getVisit = useCallback(
    (bookingId) => appointments.find((a) => a.id === bookingId)?.visit ?? null,
    [appointments],
  );

  const saveVisit = useCallback(async (bookingId, patch = {}) => {
    if (!bookingId) return null;
    const body = {};
    if (patch.triage !== undefined) body.triage = patch.triage;
    if (patch.chiefComplaint !== undefined) body.chiefComplaint = patch.chiefComplaint;
    if (patch.vitals !== undefined) body.vitals = patch.vitals;
    if (patch.checklist !== undefined) body.checklist = patch.checklist;

    const updated = await maRequest(`/visits/${encodeURIComponent(bookingId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    updateVisitInStore(bookingId, updated);
    return updated;
  }, []);

  return {
    getVisit,
    saveVisit,
  };
}
