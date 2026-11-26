import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryOne } from '../pet-transport/db.js';
import { ADOPTION_SEED_ANIMALS } from './seedAnimals.js';
import { ANIMAL_STATUS, APPLICATION_STATUS } from './adoptionConstants.js';
import { insertAnimalRow, insertApplicationRow } from './adoptionRepository.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../pet-owner/data');
const legacyRequestsFile = path.join(dataDir, 'adoption-requests.json');
let bootstrapOnce = null;

async function tableCount(table) {
  const row = await queryOne(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number(row?.c ?? 0);
}

async function seedDemoAnimalsIfEmpty() {
  if ((await tableCount('dbo.adoption_animals')) > 0) return;
  const allow = process.env.ADOPTION_SEED_ON_EMPTY !== '0';
  if (!allow) return;

  const now = new Date().toISOString();
  for (const seed of ADOPTION_SEED_ANIMALS) {
    const { id, ownerId, name, species, status, createdAt, ...rest } = seed;
    await insertAnimalRow({
      id,
      ownerId,
      name,
      species,
      status: status === 'available' ? ANIMAL_STATUS.published : status,
      createdAt: createdAt || now,
      updatedAt: now,
      data: { ...rest, seeded: true },
    });
  }
}

async function importLegacyRequestsIfAny() {
  if ((await tableCount('dbo.adoption_applications')) > 0) return;
  let legacy = [];
  try {
    legacy = JSON.parse(await readFile(legacyRequestsFile, 'utf8'));
  } catch {
    return;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return;

  const now = new Date().toISOString();
  for (const row of legacy) {
    if (!row?.id || !row.animalId) continue;
    await insertApplicationRow({
      id: row.id,
      animalId: row.animalId,
      applicantUserId: row.ownerId,
      status: row.status === 'pending' ? APPLICATION_STATUS.submitted : row.status,
      createdAt: row.createdAt || now,
      updatedAt: row.updatedAt || row.createdAt || now,
      data: {
        animalName: row.animalName,
        fullName: row.fullName,
        phone: row.phone,
        address: row.address,
        housing: row.housing,
        hasOtherPets: row.hasOtherPets,
        experience: row.experience,
        reason: row.reason,
        legacySource: 'adoption-requests.json',
      },
    });
  }
}

export function ensureAdoptionReady() {
  if (!bootstrapOnce) {
    bootstrapOnce = (async () => {
      await seedDemoAnimalsIfEmpty();
      await importLegacyRequestsIfAny();
    })();
  }
  return bootstrapOnce;
}