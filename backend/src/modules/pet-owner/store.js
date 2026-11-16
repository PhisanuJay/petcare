import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const dataFile = path.join(dataDir, 'pets.json');

let queue = Promise.resolve();

async function readPets() {
  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

async function writePets(pets) {
  await mkdir(dataDir, { recursive: true });
  const tmp = path.join(dataDir, `pets.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(pets, null, 2), 'utf8');
  await rename(tmp, dataFile);
}

function updatePets(mutator) {
  const run = queue.then(async () => {
    const pets = await readPets();
    const next = mutator(pets);
    await writePets(next.pets);
    return next.result;
  });
  queue = run.then(
    () => {},
    () => {},
  );
  return run;
}

export function listPets(ownerId) {
  return readPets().then((pets) =>
    pets
      .filter((pet) => pet.ownerId === ownerId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
  );
}

export function findPet(ownerId, id) {
  return readPets().then((pets) => pets.find((pet) => pet.id === id && pet.ownerId === ownerId) ?? null);
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
  return updatePets((pets) => ({ pets: [...pets, pet], result: pet }));
}

export function updatePet(ownerId, id, data) {
  return updatePets((pets) => {
    const index = pets.findIndex((pet) => pet.id === id && pet.ownerId === ownerId);
    if (index === -1) {
      const error = new Error('ไม่พบข้อมูลสัตว์เลี้ยงนี้');
      error.status = 404;
      throw error;
    }
    const pet = {
      ...pets[index],
      ...data,
      id,
      ownerId,
      createdAt: pets[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    const next = pets.slice();
    next[index] = pet;
    return { pets: next, result: pet };
  });
}

export function deletePet(ownerId, id) {
  return updatePets((pets) => {
    const next = pets.filter((pet) => !(pet.id === id && pet.ownerId === ownerId));
    if (next.length === pets.length) {
      const error = new Error('ไม่พบข้อมูลสัตว์เลี้ยงนี้');
      error.status = 404;
      throw error;
    }
    return { pets: next, result: { ok: true } };
  });
}
