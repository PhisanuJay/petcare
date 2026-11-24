import { randomUUID } from 'node:crypto';
import { createJsonCollection, httpError } from './jsonCollection.js';

const pets = createJsonCollection('pets.json');

export function listPets(ownerId) {
  return pets.read().then((all) =>
    all
      .filter((pet) => pet.ownerId === ownerId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
  );
}

export function findPet(ownerId, id) {
  return pets.read().then((all) => all.find((pet) => pet.id === id && pet.ownerId === ownerId) ?? null);
}

export function createPet(ownerId, data) {
  const now = new Date().toISOString();
  const pet = {
    ...data,
    id: randomUUID(),
    ownerId,
    createdAt: now,
    updatedAt: now,
  };
  return pets.update((all) => ({ records: [...all, pet], result: pet }));
}

/** Health record lists. Rows with `source: 'vet'` belong to the clinic and survive owner edits. */
const RECORD_KEYS = ['vaccines', 'treatments', 'parasites'];

export function updatePet(ownerId, id, data) {
  return pets.update((all) => {
    const index = all.findIndex((pet) => pet.id === id && pet.ownerId === ownerId);
    if (index === -1) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยงนี้');
    const merged = { ...data };
    for (const key of RECORD_KEYS) {
      if (merged[key] === undefined) continue;
      const clinicRows = (all[index][key] ?? []).filter((row) => row.source === 'vet');
      merged[key] = [...merged[key], ...clinicRows];
    }
    const pet = {
      ...all[index],
      ...merged,
      id,
      ownerId,
      createdAt: all[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    const next = all.slice();
    next[index] = pet;
    return { records: next, result: pet };
  });
}

export function deletePet(ownerId, id) {
  return pets.update((all) => {
    const next = all.filter((pet) => !(pet.id === id && pet.ownerId === ownerId));
    if (next.length === all.length) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยงนี้');
    return { records: next, result: { ok: true } };
  });
}

/** A pet by id regardless of owner (for the veterinarian side). */
export function getPetById(id) {
  return pets.read().then((all) => all.find((pet) => pet.id === id) ?? null);
}

/** Every owner's pets (for the veterinarian side). */
export function listAllPets() {
  return pets.read();
}

/**
 * Change a pet on behalf of the clinic (any owner). `mutator(pet)` returns the new pet and may throw.
 * Runs inside the store's write queue, so it cannot overwrite a concurrent owner edit.
 */
export function updatePetAsClinic(id, mutator) {
  return pets.update((all) => {
    const index = all.findIndex((pet) => pet.id === id);
    if (index === -1) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยง');
    const pet = { ...mutator(all[index]), updatedAt: new Date().toISOString() };
    const next = all.slice();
    next[index] = pet;
    return { records: next, result: pet };
  });
}
