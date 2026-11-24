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
      vet: existing.vet ?? null,
      durationMin: existing.durationMin ?? null,
      handledAt: existing.handledAt ?? null,
      rejectReason: existing.rejectReason ?? null,
      rescheduledFrom: existing.rescheduledFrom ?? null,
      contactedAt: existing.contactedAt ?? null,
      checkedInAt: existing.checkedInAt ?? null,
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
