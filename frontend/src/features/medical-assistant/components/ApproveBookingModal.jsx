import { useEffect, useMemo, useState } from 'react';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import {
  FALLBACK_DURATIONS,
  VETS,
  slotsForDate,
  todayString,
} from '../data/constants.js';
import { findConflict, getVetDaySchedule, suggestSlots } from '../data/schedule.js';

function ApproveBookingModalInner({
  booking,
  appointments,
  meta,
  onClose,
  onReschedule,
  onConfirm,
  onSuccess,
}) {
  const todayKey = todayString();
  const vetNames = useMemo(
    () => (meta?.VET_NAMES?.length ? meta.VET_NAMES : VETS.map((v) => v.name)),
    [meta],
  );
  const durations = useMemo(
    () => (meta?.DURATIONS?.length ? meta.DURATIONS : FALLBACK_DURATIONS),
    [meta],
  );
  const specMap = useMemo(() => new Map(VETS.map((v) => [v.name, v.spec])), []);

  const [savedSlot, setSavedSlot] = useState(() => ({
    date: booking.date ?? todayKey,
    time: booking.time ?? '09:00',
  }));
  const [form, setForm] = useState(() => ({
    vet: booking.visit?.vet ?? vetNames[0] ?? '',
    durationMin: String(booking.visit?.durationMin ?? 30),
    date: booking.date ?? todayKey,
    time: booking.time ?? '09:00',
    note: '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitting, onClose]);

  const timeOptions = useMemo(() => slotsForDate(form.date), [form.date]);

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
        booking.id,
      ),
    [appointments, booking.id, form.vet, form.date, form.time, form.durationMin],
  );

  const suggested = useMemo(
    () =>
      suggestSlots(
        appointments,
        {
          vet: form.vet,
          date: form.date,
          durationMin: form.durationMin,
          excludeId: booking.id,
        },
        6,
      ),
    [appointments, booking.id, form.vet, form.date, form.durationMin],
  );

  const vetSchedule = useMemo(
    () => getVetDaySchedule(appointments, form.vet, form.date, booking.id),
    [appointments, form.vet, form.date, booking.id],
  );

  const setField = (key) => (e) => {
    const value = e.target.value;
    setError('');
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleConfirmSubmit(e) {
    e.preventDefault();
    if (conflict || !form.vet || !form.date || !form.time) return;

    setSubmitting(true);
    setError('');
    let didRescheduleJustNow = false;
    const needReschedule = form.date !== savedSlot.date || form.time !== savedSlot.time;

    try {
      if (needReschedule) {
        await onReschedule(booking.id, { date: form.date, time: form.time });
        didRescheduleJustNow = true;
        setSavedSlot({ date: form.date, time: form.time });
      }
      await onConfirm(booking.id, {
        vet: form.vet,
        durationMin: Number(form.durationMin) || 30,
        note: form.note.trim(),
      });
      onSuccess();
    } catch (err) {
      const msg = err?.message || 'ไม่สามารถยืนยันการจองได้';
      setError(didRescheduleJustNow ? `เปลี่ยนเวลาแล้วแต่ยังไม่ได้ยืนยัน: ${msg}` : msg);
    } finally {
      setSubmitting(false);
    }
  }

  const sp = speciesOf(booking.petSpecies);
  const canSubmit = !submitting && !conflict && Boolean(form.vet && form.date && form.time);

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
                <i className="bi bi-calendar2-check" />
                ตรวจสอบและยืนยันการจอง
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
                  {booking.petName} ({sp.label})
                </div>
              </div>
              <div className="info-item">
                <div className="k">เจ้าของ / เบอร์โทร</div>
                <div className="v">
                  {booking.ownerName || '—'} · {booking.ownerPhone || '—'}
                </div>
              </div>
              <div className="info-item">
                <div className="k">บริการ</div>
                <div className="v">{booking.serviceLabel || booking.service}</div>
              </div>
              <div className="info-item">
                <div className="k">วันเวลาที่ขอ</div>
                <div className="v">
                  {formatDate(booking.date)} · {booking.time} น.
                </div>
              </div>
              {booking.note && (
                <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="k">ข้อความจากเจ้าของ</div>
                  <div className="v">{booking.note}</div>
                </div>
              )}
            </div>

            {(booking.pet?.allergies || booking.pet?.chronicDiseases) && (
              <div className="alert-soft danger mb-3">
                <i className="bi bi-exclamation-triangle-fill" />
                <div>
                  {booking.pet?.allergies && (
                    <div>
                      <strong>ประวัติแพ้ยา/อาหาร:</strong> {booking.pet.allergies}
                    </div>
                  )}
                  {booking.pet?.chronicDiseases && (
                    <div>
                      <strong>โรคประจำตัว:</strong> {booking.pet.chronicDiseases}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                  {form.vet} มีนัดซ้อนในช่วงเวลา {conflict.rangeText} ({conflict.petName})
                </span>
              </div>
            )}

            <form onSubmit={handleConfirmSubmit} noValidate>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="approve-vet">
                    สัตวแพทย์ <span className="text-danger">*</span>
                  </label>
                  <select
                    id="approve-vet"
                    className="form-select"
                    disabled={submitting}
                    value={form.vet}
                    onChange={setField('vet')}
                  >
                    {vetNames.map((name) => {
                      const spec = specMap.get(name);
                      return (
                        <option key={name} value={name}>
                          {name}
                          {spec ? ` (${spec})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="approve-duration">
                    ระยะเวลา (นาที)
                  </label>
                  <select
                    id="approve-duration"
                    className="form-select"
                    disabled={submitting}
                    value={form.durationMin}
                    onChange={setField('durationMin')}
                  >
                    {durations.map((m) => (
                      <option key={m} value={m}>
                        {m} นาที
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label" htmlFor="approve-date">
                    วันที่นัด (แก้ไขได้หากต้องการเลื่อน)
                  </label>
                  <input
                    id="approve-date"
                    type="date"
                    className="form-control"
                    disabled={submitting}
                    value={form.date}
                    onChange={setField('date')}
                  />
                </div>

                <div className="col-12 col-sm-6">
                  <label className="form-label" htmlFor="approve-time">
                    เวลานัด
                  </label>
                  <select
                    id="approve-time"
                    className="form-select"
                    disabled={submitting || timeOptions.length === 0}
                    value={form.time}
                    onChange={setField('time')}
                  >
                    {!timeOptions.includes(form.time) && form.time && (
                      <option value={form.time}>{form.time} น.</option>
                    )}
                    {timeOptions.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot} น.
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label" htmlFor="approve-note">
                    หมายเหตุถึงเจ้าของ / คลินิก (ถ้ามี)
                  </label>
                  <input
                    id="approve-note"
                    type="text"
                    className="form-control"
                    maxLength={500}
                    disabled={submitting}
                    placeholder="เช่น กรุณามาถึงก่อนเวลานัด 10 นาที"
                    value={form.note}
                    onChange={setField('note')}
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
                        disabled={submitting}
                        className={`btn btn-sm ${form.time === slot ? 'btn-sky' : 'btn-soft'}`}
                        onClick={() => {
                          setError('');
                          setForm((prev) => ({ ...prev, time: slot }));
                        }}
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
                <button type="button" className="btn btn-soft" disabled={submitting} onClick={onClose}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-sky" disabled={!canSubmit}>
                  {submitting && (
                    <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                  )}
                  <i className="bi bi-check2 me-1" />
                  ยืนยันการจอง
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
  appointments,
  meta,
  onClose,
  onReschedule,
  onConfirm,
  onSuccess,
}) {
  if (!open || !booking) return null;
  return (
    <ApproveBookingModalInner
      key={`approve-${booking.id}`}
      booking={booking}
      appointments={appointments}
      meta={meta}
      onClose={onClose}
      onReschedule={onReschedule}
      onConfirm={onConfirm}
      onSuccess={onSuccess}
    />
  );
}
