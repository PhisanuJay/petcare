import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { STORAGE_KEYS, readJSON } from '../../shared/utils/storage.js';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const PETS_URL = `${API_BASE}/api/pet-owner/my-pets`;

/* ---------- API ---------- */

async function request(ownerId, path = '', options = {}) {
  let res;
  try {
    res = await fetch(`${PETS_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-owner-id': ownerId },
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  return body;
}

/* ---------- shared store (one list for the logged-in owner) ---------- */

const listeners = new Set();
let state = { ownerId: null, pets: [], status: 'idle', error: '' };
let loadingFor = null;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => state;

/** Pets saved in localStorage by the earlier version are uploaded once, then removed locally. */
async function migrateLocalPets(ownerId) {
  const local = readJSON(STORAGE_KEYS.pets, []);
  const mine = local.filter((p) => p.ownerId === ownerId);
  if (mine.length === 0) return;
  const uploaded = [];
  for (const pet of mine) {
    try {
      await request(ownerId, '', { method: 'POST', body: JSON.stringify(pet) });
      uploaded.push(pet.id);
    } catch {
      return; // keep the rest locally and try again next time
    }
  }
  try {
    const rest = readJSON(STORAGE_KEYS.pets, []).filter((p) => !uploaded.includes(p.id));
    localStorage.setItem(STORAGE_KEYS.pets, JSON.stringify(rest));
  } catch {
    /* ignore */
  }
}

async function load(ownerId) {
  if (loadingFor === ownerId) return;
  loadingFor = ownerId;
  setState({ ownerId, pets: [], status: 'loading', error: '' });
  try {
    let pets = await request(ownerId);
    if (pets.length === 0 && readJSON(STORAGE_KEYS.pets, []).some((p) => p.ownerId === ownerId)) {
      await migrateLocalPets(ownerId);
      pets = await request(ownerId);
    }
    if (state.ownerId === ownerId) setState({ pets, status: 'ready' });
  } catch (err) {
    if (state.ownerId === ownerId) setState({ status: 'error', error: err.message });
  } finally {
    if (loadingFor === ownerId) loadingFor = null;
  }
}

/* ---------- hook ---------- */

/**
 * Pets of the logged-in user, stored by the backend (`/api/pet-owner/my-pets`).
 * `addPet`, `updatePet` and `deletePet` are async and throw an Error with a Thai message on failure.
 */
export function usePets() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.id ?? null;
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (ownerId && snap.ownerId !== ownerId) load(ownerId);
  }, [ownerId, snap.ownerId]);

  const mine = ownerId !== null && snap.ownerId === ownerId;
  const pets = useMemo(() => (mine ? snap.pets : []), [mine, snap.pets]);
  const loading = ownerId !== null && (!mine || snap.status === 'loading');
  const error = mine && snap.status === 'error' ? snap.error : '';

  const getPet = useCallback((id) => pets.find((p) => p.id === id) ?? null, [pets]);

  const reload = useCallback(() => {
    if (ownerId) load(ownerId);
  }, [ownerId]);

  const addPet = useCallback(
    async (data) => {
      const pet = await request(ownerId, '', { method: 'POST', body: JSON.stringify(data) });
      if (state.ownerId === ownerId) setState({ pets: [...state.pets, pet] });
      return pet;
    },
    [ownerId],
  );

  const updatePet = useCallback(
    async (id, data) => {
      const pet = await request(ownerId, `/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      if (state.ownerId === ownerId) setState({ pets: state.pets.map((p) => (p.id === id ? pet : p)) });
      return pet;
    },
    [ownerId],
  );

  const deletePet = useCallback(
    async (id) => {
      await request(ownerId, `/${id}`, { method: 'DELETE' });
      if (state.ownerId === ownerId) setState({ pets: state.pets.filter((p) => p.id !== id) });
    },
    [ownerId],
  );

  return { pets, loading, error, reload, getPet, addPet, updatePet, deletePet };
}
