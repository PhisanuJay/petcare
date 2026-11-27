import { randomUUID } from 'node:crypto';
import { createJsonCollection, httpError } from './jsonCollection.js';
import { withDemoHealthIfEmpty } from './seedPetHealth.js';

const pets = createJsonCollection('pets.json');
const DEMO_OWNER_ID = 'owner-seed';

function demoPetsForOwner(ownerId) {
  const now = new Date().toISOString();
  return [
    {
      id: 'pet-demo-didi',
      ownerId,
      name: 'ดีดี้',
      species: 'dog',
      breed: 'ปอมเมอเรเนียน',
      sex: 'male',
      birthDate: '2022-05-10',
      weight: '3.2',
      color: 'ครีม',
      photo: '',
      neutered: true,
      vaccines: [],
      treatments: [],
      parasites: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'pet-demo-mali',
      ownerId,
      name: 'มะลิ',
      species: 'cat',
      breed: 'ไทย',
      sex: 'female',
      birthDate: '2023-01-20',
      weight: '4.1',
      color: 'ขาวส้ม',
      photo: '',
      neutered: true,
      vaccines: [],
      treatments: [],
      parasites: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/** เติมสัตว์ demo ให้บัญชี owner@petcare.local ถ้ายังไม่มี — ให้จองได้ทันที */
async function ensureDemoOwnerPets(ownerId) {
  if (ownerId !== DEMO_OWNER_ID) return;
  const all = await pets.read();
  if (all.some((pet) => pet.ownerId === DEMO_OWNER_ID)) return;
  await pets.update((current) => ({
    records: [...current, ...demoPetsForOwner(DEMO_OWNER_ID)],
    result: true,
  }));
}

export async function listPets(ownerId) {
  await ensureDemoOwnerPets(ownerId);
  const all = await pets.read();
  return all
    .filter((pet) => pet.ownerId === ownerId)
    .map(withDemoHealthIfEmpty)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function findPet(ownerId, id) {
  return pets.read().then((all) => {
    const pet = all.find((p) => p.id === id && p.ownerId === ownerId) ?? null;
    return pet ? withDemoHealthIfEmpty(pet) : null;
  });
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
  return pets.read().then((all) => {
    const pet = all.find((item) => item.id === id) ?? null;
    return pet ? withDemoHealthIfEmpty(pet) : null;
  });
}

/** Every owner's pets (for the veterinarian side). */
export function listAllPets() {
  return pets.read().then((all) => all.map(withDemoHealthIfEmpty));
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
