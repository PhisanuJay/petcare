import { useEffect, useMemo, useState } from 'react';
import { SPECIES } from '../../pet-owner/petUtils.js';
import {
  DURATION_OPTIONS,
  SERVICE_TYPES,
  VETS,
} from '../data/constants.js';
import { findConflict } from '../data/schedule.js';

function createInitialForm(initialData, defaultDate, prefill) {
  if (initialData) {
    return {
      petName: initialData.petName ?? '',
      species: initialData.species ?? 'dog',
      ownerName: initialData.ownerName ?? '',
      ownerPhone: initialData.ownerPhone ?? '',
      date: initialData.date ?? defaultDate,
      time: initialData.time ?? '09:00',
      durationMin: String(initialData.durationMin ?? 30),
      service: initialData.service ?? SERVICE_TYPES[0],
      vet: initialData.vet ?? VETS[0]?.name ?? '',
      reason: initialData.reason ?? '',
      notes: initialData.notes ?? '',
    };
  }
  return {
    petName: prefill?.petName ?? '',
    species: prefill?.species ?? 'dog',
    ownerName: prefill?.ownerName ?? '',
    ownerPhone: prefill?.ownerPhone ?? '',
    date: prefill?.date ?? defaultDate,
    time: prefill?.time ?? '09:00',
    durationMin: String(prefill?.durationMin ?? 30),
    service: prefill?.service ?? SERVICE_TYPES[0],
    vet: prefill?.vet ?? VETS[0]?.name ?? '',
    reason: prefill?.reason ?? '',
    notes: prefill?.notes ?? '',
  };
}

function validateForm(form) {
  const nextErrors = {};
  if (!form.petName.trim()) nextErrors.petName = 'กรุณากรอกชื่อสัตว์เลี้ยง';
  if (!form.ownerName.trim()) nextErrors.ownerName = 'กรุณากรอกชื่อเจ้าของ';

  const digits = form.ownerPhone.replace(/[\s-]/g, '');
  if (!/^\d{9,10}$/.test(digits)) {
    nextErrors.ownerPhone = 'กรุณากรอกเบอร์โทร 9–10 หลัก';
  }

  if (!form.date) nextErrors.date = 'กรุณาเลือกวันที่';
  if (!form.time) nextErrors.time = 'กรุณาระบุเวลา';
  if (!form.service) nextErrors.service = 'กรุณาเลือกบริการ';
  if (!form.vet) nextErrors.vet = 'กรุณาเลือกสัตวแพทย์';

  return nextErrors;
}

