import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePets } from '../usePets.js';
import { NEUTER_OPTIONS, SEX_OPTIONS, SPECIES, ageText, emptyPet } from '../petUtils.js';
import {
  PARASITE_FIELDS,
  TREATMENT_FIELDS,
  VACCINE_FIELDS,
  newParasite,
  newTreatment,
  newVaccine,
} from '../recordFields.js';
import RecordList from '../components/RecordList.jsx';
import PetPhoto from '../components/PetPhoto.jsx';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';

const TABS = [
  { id: 'general', label: 'ข้อมูลทั่วไป', icon: 'bi-info-circle' },
  { id: 'health', label: 'สุขภาพ', icon: 'bi-heart-pulse' },
  { id: 'vaccines', label: 'วัคซีน', icon: 'bi-capsule', list: 'vaccines' },
  { id: 'treatments', label: 'ประวัติการรักษา', icon: 'bi-journal-medical', list: 'treatments' },
  { id: 'parasites', label: 'ถ่ายพยาธิ / เห็บหมัด', icon: 'bi-bug', list: 'parasites' },
];

function NotFound() {
  return (
    <div className="page-wrap">
      <div className="container">
        <div className="card-soft empty-box">
          <i className="bi bi-question-circle" />
          ไม่พบข้อมูลสัตว์เลี้ยงนี้
          <div className="mt-3">
            <Link to="/pet-owner/my-pets" className="btn btn-sky">กลับไปหน้าสัตว์เลี้ยง</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PetFormPage() {
  const { petId } = useParams();
  return <PetFormInner key={petId ?? 'new'} petId={petId} />;
}

function PetFormInner({ petId }) {
  const { getPet, addPet, updatePet } = usePets();
  const navigate = useNavigate();
  const existing = petId ? getPet(petId) : null;

  const [form, setForm] = useState(() => ({ ...emptyPet(), ...existing }));
  const [tab, setTab] = useState('general');
  const [error, setError] = useState('');

  if (petId && !existing) return <NotFound />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setList = (key) => (rows) => setForm((f) => ({ ...f, [key]: rows }));

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const photo = await fileToResizedDataUrl(file, 500);
      setForm((f) => ({ ...f, photo }));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setTab('general');
      setError('กรุณากรอกชื่อสัตว์เลี้ยง');
      return;
    }
    const data = { ...form, name: form.name.trim() };
    delete data.id;
    delete data.ownerId;
    delete data.createdAt;
    delete data.updatedAt;
    try {
      if (existing) {
        updatePet(existing.id, data);
        navigate(`/pet-owner/my-pets/${existing.id}`);
      } else {
        const pet = addPet(data);
        navigate(`/pet-owner/my-pets/${pet.id}`);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const input = (key, label, props = {}) => (
    <div className={props.col ?? 'col-md-6'}>
      <label className="form-label" htmlFor={`pet-${key}`}>
        {label}
        {props.required && <span className="text-danger"> *</span>}
      </label>
      {props.options ? (
        <select id={`pet-${key}`} className="form-select" value={form[key]} onChange={set(key)}>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>{o.emoji ? `${o.emoji} ${o.label}` : o.label}</option>
          ))}
        </select>
      ) : props.textarea ? (
        <textarea
          id={`pet-${key}`}
          className="form-control"
          rows={3}
          placeholder={props.placeholder}
          value={form[key]}
          onChange={set(key)}
        />
      ) : (
        <input
          id={`pet-${key}`}
          className="form-control"
          type={props.type ?? 'text'}
          placeholder={props.placeholder}
          value={form[key]}
          onChange={set(key)}
          {...props.attrs}
        />
      )}
      {props.hint && <div className="form-text">{props.hint}</div>}
    </div>
  );

  return (
    <div className="page-wrap">
      <div className="container" style={{ maxWidth: 980 }}>
        <div className="page-head">
          <div>
            <Link to={existing ? `/pet-owner/my-pets/${existing.id}` : '/pet-owner/my-pets'} className="small text-decoration-none">
              <i className="bi bi-arrow-left me-1" />
              ย้อนกลับ
            </Link>
            <h1 className="mt-1">{existing ? `แก้ไขข้อมูล ${existing.name}` : 'เพิ่มสัตว์เลี้ยง'}</h1>
            <p>กรอกเท่าที่มีข้อมูล กลับมาเพิ่มเติมทีหลังได้เสมอ</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="alert-soft danger mb-3">
              <i className="bi bi-exclamation-circle" />
              {error}
            </div>
          )}

          <div className="pill-tabs">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                <i className={`bi ${t.icon}`} />
                {t.label}
                {t.list && form[t.list].length > 0 && <span className="count">{form[t.list].length}</span>}
              </button>
            ))}
          </div>

          <div className="card-soft">
            {tab === 'general' && (
              <>
                <div className="d-flex align-items-center gap-4 mb-4 flex-wrap">
                  <div className="position-relative">
                    <PetPhoto pet={form} size="lg" />
                    <label className="upload-btn" title="อัปโหลดรูป">
                      <i className="bi bi-camera" />
                      <input type="file" accept="image/*" hidden onChange={handlePhoto} />
                    </label>
                  </div>
                  <div>
                    <div className="mitr fs-4">{form.name || 'ชื่อน้อง'}</div>
                    <div className="text-muted small">อายุ {ageText(form.birthDate)}</div>
                    {form.photo && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-danger p-0 mt-1"
                        onClick={() => setForm((f) => ({ ...f, photo: '' }))}
                      >
                        ลบรูป
                      </button>
                    )}
                  </div>
                </div>
                <div className="row g-3">
                  {input('name', 'ชื่อ', { required: true, placeholder: 'เช่น โกโก้' })}
                  {input('species', 'ชนิดสัตว์', { options: SPECIES })}
                  {input('breed', 'สายพันธุ์', { placeholder: 'เช่น คอร์กี้, เปอร์เซีย, พันธุ์ผสม' })}
                  {input('sex', 'เพศ', { options: SEX_OPTIONS, col: 'col-md-3' })}
                  {input('neutered', 'การทำหมัน', { options: NEUTER_OPTIONS, col: 'col-md-3' })}
                  {input('birthDate', 'วันเกิด (โดยประมาณ)', {
                    type: 'date',
                    hint: form.birthDate ? `อายุ ${ageText(form.birthDate)}` : undefined,
                  })}
                  {input('weight', 'น้ำหนัก (กก.)', { type: 'number', attrs: { min: 0, step: 0.1 }, placeholder: 'เช่น 8.5' })}
                  {input('color', 'สี / ลักษณะเด่น', { placeholder: 'เช่น ขาวน้ำตาล มีจุดที่หู' })}
                  {input('microchip', 'หมายเลขไมโครชิป', { placeholder: 'ถ้ามี' })}
                </div>
              </>
            )}

            {tab === 'health' && (
              <div className="row g-3">
                {input('allergies', 'แพ้ยา / แพ้อาหาร', { col: 'col-12', textarea: true, placeholder: 'เช่น แพ้ไก่, แพ้ยา Amoxicillin' })}
                {input('chronicDiseases', 'โรคประจำตัว', { textarea: true, placeholder: 'เช่น โรคไต, เบาหวาน' })}
                {input('medications', 'ยาที่ใช้ประจำ', { textarea: true, placeholder: 'ชื่อยา ขนาด ความถี่' })}
                {input('food', 'อาหารที่กิน', { textarea: true, placeholder: 'ยี่ห้อ ปริมาณ มื้อต่อวัน' })}
                {input('notes', 'หมายเหตุ / นิสัย', { textarea: true, placeholder: 'เช่น กลัวเสียงดัง ไม่ชอบให้จับขา' })}
              </div>
            )}

            {tab === 'vaccines' && (
              <RecordList
                rows={form.vaccines}
                onChange={setList('vaccines')}
                fields={VACCINE_FIELDS}
                newRow={newVaccine}
                addLabel="เพิ่มประวัติวัคซีน"
                emptyText="ยังไม่มีประวัติวัคซีน"
                emptyIcon="bi-capsule"
              />
            )}

            {tab === 'treatments' && (
              <RecordList
                rows={form.treatments}
                onChange={setList('treatments')}
                fields={TREATMENT_FIELDS}
                newRow={newTreatment}
                addLabel="เพิ่มประวัติการรักษา"
                emptyText="ยังไม่มีประวัติการรักษา"
                emptyIcon="bi-journal-medical"
              />
            )}

            {tab === 'parasites' && (
              <RecordList
                rows={form.parasites}
                onChange={setList('parasites')}
                fields={PARASITE_FIELDS}
                newRow={newParasite}
                addLabel="เพิ่มประวัติถ่ายพยาธิ / ป้องกันเห็บหมัด"
                emptyText="ยังไม่มีประวัติ"
                emptyIcon="bi-bug"
              />
            )}
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4">
            <Link to={existing ? `/pet-owner/my-pets/${existing.id}` : '/pet-owner/my-pets'} className="btn btn-soft">
              ยกเลิก
            </Link>
            <button type="submit" className="btn btn-sky">
              <i className="bi bi-check2 me-1" />
              {existing ? 'บันทึกการแก้ไข' : 'บันทึกสัตว์เลี้ยง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
