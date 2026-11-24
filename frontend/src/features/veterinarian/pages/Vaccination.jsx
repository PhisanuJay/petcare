import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import VetLayout from '../components/VetLayout.jsx';
import { useOwners, usePatient } from '../usePatients.js';
import { createVaccination, updateVaccination, useDueVaccines } from '../useVaccination.js';
import { DEFAULT_CLINIC, readVetName, saveVetName } from '../vetName.js';
import { todayString } from '../../pet-owner/bookingOptions.js';
import { ageText, daysUntil, formatDate, reminderText, speciesOf } from '../../pet-owner/petUtils.js';

/**
 * Vaccination — Role: Veterinarian (มะแอ่ว)
 * Left: vaccines that are overdue or due within 30 days, for every patient. Right: record a vaccination
 * for a patient. Records go into the pet's vaccine list, the same list the owner sees (marked
 * "บันทึกโดยคลินิก"); owners cannot edit them, the vet can edit them afterwards.
 * (Parasite treatment is recorded on the Medical Records page, not here.)
 */

const OTHER = '__other__';

// Common vaccines offered in the dropdown; "อื่นๆ (ระบุเอง)" lets the vet type any other name.
const VACCINE_SUGGESTIONS = {
  dog: ['พิษสุนัขบ้า', 'วัคซีนรวมสุนัข (DHPP)', 'ไอกรนสุนัข', 'เลปโตสไปโรซิส'],
  cat: ['พิษสุนัขบ้า', 'วัคซีนรวมแมว (FVRCP)', 'ลิวคีเมียในแมว (FeLV)'],
};

const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');

const emptyForm = (vaccine = '') => ({
  name: vaccine,
  date: todayString(),
  nextDate: '',
  place: DEFAULT_CLINIC,
  vet: readVetName(),
  lot: '',
});

