import { useMemo, useState } from 'react';
import CaModal from '../../clinic-admin/components/CaModal.jsx';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import {
  apptVetId,
  apptVetName,
  clinicSlots,
  closureFor,
  hoursForMeta,
  vetsOnDutyFor,
} from '../data/clinicMeta.js';
import { todayString } from '../data/constants.js';
import { findConflict, suggestSlots } from '../data/schedule.js';

function serviceLines(label, petName = '') {
  if (!label) return [];
  const prefix = petName ? `${petName}:` : '';
  return String(label)
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (prefix && part.startsWith(prefix)) {
        return part.slice(prefix.length).trim() || part;
      }
      return part;
    });
}

function RescheduleModalInner({ appointment, appointments, meta, onClose, onReschedule }) {
  const todayKey = todayString();
  const [date, setDate] = useState(() => appointment.date || todayKey);
  const [time, setTime] = useState(() => appointment.time || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const vetId = apptVetId(appointment);
  const vetName = apptVetName(appointment);
  const vetRef = useMemo(
    () => (vetId || vetName ? { id: vetId, name: vetName } : null),
    [vetId, vetName],
  );
  const durationMin = appointment.visit?.durationMin || 30;

  const closureInfo = useMemo(() => closureFor(meta, date), [meta, date]);
  const dayHours = useMemo(() => hoursForMeta(meta, date), [meta, date]);
  const clinicClosedOnDate = Boolean(closureInfo) || !dayHours;

  const vetOffDutyOnDate = useMemo(() => {
    if (!vetRef || clinicClosedOnDate) return false;
    const dutyVets = vetsOnDutyFor(meta, date);
    return !dutyVets.some((v) =>
      vetRef.id && v.id ? v.id === vetRef.id : Boolean(vetRef.name && v.name === vetRef.name),
    );
  }, [vetRef, clinicClosedOnDate, meta, date]);

  const slotOptions = useMemo(() => {
    if (clinicClosedOnDate) return [];
    const futureOrAll = clinicSlots(meta, date, { futureOnly: date === todayKey });
    if (date === appointment.date && appointment.time && !futureOrAll.includes(appointment.time)) {
      return clinicSlots(meta, date, { futureOnly: false });
    }
    return futureOrAll;
  }, [clinicClosedOnDate, meta, date, todayKey, appointment.date, appointment.time]);

  const conflict = useMemo(() => {
    if (!vetRef || !date || !time || clinicClosedOnDate) return null;
    return findConflict(
      appointments,
      { vet: vetRef, date, time, durationMin },
      appointment.id,
    );
  }, [appointments, vetRef, date, time, durationMin, appointment.id, clinicClosedOnDate]);

  const suggested = useMemo(
    () =>
      suggestSlots(
        appointments,
        { vet: vetRef, date, durationMin, excludeId: appointment.id, meta },
        6,
      ),
    [appointments, vetRef, date, durationMin, appointment.id, meta],
  );

  const services = useMemo(
    () => serviceLines(appointment.serviceLabel || appointment.service, appointment.petName),
    [appointment.serviceLabel, appointment.service, appointment.petName],
  );

  const unchanged = date === appointment.date && time === appointment.time;

  function handleDateChange(e) {
    const nextDate = e.target.value;
    setDate(nextDate);
    setError('');
    const nextSlots = clinicSlots(meta, nextDate, { futureOnly: nextDate === todayKey });
    if (!nextSlots.includes(time)) {
      setTime(nextSlots[0] ?? '');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (clinicClosedOnDate) {
      setError(
        closureInfo
          ? `คลินิกปิดทำการวันที่เลือก: ${closureInfo.reason}`
          : 'คลินิกไม่เปิดทำการในวันที่เลือก',
      );
      return;
    }
    if (!date || !time) {
      setError('กรุณาเลือกวันที่และเวลาใหม่');
      return;
    }
    if (unchanged) {
      setError('วันเวลาใหม่ตรงกับนัดเดิม กรุณาเลือกช่วงอื่น');
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
  const canSubmit =
    !submitting && !clinicClosedOnDate && !conflict && Boolean(date && time) && !unchanged;

  return (
    <CaModal
      open
      title="เปลี่ยนวันเวลานัด"
      icon="bi-calendar-event"
      size="lg"
      submitting={submitting}
      error={error}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-soft" disabled={submitting} onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" form="ca-resched-form" className="btn btn-sky" disabled={!canSubmit}>
            {submitting && (
              <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            )}
            <i className="bi bi-check2 me-1" aria-hidden="true" />
            บันทึกวันเวลาใหม่
          </button>
        </>
      }
    >
      <div className="ca-resched">
        <div className="ca-resched__summary">
          <div className="ca-resched__pet">
            <span className="ca-resched__emoji" aria-hidden="true">
              {sp.emoji}
            </span>
            <div className="ca-resched__pet-copy">
              <strong>
                {appointment.petName}
                <span className="ca-resched__species"> ({sp.label})</span>
              </strong>
              <span>
                {appointment.ownerName || '—'}
                {appointment.ownerPhone ? ` · ${appointment.ownerPhone}` : ''}
              </span>
            </div>
          </div>

          <div className="ca-resched__current">
            <div className="ca-resched__current-label">วันเวลาเดิม</div>
            <div className="ca-resched__current-value">
              {formatDate(appointment.date)} · {appointment.time} น.
            </div>
            <div className="ca-resched__current-meta">
              {vetName || 'ยังไม่ระบุสัตวแพทย์'}
              {durationMin ? ` · ${durationMin} นาที` : ''}
            </div>
          </div>
        </div>

        {services.length > 0 && (
          <div className="ca-resched__services">
            <div className="ca-resched__services-label">บริการ</div>
            <ul className="ca-resched__service-list">
              {services.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {closureInfo && (
          <div className="alert-soft danger mb-0" role="status">
            <i className="bi bi-calendar-x" aria-hidden="true" />
            <span>คลินิกปิดทำการวันที่เลือก: {closureInfo.reason} กรุณาเลือกวันอื่น</span>
          </div>
        )}

        {!closureInfo && !dayHours && (
          <div className="alert-soft warn mb-0" role="status">
            <i className="bi bi-clock" aria-hidden="true" />
            <span>คลินิกไม่เปิดทำการในวันที่เลือก กรุณาเลือกวันอื่น</span>
          </div>
        )}

        {vetOffDutyOnDate && (
          <div className="alert-soft warn mb-0" role="status">
            <i className="bi bi-exclamation-triangle" aria-hidden="true" />
            <span>{vetName} ไม่ได้เข้าเวรในวันที่เลือก</span>
          </div>
        )}

        {conflict && (
          <div className="alert-soft warn mb-0" role="status">
            <i className="bi bi-exclamation-triangle" aria-hidden="true" />
            <span>
              {vetName} มีนัดซ้อนในช่วงเวลา {conflict.rangeText} ({conflict.petName})
            </span>
          </div>
        )}

        <form id="ca-resched-form" onSubmit={handleSubmit} noValidate>
          <div className="ca-resched__form">
            <div>
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

            <div>
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

          <div className="ca-resched__suggest">
            <div className="form-label mb-2">เวลาว่างที่แนะนำ</div>
            {suggested.length > 0 ? (
              <div className="ca-resched__slots">
                {suggested.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    disabled={submitting}
                    className={`ca-resched__slot${time === slot ? ' is-active' : ''}`}
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
                {clinicClosedOnDate
                  ? 'คลินิกปิดทำการในวันที่เลือก'
                  : date < todayKey
                    ? 'วันที่เลือกผ่านมาแล้ว กรุณาเลือกวันนี้หรือวันถัดไป'
                    : 'ไม่มีเวลาว่างแนะนำในวันที่เลือก'}
              </div>
            )}
          </div>

          {!unchanged && date && time && (
            <div className="ca-resched__preview" aria-live="polite">
              <i className="bi bi-arrow-right-circle" aria-hidden="true" />
              <span>
                จะเปลี่ยนเป็น <strong>{formatDate(date)} · {time} น.</strong>
              </span>
            </div>
          )}
        </form>
      </div>
    </CaModal>
  );
}

export default function AppointmentModal({
  open,
  appointment,
  appointments,
  meta = null,
  onClose,
  onReschedule,
}) {
  if (!open || !appointment) return null;
  return (
    <RescheduleModalInner
      key={`resched-${appointment.id}`}
      appointment={appointment}
      appointments={appointments}
      meta={meta}
      onClose={onClose}
      onReschedule={onReschedule}
    />
  );
}
