import { useCallback, useSyncExternalStore } from 'react';
import { newId, readJSON, writeJSON } from '../../../shared/utils/storage.js';
import { PATIENT_NOTES_KEY } from './constants.js';

const listeners = new Set();
let cache = null;

function buildSeedNotes() {
  const now = new Date().toISOString();
  return {
    'walkin-0812345678-ข้าวตัง': {
      flags: ['drug_allergy'],
      notes: [
        {
          id: newId(),
          category: 'อาการ',
          text: 'มีประวัติแพ้ยากลุ่ม Penicillin แจ้งคุณหมอก่อนสั่งยาทุกครั้ง',
          createdAt: now,
        },
      ],
    },
    'walkin-0845678901-โกโก้': {
      flags: ['anxious'],
      notes: [
        {
          id: newId(),
          category: 'พฤติกรรม',
          text: 'กลัวเสียงเครื่องเป่าขนและตื่นเต้นง่ายเมื่ออยู่ในห้องตรวจ ควรใช้ผ้าคลุมช่วยลดความเครียด',
          createdAt: now,
        },
      ],
    },
    'walkin-0823456789-ส้มจี๊ด': {
      flags: ['senior'],
      notes: [
        {
          id: newId(),
          category: 'ทั่วไป',
          text: 'อายุ 9 ปี เจ้าของสะดวกนัดช่วงเช้าเนื่องจากน้องไม่เครียด',
          createdAt: now,
        },
      ],
    },
  };
}

function seedNotesIfEmpty() {
  if (localStorage.getItem(PATIENT_NOTES_KEY) === null) {
    writeJSON(PATIENT_NOTES_KEY, buildSeedNotes());
  }
}

function getAll() {
  if (cache === null) {
    seedNotesIfEmpty();
    cache = readJSON(PATIENT_NOTES_KEY, {});
  }
  return cache;
}

function setAll(next) {
  writeJSON(PATIENT_NOTES_KEY, next);
  cache = next;
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (e) => {
    if (e.key === PATIENT_NOTES_KEY) {
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

const EMPTY_ENTRY = { flags: [], notes: [] };

/**
 * Medical Assistant patient caution flags & internal notes persisted in localStorage.
 */
export function usePatientNotes() {
  const notesMap = useSyncExternalStore(subscribe, getAll);

  const getEntry = useCallback(
    (patientId) => notesMap[patientId] ?? EMPTY_ENTRY,
    [notesMap],
  );

  const toggleFlag = useCallback((patientId, flag) => {
    if (!patientId || !flag) return false;
    const all = getAll();
    const current = all[patientId] ?? { flags: [], notes: [] };
    const exists = current.flags.includes(flag);
    const nextFlags = exists
      ? current.flags.filter((f) => f !== flag)
      : [...current.flags, flag];

    setAll({
      ...all,
      [patientId]: {
        ...current,
        flags: nextFlags,
      },
    });
    return !exists;
  }, []);

  const addNote = useCallback((patientId, { category = 'ทั่วไป', text }) => {
    const trimmed = String(text ?? '').trim();
    if (!patientId || !trimmed) return null;

    const all = getAll();
    const current = all[patientId] ?? { flags: [], notes: [] };
    const note = {
      id: newId(),
      category,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    setAll({
      ...all,
      [patientId]: {
        ...current,
        notes: [note, ...current.notes],
      },
    });
    return note;
  }, []);

  const deleteNote = useCallback((patientId, noteId) => {
    if (!patientId || !noteId) return;
    const all = getAll();
    const current = all[patientId];
    if (!current) return;

    setAll({
      ...all,
      [patientId]: {
        ...current,
        notes: current.notes.filter((n) => n.id !== noteId),
      },
    });
  }, []);

  return {
    notesMap,
    getEntry,
    toggleFlag,
    addNote,
    deleteNote,
  };
}
