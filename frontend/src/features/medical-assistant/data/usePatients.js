import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { STORAGE_KEYS, readJSON } from '../../../shared/utils/storage.js';
import { FINAL_STATUSES, offsetDateKey } from './constants.js';
import { useAppointments } from './useAppointments.js';
import { usePatientNotes } from './usePatientNotes.js';

function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone ?? '').replace(/[\s-]/g, '').trim();
}

function makeWalkinId(ownerPhone, petName) {
  const safePhone = normalizePhone(ownerPhone) || 'unknown';
  const safeName = normalizeName(petName).replace(/[/\\]/g, '-') || 'pet';
  return `walkin-${safePhone}-${safeName}`;
}

function pickPublicOwner(u) {
  if (!u) return null;
  return {
    id: u.id,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    phone: u.phone ?? '',
    email: u.email ?? '',
  };
}

let lastPetsRaw = null;
let cachedPets = [];
function getPetsSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEYS.pets);
  if (raw !== lastPetsRaw) {
    lastPetsRaw = raw;
    cachedPets = readJSON(STORAGE_KEYS.pets, []);
  }
  return cachedPets;
}

let lastUsersRaw = null;
let cachedPublicUsers = [];
function getUsersSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEYS.users);
  if (raw !== lastUsersRaw) {
    lastUsersRaw = raw;
    const users = readJSON(STORAGE_KEYS.users, []);
    cachedPublicUsers = Array.isArray(users) ? users.map(pickPublicOwner).filter(Boolean) : [];
  }
  return cachedPublicUsers;
}

