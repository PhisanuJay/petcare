import { useEffect, useMemo, useState } from 'react';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import {
  DURATION_OPTIONS,
  VETS,
  offsetDateKey,
  sourceOf,
} from '../data/constants.js';
import { findConflict, getVetDaySchedule, suggestSlots } from '../data/schedule.js';

function ApproveBookingModalInner({ booking, mode, appointments, onClose, onConfirm }) {
  const isReschedule = mode === 'reschedule';
  const todayKey = offsetDateKey(0);

  const [form, setForm] = useState(() => ({
    vet: booking.vet ?? VETS[0]?.name ?? '',
    date: isReschedule ? offsetDateKey(1) : booking.date ?? offsetDateKey(0),
    time: booking.time ?? '09:00',
    durationMin: String(booking.durationMin ?? 30),
  }));

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const excludeId = booking.id;

  const conflict = useMemo(
    () =>
      findConflict(
        appointments,
        {
          vet: form.vet,
          date: form.date,
          time: form.time,
          durationMin: form.durationMin,
        },
        excludeId,
      ),
    [appointments, excludeId, form.vet, form.date, form.time, form.durationMin],
  );

  const suggested = useMemo(
    () =>
      suggestSlots(
        appointments,
        {
          vet: form.vet,
          date: form.date,
          durationMin: form.durationMin,
          excludeId,
        },
        6,
      ),
    [appointments, excludeId, form.vet, form.date, form.durationMin],
  );

  const vetSchedule = useMemo(
    () => getVetDaySchedule(appointments, form.vet, form.date, excludeId),
    [appointments, form.vet, form.date, excludeId],
  );

  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  function handleSubmit(e) {
    e.preventDefault();
    if (conflict || !form.vet || !form.date || !form.time) return;
    onConfirm({
      vet: form.vet,
      date: form.date,
      time: form.time,
      durationMin: Number(form.durationMin) || 30,
    });
  }

  const sp = speciesOf(booking.species);
  const src = sourceOf(booking.source);
  const canSubmit = !conflict && Boolean(form.vet && form.date && form.time);

  return (
    <>
      <div className="modal d-block ma-modal" tabIndex={-1} role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ma-modal-card">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div className="section-label mb-0">
                <i className={`bi ${isReschedule ? 'bi-calendar-range' : 'bi-calendar2-check'}`} />
                {isReschedule ? 'เลื่อนนัดใหม่' : 'ตรวจสอบและอนุมัติ'}
              </div>
              <button type="button" className="btn-close" aria-label="ปิด" onClick={onClose} />
            </div>

            <div className="info-grid mb-3">
              <div className="info-item">
                <div className="k">สัตว์เลี้ยง</div>
                <div className="v">
                  <span className="me-1" aria-hidden="true">{sp.emoji}</span>
                  {booking.petName} ({sp.label})
                </div>
              </div>
              <div className="info-item">
                <div className="k">เจ้าของ / เบอร์โทร</div>
                <div className="v">
                  {booking.ownerName} · {booking.ownerPhone}
                </div>
              </div>
              <div className="info-item">
                <div className="k">บริการ</div>
                <div className="v">{booking.service}</div>
              </div>
              <div className="info-item">
                <div className="k">{isReschedule ? 'นัดเดิม' : 'วันเวลาที่ขอ'}</div>
                <div className="v">
                  {formatDate(booking.date)} · {booking.time} น.
                </div>
              </div>
              <div className="info-item">
                <div className="k">ช่องทาง</div>
                <div className="v">
                  <i className={`bi ${src.icon} me-1 text-sky`} />
                  {src.label}
                </div>
              </div>
              {booking.reason && (
                <div className="info-item">
                  <div className="k">อาการ / เหตุผล</div>
                  <div className="v">{booking.reason}</div>
                </div>
              )}
            </div>

            {conflict && (
              <div className="alert-soft warn mb-3">
                <i className="bi bi-exclamation-triangle" />
                <span>
                  {form.vet} มีนัดซ้อนในช่วงเวลา {conflict.rangeText} ({conflict.petName} · {conflict.ownerName})
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="approve-vet">
                    สัตวแพทย์
                  </label>
                  <select
                    id="approve-vet"
                    className="form-select"
                    value={form.vet}
                    onChange={setField('vet')}
                  >
                    {VETS.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.spec})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="approve-duration">
                    ระยะเวลา (นาที)
                  </label>
                  <select
                    id="approve-duration"
                    className="form-select"
                    value={form.durationMin}
                    onChange={setField('durationMin')}
                  >
                    {DURATION_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m} นาที
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label" htmlFor="approve-date">
                    วันที่นัด
                  </label>
                  <input
                    id="approve-date"
                    type="date"
                    className="form-control"
                    value={form.date}
                    onChange={setField('date')}
                  />
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label" htmlFor="approve-time">
                    เวลานัด
                  </label>
                  <input
                    id="approve-time"
                    type="time"
                    className="form-control"
                    value={form.time}
                    onChange={setField('time')}
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="form-label mb-2">เวลาว่างที่แนะนำ</div>
                {suggested.length > 0 ? (
                  <div className="ma-slot-list">
                    {suggested.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`btn btn-sm ${form.time === slot ? 'btn-sky' : 'btn-soft'}`}
                        onClick={() => setForm((prev) => ({ ...prev, time: slot }))}
                      >
                        {slot} น.
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="small text-muted">
                    {form.date < todayKey
                      ? 'วันที่เลือกผ่านมาแล้ว กรุณาเปลี่ยนเป็นวันนี้หรือวันถัดไปเพื่อดูเวลาว่าง'
                      : 'ไม่มีเวลาว่างในวันและระยะเวลาที่เลือก'}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <div className="form-label mb-2">
                  ตารางนัดของ {form.vet} ({formatDate(form.date)})
                </div>
                <div className="ma-mini-schedule">
                  {vetSchedule.length > 0 ? (
                    vetSchedule.map((item) => (
                      <span key={item.id} className="tag sky m-0">
                        {item.rangeText} · {item.petName}
                      </span>
                    ))
                  ) : (
                    <span className="small text-muted">ยังไม่มีนัดอื่นในวันนี้</span>
                  )}
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-soft" onClick={onClose}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-sky" disabled={!canSubmit}>
                  <i className="bi bi-check2 me-1" />
                  {isReschedule ? 'ยืนยันเลื่อนนัด' : 'ยืนยันการจอง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show ma-modal-backdrop" />
    </>
  );
}

export default function ApproveBookingModal({
  open,
  booking,
  mode = 'approve',
  appointments,
  onClose,
  onConfirm,
}) {
  if (!open || !booking) return null;
  return (
    <ApproveBookingModalInner
      key={`${mode}-${booking.id}`}
      booking={booking}
      mode={mode}
      appointments={appointments}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