function AppointmentModalInner({ initialData, prefill, appointments, defaultDate, onClose, onSave }) {
  const [form, setForm] = useState(() => createInitialForm(initialData, defaultDate, prefill));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
        initialData?.id,
      ),
    [appointments, initialData?.id, form.vet, form.date, form.time, form.durationMin],
  );

  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave({
      petId: initialData?.petId ?? prefill?.petId ?? null,
      petName: form.petName.trim(),
      species: form.species,
      ownerName: form.ownerName.trim(),
      ownerPhone: form.ownerPhone.replace(/[\s-]/g, ''),
      date: form.date,
      time: form.time,
      durationMin: Number(form.durationMin) || 30,
      service: form.service,
      vet: form.vet,
      reason: form.reason.trim(),
      notes: form.notes.trim(),
    });
  }

  return (
    <>
      <div className="modal d-block ma-modal" tabIndex={-1} role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content ma-modal-card">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div className="section-label mb-0">
                <i className={`bi ${initialData ? 'bi-pencil-square' : 'bi-calendar-plus'}`} />
                {initialData ? 'แก้ไขนัดหมาย' : 'เพิ่มนัดหมายใหม่'}
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="ปิด"
                onClick={onClose}
              />
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
                  <label className="form-label" htmlFor="appt-petName">
                    ชื่อสัตว์เลี้ยง <span className="text-danger">*</span>
                  </label>
                  <input
                    id="appt-petName"
                    type="text"
                    className={`form-control${errors.petName ? ' is-invalid' : ''}`}
                    placeholder="เช่น โกโก้"
                    value={form.petName}
                    onChange={setField('petName')}
                  />
                  {errors.petName && <div className="invalid-feedback">{errors.petName}</div>}
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="appt-species">
                    ชนิดสัตว์
                  </label>
                  <select
                    id="appt-species"
                    className="form-select"
                    value={form.species}
                    onChange={setField('species')}
                  >
                    {SPECIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.emoji} {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="appt-ownerName">
                    ชื่อเจ้าของ <span className="text-danger">*</span>
                  </label>
                  <input
                    id="appt-ownerName"
                    type="text"
                    className={`form-control${errors.ownerName ? ' is-invalid' : ''}`}
                    placeholder="เช่น คุณมายด์"
                    value={form.ownerName}
                    onChange={setField('ownerName')}
                  />
                  {errors.ownerName && <div className="invalid-feedback">{errors.ownerName}</div>}
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="appt-ownerPhone">
                    เบอร์โทรศัพท์ <span className="text-danger">*</span>
                  </label>
                  <input
                    id="appt-ownerPhone"
                    type="tel"
                    inputMode="numeric"
                    className={`form-control${errors.ownerPhone ? ' is-invalid' : ''}`}
                    placeholder="เช่น 0812345678"
                    value={form.ownerPhone}
                    onChange={setField('ownerPhone')}
                  />
                  {errors.ownerPhone && <div className="invalid-feedback">{errors.ownerPhone}</div>}
                </div>

                <div className="col-12 col-sm-6 col-md-4">
                  <label className="form-label" htmlFor="appt-date">
                    วันที่ <span className="text-danger">*</span>
                  </label>
                  <input
                    id="appt-date"
                    type="date"
                    className={`form-control${errors.date ? ' is-invalid' : ''}`}
                    value={form.date}
                    onChange={setField('date')}
                  />
                  {errors.date && <div className="invalid-feedback">{errors.date}</div>}
                </div>

                <div className="col-12 col-sm-6 col-md-4">
                  <label className="form-label" htmlFor="appt-time">
                    เวลา <span className="text-danger">*</span>
                  </label>
                  <input
                    id="appt-time"
                    type="time"
                    className={`form-control${errors.time ? ' is-invalid' : ''}`}
                    value={form.time}
                    onChange={setField('time')}
                  />
                  {errors.time && <div className="invalid-feedback">{errors.time}</div>}
                </div>

                <div className="col-md-4">
                  <label className="form-label" htmlFor="appt-duration">
                    ระยะเวลา (นาที)
                  </label>
                  <select
                    id="appt-duration"
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

                <div className="col-md-6">
                  <label className="form-label" htmlFor="appt-service">
                    บริการ <span className="text-danger">*</span>
                  </label>
                  <select
                    id="appt-service"
                    className={`form-select${errors.service ? ' is-invalid' : ''}`}
                    value={form.service}
                    onChange={setField('service')}
                  >
                    <option value="">-- เลือกบริการ --</option>
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.service && <div className="invalid-feedback">{errors.service}</div>}
                </div>

                <div className="col-md-6">
                  <label className="form-label" htmlFor="appt-vet">
                    สัตวแพทย์ <span className="text-danger">*</span>
                  </label>
                  <select
                    id="appt-vet"
                    className={`form-select${errors.vet ? ' is-invalid' : ''}`}
                    value={form.vet}
                    onChange={setField('vet')}
                  >
                    <option value="">-- เลือกสัตวแพทย์ --</option>
                    {VETS.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.spec})
                      </option>
                    ))}
                  </select>
                  {errors.vet && <div className="invalid-feedback">{errors.vet}</div>}
                </div>

                <div className="col-12">
                  <label className="form-label" htmlFor="appt-reason">
                    อาการ / เหตุผลที่นัด
                  </label>
                  <textarea
                    id="appt-reason"
                    className="form-control"
                    rows={2}
                    placeholder="เช่น ซึม ไม่ทานอาหาร 1 วัน"
                    value={form.reason}
                    onChange={setField('reason')}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label" htmlFor="appt-notes">
                    หมายเหตุเพิ่มเติม
                  </label>
                  <textarea
                    id="appt-notes"
                    className="form-control"
                    rows={2}
                    placeholder="เช่น แพ้ยา, งดน้ำงดอาหารก่อนเข้าตรวจ"
                    value={form.notes}
                    onChange={setField('notes')}
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-soft" onClick={onClose}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-sky">
                  <i className="bi bi-check2 me-1" />
                  บันทึก
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

export default function AppointmentModal({
  open,
  initialData,
  prefill = null,
  appointments,
  defaultDate,
  onClose,
  onSave,
}) {
  if (!open) return null;
  const key = initialData
    ? `edit-${initialData.id}`
    : `new-${prefill?.petId ?? prefill?.petName ?? 'blank'}-${defaultDate}`;
  return (
    <AppointmentModalInner
      key={key}
      initialData={initialData}
      prefill={prefill}
      appointments={appointments}
      defaultDate={defaultDate}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
