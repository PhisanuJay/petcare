/** Listing lifecycle (stored in dbo.adoption_animals.status). */
export const ANIMAL_STATUS = {
  pending_review: 'pending_review',
  published: 'published',
  has_interest: 'has_interest',
  adopted: 'adopted',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

/** Public gallery: animals open for adoption. */
export const PUBLIC_ANIMAL_STATUSES = new Set([
  ANIMAL_STATUS.published,
  ANIMAL_STATUS.has_interest,
]);

/** Legacy in-memory value → DB status. */
export function normalizeAnimalStatus(status) {
  if (status === 'available') return ANIMAL_STATUS.published;
  return Object.values(ANIMAL_STATUS).includes(status) ? status : ANIMAL_STATUS.pending_review;
}

/** Application lifecycle (dbo.adoption_applications.status). */
export const APPLICATION_STATUS = {
  submitted: 'submitted',
  reviewing: 'reviewing',
  interview: 'interview',
  approved: 'approved',
  rejected: 'rejected',
  completed: 'completed',
  cancelled: 'cancelled',
  closed: 'closed',
};

export const OPEN_APPLICATION_STATUSES = new Set([
  APPLICATION_STATUS.submitted,
  APPLICATION_STATUS.reviewing,
  APPLICATION_STATUS.interview,
]);

export function normalizeApplicationStatus(status) {
  if (status === 'pending') return APPLICATION_STATUS.submitted;
  return Object.values(APPLICATION_STATUS).includes(status) ? status : APPLICATION_STATUS.submitted;
}

export function appendStatusLog(record, entry) {
  const data = record.data && typeof record.data === 'object' ? { ...record.data } : {};
  const log = Array.isArray(data.statusLog) ? data.statusLog.slice() : [];
  log.push({
    at: new Date().toISOString(),
    ...entry,
  });
  data.statusLog = log;
  return data;
}