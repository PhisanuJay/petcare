import { useEffect, useMemo, useState } from 'react';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { availableSlots, slotsForDate, todayString } from '../data/constants.js';
import { findConflict, suggestSlots } from '../data/schedule.js';

function RescheduleModalInner({ appointment, appointments, onClose, onReschedule }) {
  const todayKey = todayString();
  const [date, setDate] = useState(() => appointment.date || todayKey);
  const [time, setTime] = useState(() => appointment.time || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitting, onClose]);

  const vetName = appointment.visit?.vet || '';
  const durationMin = appointment.visit?.durationMin || 30;

  const slotOptions = useMemo(() => {
    const futureOrAll = date === todayKey ? availableSlots(date) : slotsForDate(date);
    if (date === appointment.date && appointment.time && !futureOrAll.includes(appointment.time)) {
      return slotsForDate(date);
    }
    return futureOrAll;
  }, [date, todayKey, appointment.date, appointment.time]);

  const conflict = useMemo(() => {
    if (!vetName || !date || !time) return null;
    return findConflict(
      appointments,
      { vet: vetName, date, time, durationMin },
      appointment.id,
    );
  }, [appointments, vetName, date, time, durationMin, appointment.id]);

  const suggested = useMemo(
    () =>
      suggestSlots(
        appointments,
        { vet: vetName, date, durationMin, excludeId: appointment.id },
        6,
      ),
    [appointments, vetName, date, durationMin, appointment.id],
  );

  function handleDateChange(e) {
    const nextDate = e.target.value;
    setDate(nextDate);
    setError('');
    const nextSlots = nextDate === todayKey ? availableSlots(nextDate) : slotsForDate(nextDate);
    if (!nextSlots.includes(time)) {
      setTime(nextSlots[0] ?? '');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!date || !time) {
      setError('กรุณาเลือกวันที่และเวลาใหม่');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onReschedule({ date, time });
    } catch (err) {
      setError(err?.message || 'ไม่สามารถเปลี่ยนวันเวลานัดได้');
    } finally {
      setSubmitting(false);
    }
  }

  const sp = speciesOf(appointment.petSpecies);

  return (
    <>
      <div
        className="modal d-block ma-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={() => !submitting && onClose()}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ma-modal-card">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div className="section-label mb-0">
                <i className="bi bi-calendar-event" />
                เปลี่ยนวันเวลานัด
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="ปิด"
                disabled={submitting}
                onClick={onClose}
              />
            </div>

            <div className="info-grid mb-3">
              <div className="info-item">
                <div className="k">สัตว์เลี้ยง</div>
                <div className="v">
                  <span className="me-1" aria-hidden="true">{sp.emoji}</span>
                  {appointment.petName} ({sp.label})
                </div>
              </div>
              <div className="info-item">
                <div className="k">เจ้าของ / เบอร์โทร</div>
                <div className="v">
                  {appointment.ownerName || '—'} · {appointment.ownerPhone || '—'}
                </div>
              </div>
              <div className="info-item">
                <div className="k">บริการ</div>
                <div className="v">{appointment.serviceLabel || appointment.service}</div>
              </div>
              <div className="info-item">
                <div className="k">วันเวลาเดิม</div>
                <div className="v">
                  {formatDate(appointment.date)} · {appointment.time} น.
                </div>
              </div>
              <div className="info-item">
                <div className="k">สัตวแพทย์</div>
                <div className="v">
                  {vetName ? `${vetName} (${durationMin} นาที)` : 'ยังไม่ระบุ'}
                </div>
              </div>
            </div>

            {error && (
              <div className="alert-soft danger mb-3" role="alert">
                <i className="bi bi-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}

            {conflict && (
              <div className="alert-soft warn mb-3">
                <i className="bi bi-exclamation-triangle" />
                <span>
                  {vetName} มีนัดซ้อนในช่วงเวลา {conflict.rangeText} ({conflict.petName})
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="row g-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label" htmlFor="resched-date">
                    วันที่ใหม่ <span className="text-danger">*</span>
                  </label>
                  <input
                    id="resched-date"
                    type="date"
                    className="form-control"
                    min={todayKey}
                    disabled={submitting}
                    value={date}
                    onChange={handleDateChange}
                  />
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label" htmlFor="resched-time">
                    เวลาใหม่ <span className="text-danger">*</span>
                  </label>
                  <select
                    id="resched-time"
                    className="form-select"
                    disabled={submitting || slotOptions.length === 0}
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      setError('');
                    }}
                  >
                    {slotOptions.length === 0 ? (
                      <option value="">ไม่มีช่วงเวลาว่างในวันนี้</option>
                    ) : (
                      slotOptions.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot} น.
                        </option>
                      ))
                    )}
                  </select>
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
                        disabled={submitting}
                        className={`btn btn-sm ${time === slot ? 'btn-sky' : 'btn-soft'}`}
                        onClick={() => {
                          setTime(slot);
                          setError('');
                        }}
                      >
                        {slot} น.
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="small text-muted">
                    {date < todayKey
                      ? 'วันที่เลือกผ่านมาแล้ว กรุณาเลือกวันนี้หรือวันถัดไป'
                      : 'ไม่มีเวลาว่างแนะนำในวันที่เลือก'}
                  </div>
                )}
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-soft" disabled={submitting} onClick={onClose}>
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn btn-sky"
                  disabled={submitting || !date || !time || Boolean(conflict)}
                >
                  {submitting && (
                    <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                  )}
                  <i className="bi bi-check2 me-1" />
                  บันทึกวันเวลาใหม่
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

export default function AppointmentModal({ open, appointment, appointments, onClose, onReschedule }) {
  if (!open || !appointment) return null;
  return (
    <RescheduleModalInner
      key={`resched-${appointment.id}`}
      appointment={appointment}
      appointments={appointments}
      onClose={onClose}
      onReschedule={onReschedule}
    />
  );
}
