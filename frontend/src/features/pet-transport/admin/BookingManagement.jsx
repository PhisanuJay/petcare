import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import { PAYMENT_STATUSES, serviceTypeMeta } from '../constants.js';
import { formatBaht } from '../pricing.js';
import { useTransport } from '../useTransport.js';
import { bookingBucket, shortBookingId } from './adminBookingUtils.js';

const TABS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'awaiting_assign', label: 'รอมอบหมายคนขับ' },
  { id: 'in_progress', label: 'กำลังดำเนินการ' },
  { id: 'completed', label: 'เสร็จสิ้น' },
  { id: 'cancelled', label: 'ยกเลิก' },
];

function dayKey(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function primaryTrip(b) {
  return (b.trips || []).find((t) => t.type === 'pickup') || b.trips?.[0] || null;
}

function driversLabel(b) {
  const names = (b.trips || [])
    .map((t) => t.driver?.name || (t.driverId ? `รหัส ${shortBookingId(t.driverId)}` : ''))
    .filter(Boolean);
  if (!names.length) return 'ยังไม่มอบหมาย';
  return [...new Set(names)].join(', ');
}

function paymentMeta(status) {
  return PAYMENT_STATUSES[status] || { id: status, label: status || '—' };
}

function serviceLabel(type) {
  return serviceTypeMeta(type)?.label || type || '—';
}

export default function BookingManagement() {
  const [searchParams] = useSearchParams();
  const {
    bookings,
    activeDrivers,
    assignDriver,
  } = useTransport();

  const [tab, setTab] = useState(() => {
    const initialTab = searchParams.get('tab');
    return TABS.some((item) => item.id === initialTab) ? initialTab : 'all';
  });
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(null);
  const paidBookings = useMemo(
    () => bookings.filter((booking) => booking.paymentStatus === 'paid'),
    [bookings],
  );

  const counts = useMemo(() => {
    const base = Object.fromEntries(TABS.map((t) => [t.id, 0]));
    base.all = paidBookings.length;
    paidBookings.forEach((b) => {
      const key = bookingBucket(b);
      base[key] = (base[key] || 0) + 1;
    });
    return base;
  }, [paidBookings]);

  function bookingMatches(b, needle) {
    if (!needle) return true;
    const digits = needle.replace(/\D/g, '');
    const petNames = Array.isArray(b.petNames) ? b.petNames.join(' ') : '';
    const fields = [
      b.id,
      shortBookingId(b.id),
      b.petName,
      petNames,
      b.ownerName,
      b.ownerPhone,
      b.serviceType,
      serviceLabel(b.serviceType),
      driversLabel(b),
      ...(b.trips || []).flatMap((t) => [t.fromLabel, t.toLabel, t.driver?.name, t.driverId]),
    ];
    if (fields.some((v) => String(v || '').toLowerCase().includes(needle))) return true;
    if (digits.length >= 3) {
      const phone = String(b.ownerPhone || '').replace(/\D/g, '');
      if (phone.includes(digits)) return true;
    }
    return false;
  }

  const filtered = useMemo(() => {
    const needle = appliedQ.trim().toLowerCase();
    return paidBookings.filter((b) => {
      if (tab !== 'all' && bookingBucket(b) !== tab) return false;
      if (dateFilter) {
        const trip = primaryTrip(b);
        if (dayKey(trip?.pickupTime) !== dateFilter) return false;
      }
      return bookingMatches(b, needle);
    });
  }, [paidBookings, tab, appliedQ, dateFilter]);

  function runSearch(event) {
    event?.preventDefault?.();
    setAppliedQ(q.trim());
  }

  function clearSearch() {
    setQ('');
    setAppliedQ('');
  }

  function flashOk(text) {
    setErr('');
    setMsg(text);
  }

  function openAssign(b) {
    const picks = Object.fromEntries((b.trips || []).map((t) => [t.id, t.driverId || '']));
    setModal({ type: 'assign', booking: b, picks });
  }

  function closeModal() {
    setModal(null);
  }

  async function submitAssign() {
    if (!modal?.booking) return;
    try {
      if (modal.booking.paymentStatus !== 'paid') {
        setErr('รอฝ่ายบัญชียืนยันการชำระเงินก่อนมอบหมายคนขับ');
        return;
      }
      const entries = Object.entries(modal.picks || {}).filter(([, id]) => id);
      if (!entries.length) {
        setErr('เลือกคนขับอย่างน้อย 1 ทริป');
        return;
      }
      for (const [tripId, driverId] of entries) {
        await assignDriver(tripId, driverId);
      }
      flashOk(`มอบหมายคนขับแล้ว · ${modal.booking.petName}`);
      closeModal();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="tp-bookings">
      <h1>จัดการรายการจอง</h1>
      <p className="tp-lead">รายการที่ฝ่ายบัญชียืนยันชำระแล้ว สำหรับมอบหมายและติดตามคนขับ</p>

      {msg ? <div className="tp-alert tp-alert--ok">{msg}</div> : null}
      {err && !modal ? <div className="tp-alert tp-alert--danger">{err}</div> : null}

      <div className="tp-tabs" role="tablist" aria-label="สถานะงาน">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <b>{counts[t.id] || 0}</b>
          </button>
        ))}
      </div>

      <div className="tp-card tp-filters">
        <form className="tp-form tp-filters__grid" onSubmit={runSearch}>
          <div className="field">
            <label htmlFor="bm-q">ค้นหา</label>
            <div className="tp-filters__search">
              <input
                id="bm-q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ชื่อสัตว์ / เจ้าของ / เลข Booking"
              />
              {appliedQ ? (
                <button type="button" className="btn btn-soft" onClick={clearSearch}>
                  ล้าง
                </button>
              ) : null}
              <button type="submit" className="btn btn-sky">
                ค้นหา
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="bm-date">วันที่นัดรับ</label>
            <input
              id="bm-date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <div className="field tp-filters__reset">
            <label>&nbsp;</label>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                clearSearch();
                setDateFilter('');
                setTab('all');
              }}
            >
              ล้างตัวกรอง
            </button>
          </div>
        </form>
        {appliedQ ? (
          <p className="tp-muted tp-filters__meta">
            ผลการค้นหา “{appliedQ}” · {filtered.length} รายการ
          </p>
        ) : null}
      </div>

      <div className="tp-table-wrap">
        <table className="tp-table tp-table--bookings">
          <thead>
            <tr>
              <th>เลข Booking</th>
              <th>เจ้าของ</th>
              <th>สัตว์เลี้ยง</th>
              <th>บริการ</th>
              <th>วันเวลานัดรับ</th>
              <th>รับ → ส่ง</th>
              <th>คนขับ</th>
              <th>ราคารวม</th>
              <th>ชำระเงิน</th>
              <th>สถานะงาน</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const trip = primaryTrip(b);
              const pay = paymentMeta(b.paymentStatus);
              const bucket = bookingBucket(b);
              return (
                <tr key={b.id}>
                  <td>
                    <code className="tp-code" title={b.id}>{shortBookingId(b.id)}</code>
                  </td>
                  <td>
                    <strong>{b.ownerName || '—'}</strong>
                    {b.ownerPhone ? <div className="tp-cell-sub">{b.ownerPhone}</div> : null}
                  </td>
                  <td>{b.petName || '—'}</td>
                  <td>{serviceLabel(b.serviceType)}</td>
                  <td>{formatWhen(trip?.pickupTime)}</td>
                  <td className="tp-cell-route">
                    <span>{trip?.fromLabel || '—'}</span>
                    <span className="tp-cell-sub">→ {trip?.toLabel || '—'}</span>
                    {(b.trips || []).length > 1 ? (
                      <span className="tp-cell-sub">+{(b.trips.length - 1)} ทริป</span>
                    ) : null}
                  </td>
                  <td>{driversLabel(b)}</td>
                  <td>{formatBaht(b.quote?.total)}</td>
                  <td>
                    <StatusBadge
                      label={pay.label}
                      tone={b.paymentStatus === 'paid' ? 'ok' : b.paymentStatus === 'owner_confirmed' ? 'warn' : 'info'}
                    />
                  </td>
                  <td>
                    <StatusBadge label={b.statusMeta?.label || b.status} tone={b.statusMeta?.tone || 'info'} />
                  </td>
                  <td>
                    <div className="tp-row-actions">
                      {bucket === 'awaiting_assign' ? (
                        <button type="button" className="btn btn-soft btn-sm" onClick={() => openAssign(b)}>
                          มอบหมายคนขับ
                        </button>
                      ) : null}
                      <Link className="btn btn-sky btn-sm" to={`/admin/transport/bookings/${b.id}`}>
                        รายละเอียด
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length ? (
              <tr>
                <td colSpan={11} className="tp-table-empty">ไม่พบ booking ตามเงื่อนไข</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div className="tp-modal" role="dialog" aria-modal="true" aria-labelledby="bm-modal-title">
          <button type="button" className="tp-modal__backdrop" aria-label="ปิด" onClick={closeModal} />
          <div className="tp-modal__panel tp-card">
            {modal.type === 'assign' ? (
              <>
                <h2 id="bm-modal-title">มอบหมายคนขับ</h2>
                <p className="tp-muted">{modal.booking.petName} · {modal.booking.ownerName}</p>
                {err ? <div className="tp-alert tp-alert--danger">{err}</div> : null}
                {!activeDrivers.length ? (
                  <p className="tp-muted">ยังไม่มีบัญชีคนขับ — สร้างที่เมนูจัดการคนขับ</p>
                ) : null}
                <div className="tp-form">
                  {(modal.booking.trips || []).map((trip) => (
                    <div className="field" key={trip.id}>
                      <label htmlFor={`bm-drv-${trip.id}`}>
                        {trip.type === 'dropoff' ? 'เที่ยวกลับ' : 'เที่ยวไป'} · {trip.fromLabel} → {trip.toLabel}
                      </label>
                      <select
                        id={`bm-drv-${trip.id}`}
                        value={modal.picks[trip.id] || ''}
                        onChange={(e) => setModal((m) => ({
                          ...m,
                          picks: { ...m.picks, [trip.id]: e.target.value },
                        }))}
                      >
                        <option value="">— เลือกคนขับ —</option>
                        {activeDrivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} · {d.vehicle || 'ไม่ระบุรถ'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="tp-actions">
                  <button type="button" className="btn btn-soft" onClick={closeModal}>ยกเลิก</button>
                  <button type="button" className="btn btn-sky" onClick={submitAssign} disabled={!activeDrivers.length}>
                    ยืนยันมอบหมายคนขับ
                  </button>
                </div>
              </>
            ) : null}

          </div>
        </div>
      ) : null}
    </div>
  );
}
