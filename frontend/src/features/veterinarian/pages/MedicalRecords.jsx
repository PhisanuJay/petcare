import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import VetLayout from '../components/VetLayout.jsx';
import { usePatient, usePatients } from '../usePatients.js';
import {
  createMedicalRecord,
  createParasiteRecord,
  updateMedicalRecord,
  updateParasiteRecord,
} from '../useMedicalRecords.js';
import { DEFAULT_CLINIC, readVetName, saveVetName } from '../vetName.js';
import { todayString } from '../../pet-owner/bookingOptions.js';
import { PARASITE_TYPES, ageText, formatDate, labelOf, speciesOf } from '../../pet-owner/petUtils.js';

/**
 * Medical Records — Role: Veterinarian (มะแอ่ว)
 * Record what was done for a patient. Two kinds:
 *  - ตรวจ / รักษา  → the pet's treatment list (owner sees it under "การรักษา")
 *  - ให้ยาถ่ายพยาธิ / เห็บหมัด → the pet's parasite list (owner sees it under "ถ่ายพยาธิ / เห็บหมัด")
 * Both are marked "บันทึกโดยคลินิก" for the owner, who cannot edit them; the vet can edit them afterwards.
 */

const KINDS = [
  { value: 'treatment', label: 'ตรวจ / รักษา', icon: 'bi-journal-medical' },
  { value: 'parasite', label: 'ให้ยาถ่ายพยาธิ / เห็บหมัด', icon: 'bi-bug' },
];

const emptyTreatment = () => ({
  date: todayString(),
  vet: readVetName(),
  clinic: DEFAULT_CLINIC,
  symptoms: '',
  diagnosis: '',
  treatment: '',
  followUp: '',
});

const emptyParasite = () => ({
  type: 'deworm',
  product: '',
  date: todayString(),
  vet: readVetName(),
  place: DEFAULT_CLINIC,
});

const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');

function SaveButtons({ editing, saving, onCancel }) {
  return (
    <div className="d-flex justify-content-end gap-2 mt-3">
      {editing && (
        <button type="button" className="btn btn-soft" onClick={onCancel} disabled={saving}>ยกเลิก</button>
      )}
      <button type="submit" className="btn btn-sky" disabled={saving}>
        <i className="bi bi-check2 me-1" />
        {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'บันทึก'}
      </button>
    </div>
  );
}

function TreatmentForm({ patient, editing, onSaved, onCancel }) {
  const [form, setForm] = useState(() =>
    editing ? { ...emptyTreatment(), ...editing, followUp: editing.followUp ?? '' } : emptyTreatment(),
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
      <SaveButtons editing={editing} saving={saving} onCancel={onCancel} />
    </form>
  );
}

function ParasiteForm({ patient, editing, onSaved, onCancel }) {
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
      <SaveButtons editing={editing} saving={saving} onCancel={onCancel} />
    </form>
  );
}

/** Treatments and parasite doses of one patient as a single list, newest first. */
function buildHistory(patient) {
  return [
    ...(patient.treatments ?? []).map((row) => ({ kind: 'treatment', row })),
    ...(patient.parasites ?? []).map((row) => ({ kind: 'parasite', row })),
  ].sort((a, b) => byDateDesc(a.row, b.row));
}

