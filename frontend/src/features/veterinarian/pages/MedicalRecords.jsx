import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import VetLayout from '../components/VetLayout.jsx';
import { usePatient, usePatients } from '../usePatients.js';
import { createMedicalRecord, updateMedicalRecord } from '../useMedicalRecords.js';
import { todayString } from '../../pet-owner/bookingOptions.js';
import { ageText, formatDate, speciesOf } from '../../pet-owner/petUtils.js';

/**
 * Medical Records — Role: Veterinarian (มะแอ่ว)
 * Record an examination / treatment for a patient. Records are saved in the pet's treatment list,
 * the same list the owner sees on the Medical page (marked "บันทึกโดยคลินิก"). Owners cannot edit
 * records written here; the vet can edit them afterwards.
 */

const VET_NAME_KEY = 'petcare_vet_name';
const DEFAULT_CLINIC = 'PetCare';

const readVetName = () => {
  try {
    return localStorage.getItem(VET_NAME_KEY) ?? '';
  } catch {
    return '';
  }
};
const saveVetName = (name) => {
  try {
    localStorage.setItem(VET_NAME_KEY, name);
  } catch {
    /* remembering the name is only a convenience */
  }
};

const emptyForm = () => ({
  date: todayString(),
  vet: readVetName(),
  clinic: DEFAULT_CLINIC,
  symptoms: '',
  diagnosis: '',
  treatment: '',
  followUp: '',
});

const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');

function RecordForm({ patient, editing, onSaved, onCancel }) {
  const [form, setForm] = useState(() =>
    editing ? { ...emptyForm(), ...editing, followUp: editing.followUp ?? '' } : emptyForm(),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.vet.trim()) return setError('กรุณากรอกชื่อสัตวแพทย์');
    if (!form.symptoms.trim() && !form.diagnosis.trim()) return setError('กรุณากรอกอาการหรือผลการวินิจฉัยอย่างน้อยหนึ่งอย่าง');
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
      setSaving(false);
    }
  }

  return (
    <form className="card-soft mb-4" onSubmit={handleSubmit}>
      <div className="section-label">
        <i className="bi bi-journal-plus" />
        {editing ? 'แก้ไขบันทึกการรักษา' : `บันทึกการรักษาใหม่ของ ${patient.name}`}
      </div>

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

      <div className="d-flex justify-content-end gap-2 mt-3">
        {editing && (
          <button type="button" className="btn btn-soft" onClick={onCancel} disabled={saving}>ยกเลิก</button>
        )}
        <button type="submit" className="btn btn-sky" disabled={saving}>
          <i className="bi bi-check2 me-1" />
          {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'บันทึกการรักษา'}
        </button>
      </div>
    </form>
  );
}

