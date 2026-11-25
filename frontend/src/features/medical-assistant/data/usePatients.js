import { useCallback, useEffect, useState } from 'react';
import { maRequest } from './maApi.js';
import { reloadMaStore, reloadPatientsSilent, useMaStore } from './maStore.js';

export function usePatients() {
  const { patients, loading, error, meta } = useMaStore();

  const reload = useCallback(() => reloadMaStore({ silent: false }), []);

  return {
    patients,
    loading,
    error,
    reload,
    meta,
  };
}

export function usePatient(id) {
  const { meta } = useMaStore();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!id) {
      setPatient(null);
      setLoading(false);
      setError('ไม่พบรหัสสัตว์เลี้ยง');
      return null;
    }
    setLoading(true);
    setError('');
    try {
      const data = await maRequest(`/patients/${encodeURIComponent(id)}`);
      setPatient(data);
      return data;
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        setPatient(null);
        setLoading(false);
        setError('ไม่พบรหัสสัตว์เลี้ยง');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await maRequest(`/patients/${encodeURIComponent(id)}`);
        if (!cancelled) setPatient(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const setFlags = useCallback(
    async (flags) => {
      if (!id) throw new Error('ไม่พบรหัสสัตว์เลี้ยง');
      const updated = await maRequest(`/patients/${encodeURIComponent(id)}/flags`, {
        method: 'PUT',
        body: JSON.stringify({ flags }),
      });
      setPatient((prev) => (prev ? { ...prev, flags: updated.flags ?? [] } : prev));
      reloadPatientsSilent();
      return updated;
    },
    [id],
  );

  const addNote = useCallback(
    async ({ category, text }) => {
      if (!id) throw new Error('ไม่พบรหัสสัตว์เลี้ยง');
      const created = await maRequest(`/patients/${encodeURIComponent(id)}/notes`, {
        method: 'POST',
        body: JSON.stringify({ category, text }),
      });
      setPatient((prev) =>
        prev ? { ...prev, notes: [created, ...(prev.notes ?? [])] } : prev,
      );
      return created;
    },
    [id],
  );

  const deleteNote = useCallback(
    async (noteId) => {
      if (!id || !noteId) throw new Error('ไม่พบข้อมูลบันทึก');
      await maRequest(
        `/patients/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`,
        { method: 'DELETE' },
      );
      setPatient((prev) =>
        prev ? { ...prev, notes: (prev.notes ?? []).filter((n) => n.id !== noteId) } : prev,
      );
    },
    [id],
  );

  return {
    patient,
    loading,
    error,
    meta,
    reload,
    setFlags,
    addNote,
    deleteNote,
  };
}
