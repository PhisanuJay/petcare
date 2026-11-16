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

export function updatePet(ownerId, id, data) {
  return pets.update((all) => {
    const index = all.findIndex((pet) => pet.id === id && pet.ownerId === ownerId);
    if (index === -1) throw httpError(404, 'ไม่พบข้อมูลสัตว์เลี้ยงนี้');
    const pet = {
      ...all[index],
      ...data,
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