function RecordList({ records, onEdit, editingId }) {
  if (records.length === 0) {
    return (
      <div className="empty-box py-3">
        <i className="bi bi-journal-medical" />
        ยังไม่มีประวัติการรักษา
      </div>
    );
  }
  return (
    <div className="timeline">
      {records.map((t) => (
        <div className="tl-item" key={t.id}>
          <div className="date d-flex flex-wrap align-items-center gap-2">
            <span>
              {formatDate(t.date)}
              {(t.vet || t.clinic) && ` · ${[t.vet, t.clinic].filter(Boolean).join(' · ')}`}
            </span>
            {t.source === 'vet' ? (
              <span className="tag ok">บันทึกโดยคลินิก</span>
            ) : (
              <span className="tag">บันทึกโดยเจ้าของ</span>
            )}
          </div>
          <div className="fw-medium">{t.diagnosis || t.symptoms || 'ไม่ระบุ'}</div>
          {t.symptoms && t.diagnosis && <div className="small text-muted">อาการ: {t.symptoms}</div>}
          {t.treatment && <div className="small">การรักษา: {t.treatment}</div>}
          {t.followUp && <div className="small mt-1">นัดติดตาม: {formatDate(t.followUp)}</div>}
          {t.source === 'vet' && (
            <button
              type="button"
              className="btn btn-sm btn-soft mt-2"
              disabled={editingId === t.id}
              onClick={() => onEdit(t)}
            >
              <i className="bi bi-pencil-square me-1" />
              แก้ไข
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function PatientPicker({ patients, loading, onSelect }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = patients.filter(
    (p) => !q || [p.name, p.breed, speciesOf(p.species).label].some((v) => v?.toLowerCase().includes(q)),
  );
  return (
    <div className="card-soft">
      <div className="section-label">
        <i className="bi bi-search" />
        เลือกคนไข้
      </div>
      <input
        className="form-control mb-3"
        placeholder="ค้นหาชื่อ / สายพันธุ์ / ชนิดสัตว์"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading ? (
        <div className="empty-box py-3">กำลังโหลดข้อมูล...</div>
      ) : shown.length === 0 ? (
        <div className="empty-box py-3">ไม่พบคนไข้</div>
      ) : (
        <div className="d-grid gap-2">
          {shown.map((p) => {
            const species = speciesOf(p.species);
            return (
              <button type="button" key={p.id} className="btn btn-soft text-start" style={{ borderRadius: 20 }} onClick={() => onSelect(p.id)}>
                <span className="fw-medium">{species.emoji} {p.name}</span>
                <span className="small text-muted ms-2">
                  {species.label}
                  {p.breed ? ` · ${p.breed}` : ''} · {ageText(p.birthDate)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MedicalRecordsPage() {
  const [params, setParams] = useSearchParams();
  const petId = params.get('pet') ?? '';
  const { patients, loading: listLoading, error: listError } = usePatients();
  const detail = usePatient(petId);
  const [editing, setEditing] = useState(null);
  const [savedAt, setSavedAt] = useState(0);

  const patient = detail.patient;
  const records = patient ? [...(patient.treatments ?? [])].sort(byDateDesc) : [];

  async function handleSaved() {
    setEditing(null);
    setSavedAt(Date.now());
    await detail.reload();
  }

  const choose = (id) => {
    setEditing(null);
    setParams({ pet: id });
  };

  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>ประวัติการรักษา</h1>
              <p>บันทึกการตรวจและการรักษา เจ้าของจะเห็นในหน้าประวัติสุขภาพของน้อง</p>
            </div>
            {patient && (
              <div className="d-flex gap-2">
                <Link to={`/veterinarian/patients?pet=${patient.id}`} className="btn btn-soft">
                  <i className="bi bi-person-vcard me-1" />
                  ข้อมูลคนไข้
                </Link>
                <button type="button" className="btn btn-soft" onClick={() => setParams({})}>
                  เปลี่ยนคนไข้
                </button>
              </div>
            )}
          </div>

          {listError && <div className="alert alert-danger">{listError}</div>}

          {!petId ? (
            <PatientPicker patients={patients} loading={listLoading} onSelect={choose} />
          ) : detail.loading ? (
            <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
          ) : detail.error ? (
            <div className="card-soft empty-box">
              <i className="bi bi-question-circle" />
              {detail.error}
            </div>
          ) : (
            patient && (
              <>
                {patient.allergies && (
                  <div className="alert-soft danger mb-3">
                    <i className="bi bi-exclamation-triangle" />
                    <span>
                      <strong>ประวัติการแพ้ของ {patient.name}:</strong> {patient.allergies}
                    </span>
                  </div>
                )}
                {savedAt > 0 && !editing && <div className="alert alert-success py-2">บันทึกเรียบร้อยแล้ว</div>}

                <RecordForm
                  key={editing?.id ?? 'new'}
                  patient={patient}
                  editing={editing}
                  onSaved={handleSaved}
                  onCancel={() => setEditing(null)}
                />

                <div className="card-soft">
                  <div className="section-label">
                    <i className="bi bi-journal-medical" />
                    ประวัติของ {patient.name} ({records.length})
                  </div>
                  <RecordList records={records} onEdit={setEditing} editingId={editing?.id} />
                </div>
              </>
            )
          )}
        </div>
      </div>
    </VetLayout>
  );
}
