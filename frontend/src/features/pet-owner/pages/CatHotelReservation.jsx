import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePets } from '../usePets.js';
import { useHotelReservations } from '../useHotelReservations.js';
import {
  HOTEL_ROOMS,
  HOTEL_SPECIES,
  MAX_HOTEL_NIGHTS,
  RESERVATION_STATUS,
  addDays,
  formatBaht,
  nightsBetween,
} from '../hotelOptions.js';
import { todayString } from '../bookingOptions.js';
import { formatDate } from '../petUtils.js';

/**
 * Cat Hotel — Role: Pet Owner (มะแอ่ว)
 * Request a stay for one of the owner's cats and manage existing reservations.
 * Saved by the backend (/api/pet-owner/cat-hotel/reservations); status starts as "pending"
 * until the hotel staff confirms it.
 */

function ReservationForm({ cats, onSubmit }) {
  const [form, setForm] = useState({
    petId: cats[0]?.id ?? '',
    roomType: 'deluxe',
    checkIn: '',
    checkOut: '',
    note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const room = HOTEL_ROOMS.find((r) => r.value === form.roomType);
  const nights = nightsBetween(form.checkIn, form.checkOut);
  const validNights = nights >= 1 && nights <= MAX_HOTEL_NIGHTS;

  const set = (key) => (e) => {
    setDone(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  // Keep check-out after check-in: clear it if the new check-in makes it invalid.
  const setCheckIn = (e) => {
    const checkIn = e.target.value;
    setDone(false);
    setForm((f) => ({ ...f, checkIn, checkOut: f.checkOut && f.checkOut <= checkIn ? '' : f.checkOut }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.checkIn) return setError('กรุณาเลือกวันเช็คอิน');
    if (!form.checkOut) return setError('กรุณาเลือกวันเช็คเอาท์');
    if (!validNights) return setError(`ฝากได้ 1 ถึง ${MAX_HOTEL_NIGHTS} คืนต่อครั้ง`);
    setSaving(true);
    setError('');
    try {
      await onSubmit(form);
      setForm((f) => ({ ...f, checkIn: '', checkOut: '', note: '' }));
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card-soft" onSubmit={handleSubmit}>
      <div className="section-label">
        <i className="bi bi-calendar-plus" />
        จองที่พักให้น้องแมว
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {done && <div className="alert alert-success py-2">ส่งคำขอจองแล้ว รอการยืนยันจากโรงแรม</div>}

      <div className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="ht-pet">น้องแมว</label>
          <select id="ht-pet" className="form-select" value={form.petId} onChange={set('petId')}>
            {cats.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="col-12">
          <div className="form-label">ประเภทห้อง</div>
          <div className="row g-2">
            {HOTEL_ROOMS.map((r) => (
              <div className="col-md-4" key={r.value}>
                <label
                  className="d-block h-100 p-2 rounded-3 border"
                  style={{
                    cursor: 'pointer',
                    background: form.roomType === r.value ? r.bg : '#fff',
                    borderColor: form.roomType === r.value ? r.fg : undefined,
                  }}
                >
                  <input
                    type="radio"
                    name="roomType"
                    className="visually-hidden"
                    value={r.value}
                    checked={form.roomType === r.value}
                    onChange={set('roomType')}
                  />
                  <div className="mitr" style={{ color: r.fg }}>
                    <i className={`bi ${r.icon} me-1`} />
                    {r.label}
                  </div>
                  <div className="small fw-medium">{formatBaht(r.price)} / คืน</div>
                </label>
              </div>
            ))}
          </div>
          {room && (
            <ul className="small text-muted mt-2 mb-0 ps-3">
              {room.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="ht-in">วันเช็คอิน</label>
          <input
            id="ht-in"
            type="date"
            className="form-control"
            min={todayString()}
            value={form.checkIn}
            onChange={setCheckIn}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="ht-out">วันเช็คเอาท์</label>
          <input
            id="ht-out"
            type="date"
            className="form-control"
            min={form.checkIn ? addDays(form.checkIn, 1) : todayString()}
            max={form.checkIn ? addDays(form.checkIn, MAX_HOTEL_NIGHTS) : undefined}
            value={form.checkOut}
            onChange={set('checkOut')}
          />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="ht-note">ข้อมูลเพิ่มเติม</label>
          <textarea
            id="ht-note"
            rows={3}
            maxLength={500}
            className="form-control"
            placeholder="ไม่บังคับ เช่น อาหารที่กิน ยาที่ต้องให้ หรือนิสัยที่ควรรู้"
            value={form.note}
            onChange={set('note')}
          />
        </div>
      </div>

      {validNights && room && (
        <div className="alert-soft mt-3">
          <i className="bi bi-receipt" />
          <span>
            {nights} คืน × {formatBaht(room.price)} = <strong>{formatBaht(nights * room.price)}</strong>
          </span>
        </div>
      )}

      <div className="text-end mt-3">
        <button type="submit" className="btn btn-sky" disabled={saving}>
          <i className="bi bi-check2 me-1" />
          {saving ? 'กำลังส่ง...' : 'ยืนยันการจอง'}
        </button>
      </div>
    </form>
  );
}

function ReservationItem({ reservation: r, onCancel, busy }) {
  const status = RESERVATION_STATUS[r.status] ?? RESERVATION_STATUS.pending;
  const canCancel = r.status !== 'cancelled' && r.checkOut > todayString();

  return (
    <div className="tl-item">
      <div className="date">
        {formatDate(r.checkIn)} - {formatDate(r.checkOut)} ({r.nights} คืน)
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="fw-medium">{r.petName}</span>
        <span className="tag">
          <i className="bi bi-building me-1" />
          {r.roomLabel}
        </span>
        <span className={`tag ${status.tone}`}>{status.label}</span>
      </div>
      <div className="small mt-1">รวม {formatBaht(r.totalPrice)}</div>
      {r.note && <div className="small text-muted">{r.note}</div>}
      {canCancel && (
        <button
          type="button"
          className="btn btn-sm btn-soft-danger mt-2"
          disabled={busy}
          onClick={() => onCancel(r)}
        >
          ยกเลิกการจอง
        </button>
      )}
    </div>
  );
}

export default function CatHotelReservationPage() {
  const { pets, loading: petsLoading, error: petsError } = usePets();
  const { reservations, loading, error, reload, addReservation, cancelReservation } = useHotelReservations();
  const [cancelError, setCancelError] = useState('');
  const [busyId, setBusyId] = useState('');

  const cats = pets.filter((p) => p.species === HOTEL_SPECIES);
  const today = todayString();
  const current = reservations.filter((r) => r.status !== 'cancelled' && r.checkOut > today);
  const history = reservations.filter((r) => r.status === 'cancelled' || r.checkOut <= today).reverse();

  async function handleCancel(r) {
    const text = `ยกเลิกการจองของ "${r.petName}" ${formatDate(r.checkIn)} - ${formatDate(r.checkOut)}?`;
    if (!window.confirm(text)) return;
    setBusyId(r.id);
    setCancelError('');
    try {
      await cancelReservation(r.id);
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>โรงแรมแมว</h1>
            <p>ฝากน้องแมวไว้กับเรา ดูแลโดยทีมที่ใส่ใจ พร้อมสัตวแพทย์ประจำ</p>
          </div>
        </div>

        {(petsError || error) && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{petsError || error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
          </div>
        )}

        {petsLoading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : cats.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-heart" />
            โรงแรมนี้รับเฉพาะน้องแมว ต้องมีข้อมูลน้องแมวก่อนจึงจะจองได้
            <div className="mt-3">
              <Link to="/pet-owner/my-pets/new" className="btn btn-sky">เพิ่มสัตว์เลี้ยง</Link>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            <div className="col-lg-7">
              <ReservationForm cats={cats} onSubmit={addReservation} />
            </div>

            <div className="col-lg-5">
              <div className="card-soft mb-4">
                <div className="section-label">
                  <i className="bi bi-calendar-event" />
                  การจองปัจจุบัน ({current.length})
                </div>
                {cancelError && <div className="alert alert-danger py-2">{cancelError}</div>}
                {loading ? (
                  <div className="empty-box py-3">กำลังโหลด...</div>
                ) : current.length === 0 ? (
                  <div className="empty-box py-3">
                    <i className="bi bi-calendar-x" />
                    ยังไม่มีการจอง
                  </div>
                ) : (
                  <div className="timeline">
                    {current.map((r) => (
                      <ReservationItem key={r.id} reservation={r} onCancel={handleCancel} busy={busyId === r.id} />
                    ))}
                  </div>
                )}
              </div>

              {history.length > 0 && (
                <div className="card-soft">
                  <div className="section-label">
                    <i className="bi bi-clock-history" />
                    ประวัติการฝาก ({history.length})
                  </div>
                  <div className="timeline">
                    {history.map((r) => (
                      <ReservationItem key={r.id} reservation={r} onCancel={handleCancel} busy={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
