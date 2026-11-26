import { useState } from 'react';
import {
  createMedicalRecord,
  createParasiteRecord,
  updateMedicalRecord,
  updateParasiteRecord,
} from '../useMedicalRecords.js';
import { DEFAULT_CLINIC, readVetName, saveVetName } from '../vetName.js';
import { todayString } from '../../pet-owner/bookingOptions.js';
import { PARASITE_TYPES } from '../../pet-owner/petUtils.js';

export const emptyTreatment = () => ({
  date: todayString(),
  vet: readVetName(),
  clinic: DEFAULT_CLINIC,
  symptoms: '',
  diagnosis: '',
  treatment: '',
  followUp: '',
});

export const emptyParasite = () => ({
  type: 'deworm',
  product: '',
  date: todayString(),
  vet: readVetName(),
  place: DEFAULT_CLINIC,
});

function SaveButtons({ editing, saving, onCancel }) {
  return (
    <div className="d-flex justify-content-end gap-2 mt-3">
      {onCancel && (
        <button type="button" className="btn btn-soft" onClick={onCancel} disabled={saving}>
          ยกเลิก
        </button>
      )}
      <button type="submit" className="btn btn-sky" disabled={saving}>
        <i className="bi bi-check2 me-1" />
        {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'บันทึก'}
      </button>
    </div>
  );
}

export function TreatmentForm({ patient, editing = null, onSaved, onCancel }) {
  const [form, setForm] = useState(() =>
    editing ? { ...emptyTreatment(), ...editing, followUp: editing.followUp ?? '' } : emptyTreatment(),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.vet.trim()) return setError('กรุณากรอกชื่อสัตวแพทย์');
    if (!form.symptoms.trim() && !form.diagnosis.trim()) {
      return setError('กรุณากรอกอาการหรือผลการวินิจฉัยอย่างน้อยหนึ่งอย่าง');
    }
    setSaving(true);
    setError('');
    try {
      const data = {
        date: form.date,
        vet: form.vet,
        clinic: form.clinic,
        symptoms: form.symptoms,
        diagnosis: form.diagnosis,
        treatment: form.treatment,
        followUp: form.followUp,
      };
      if (editing) await updateMedicalRecord(patient.id, editing.id, data);
      else await createMedicalRecord(patient.id, data);
      saveVetName(form.vet.trim());
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label" htmlFor="mr-date">วันที่ตรวจ</label>
          <input id="mr-date" type="date" className="form-control" max={todayString()} value={form.date} onChange={set('date')} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="mr-vet">สัตวแพทย์</label>
          <input id="mr-vet" className="form-control" maxLength={100} value={form.vet} onChange={set('vet')} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="mr-clinic">คลินิก / โรงพยาบาล</label>
          <input id="mr-clinic" className="form-control" maxLength={100} value={form.clinic} onChange={set('clinic')} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="mr-symptoms">อาการ</label>
          <textarea id="mr-symptoms" rows={2} maxLength={2000} className="form-control" value={form.symptoms} onChange={set('symptoms')} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="mr-diagnosis">ผลการวินิจฉัย</label>
          <textarea id="mr-diagnosis" rows={2} maxLength={2000} className="form-control" value={form.diagnosis} onChange={set('diagnosis')} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="mr-treatment">การรักษา / ยาที่ได้รับ</label>
          <textarea id="mr-treatment" rows={2} maxLength={2000} className="form-control" value={form.treatment} onChange={set('treatment')} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="mr-follow">นัดติดตามอาการ</label>
          <input id="mr-follow" type="date" className="form-control" min={form.date} value={form.followUp} onChange={set('followUp')} />
          <div className="form-text">ไม่บังคับ ใช้บันทึกวันที่ควรกลับมาติดตามผล</div>
        </div>
      </div>
      <SaveButtons editing={Boolean(editing)} saving={saving} onCancel={onCancel} />
    </form>
  );
}

export function ParasiteForm({ patient, editing = null, onSaved, onCancel }) {
  const [form, setForm] = useState(() => (editing ? { ...emptyParasite(), ...editing } : emptyParasite()));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.vet.trim()) return setError('กรุณากรอกชื่อสัตวแพทย์');
    setSaving(true);
    setError('');
    try {
      const data = { type: form.type, product: form.product, date: form.date, place: form.place, vet: form.vet };
      if (editing) await updateParasiteRecord(patient.id, editing.id, data);
      else await createParasiteRecord(patient.id, data);
      saveVetName(form.vet.trim());
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="pr-type">ประเภท</label>
          <select id="pr-type" className="form-select" value={form.type} onChange={set('type')}>
            {PARASITE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="pr-product">ชื่อยา / ผลิตภัณฑ์</label>
          <input
            id="pr-product"
            className="form-control"
            maxLength={100}
            placeholder="ไม่บังคับ เช่น NexGard, Drontal"
            value={form.product}
            onChange={set('product')}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="pr-date">วันที่ให้ยา</label>
          <input id="pr-date" type="date" className="form-control" max={todayString()} value={form.date} onChange={set('date')} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="pr-vet">สัตวแพทย์</label>
          <input id="pr-vet" className="form-control" maxLength={100} value={form.vet} onChange={set('vet')} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="pr-place">สถานที่</label>
          <input id="pr-place" className="form-control" maxLength={100} value={form.place} onChange={set('place')} />
        </div>
      </div>
      <SaveButtons editing={Boolean(editing)} saving={saving} onCancel={onCancel} />
    </form>
  );
}