function subscribeStorageKey(key) {
  return (listener) => {
    const onStorage = (e) => {
      if (e.key === key) {
        if (key === STORAGE_KEYS.pets) lastPetsRaw = null;
        if (key === STORAGE_KEYS.users) lastUsersRaw = null;
        listener();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  };
}

const subscribePets = subscribeStorageKey(STORAGE_KEYS.pets);
const subscribeUsers = subscribeStorageKey(STORAGE_KEYS.users);

function sortApptsDesc(list) {
  return [...list].sort((a, b) => `${b.date || ''}${b.time || ''}`.localeCompare(`${a.date || ''}${a.time || ''}`));
}

function buildPatientSummary(base, appts, notesEntry, todayKey) {
  const sortedDesc = sortApptsDesc(appts);
  const completed = sortedDesc.filter((a) => a.status === 'completed');
  const upcoming = sortedDesc
    .filter((a) => !FINAL_STATUSES.includes(a.status) && a.date >= todayKey)
    .sort((a, b) => `${a.date || ''}${a.time || ''}`.localeCompare(`${b.date || ''}${b.time || ''}`));

  return {
    ...base,
    appointments: sortedDesc,
    lastVisit: completed[0] ?? null,
    nextAppointment: upcoming[0] ?? null,
    visitCount: completed.length,
    flags: notesEntry?.flags ?? [],
  };
}

/**
 * Resolve the patientId for an appointment against the merged patient list (or registered pets).
 */
export function patientIdOf(appt, patients = []) {
  if (!appt) return '';
  if (appt.petId) {
    const byPetId = patients.find((p) => p.registered && p.patientId === appt.petId);
    if (byPetId) return byPetId.patientId;
  }

  const targetName = normalizeName(appt.petName);
  const targetPhone = normalizePhone(appt.ownerPhone);
  const matchedRegistered = patients.find(
    (p) =>
      p.registered &&
      normalizeName(p.petName) === targetName &&
      targetPhone &&
      normalizePhone(p.owner.phone) === targetPhone,
  );
  if (matchedRegistered) return matchedRegistered.patientId;

  return makeWalkinId(appt.ownerPhone, appt.petName);
}

/**
 * Read-only aggregated patients store merging registered pets (`petcare_pets` + `petcare_users`)
 * with walk-in appointment patients and Medical Assistant caution notes.
 */
export function usePatients() {
  const rawPets = useSyncExternalStore(subscribePets, getPetsSnapshot);
  const publicUsers = useSyncExternalStore(subscribeUsers, getUsersSnapshot);
  const { appointments } = useAppointments();
  const { notesMap } = usePatientNotes();

  const patients = useMemo(() => {
    const todayKey = offsetDateKey(0);
    const userById = new Map(publicUsers.map((u) => [u.id, u]));

    const registeredRecords = rawPets.map((pet) => {
      const ownerUser = userById.get(pet.ownerId) ?? null;
      const ownerName = ownerUser
        ? [ownerUser.firstName, ownerUser.lastName].filter(Boolean).join(' ').trim() || 'เจ้าของสัตว์เลี้ยง'
        : 'ไม่ระบุเจ้าของ';
      return {
        patientId: pet.id,
        registered: true,
        pet,
        petName: pet.name || 'ไม่ระบุชื่อ',
        species: pet.species || 'other',
        breed: pet.breed || '',
        owner: {
          name: ownerName,
          phone: ownerUser?.phone ?? '',
          email: ownerUser?.email ?? '',
        },
        normName: normalizeName(pet.name),
        normPhone: normalizePhone(ownerUser?.phone),
      };
    });

    const regById = new Map(registeredRecords.map((r) => [r.patientId, r]));
    const apptsByPatient = new Map();
    for (const r of registeredRecords) {
      apptsByPatient.set(r.patientId, []);
    }

    const walkinMap = new Map();

    for (const appt of appointments) {
      let matchedReg = null;
      if (appt.petId && regById.has(appt.petId)) {
        matchedReg = regById.get(appt.petId);
      } else {
        const apptName = normalizeName(appt.petName);
        const apptPhone = normalizePhone(appt.ownerPhone);
        if (apptName && apptPhone) {
          matchedReg =
            registeredRecords.find(
              (r) => r.normName === apptName && r.normPhone && r.normPhone === apptPhone,
            ) ?? null;
        }
      }

      if (matchedReg) {
        apptsByPatient.get(matchedReg.patientId).push(appt);
      } else {
        const wid = makeWalkinId(appt.ownerPhone, appt.petName);
        if (!walkinMap.has(wid)) {
          walkinMap.set(wid, {
            patientId: wid,
            registered: false,
            pet: null,
            petName: appt.petName || 'ไม่ระบุชื่อ',
            species: appt.species || 'other',
            breed: '',
            owner: {
              name: appt.ownerName || 'ไม่ระบุเจ้าของ',
              phone: appt.ownerPhone || '',
              email: '',
            },
            appts: [],
          });
        }
        const entry = walkinMap.get(wid);
        entry.appts.push(appt);
      }
    }

    const result = [];

    for (const r of registeredRecords) {
      const { normName: _n, normPhone: _p, ...base } = r;
      result.push(
        buildPatientSummary(
          base,
          apptsByPatient.get(r.patientId) ?? [],
          notesMap[r.patientId],
          todayKey,
        ),
      );
    }

    for (const w of walkinMap.values()) {
      const { appts, ...base } = w;
      const latestAppt = sortApptsDesc(appts)[0];
      if (latestAppt) {
        base.petName = latestAppt.petName || base.petName;
        base.species = latestAppt.species || base.species;
        base.owner = {
          name: latestAppt.ownerName || base.owner.name,
          phone: latestAppt.ownerPhone || base.owner.phone,
          email: '',
        };
      }
      result.push(buildPatientSummary(base, appts, notesMap[w.patientId], todayKey));
    }

    return result;
  }, [rawPets, publicUsers, appointments, notesMap]);

  const getPatient = useCallback(
    (patientId) => patients.find((p) => p.patientId === patientId) ?? null,
    [patients],
  );

  const patientIdForAppt = useCallback(
    (appt) => patientIdOf(appt, patients),
    [patients],
  );

  return {
    patients,
    getPatient,
    patientIdForAppt,
  };
}
