import { useEffect, useMemo, useState } from 'react';
import { api, bangkokInput, formatWhen } from '../api.js';
import PetAvatarImg from '../../../../pet-owner/components/PetAvatarImg.jsx';
import { keepIfSame, whenVisible } from '../../../../../shared/utils/stableData.js';

function grantStatus(item) {
  if (item.revokedAt) return { key: 'revoked', label: 'เพิกถอนแล้ว', tone: 'offline' };
  if (item.isActive) return { key: 'active', label: 'กำลังใช้ได้', tone: 'online' };
  return { key: 'idle', label: 'หมดอายุ / ยังไม่ถึง', tone: 'connecting' };
}

function toDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateToGrantInput(dateStr, end = false) {
  if (!dateStr) {
    const d = new Date();
    if (end) d.setHours(23, 59, 0, 0);
    else d.setHours(0, 0, 0, 0);
    return bangkokInput(d);
  }
  return bangkokInput(new Date(`${dateStr}T${end ? '23:59:00' : '00:00:00'}`));
}

function addDaysToDateOnly(dateStr, days) {
  if (!dateStr || !days) return dateStr;
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + Number(days));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatThaiDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${toDateOnly(dateStr)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function speciesLabel(species) {
  if (species === 'dog') return 'หมา';
  if (species === 'cat') return 'แมว';
  return 'สัตว์';
}

function suggestCamera(cameras, species) {
  if (!cameras.length) return '';
  const match = cameras.find((cam) => {
    const blob = `${cam.roomLabel || ''} ${cam.name || ''} ${cam.catName || ''}`.toLowerCase();
    if (species === 'dog') return blob.includes('หมา') || blob.includes('dog');
    if (species === 'cat') return blob.includes('แมว') || blob.includes('cat');
    return false;
  });
  return String((match || cameras[0]).id);
}

function boardingPetsFromStays(stays) {
  const rows = [];
  for (const stay of stays) {
    const pets = Array.isArray(stay.pets) && stay.pets.length
      ? stay.pets
      : [{ id: `stay-${stay.id}`, name: stay.petLabel || 'สัตว์เลี้ยง', species: '', photo: '' }];
    for (const pet of pets) {
      rows.push({
        key: `${stay.id}:${pet.id}`,
        stayId: stay.id,
        petId: pet.id,
        petName: pet.name || 'สัตว์เลี้ยง',
        species: pet.species || '',
        photo: pet.photo || '',
        ownerName: stay.ownerName || 'ผู้จอง',
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        roomLabel: stay.roomLabel || '',
        stay,
      });
    }
  }
  return rows.sort((a, b) => {
    const byOwner = String(a.ownerName).localeCompare(String(b.ownerName), 'th');
    if (byOwner) return byOwner;
    return String(a.petName).localeCompare(String(b.petName), 'th');
  });
}

/**
 * มอบสิทธิ์ดูกล้อง: การ์ดชื่อเจ้าของ + รูปน้อง · วันเข้าพักแบบวันที่ธรรมดา
 */
export default function StayAccessPanel({ embedded = false, initialCameraId = '' } = {}) {
  const [stays, setStays] = useState([]);
  const [grants, setGrants] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [filter, setFilter] = useState('active');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    boardingKey: '',
    cameraId: '',
    startDate: '',
    endDate: '',
  });

  const boardingPets = useMemo(() => boardingPetsFromStays(stays), [stays]);

  const petsByOwner = useMemo(() => {
    const groups = new Map();
    for (const row of boardingPets) {
      const key = row.ownerName || 'ผู้จอง';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return [...groups.entries()];
  }, [boardingPets]);

  async function load({ silent = false } = {}) {
    const active = filter === 'active' ? '1' : '0';
    const [stayRes, access, cams] = await Promise.all([
      api('/api/admin/stays'),
      api(`/api/admin/grants?active=${active}`),
      api('/api/admin/cameras?pageSize=100'),
    ]);
    const openStays = (stayRes.items || []).filter(
      (stay) => !['cancelled', 'checked_out'].includes(stay.status),
    );
    const enabledCams = (cams.items || []).filter((cam) => cam.isEnabled !== false);
    setStays((prev) => keepIfSame(prev, openStays));
    setGrants((prev) => keepIfSame(prev, access.items || []));
    setCameras((prev) => keepIfSame(prev, enabledCams));
    if (!silent) setError('');
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    const timer = window.setInterval(() => {
      whenVisible(() => load({ silent: true }).catch(() => {}));
    }, 25000);
    return () => window.clearInterval(timer);
  }, [filter]);

  useEffect(() => {
    if (!initialCameraId || !cameras.length) return;
    setForm((prev) => ({ ...prev, cameraId: String(initialCameraId) }));
  }, [initialCameraId, cameras]);

  const selectedBoarding = useMemo(
    () => boardingPets.find((row) => row.key === form.boardingKey) || null,
    [boardingPets, form.boardingKey],
  );

  const selectedCamera = useMemo(
    () => cameras.find((cam) => String(cam.id) === String(form.cameraId)) || null,
    [cameras, form.cameraId],
  );

  function pickPet(row) {
    setForm((prev) => ({
      boardingKey: row.key,
      cameraId: prev.cameraId || suggestCamera(cameras, row.species),
      startDate: toDateOnly(row.checkIn),
      endDate: toDateOnly(row.checkOut),
    }));
    setError('');
    setOkMsg('');
  }

  function resetStayDates() {
    if (!selectedBoarding) return;
    setForm((prev) => ({
      ...prev,
      startDate: toDateOnly(selectedBoarding.checkIn),
      endDate: toDateOnly(selectedBoarding.checkOut),
    }));
  }

  function extendEndBy(days) {
    setForm((prev) => ({
      ...prev,
      endDate: addDaysToDateOnly(prev.endDate, days),
    }));
  }

  async function createAccess(event) {
    event.preventDefault();
    if (!selectedBoarding) {
      setError('เลือกน้องที่มาฝากก่อน');
      return;
    }
    if (!form.cameraId) {
      setError('เลือกกล้องก่อนมอบสิทธิ์');
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError('ระบุวันเข้า–ออกให้ครบ');
      return;
    }
    if (form.endDate < form.startDate) {
      setError('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
      return;
    }

    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const result = await api(`/api/admin/stays/${selectedBoarding.stayId}/grants`, {
        method: 'POST',
        body: {
          cameraId: Number(form.cameraId),
          startsAt: dateToGrantInput(form.startDate, false),
          endsAt: dateToGrantInput(form.endDate, true),
          petIds: [selectedBoarding.petId],
          roomLabel: selectedCamera?.roomLabel || selectedBoarding.roomLabel,
        },
      });
      setOkMsg(
        `มอบสิทธิ์แล้ว · ${selectedBoarding.petName} (${selectedBoarding.ownerName}) → ${selectedCamera?.name || 'กล้อง'}`,
      );
      setForm((prev) => ({
        ...prev,
        boardingKey: '',
        startDate: '',
        endDate: '',
      }));
      await load();
    } catch (err) {
      setError(err.message || 'มอบสิทธิ์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/grants/${id}`, { method: 'DELETE' });
      setOkMsg('เพิกถอนสิทธิ์แล้ว');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const visibleGrants = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (grants || []).filter((item) => {
      if (!needle) return true;
      const blob = [
        item.displayName,
        item.email,
        item.cameraName,
        item.petName,
        item.roomLabel,
      ].join(' ').toLowerCase();
      return blob.includes(needle);
    });
  }, [grants, query]);

  return (
    <div className={`page access-page access-page--simple ${embedded ? 'access-embedded' : ''}`}>
      <div className="page-head">
        <div>
          {embedded ? null : <h1>มอบสิทธิ์ดูกล้อง</h1>}
          <p className="muted">เลือกการ์ดน้องตามเจ้าของ — วันเข้าพักดึงจากใบจอง แก้เป็นวันธรรมดาได้</p>
        </div>
        <button
          className="button ghost"
          type="button"
          onClick={() => load().catch((err) => setError(err.message))}
        >
          รีเฟรช
        </button>
      </div>

      {error ? <p className="banner error">{error}</p> : null}
      {okMsg ? <p className="banner ok">{okMsg}</p> : null}

      <section className="panel access-create access-create--simple">
        <form className="access-form access-form--simple" onSubmit={createAccess}>
          <div className="access-field">
            <span>เลือกน้องที่มาฝาก</span>
            {boardingPets.length === 0 ? (
              <p className="muted" style={{ margin: '0.5rem 0 0' }}>ยังไม่มีสัตว์ที่เข้าพักอยู่</p>
            ) : (
              <div className="access-owner-groups">
                {petsByOwner.map(([ownerName, pets]) => (
                  <div key={ownerName} className="access-owner-group">
                    <p className="access-owner-name">{ownerName}</p>
                    <div className="access-pet-grid">
                      {pets.map((row) => {
                        const selected = form.boardingKey === row.key;
                        return (
                          <button
                            key={row.key}
                            type="button"
                            className={`access-pet-card${selected ? ' is-selected' : ''}`}
                            onClick={() => pickPet(row)}
                          >
                            <PetAvatarImg
                              pet={row}
                              photo={row.photo}
                              species={row.species}
                              className="access-pet-card__photo"
                              size={64}
                            />
                            <span className="access-pet-card__body">
                              <strong>{row.petName}</strong>
                              <span className="muted tiny">
                                {speciesLabel(row.species)}
                                {' · '}
                                {formatThaiDate(row.checkIn)}
                                {'–'}
                                {formatThaiDate(row.checkOut)}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedBoarding ? (
            <>
              <div className="access-summary access-summary--pet" aria-live="polite">
                <PetAvatarImg
                  pet={selectedBoarding}
                  photo={selectedBoarding.photo}
                  species={selectedBoarding.species}
                  className="access-summary__photo"
                  size={48}
                />
                <div>
                  <p>
                    <strong>{selectedBoarding.petName}</strong>
                    {' · '}
                    {selectedBoarding.ownerName}
                  </p>
                  <p className="muted tiny">
                    ตามใบจอง {formatThaiDate(selectedBoarding.checkIn)}
                    {' – '}
                    {formatThaiDate(selectedBoarding.checkOut)}
                  </p>
                </div>
              </div>

              <div className="access-form-grid access-form-grid--dates">
                <label className="access-field">
                  <span>วันเริ่มดู</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                    required
                  />
                </label>
                <label className="access-field">
                  <span>วันสิ้นสุด</span>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                    required
                  />
                </label>
              </div>

              <div className="access-date-tools">
                <span className="muted tiny">ขยายวันสิ้นสุดเร็วๆ</span>
                <div className="chip-row">
                  {[1, 2, 3, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className="chip-btn"
                      onClick={() => extendEndBy(days)}
                    >
                      +{days} วัน
                    </button>
                  ))}
                  <button type="button" className="chip-btn" onClick={resetStayDates}>
                    ตามใบจอง
                  </button>
                </div>
              </div>
            </>
          ) : null}

          <label className="access-field">
            <span>กล้อง</span>
            <select
              value={form.cameraId}
              onChange={(event) => setForm((prev) => ({ ...prev, cameraId: event.target.value }))}
              required
            >
              <option value="">เลือกกล้อง…</option>
              {cameras.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.roomLabel ? ` · ${item.roomLabel}` : ''}
                  {item.streamStatus === 'online' ? '' : ' (ออฟไลน์)'}
                </option>
              ))}
            </select>
          </label>

          <div className="access-actions">
            <button
              className="button wide"
              type="submit"
              disabled={busy || !form.boardingKey || !form.cameraId}
            >
              {busy ? 'กำลังมอบสิทธิ์…' : 'มอบสิทธิ์ดูกล้อง'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel access-list">
        <div className="access-list-head">
          <div>
            <h2>สิทธิ์ที่มอบแล้ว</h2>
            <p className="muted tiny">{visibleGrants.length} รายการ</p>
          </div>
          <div className="chip-row">
            {[
              ['active', 'ใช้งาน'],
              ['all', 'ทั้งหมด'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip-btn ${filter === value ? 'active' : ''}`}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="search access-search">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อน้อง / เจ้าของ / กล้อง"
          />
        </label>

        {visibleGrants.length === 0 ? (
          <div className="empty access-empty">
            <strong>ยังไม่มีสิทธิ์</strong>
            <p className="muted">เลือกการ์ดน้องด้านบนแล้วกดมอบสิทธิ์</p>
          </div>
        ) : (
          <div className="access-cards">
            {visibleGrants.map((item) => {
              const status = grantStatus(item);
              return (
                <article className="access-card" key={item.id}>
                  <div className="access-card-top">
                    <div className="access-who">
                      <strong>{item.petName || item.displayName || item.email}</strong>
                      <p className="muted tiny">
                        {item.displayName || item.email}
                        {item.cameraName ? ` · ${item.cameraName}` : ''}
                      </p>
                    </div>
                    <span className={`pill ${status.tone}`}>{status.label}</span>
                  </div>
                  <div className="access-card-body access-card-body--simple">
                    <p className="muted tiny">
                      {formatWhen(item.startsAt)} → {formatWhen(item.endsAt)}
                    </p>
                    {!item.revokedAt && item.isActive ? (
                      <button className="button ghost" type="button" disabled={busy} onClick={() => revoke(item.id)}>
                        เพิกถอน
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