function DueList({ due, loading, error, reload, onPick }) {
  return (
    <div className="card-soft">
      <div className="section-label">
        <i className="bi bi-bell" />
        ถึงกำหนดฉีด ({due.length})
      </div>
      <div className="small text-muted mb-3">เลยกำหนด หรือครบกำหนดภายใน 30 วัน นับเฉพาะเข็มล่าสุดของวัคซีนแต่ละชนิด</div>
      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center py-2">
          <span>{error}</span>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
        </div>
      )}
      {loading ? (
        <div className="empty-box py-3">กำลังโหลด...</div>
      ) : due.length === 0 ? (
        <div className="empty-box py-3">
          <i className="bi bi-check2-circle" />
          ไม่มีวัคซีนที่ใกล้ถึงหรือเลยกำหนด
        </div>
      ) : (
        <div className="d-grid gap-2">
          {due.map((d) => {
            const r = { days: daysUntil(d.nextDate) };
            return (
              <div key={`${d.petId}-${d.name}-${d.nextDate}`} className="p-2 rounded-4 border">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="fw-medium">{speciesOf(d.petSpecies).emoji} {d.petName}</span>
                  <span className={`tag ${d.status === 'overdue' ? 'danger' : 'warn'}`}>{reminderText(r)}</span>
                </div>
                <div className="small">
                  {d.name} · กำหนด {formatDate(d.nextDate)}
                  {d.lastDate && <span className="text-muted"> (ฉีดล่าสุด {formatDate(d.lastDate)})</span>}
                </div>
                <button type="button" className="btn btn-sm btn-sky mt-2" onClick={() => onPick(d)}>
                  <i className="bi bi-capsule me-1" />
                  บันทึกการฉีด
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VaccineForm({ patient, editing, presetName, onSaved, onCancel }) {
  const [form, setForm] = useState(() =>
    editing ? { ...emptyForm(), ...editing, nextDate: editing.nextDate ?? '' } : emptyForm(presetName),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const suggestions = VACCINE_SUGGESTIONS[patient.species] ?? [];

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // The dropdown lists the usual vaccines for the species; a name outside the list (typed earlier,
  // or chosen via "อื่นๆ") shows the free-text box.
  const [customName, setCustomName] = useState(() => form.name !== '' && !suggestions.includes(form.name));
  const selectValue = customName ? OTHER : form.name;
  const pickVaccine = (e) => {
    const v = e.target.value;
    if (v === OTHER) {
      setCustomName(true);
      setForm((f) => ({ ...f, name: suggestions.includes(f.name) ? '' : f.name }));
    } else {
      setCustomName(false);
      setForm((f) => ({ ...f, name: v }));
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('กรุณากรอกชื่อวัคซีน');
    if (!form.vet.trim()) return setError('กรุณากรอกชื่อสัตวแพทย์');
    if (form.nextDate && form.nextDate <= form.date) return setError('วันนัดครั้งถัดไปต้องหลังวันที่ฉีด');
    setSaving(true);
    setError('');
    try {
      const data = {
        name: form.name,
        date: form.date,
        nextDate: form.nextDate,
        place: form.place,
        vet: form.vet,
        lot: form.lot,
      };
      if (editing) await updateVaccination(patient.id, editing.id, data);
      else await createVaccination(patient.id, data);
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
        <i className="bi bi-capsule" />
        {editing ? 'แก้ไขบันทึกวัคซีน' : `บันทึกการฉีดวัคซีนของ ${patient.name}`}
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="vx-name">ชื่อวัคซีน</label>
          <select id="vx-name" className="form-select" value={selectValue} onChange={pickVaccine}>
            <option value="">เลือกชนิดวัคซีน</option>
            {suggestions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            <option value={OTHER}>อื่นๆ (ระบุเอง)</option>
          </select>
          {selectValue === OTHER && (
            <input
              className="form-control mt-2"
              aria-label="ชื่อวัคซีน"
              placeholder="ระบุชื่อวัคซีน"
              maxLength={100}
              value={form.name}
              onChange={set('name')}
              autoFocus
            />
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="vx-vet">สัตวแพทย์</label>
          <input id="vx-vet" className="form-control" maxLength={100} value={form.vet} onChange={set('vet')} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="vx-date">วันที่ฉีด</label>
          <input id="vx-date" type="date" className="form-control" max={todayString()} value={form.date} onChange={set('date')} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="vx-next">นัดครั้งถัดไป</label>
          <input id="vx-next" type="date" className="form-control" min={form.date} value={form.nextDate} onChange={set('nextDate')} />
          <div className="form-text">ไม่บังคับ ระบบจะเตือนเจ้าของเมื่อใกล้ถึงวัน</div>
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="vx-place">สถานที่</label>
          <input id="vx-place" className="form-control" maxLength={100} value={form.place} onChange={set('place')} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="vx-lot">Lot / หมายเหตุ</label>
          <input id="vx-lot" className="form-control" maxLength={200} placeholder="ไม่บังคับ" value={form.lot} onChange={set('lot')} />
        </div>
      </div>

      <div className="d-flex justify-content-end gap-2 mt-3">
        {editing && (
          <button type="button" className="btn btn-soft" onClick={onCancel} disabled={saving}>ยกเลิก</button>
        )}
        <button type="submit" className="btn btn-sky" disabled={saving}>
          <i className="bi bi-check2 me-1" />
          {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'บันทึกการฉีด'}
        </button>
      </div>
    </form>
  );
}

function VaccineHistory({ vaccines, onEdit, editingId }) {
  if (vaccines.length === 0) {
    return (
      <div className="empty-box py-3">
        <i className="bi bi-capsule" />
        ยังไม่มีประวัติวัคซีน
      </div>
    );
  }
  return (
    <div className="table-responsive">
      <table className="table align-middle mb-0 small">
        <thead>
          <tr className="text-muted">
            <th>วัคซีน</th>
            <th>วันที่ฉีด</th>
            <th>นัดถัดไป</th>
            <th>ผู้บันทึก</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {vaccines.map((v) => (
            <tr key={v.id}>
              <td className="fw-medium">
                {v.name || '-'}
                {v.lot && <div className="small text-muted">{v.lot}</div>}
              </td>
              <td>{formatDate(v.date)}</td>
              <td>{formatDate(v.nextDate)}</td>
              <td>
                {v.source === 'vet' ? (
                  <span className="tag ok">คลินิก{v.vet ? ` · ${v.vet}` : ''}</span>
                ) : (
                  <span className="tag">เจ้าของ</span>
                )}
              </td>
              <td className="text-end">
                {v.source === 'vet' && (
                  <button type="button" className="btn btn-sm btn-soft" disabled={editingId === v.id} onClick={() => onEdit(v)}>
                    <i className="bi bi-pencil-square" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Step 1: pick the customer. Step 2: pick one of that customer's pets. */
function PatientPicker({ owners, loading, onSelect, startOwnerId = '' }) {
  const [query, setQuery] = useState('');
  const [ownerId, setOwnerId] = useState(startOwnerId);
  const q = query.trim().toLowerCase();
  const owner = owners.find((o) => o.id === ownerId) ?? null;
  const shown = owners.filter(
    (o) =>
      !q ||
      [o.name, o.phone, ...o.pets.flatMap((p) => [p.name, p.breed, speciesOf(p.species).label])].some((v) =>
        v?.toLowerCase().includes(q),
      ),
  );
  return (
    <div className="card-soft">
      {loading ? (
        <div className="empty-box py-3">กำลังโหลดข้อมูล...</div>
      ) : owner ? (
        <>
          <button type="button" className="btn btn-soft btn-sm mb-3" onClick={() => setOwnerId('')}>
            <i className="bi bi-arrow-left me-1" />
            ลูกค้าทั้งหมด
          </button>
          <div className="section-label">
            <i className="bi bi-person-circle" />
            {owner.name || 'ไม่ทราบชื่อลูกค้า'} · เลือกสัตว์เลี้ยงที่จะบันทึกวัคซีน
          </div>
          <div className="d-grid gap-2">
            {owner.pets.map((p) => {
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
        </>
      ) : (
        <>
          <div className="section-label">
            <i className="bi bi-search" />
            เลือกลูกค้า
          </div>
          <input
            className="form-control mb-3"
            placeholder="ค้นหาชื่อลูกค้า / เบอร์โทร / ชื่อสัตว์เลี้ยง"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {shown.length === 0 ? (
            <div className="empty-box py-3">ไม่พบลูกค้า</div>
          ) : (
            <div className="d-grid gap-2">
              {shown.map((o) => (
                <button type="button" key={o.id} className="btn btn-soft text-start" style={{ borderRadius: 20 }} onClick={() => setOwnerId(o.id)}>
                  <div className="fw-medium">
                    <i className="bi bi-person-circle me-1" />
                    {o.name || 'ไม่ทราบชื่อลูกค้า'}
                  </div>
                  <div>{[...new Set(o.pets.map((p) => speciesOf(p.species).emoji))].join(' ')}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function VaccinationPage() {
  const [params, setParams] = useSearchParams();
  const petId = params.get('pet') ?? '';
  const presetName = params.get('vaccine') ?? '';
  const { owners, loading: listLoading, error: listError } = useOwners();
  const dueState = useDueVaccines(30);
  const detail = usePatient(petId);
  const [editing, setEditing] = useState(null);
  const [savedAt, setSavedAt] = useState(0);

  const patient = detail.patient;
  const vaccines = patient ? [...(patient.vaccines ?? [])].sort(byDateDesc) : [];

  async function handleSaved() {
    setEditing(null);
    setSavedAt(Date.now());
    await Promise.all([detail.reload(), dueState.reload()]);
  }

  const choose = (id, vaccine = '') => {
    setEditing(null);
    setSavedAt(0);
    setParams(vaccine ? { pet: id, vaccine } : { pet: id });
  };

  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>วัคซีน</h1>
              <p>บันทึกการฉีดวัคซีน และติดตามวัคซีนที่ใกล้ถึงกำหนด</p>
            </div>
            {patient && (
              <div className="d-flex gap-2">
                <Link to={`/veterinarian/patients?pet=${patient.id}`} className="btn btn-soft">
                  <i className="bi bi-person-vcard me-1" />
                  ข้อมูลสัตว์เลี้ยง
                </Link>
                <button type="button" className="btn btn-soft" onClick={() => setParams(patient.owner?.id ? { owner: patient.owner.id } : {})}>
                  เปลี่ยนสัตว์เลี้ยง
                </button>
              </div>
            )}
          </div>

          {listError && <div className="alert alert-danger">{listError}</div>}

          <div className="row g-4">
            <div className="col-lg-5">
              <DueList
                due={dueState.due}
                loading={dueState.loading}
                error={dueState.error}
                reload={dueState.reload}
                onPick={(d) => choose(d.petId, d.name)}
              />
            </div>

            <div className="col-lg-7">
              {!petId ? (
                <PatientPicker owners={owners} loading={listLoading} onSelect={(id) => choose(id)} startOwnerId={params.get('owner') ?? ''} />
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

                    <VaccineForm
                      key={`${editing?.id ?? 'new'}-${patient.id}-${presetName}`}
                      patient={patient}
                      editing={editing}
                      presetName={presetName}
                      onSaved={handleSaved}
                      onCancel={() => setEditing(null)}
                    />

                    <div className="card-soft">
                      <div className="section-label">
                        <i className="bi bi-capsule" />
                        ประวัติวัคซีนของ {patient.name} ({vaccines.length})
                      </div>
                      <VaccineHistory vaccines={vaccines} onEdit={setEditing} editingId={editing?.id} />
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </VetLayout>
  );
}
