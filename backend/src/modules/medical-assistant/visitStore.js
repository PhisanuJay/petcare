import { listStaff } from '../auth/staffAccounts.js';
import { createJsonCollection } from './jsonCollection.js';

const visits = createJsonCollection('visits.json');

const EMPTY_VITALS = {
  weight: '',
  temp: '',
  heartRate: '',
  respRate: '',
  bcs: '',
  pain: '',
  mucous: '',
  crt: '',
};

export async function getVisit(bookingId) {
  const all = await visits.read();
  return all.find((v) => v.bookingId === bookingId) ?? null;
}

export function listVisits() {
  return visits.read();
}

export async function backfillVetIds() {
  try {
    const current = await visits.read();
    const vetIdByName = new Map(listStaff('veterinarian').map((v) => [v.name, v.id]));
    const needsUpdate = current.some(
      (v) => v && v.vet && !v.vetId && vetIdByName.has(v.vet),
    );
    if (!needsUpdate) return;

    await visits.update((all) => {
      const next = all.map((v) => {
        if (v && v.vet && !v.vetId && vetIdByName.has(v.vet)) {
          return { ...v, vetId: vetIdByName.get(v.vet) };
        }
        return v;
      });
      return { records: next, result: true };
    });
  } catch (err) {
    console.warn('[visitStore] backfillVetIds warning:', err?.message ?? err);
  }
}

export function upsertVisit(bookingId, patch) {
  return visits.update((all) => {
    const index = all.findIndex((v) => v.bookingId === bookingId);
    const existing = index === -1 ? {} : all[index];
    const now = new Date().toISOString();

    const nextVitals = {
      ...EMPTY_VITALS,
      ...(existing.vitals ?? {}),
      ...(patch.vitals ?? {}),
    };

    const nextChecklist = {
      ...(existing.checklist ?? {}),
      ...(patch.checklist ?? {}),
    };

    const record = {
      bookingId,
      petId: existing.petId ?? null,
      vetId: existing.vetId ?? null,
      vet: existing.vet ?? null,
      durationMin: existing.durationMin ?? null,
      handledAt: existing.handledAt ?? null,
      handledBy: existing.handledBy ?? null,
      handledById: existing.handledById ?? null,
      rejectReason: existing.rejectReason ?? null,
      rescheduledFrom: existing.rescheduledFrom ?? null,
      contactedAt: existing.contactedAt ?? null,
      contactedBy: existing.contactedBy ?? null,
      contactedById: existing.contactedById ?? null,
      checkedInAt: existing.checkedInAt ?? null,
      checkedInBy: existing.checkedInBy ?? null,
      checkedInById: existing.checkedInById ?? null,
      treatmentStartedAt: existing.treatmentStartedAt ?? null,
      triage: existing.triage ?? '',
      chiefComplaint: existing.chiefComplaint ?? '',
      ...patch,
      bookingId,
      vitals: nextVitals,
      checklist: nextChecklist,
      updatedAt: now,
    };

    const next = all.slice();
    if (index === -1) next.push(record);
    else next[index] = record;

    return { records: next, result: record };
  });
}
