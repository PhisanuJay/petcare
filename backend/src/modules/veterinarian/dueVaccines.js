import { todayString } from '../pet-owner/clinicSchedule.js';

const pad = (n) => String(n).padStart(2, '0');
const normName = (name) => String(name ?? '').trim().toLowerCase();

/**
 * Vaccines that are overdue or due within `days` days, across `pets` (from listAllPets()).
 * Only the most recent dose of each vaccine counts, so giving the next dose clears the old reminder.
 * (Parasite treatment is just recorded when given; the clinic does not track it as a schedule.)
 *
 * Returns `[{ name, petId, petName, petSpecies, petBreed, lastDate, nextDate, status: 'overdue'|'soon' }]`,
 * soonest first. Shared by the Veterinarian and Medical Assistant modules.
 */
export function dueVaccines(pets, days) {
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  const limitString = `${limit.getFullYear()}-${pad(limit.getMonth() + 1)}-${pad(limit.getDate())}`;
  const t = todayString();
  const due = [];

  for (const pet of pets) {
    const latest = new Map();
    for (const row of pet.vaccines ?? []) {
      const key = normName(row.name) || row.id;
      const current = latest.get(key);
      if (!current || (row.date ?? '') >= (current.date ?? '')) latest.set(key, row);
    }
    for (const row of latest.values()) {
      if (!row.nextDate || row.nextDate > limitString) continue;
      due.push({
        name: row.name,
        petId: pet.id,
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed,
        lastDate: row.date || '',
        nextDate: row.nextDate,
        status: row.nextDate < t ? 'overdue' : 'soon',
      });
    }
  }
  return due.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}
