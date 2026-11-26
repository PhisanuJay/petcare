import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, run } from '../pet-transport/db.js';
import { httpError } from '../pet-owner/jsonCollection.js';
import {
  ANIMAL_STATUS,
  APPLICATION_STATUS,
  OPEN_APPLICATION_STATUSES,
  PUBLIC_ANIMAL_STATUSES,
  appendStatusLog,
  normalizeAnimalStatus,
  normalizeApplicationStatus,
} from './adoptionConstants.js';

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function mapAnimalRow(row) {
  if (!row) return null;
  const data = parseJson(row.data);
  return {
    ...data,
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    species: row.species,
    status: normalizeAnimalStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapApplicationRow(row) {
  if (!row) return null;
  const data = parseJson(row.data);
  return {
    ...data,
    id: row.id,
    animalId: row.animal_id,
    ownerId: row.applicant_user_id,
    applicantUserId: row.applicant_user_id,
    status: normalizeApplicationStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertAnimalRow({ id, ownerId, name, species, status, createdAt, updatedAt, data }) {
  const payload = data ?? {};
  await run(
    `INSERT INTO dbo.adoption_animals (id, owner_id, name, species, status, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      ownerId ?? null,
      name,
      species,
      status,
      JSON.stringify(payload),
      createdAt,
      updatedAt,
    ],
  );
  return mapAnimalRow(await queryOne('SELECT * FROM dbo.adoption_animals WHERE id = ?', [id]));
}

async function saveAnimalRow(animal) {
  const data = { ...animal };
  const id = animal.id;
  delete data.id;
  delete data.ownerId;
  delete data.name;
  delete data.species;
  delete data.status;
  delete data.createdAt;
  delete data.updatedAt;

  await run(
    `UPDATE dbo.adoption_animals
     SET owner_id = ?, name = ?, species = ?, status = ?, data = ?, updated_at = ?
     WHERE id = ?`,
    [
      animal.ownerId ?? null,
      animal.name,
      animal.species,
      animal.status,
      JSON.stringify(data),
      animal.updatedAt || new Date().toISOString(),
      id,
    ],
  );
  return findAnimalById(id);
}

export async function findAnimalById(id) {
  const row = await queryOne('SELECT * FROM dbo.adoption_animals WHERE id = ?', [id]);
  return mapAnimalRow(row);
}

export async function listPublicAnimals() {
  const rows = await queryAll(
    `SELECT * FROM dbo.adoption_animals
     WHERE status IN ('published', 'has_interest')
     ORDER BY created_at DESC`,
  );
  return rows.map(mapAnimalRow);
}

export async function listAnimalsForStaff(statusFilter) {
  const rows = statusFilter
    ? await queryAll(
      'SELECT * FROM dbo.adoption_animals WHERE status = ? ORDER BY created_at DESC',
      [statusFilter],
    )
    : await queryAll('SELECT * FROM dbo.adoption_animals ORDER BY created_at DESC');
  return rows.map(mapAnimalRow);
}

export async function listAnimalsByOwner(ownerId) {
  const rows = await queryAll(
    'SELECT * FROM dbo.adoption_animals WHERE owner_id = ? ORDER BY created_at DESC',
    [ownerId],
  );
  return rows.map(mapAnimalRow);
}

export async function countOpenApplicationsForAnimal(animalId) {
  const row = await queryOne(
    `SELECT COUNT(*) AS c FROM dbo.adoption_applications
     WHERE animal_id = ? AND status IN ('submitted', 'reviewing', 'interview')`,
    [animalId],
  );
  return Number(row?.c ?? 0);
}

export async function createAnimalRecord(ownerId, fields, extra = {}) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const data = appendStatusLog(
    { data: { ...extra, ...fields } },
    { action: 'created', by: ownerId, status: ANIMAL_STATUS.pending_review },
  );
  const animal = {
    id,
    ownerId,
    name: fields.name,
    species: fields.species,
    status: ANIMAL_STATUS.pending_review,
    createdAt: now,
    updatedAt: now,
    ...fields,
    ...data,
  };
  await insertAnimalRow({
    id,
    ownerId,
    name: fields.name,
    species: fields.species,
    status: ANIMAL_STATUS.pending_review,
    createdAt: now,
    updatedAt: now,
    data: { ...extra, ...fields, ...data },
  });
  return findAnimalById(id);
}

export async function updateAnimalRecord(animal, patch, actorId) {
  const now = new Date().toISOString();
  const next = {
    ...animal,
    ...patch,
    updatedAt: now,
  };
  const data = appendStatusLog(
    { data: next },
    { action: 'updated', by: actorId, status: next.status },
  );
  Object.assign(next, data);
  return saveAnimalRow(next);
}

export async function setAnimalStatus(animal, status, actorId, note = '') {
  if (!Object.values(ANIMAL_STATUS).includes(status)) {
    throw httpError(400, 'สถานะประกาศไม่ถูกต้อง');
  }
  const now = new Date().toISOString();
  const patch = {
    status,
    updatedAt: now,
    ...(status === ANIMAL_STATUS.adopted ? { adoptedAt: now } : {}),
    ...(status === ANIMAL_STATUS.rejected ? { moderationNote: note } : {}),
  };
  const data = appendStatusLog(
    { data: { ...animal, ...patch } },
    { action: 'status', by: actorId, status, note },
  );
  return saveAnimalRow({ ...animal, ...patch, ...data });
}

export async function insertApplicationRow({
  id,
  animalId,
  applicantUserId,
  status,
  createdAt,
  updatedAt,
  data,
}) {
  await run(
    `INSERT INTO dbo.adoption_applications (id, animal_id, applicant_user_id, status, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      animalId,
      applicantUserId,
      status,
      JSON.stringify(data ?? {}),
      createdAt,
      updatedAt,
    ],
  );
}

export async function findApplicationById(id) {
  const row = await queryOne('SELECT * FROM dbo.adoption_applications WHERE id = ?', [id]);
  return mapApplicationRow(row);
}

export async function listApplicationsForUser(userId) {
  const rows = await queryAll(
    'SELECT * FROM dbo.adoption_applications WHERE applicant_user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows.map(mapApplicationRow);
}

export async function listApplicationsForStaff() {
  const rows = await queryAll('SELECT * FROM dbo.adoption_applications ORDER BY created_at DESC');
  return rows.map(mapApplicationRow);
}

export async function findDuplicateApplication(userId, animalId) {
  const row = await queryOne(
    `SELECT TOP 1 * FROM dbo.adoption_applications
     WHERE applicant_user_id = ? AND animal_id = ?
       AND status NOT IN ('cancelled', 'rejected', 'closed')`,
    [userId, animalId],
  );
  return mapApplicationRow(row);
}

export async function createApplicationRecord({ animal, applicantUserId, payload }) {
  if (animal.ownerId && animal.ownerId === applicantUserId) {
    throw httpError(403, 'ไม่สามารถส่งคำขอรับเลี้ยงสัตว์ที่คุณประกาศเองได้');
  }
  if (!PUBLIC_ANIMAL_STATUSES.has(animal.status)) {
    throw httpError(404, 'ไม่พบน้องที่เปิดรับบ้านอยู่');
  }

  const duplicate = await findDuplicateApplication(applicantUserId, animal.id);
  if (duplicate) throw httpError(409, 'คุณส่งคำขอสำหรับน้องตัวนี้ไว้แล้ว');

  const now = new Date().toISOString();
  const id = randomUUID();
  const data = appendStatusLog(
    { data: payload },
    { action: 'submitted', by: applicantUserId, status: APPLICATION_STATUS.submitted },
  );
  await insertApplicationRow({
    id,
    animalId: animal.id,
    applicantUserId,
    status: APPLICATION_STATUS.submitted,
    createdAt: now,
    updatedAt: now,
    data,
  });

  const interestCount = await countOpenApplicationsForAnimal(animal.id);
  if (interestCount > 0 && animal.status === ANIMAL_STATUS.published) {
    await setAnimalStatus(animal, ANIMAL_STATUS.has_interest, 'system', 'มีผู้สนใจรับเลี้ยง');
  }

  return findApplicationById(id);
}

function applicationPayload(application, patch = {}) {
  const merged = { ...application, ...patch };
  const data = { ...merged };
  delete data.id;
  delete data.animalId;
  delete data.ownerId;
  delete data.applicantUserId;
  delete data.status;
  delete data.createdAt;
  delete data.updatedAt;
  return data;
}

export async function setApplicationStatus(application, status, actorId, patch = {}) {
  if (!Object.values(APPLICATION_STATUS).includes(status)) {
    throw httpError(400, 'สถานะคำขอไม่ถูกต้อง');
  }
  const now = new Date().toISOString();
  const payload = applicationPayload(application, { ...patch, decidedAt: patch.decidedAt || now });
  const withLog = appendStatusLog(
    { data: payload },
    { action: 'status', by: actorId, status, note: patch.resolutionNote || patch.note || '' },
  );
  await run(
    `UPDATE dbo.adoption_applications SET status = ?, data = ?, updated_at = ? WHERE id = ?`,
    [status, JSON.stringify({ ...payload, ...withLog }), now, application.id],
  );
  return findApplicationById(application.id);
}

export async function closeOtherApplications(animalId, exceptId, note) {
  const rows = await queryAll(
    `SELECT * FROM dbo.adoption_applications
     WHERE animal_id = ? AND id <> ? AND status IN ('submitted', 'reviewing', 'interview')`,
    [animalId, exceptId],
  );
  for (const row of rows) {
    const app = mapApplicationRow(row);
    await setApplicationStatus(app, APPLICATION_STATUS.closed, 'system', {
      resolutionNote: note,
      decidedAt: new Date().toISOString(),
    });
  }
}

export async function adoptionHistory() {
  const animals = await listAnimalsForStaff(ANIMAL_STATUS.adopted);
  const enriched = [];
  for (const animal of animals) {
    const row = await queryOne(
      `SELECT TOP 1 * FROM dbo.adoption_applications
       WHERE animal_id = ? AND status IN ('approved', 'completed')
       ORDER BY updated_at DESC`,
      [animal.id],
    );
    enriched.push({
      animal,
      application: row ? mapApplicationRow(row) : null,
    });
  }
  return enriched;
}

export async function staffOverviewCounts() {
  const animals = await queryAll('SELECT status FROM dbo.adoption_animals');
  const apps = await queryAll('SELECT status FROM dbo.adoption_applications');
  return {
    pendingListings: animals.filter((a) => a.status === ANIMAL_STATUS.pending_review).length,
    availableAnimals: animals.filter((a) => PUBLIC_ANIMAL_STATUSES.has(a.status)).length,
    adoptedAnimals: animals.filter((a) => a.status === ANIMAL_STATUS.adopted).length,
    pendingRequests: apps.filter((a) => OPEN_APPLICATION_STATUSES.has(a.status)).length,
    totalRequests: apps.length,
  };
}