function HistoryList({ history, onEdit, editing }) {
  if (history.length === 0) {
    return (
      <div className="empty-box py-3">
        <i className="bi bi-journal-medical" />
        ยังไม่มีประวัติ
      </div>
    );
  }
  return (
    <div className="timeline">
      {history.map(({ kind, row: t }) => (
        <div className="tl-item" key={`${kind}-${t.id}`}>
          <div className="date d-flex flex-wrap align-items-center gap-2">
            <span>
              {formatDate(t.date)}
              {kind === 'treatment' && (t.vet || t.clinic) && ` · ${[t.vet, t.clinic].filter(Boolean).join(' · ')}`}
              {kind === 'parasite' && (t.vet || t.place) && ` · ${[t.vet, t.place].filter(Boolean).join(' · ')}`}
            </span>
            <span className="tag">
              <i className={`bi ${kind === 'parasite' ? 'bi-bug' : 'bi-journal-medical'} me-1`} />
              {kind === 'parasite' ? 'ถ่ายพยาธิ / เห็บหมัด' : 'ตรวจ / รักษา'}
            </span>
            {t.source === 'vet' ? (
              <span className="tag ok">บันทึกโดยคลินิก</span>
            ) : (
              <span className="tag">บันทึกโดยเจ้าของ</span>
            )}
          </div>

          {kind === 'treatment' ? (
            <>
              <div className="fw-medium">{t.diagnosis || t.symptoms || 'ไม่ระบุ'}</div>
              {t.symptoms && t.diagnosis && <div className="small text-muted">อาการ: {t.symptoms}</div>}
              {t.treatment && <div className="small">การรักษา: {t.treatment}</div>}
              {t.followUp && <div className="small mt-1">นัดติดตาม: {formatDate(t.followUp)}</div>}
            </>
          ) : (
            <div className="fw-medium">
              {labelOf(PARASITE_TYPES, t.type)}
              {t.product && <span className="fw-normal text-muted"> · {t.product}</span>}
            </div>
          )}

          {t.source === 'vet' && (
            <button
              type="button"
              className="btn btn-sm btn-soft mt-2"
              disabled={editing?.row.id === t.id}
              onClick={() => onEdit({ kind, row: t })}
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
  const initialKind = params.get('kind') === 'parasite' ? 'parasite' : 'treatment';
  const { patients, loading: listLoading, error: listError } = usePatients();
  const detail = usePatient(petId);
  const [kind, setKind] = useState(initialKind);
  const [editing, setEditing] = useState(null); // { kind, row }
  const [savedAt, setSavedAt] = useState(0);

  const patient = detail.patient;
  const history = patient ? buildHistory(patient) : [];
  const activeKind = editing ? editing.kind : kind;

  async function handleSaved() {
    setEditing(null);
    setSavedAt(Date.now());
    await detail.reload();
  }

  const choose = (id) => {
    setEditing(null);
    setSavedAt(0);
    setParams(kind === 'parasite' ? { pet: id, kind: 'parasite' } : { pet: id });
  };

  const FormComponent = activeKind === 'parasite' ? ParasiteForm : TreatmentForm;

  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>ประวัติการรักษา</h1>
              <p>บันทึกการตรวจ การรักษา และการให้ยาถ่ายพยาธิ เจ้าของจะเห็นในหน้าประวัติสุขภาพของน้อง</p>
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

                <div className="card-soft mb-4">
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {KINDS.map((k) => (
                      <button
                        type="button"
                        key={k.value}
                        className={`btn btn-sm ${activeKind === k.value ? 'btn-sky' : 'btn-soft'}`}
                        disabled={Boolean(editing)}
                        onClick={() => {
                          setKind(k.value);
                          setSavedAt(0);
                        }}
                      >
                        <i className={`bi ${k.icon} me-1`} />
                        {k.label}
                      </button>
                    ))}
                  </div>
                  <div className="section-label">
                    <i className={`bi ${activeKind === 'parasite' ? 'bi-bug' : 'bi-journal-plus'}`} />
                    {editing ? 'แก้ไขบันทึก' : `บันทึกใหม่ของ ${patient.name}`}
                  </div>
                  <FormComponent
                    key={`${activeKind}-${editing?.row.id ?? 'new'}-${patient.id}`}
                    patient={patient}
                    editing={editing?.row ?? null}
                    onSaved={handleSaved}
                    onCancel={() => setEditing(null)}
                  />
                </div>

                <div className="card-soft">
                  <div className="section-label">
                    <i className="bi bi-journal-medical" />
                    ประวัติของ {patient.name} ({history.length})
                  </div>
                  <HistoryList history={history} onEdit={setEditing} editing={editing} />
                </div>
              </>
            )
          )}
        </div>
      </div>
    </VetLayout>
  );
}
