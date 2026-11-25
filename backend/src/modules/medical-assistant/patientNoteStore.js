import { randomUUID } from 'node:crypto';
import { createJsonCollection, httpError } from './jsonCollection.js';

const patientNotes = createJsonCollection('patient-notes.json');

export async function getEntry(petId) {
  const all = await patientNotes.read();
  return all.find((e) => e.petId === petId) ?? { petId, flags: [], notes: [] };
}

export function listEntries() {
  return patientNotes.read();
}

export function setFlags(petId, flags) {
  return patientNotes.update((all) => {
    const index = all.findIndex((e) => e.petId === petId);
    const existing = index === -1 ? { petId, flags: [], notes: [] } : all[index];
    const entry = { ...existing, petId, flags };
    const next = all.slice();
    if (index === -1) next.push(entry);
    else next[index] = entry;
    return { records: next, result: entry };
  });
}

export function addNote(petId, { category, text }) {
  return patientNotes.update((all) => {
    const index = all.findIndex((e) => e.petId === petId);
    const existing = index === -1 ? { petId, flags: [], notes: [] } : all[index];
    const note = {
      id: randomUUID(),
      category,
      text,
      createdAt: new Date().toISOString(),
    };
    const entry = { ...existing, petId, notes: [note, ...existing.notes] };
    const next = all.slice();
    if (index === -1) next.push(entry);
    else next[index] = entry;
    return { records: next, result: note };
  });
}

export function deleteNote(petId, noteId) {
  return patientNotes.update((all) => {
    const index = all.findIndex((e) => e.petId === petId);
    if (index === -1) throw httpError(404, 'ไม่พบบันทึกนี้');
    const existing = all[index];
    const remaining = existing.notes.filter((n) => n.id !== noteId);
    if (remaining.length === existing.notes.length) {
      throw httpError(404, 'ไม่พบบันทึกนี้');
    }
    const next = all.slice();
    next[index] = { ...existing, notes: remaining };
    return { records: next, result: { ok: true } };
  });
}
