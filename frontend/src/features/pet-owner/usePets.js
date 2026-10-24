import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { STORAGE_KEYS, newId, readJSON, writeJSON } from '../../shared/utils/storage.js';

const listeners = new Set();
let cache = null;

function getAll() {
  if (cache === null) cache = readJSON(STORAGE_KEYS.pets, []);
  return cache;
}

function setAll(next) {
  writeJSON(STORAGE_KEYS.pets, next);
  cache = next;
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEYS.pets) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const withIds = (rows = []) => rows.map((r) => (r.id ? r : { ...r, id: newId() }));

/** Pets of the logged-in user, persisted in localStorage. */
export function usePets() {
  const { currentUser } = useAuth();
  const all = useSyncExternalStore(subscribe, getAll);
  const ownerId = currentUser?.id;

  const pets = useMemo(
    () =>
      ownerId
        ? all.filter((p) => p.ownerId === ownerId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        : [],
    [all, ownerId],
  );

  const getPet = useCallback((id) => pets.find((p) => p.id === id) ?? null, [pets]);

  const addPet = useCallback(
    (data) => {
      const now = new Date().toISOString();
      const pet = {
        ...data,
        vaccines: withIds(data.vaccines),
        treatments: withIds(data.treatments),
        parasites: withIds(data.parasites),
        id: newId(),
        ownerId,
        createdAt: now,
        updatedAt: now,
      };
      setAll([...getAll(), pet]);
      return pet;
    },
    [ownerId],
  );

  const updatePet = useCallback(
    (id, data) => {
      setAll(
        getAll().map((p) =>
          p.id === id && p.ownerId === ownerId
            ? {
                ...p,
                ...data,
                vaccines: withIds(data.vaccines ?? p.vaccines),
                treatments: withIds(data.treatments ?? p.treatments),
                parasites: withIds(data.parasites ?? p.parasites),
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      );
    },
    [ownerId],
  );

  const deletePet = useCallback(
    (id) => setAll(getAll().filter((p) => !(p.id === id && p.ownerId === ownerId))),
    [ownerId],
  );

  return { pets, getPet, addPet, updatePet, deletePet };
}
