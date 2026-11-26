import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../super-admin/hotel-cctv/src/api.js';
import { keepIfSame, whenVisible } from '../../shared/utils/stableData.js';
import '../hotel-admin/hotel-admin.css';
import { HOTEL_STATUS, HOTEL_STATUS_LABEL } from './useHotelBookings.js';

const DEFAULT_FILTER = { stays: 'active', grant: 'granted' };
const POLL_MS = 20000;

function formatDay(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function localInputValue(isoOrDate, end = false) {
  if (!isoOrDate) {
    const d = new Date();
    if (end) d.setHours(23, 59, 0, 0);
    else d.setHours(0, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    return `${isoOrDate}T${end ? '23:59' : '00:00'}`;
  }
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusTone(status) {
  if (status === HOTEL_STATUS.checkedIn || status === 'checked_in') return 'checked_in';
  if (status === HOTEL_STATUS.checkedOut || status === 'checked_out') return 'checked_out';
  if (status === HOTEL_STATUS.cancelled || status === 'cancelled') return 'cancelled';
  if (status === 'confirmed' || status === 'pending' || status === HOTEL_STATUS.waiting) return 'waiting';
  return 'idle';
}

/** Hotel desk: real stays from MSSQL + grant cameras to the booker. */
export default function HotelStayDesk({ focus = 'stays' } = {}) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(DEFAULT_FILTER[focus] || 'active');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  const [grantStay, setGrantStay] = useState(null);
  const [grantForm, setGrantForm] = useState({ cameraId: '', startsAt: '', endsAt: '', petIds: [] });
  const [grantMsg, setGrantMsg] = useState('');
  const [grantBusy, setGrantBusy] = useState(false);

  useEffect(() => {
    setFilter(DEFAULT_FILTER[focus] || 'active');
  }, [focus]);

  const initialLoad = useRef(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setError('');
    try {
      const [staysRes, camRes] = await Promise.all([
        api('/api/admin/stays'),
        api('/api/admin/cameras?pageSize=100').catch(() => ({ items: [] })),
      ]);
      setItems((prev) => keepIfSame(prev, staysRes.items || []));
      setSummary((prev) => keepIfSame(prev, staysRes.summary || null));
      setCameras((prev) => keepIfSame(prev, camRes.items || []));
    } catch (err) {
      if (!silent) setError(err.message || 'โหลดใบจองไม่สำเร็จ');
    } finally {
      if (initialLoad.current) {
        initialLoad.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load({ silent: false });
    const timer = window.setInterval(() => {
      whenVisible(() => load({ silent: true }));
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) load({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((stay) => {
      if (filter === 'granted' && !stay.cameraGranted) return false;
      if (filter === 'checked_in' && stay.status !== 'checked_in') return false;
      if (filter === 'active' && ['cancelled', 'checked_out'].includes(stay.status)) return false;
      if (!needle) return true;
      const blob = [
        stay.petLabel,
        stay.ownerName,
        stay.ownerEmail,
        stay.roomLabel,
      ].join(' ').toLowerCase();
      return blob.includes(needle);
    });
  }, [items, filter, query]);

  async function setStatus(stayId, status) {
    setBusyId(stayId);
    setError('');
    try {
      const result = await api(`/api/admin/stays/${stayId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      setItems((prev) => prev.map((row) => (row.id === stayId ? { ...row, ...result.stay } : row)));
      await load({ silent: true });
    } catch (err) {
      setError(err.message || 'อัปเดตสถานะไม่สำเร็จ');
    } finally {
      setBusyId('');
    }
  }

  function suggestCameraForStay(stay) {
    const species = stay?.pets?.[0]?.species || stay?.rooms?.[0]?.species || '';
    const match = cameras.find((cam) => {
      const blob = `${cam.roomLabel || ''} ${cam.name || ''}`.toLowerCase();
      if (species === 'dog') return blob.includes('หมา') || blob.includes('dog');
      if (species === 'cat') return blob.includes('แมว') || blob.includes('cat');
      return false;
    });
    return String((match || cameras[0] || {}).id || '');
  }

  function openGrant(stay) {
    setGrantStay(stay);
    setGrantMsg('');
    setGrantForm({
      cameraId: suggestCameraForStay(stay),
      startsAt: localInputValue(stay.checkIn, false),
      endsAt: localInputValue(stay.checkOut, true),
      petIds: (stay.pets || []).map((pet) => pet.id),
    });
  }

  function toggleGrantPet(petId) {
    setGrantForm((prev) => {
      const has = prev.petIds.includes(petId);
      return {
        ...prev,
        petIds: has ? prev.petIds.filter((id) => id !== petId) : [...prev.petIds, petId],
      };
    });
  }

  async function submitGrant(event) {
    event.preventDefault();
    if (!grantStay) return;
    if (!(grantForm.petIds || []).length) {
      setGrantMsg('เลือกอย่างน้อย 1 ตัวจากใบจอง');
      return;
    }
    setGrantBusy(true);
    setGrantMsg('');
    try {
      const result = await api(`/api/admin/stays/${grantStay.id}/grants`, {
        method: 'POST',
        body: {
          cameraId: Number(grantForm.cameraId),
          startsAt: grantForm.startsAt,
          endsAt: grantForm.endsAt,
          petIds: grantForm.petIds,
          roomLabel: grantStay.roomLabel,
        },
      });
      setGrantMsg(`มอบสิทธิ์ดูกล้องแล้ว (${result.count || 1} สิทธิ์)`);
      await load({ silent: true });
      window.setTimeout(() => {
        setGrantStay(null);
        setGrantMsg('');
      }, 900);
    } catch (err) {
      setGrantMsg(err.message || 'มอบสิทธิ์ไม่สำเร็จ');
    } finally {
      setGrantBusy(false);
    }
  }

  const stats = [
    { key: 'all', label: 'ทั้งหมด', value: summary?.total ?? 0 },
    { key: 'active', label: 'รอ / ใช้งาน', value: summary?.waiting ?? 0 },
    { key: 'checked_in', label: 'กำลังเข้าพัก', value: summary?.checkedIn ?? 0 },
    { key: 'granted', label: 'เปิดกล้องแล้ว', value: summary?.granted ?? 0 },
  ];

  const chips = [
    ['active', 'ใช้งานอยู่'],
    ['checked_in', 'กำลังเข้าพัก'],
    ['granted', 'เปิดกล้องแล้ว'],
    ['all', 'ทั้งหมด'],
  ];

  return (
    <div className="hotel-admin-desk page">
      <div className="hotel-admin-desk__toolbar">
        <p className="hotel-admin-desk__hint">
          {focus === 'grant'
            ? 'มอบสิทธิ์ดูกล้องจากใบจองจริง — ช่วงตามวันเข้าพักถึงวันรับกลับ'
            : 'รับเข้าพัก / รับกลับ และมอบสิทธิ์ดูกล้องจากคนจองจริง'}
        </p>
        <div className="hotel-admin-desk__tools">
          <label className="hotel-admin-desk__search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อ / อีเมล / สัตว์"
              aria-label="ค้นหาใบจอง"
            />
          </label>
          <button className="ha-btn ha-btn--ghost button ghost" type="button" onClick={() => load()}>
            รีเฟรช
          </button>
        </div>
      </div>

      {summary ? (
        <section className="ha-stat-row stat-row" aria-label="สรุปใบจอง">
          {stats.map((stat) => (
            <button
              key={stat.key}
              type="button"
              className={`ha-stat stat-card ${filter === stat.key ? 'is-active' : ''}`}
              onClick={() => setFilter(stat.key)}
            >
              <div>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            </button>
          ))}
        </section>
      ) : null}

      <div className="ha-chip-row chip-row">
        {chips.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`ha-chip chip-btn ${filter === value ? 'is-active active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="ha-banner ha-banner--error banner error">{error}</p> : null}
      {loading ? <p className="ha-muted muted">กำลังโหลดใบจอง…</p> : null}
      {!loading && visible.length === 0 ? (
        <p className="ha-muted muted">ยังไม่มีใบจองในตัวกรองนี้</p>
      ) : null}

      {visible.length > 0 ? (
        <section className="stay-desk hotel-admin-desk__list">
          {visible.map((booking) => {
            const tone = statusTone(booking.status);
            const canCheckIn = booking.status === HOTEL_STATUS.waiting
              || booking.status === 'confirmed'
              || booking.status === 'pending';
            const canCheckOut = booking.status === HOTEL_STATUS.checkedIn || booking.status === 'checked_in';
            const canGrant = !['cancelled', 'checked_out'].includes(booking.status);

            return (
              <article key={booking.id} className="stay-desk-row hotel-admin-desk__card">
                <div className="hotel-admin-desk__card-main">
                  <strong>{booking.petLabel}</strong>
                  <p>
                    {booking.ownerName}
                    {' · '}
                    {booking.ownerEmail}
                  </p>
                  <p>
                    {booking.roomLabel}
                    {' · '}
                    {formatDay(booking.checkIn)}
                    {' – '}
                    {formatDay(booking.checkOut)}
                    {booking.nights ? ` · ${booking.nights} คืน` : ''}
                  </p>
                  <div className="hotel-admin-desk__meta">
                    {booking.cameraGranted ? (
                      <span className="ha-badge ha-badge--granted">
                        เปิดกล้อง
                        {booking.grants?.length
                          ? ` · ${booking.grants.map((g) => g.cameraName || g.roomLabel).filter(Boolean).join(', ')}`
                          : ''}
                      </span>
                    ) : (
                      <span className="ha-badge ha-badge--idle">ยังไม่มอบสิทธิ์</span>
                    )}
                  </div>
                </div>

                <span className={`ha-badge ha-badge--${tone} hotel-admin-desk__status`}>
                  {HOTEL_STATUS_LABEL[booking.status] || booking.status}
                </span>

                <div className="stay-desk-actions hotel-admin-desk__actions">
                  {canCheckIn ? (
                    <button
                      className="ha-btn ha-btn--primary button"
                      type="button"
                      disabled={busyId === booking.id}
                      onClick={() => setStatus(booking.id, HOTEL_STATUS.checkedIn)}
                    >
                      รับเข้าพัก
                    </button>
                  ) : null}
                  {canCheckOut ? (
                    <button
                      className="ha-btn ha-btn--primary button"
                      type="button"
                      disabled={busyId === booking.id}
                      onClick={() => setStatus(booking.id, HOTEL_STATUS.checkedOut)}
                    >
                      รับกลับ
                    </button>
                  ) : null}
                  {canGrant ? (
                    <button
                      className="ha-btn ha-btn--ghost button ghost"
                      type="button"
                      onClick={() => openGrant(booking)}
                    >
                      {booking.cameraGranted ? 'ต่ออายุ / เปลี่ยนกล้อง' : 'มอบสิทธิ์ดูกล้อง'}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {grantStay ? (
        <div className="overlay" onClick={() => setGrantStay(null)}>
          <form
            className="cctv-modal ha-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitGrant}
          >
            <div className="card-top">
              <div>
                <h2>มอบสิทธิ์ดูกล้อง</h2>
                <p className="ha-muted muted">
                  {grantStay.ownerName}
                  {' · '}
                  {grantStay.petLabel}
                  {' · '}
                  {grantStay.roomLabel}
                </p>
              </div>
              <button className="ha-btn ha-btn--ghost button ghost" type="button" onClick={() => setGrantStay(null)}>
                ปิด
              </button>
            </div>

            {grantMsg ? (
              <p className={`ha-banner banner ${grantMsg.includes('แล้ว') ? 'ha-banner--ok ok' : 'ha-banner--error error'}`}>
                {grantMsg}
              </p>
            ) : null}

            {cameras.length === 0 ? (
              <p className="ha-banner ha-banner--error banner error">
                ยังไม่มีกล้องในระบบ — เพิ่มกล้องที่เมนูจัดการกล้องก่อน
              </p>
            ) : (
              <>
                <div>
                  <p className="ha-muted muted tiny" style={{ marginBottom: 8 }}>เลือกหมา / แมวในใบจอง</p>
                  <div className="ha-chip-row chip-row">
                    {(grantStay.pets || []).length === 0 ? (
                      <span className="ha-muted muted tiny">ไม่มีรายชื่อสัตว์ในใบจอง</span>
                    ) : (
                      grantStay.pets.map((pet) => {
                        const on = (grantForm.petIds || []).includes(pet.id);
                        return (
                          <button
                            key={pet.id}
                            type="button"
                            className={`ha-chip chip-btn ${on ? 'is-active active' : ''}`}
                            onClick={() => toggleGrantPet(pet.id)}
                          >
                            {pet.species === 'dog' ? 'หมา' : pet.species === 'cat' ? 'แมว' : 'สัตว์'}
                            {' · '}
                            {pet.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                <label>
                  เลือกกล้องห้อง
                  <select
                    value={grantForm.cameraId}
                    onChange={(event) => setGrantForm((prev) => ({ ...prev, cameraId: event.target.value }))}
                    required
                  >
                    {cameras.map((camera) => (
                      <option key={camera.id} value={camera.id}>
                        {camera.name || `กล้อง ${camera.id}`}
                        {camera.roomLabel ? ` · ห้อง ${camera.roomLabel}` : ''}
                        {camera.streamStatus === 'online' ? ' · ออนไลน์' : ' · ออฟไลน์'}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  เริ่มดูได้ (วันเข้าพัก)
                  <input
                    type="datetime-local"
                    value={grantForm.startsAt}
                    onChange={(event) => setGrantForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  ดูได้ถึง (วันรับกลับ)
                  <input
                    type="datetime-local"
                    value={grantForm.endsAt}
                    onChange={(event) => setGrantForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                    required
                  />
                </label>
              </>
            )}

            <div className="card-actions">
              <button className="ha-btn ha-btn--ghost button ghost" type="button" onClick={() => setGrantStay(null)}>
                ยกเลิก
              </button>
              <button
                className="ha-btn ha-btn--primary button"
                type="submit"
                disabled={grantBusy || cameras.length === 0 || !(grantForm.petIds || []).length}
              >
                {grantBusy ? 'กำลังมอบสิทธิ์…' : 'ยืนยันมอบสิทธิ์'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
