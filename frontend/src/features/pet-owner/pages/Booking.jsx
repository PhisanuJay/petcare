<<<<<<< HEAD
export { default } from '../../payments/ClinicBookPage.jsx';
=======
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePets } from '../usePets.js';
import { useBookings } from '../useBookings.js';
import {
  BOOKING_SERVICES,
  BOOKING_STATUS,
  CLINIC_PHONE,
  OWNER_CANCELLABLE,
  availableSlots,
  closureFor,
  hoursFor,
  hoursSummary,
  todayString,
  useClinicInfo,
} from '../bookingOptions.js';
import { formatDate } from '../petUtils.js';

const WEEKDAY_NAMES_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const ICON_BY_SERVICE = new Map(BOOKING_SERVICES.map((s) => [s.value, s.icon]));

function addDaysKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function shortClosureDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

/**
 * Booking — Role: Pet Owner (มะแอ่ว)
 * Book a vet appointment for one of the owner's pets and manage existing bookings.
 * Bookings are saved by the backend (/api/pet-owner/bookings); status starts as "pending"
 * until the veterinarian side confirms it.
 */

function BookingForm({ pets, defaultPetId, defaultService, onSubmit }) {
  const { info, loading: infoLoading } = useClinicInfo();

  const onlineServices = useMemo(
    () =>
      (info?.services ?? []).map((s) => ({
        value: s.code,
        label: s.label,
        icon: ICON_BY_SERVICE.get(s.code) ?? 'bi-calendar',
      })),
    [info],
  );

  const [form, setForm] = useState({
    petId: pets.some((p) => p.id === defaultPetId) ? defaultPetId : (pets[0]?.id ?? ''),
    service: BOOKING_SERVICES.some((s) => s.value === defaultService) ? defaultService : 'checkup',
    date: '',
    time: '',
    note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // When live clinic info arrives, clear any selected service/time that is no longer available
  useEffect(() => {
    if (infoLoading) return;
    setForm((prev) => {
      const nextService = onlineServices.some((s) => s.value === prev.service)
        ? prev.service
        : (onlineServices[0]?.value ?? '');
      const validSlots = prev.date ? availableSlots(prev.date, info) : [];
      const nextTime = prev.time && validSlots.includes(prev.time) ? prev.time : '';
      if (nextService === prev.service && nextTime === prev.time) return prev;
      return { ...prev, service: nextService, time: nextTime };
    });
  }, [info, infoLoading, onlineServices]);

  const disabledRequestedService = useMemo(() => {
    if (infoLoading || !defaultService) return null;
    if (onlineServices.some((s) => s.value === defaultService)) return null;
    const match = BOOKING_SERVICES.find((s) => s.value === defaultService);
    return match?.label ?? defaultService;
  }, [infoLoading, defaultService, onlineServices]);

  const set = (key) => (e) => {
    setDone(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const slots = availableSlots(form.date, info);
  const selectedClosure = form.date ? closureFor(form.date, info) : null;
  const selectedHours = form.date ? hoursFor(form.date, info) : null;

  const noSlotMessage = useMemo(() => {
    if (!form.date || slots.length > 0) return '';
    if (selectedClosure) {
      return `คลินิกปิดทำการวันที่เลือก: ${selectedClosure.reason} กรุณาเลือกวันอื่น`;
    }
    if (!selectedHours) {
      const [y, m, d] = form.date.split('-').map(Number);
      const dayName = WEEKDAY_NAMES_TH[new Date(y, m - 1, d).getDay()];
      return `คลินิกไม่เปิดทำการวัน${dayName} กรุณาเลือกวันอื่น`;
    }
    return 'วันนี้หมดเวลาจองแล้ว กรุณาเลือกวันอื่น';
  }, [form.date, slots.length, selectedClosure, selectedHours]);

  // Opening hours and closures vary by day, so reset time if it is no longer valid on the new date.
  const setDate = (e) => {
    const date = e.target.value;
    setDone(false);
    setForm((f) => ({ ...f, date, time: availableSlots(date, info).includes(f.time) ? f.time : '' }));
  };

  const upcomingClosures30d = useMemo(() => {
    const today = todayString();
    const limit30 = addDaysKey(today, 30);
    return (info?.closures ?? []).filter((c) => c.date >= today && c.date <= limit30);
  }, [info]);

  const noServicesAvailable = !infoLoading && onlineServices.length === 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (noServicesAvailable || !form.service) return setError('ขณะนี้ไม่มีบริการเปิดรับจองออนไลน์');
    if (!form.date) return setError('กรุณาเลือกวันที่');
    if (!form.time) return setError('กรุณาเลือกเวลา');
    setSaving(true);
    setError('');
    try {
      await onSubmit(form);
      setForm((f) => ({ ...f, date: '', time: '', note: '' }));
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
        จองนัดหมายใหม่
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {done && <div className="alert alert-success py-2">ส่งคำขอจองนัดแล้ว รอการยืนยันจากคลินิก</div>}

      {disabledRequestedService && (
        <div className="alert-soft warn mb-3" role="status">
          <i className="bi bi-info-circle" />
          <span>
            บริการ {disabledRequestedService} ปิดรับจองออนไลน์ชั่วคราว กรุณาโทร {CLINIC_PHONE}
          </span>
        </div>
      )}

      {noServicesAvailable ? (
        <div className="alert-soft warn mb-3" role="status">
          <i className="bi bi-exclamation-triangle" />
          <span>ขณะนี้ปิดรับจองออนไลน์ทุกบริการชั่วคราว กรุณาติดต่อคลินิกโทร {CLINIC_PHONE}</span>
        </div>
      ) : (
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="bk-pet">สัตว์เลี้ยง</label>
            <select id="bk-pet" className="form-select" value={form.petId} onChange={set('petId')}>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="bk-service">บริการ</label>
            <select id="bk-service" className="form-select" value={form.service} onChange={set('service')}>
              {onlineServices.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="bk-date">วันที่</label>
            <input
              id="bk-date"
              type="date"
              className="form-control"
              min={todayString()}
              value={form.date}
              onChange={setDate}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="bk-time">เวลา</label>
            <select
              id="bk-time"
              className="form-select"
              value={form.time}
              onChange={set('time')}
              disabled={!form.date || slots.length === 0}
            >
              <option value="">{form.date ? 'เลือกเวลา' : 'เลือกวันที่ก่อน'}</option>
              {slots.map((t) => (
                <option key={t} value={t}>{t} น.</option>
              ))}
            </select>
            {noSlotMessage && <div className="form-text text-danger">{noSlotMessage}</div>}
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="bk-note">อาการ / หมายเหตุ</label>
            <textarea
              id="bk-note"
              rows={3}
              maxLength={500}
              className="form-control"
              placeholder="ไม่บังคับ เช่น อาการที่พบ หรือสิ่งที่อยากให้หมอตรวจเป็นพิเศษ"
              value={form.note}
              onChange={set('note')}
            />
          </div>
        </div>
      )}

      <div className="small text-muted mt-3">
        <i className="bi bi-clock me-1" />
        {hoursSummary(info).join(' · ')}
        {upcomingClosures30d.length > 0 && (
          <>
            <br />
            <i className="bi bi-calendar-x me-1" />
            วันปิดทำการ:{' '}
            {upcomingClosures30d
              .map((c) => `${shortClosureDate(c.date)} (${c.reason || 'ปิดทำการ'})`)
              .join(', ')}
          </>
        )}
        <br />
        <i className="bi bi-exclamation-triangle me-1" />
        กรณีฉุกเฉิน (เปิด 24 ชั่วโมง) กรุณาโทร {CLINIC_PHONE} ไม่ต้องจองล่วงหน้า
      </div>

      <div className="text-end mt-3">
        <button type="submit" className="btn btn-sky" disabled={saving || noServicesAvailable}>
          <i className="bi bi-check2 me-1" />
          {saving ? 'กำลังส่ง...' : 'ยืนยันการจอง'}
        </button>
      </div>
    </form>
  );
}

function BookingItem({ booking, onCancel, busy }) {
  const status = BOOKING_STATUS[booking.status] ?? BOOKING_STATUS.pending;
  const service = BOOKING_SERVICES.find((s) => s.value === booking.service);
  const canCancel = OWNER_CANCELLABLE.includes(booking.status) && booking.date >= todayString();

  return (
    <div className="tl-item">
      <div className="date">
        {formatDate(booking.date)} · {booking.time} น.
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="fw-medium">{booking.petName}</span>
        <span className="tag">
          <i className={`bi ${service?.icon ?? 'bi-calendar'} me-1`} />
          {booking.serviceLabel}
        </span>
        <span className={`tag ${status.tone}`}>{status.label}</span>
      </div>
      {booking.note && <div className="small text-muted mt-1">{booking.note}</div>}
      {booking.clinicNote && (
        <div className="small mt-1">
          <i className="bi bi-chat-left-text me-1" />
          จากคลินิก: {booking.clinicNote}
        </div>
      )}
      {canCancel && (
        <button
          type="button"
          className="btn btn-sm btn-soft-danger mt-2"
          disabled={busy}
          onClick={() => onCancel(booking)}
        >
          ยกเลิกนัด
        </button>
      )}
    </div>
  );
}

export default function BookingPage() {
  const [params] = useSearchParams();
  const { pets, loading: petsLoading, error: petsError } = usePets();
  const { bookings, loading, error, reload, addBooking, cancelBooking } = useBookings();
  const [cancelError, setCancelError] = useState('');
  const [busyId, setBusyId] = useState('');

  const today = todayString();
  const isOpen = (b) => OWNER_CANCELLABLE.includes(b.status) && b.date >= today;
  const upcoming = bookings.filter(isOpen);
  const history = bookings.filter((b) => !isOpen(b)).reverse();

  async function handleCancel(booking) {
    const text = `ยกเลิกนัดของ "${booking.petName}" วันที่ ${formatDate(booking.date)} เวลา ${booking.time} น.?`;
    if (!window.confirm(text)) return;
    setBusyId(booking.id);
    setCancelError('');
    try {
      await cancelBooking(booking.id);
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
            <h1>จองนัดหมาย</h1>
            <p>นัดตรวจ ฉีดวัคซีน หรือถ่ายพยาธิให้น้องๆ ได้ที่นี่</p>
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
        ) : pets.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-heart" />
            ต้องมีข้อมูลสัตว์เลี้ยงก่อนจึงจะจองนัดได้
            <div className="mt-3">
              <Link to="/pet-owner/my-pets/new" className="btn btn-sky">เพิ่มสัตว์เลี้ยง</Link>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            <div className="col-lg-6">
              <BookingForm pets={pets} defaultPetId={params.get('petId')} defaultService={params.get('service')} onSubmit={addBooking} />
            </div>

            <div className="col-lg-6">
              <div className="card-soft mb-4">
                <div className="section-label">
                  <i className="bi bi-calendar-event" />
                  นัดที่กำลังจะถึง ({upcoming.length})
                </div>
                {cancelError && <div className="alert alert-danger py-2">{cancelError}</div>}
                {loading ? (
                  <div className="empty-box py-3">กำลังโหลด...</div>
                ) : upcoming.length === 0 ? (
                  <div className="empty-box py-3">
                    <i className="bi bi-calendar-x" />
                    ยังไม่มีนัดที่กำลังจะถึง
                  </div>
                ) : (
                  <div className="timeline">
                    {upcoming.map((b) => (
                      <BookingItem key={b.id} booking={b} onCancel={handleCancel} busy={busyId === b.id} />
                    ))}
                  </div>
                )}
              </div>

              {history.length > 0 && (
                <div className="card-soft">
                  <div className="section-label">
                    <i className="bi bi-clock-history" />
                    ประวัติการจอง ({history.length})
                  </div>
                  <div className="timeline">
                    {history.map((b) => (
                      <BookingItem key={b.id} booking={b} onCancel={handleCancel} busy={false} />
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
>>>>>>> origin/Pet-Owner-Vet
