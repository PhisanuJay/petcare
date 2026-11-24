import { useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useAdoption } from '../useAdoption.js';
import {
  ADOPTION_STATUS,
  EXPERIENCE_OPTIONS,
  HOUSING_OPTIONS,
  adoptionEmoji,
} from '../adoptionOptions.js';
import { SEX_OPTIONS, formatDate, labelOf } from '../petUtils.js';

/**
 * Adoption — Role: Pet Owner (มะแอ่ว)
 * Browse animals waiting for a home and send an adoption request.
 * The animal list is a temporary sample list from the backend (see adoptionAnimals.js) until the
 * Adoption role provides real data. Requests are saved at /api/pet-owner/adoption/requests.
 */

function AdoptionForm({ animal, user, onSubmit, onClose }) {
  const [form, setForm] = useState({
    fullName: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    housing: 'condo',
    hasOtherPets: 'no',
    experience: 'none',
    reason: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.fullName.trim().length < 2) return setError('กรุณากรอกชื่อ-นามสกุล');
    if (!/^0\d{8,9}$/.test(form.phone.replace(/[-\s]/g, ''))) return setError('เบอร์โทร 9-10 หลัก ขึ้นต้นด้วย 0');
    if (form.address.trim().length < 10) return setError('กรุณากรอกที่อยู่ให้ละเอียด');
    if (form.reason.trim().length < 10) return setError('กรุณาเล่าเหตุผลที่อยากรับเลี้ยงอย่างน้อย 10 ตัวอักษร');
    setSaving(true);
    setError('');
    try {
      await onSubmit({ ...form, animalId: animal.id, hasOtherPets: form.hasOtherPets === 'yes' });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="card-soft" onSubmit={handleSubmit}>
      <div className="d-flex align-items-start justify-content-between">
        <div className="section-label">
          <i className="bi bi-file-earmark-text" />
          ขอรับเลี้ยง {animal.name}
        </div>
        <button type="button" className="btn-close" aria-label="ปิด" onClick={onClose} />
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="ad-name">ชื่อ-นามสกุล</label>
          <input id="ad-name" className="form-control" value={form.fullName} onChange={set('fullName')} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="ad-phone">เบอร์โทรติดต่อ</label>
          <input id="ad-phone" type="tel" className="form-control" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="ad-addr">ที่อยู่ปัจจุบัน</label>
          <textarea
            id="ad-addr"
            rows={2}
            maxLength={300}
            className="form-control"
            value={form.address}
            onChange={set('address')}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="ad-housing">ประเภทที่พักอาศัย</label>
          <select id="ad-housing" className="form-select" value={form.housing} onChange={set('housing')}>
            {HOUSING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="ad-pets">มีสัตว์เลี้ยงอื่นอยู่แล้วไหม</label>
          <select id="ad-pets" className="form-select" value={form.hasOtherPets} onChange={set('hasOtherPets')}>
            <option value="no">ไม่มี</option>
            <option value="yes">มี</option>
          </select>
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="ad-exp">ประสบการณ์การเลี้ยงสัตว์</label>
          <select id="ad-exp" className="form-select" value={form.experience} onChange={set('experience')}>
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="ad-reason">เหตุผลที่อยากรับเลี้ยง</label>
          <textarea
            id="ad-reason"
            rows={3}
            maxLength={1000}
            className="form-control"
            placeholder="เล่าให้ทีมงานฟังว่าทำไมอยากรับน้องไปอยู่ด้วย และจะดูแลน้องอย่างไร"
            value={form.reason}
            onChange={set('reason')}
          />
        </div>
      </div>

      <div className="small text-muted mt-3">
        <i className="bi bi-info-circle me-1" />
        ทีมงานจะติดต่อกลับเพื่อพูดคุย และอาจนัดเยี่ยมบ้านก่อนตัดสินใจ
      </div>

      <div className="text-end mt-3">
        <button type="submit" className="btn btn-sky" disabled={saving}>
          <i className="bi bi-check2 me-1" />
          {saving ? 'กำลังส่ง...' : 'ส่งคำขอรับเลี้ยง'}
        </button>
      </div>
    </form>
  );
}

function AnimalCard({ animal, requested, onChoose }) {
  return (
    <div className="col-sm-6 col-xl-4">
      <div className="pet-card text-center align-items-center h-100" style={{ cursor: 'default' }}>
        <span className="pet-photo" style={{ fontSize: '2.6rem' }}>{adoptionEmoji(animal.species)}</span>
        <div className="mitr fs-5 mt-2">{animal.name}</div>
        <div className="small text-muted mb-2">
          {animal.breed} · {labelOf(SEX_OPTIONS, animal.sex)} · {animal.age}
        </div>
        <div className="small mb-2">{animal.personality}</div>
        <div className="mb-3">
          {animal.tags.map((t) => (
            <span className="tag ok" key={t}>{t}</span>
          ))}
        </div>
        {requested ? (
          <span className="tag sky mt-auto">ยื่นคำขอแล้ว</span>
        ) : (
          <button type="button" className="btn btn-sky btn-sm mt-auto" onClick={() => onChoose(animal)}>
            <i className="bi bi-heart me-1" />
            ขอรับเลี้ยง
          </button>
        )}
      </div>
    </div>
  );
}

function RequestItem({ request: r, onCancel, busy }) {
  const status = ADOPTION_STATUS[r.status] ?? { label: r.status, tone: 'sky' };
  return (
    <div className="tl-item">
      <div className="date">ยื่นเมื่อ {formatDate(r.createdAt)}</div>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="fw-medium">{r.animalName}</span>
        <span className={`tag ${status.tone}`}>{status.label}</span>
      </div>
      {r.status === 'pending' && (
        <button type="button" className="btn btn-sm btn-soft-danger mt-2" disabled={busy} onClick={() => onCancel(r)}>
          ยกเลิกคำขอ
        </button>
      )}
    </div>
  );
}

export default function AdoptionPage() {
  const { currentUser } = useAuth();
  const { animals, requests, loading, error, reload, addRequest, cancelRequest } = useAdoption();
  const [selected, setSelected] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [busyId, setBusyId] = useState('');
  const formRef = useRef(null);

  const requestedIds = new Set(requests.filter((r) => r.status !== 'cancelled').map((r) => r.animalId));

  function choose(animal) {
    setSelected(animal);
    // The form appears after render; scroll to it on the next frame.
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function handleCancel(r) {
    if (!window.confirm(`ยกเลิกคำขอรับเลี้ยง "${r.animalName}"?`)) return;
    setBusyId(r.id);
    setCancelError('');
    try {
      await cancelRequest(r.id);
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>หาบ้านให้น้อง</h1>
            <p>น้องๆ ที่กำลังรอครอบครัวใหม่ เลือกน้องที่ใช่แล้วส่งคำขอรับเลี้ยงได้เลย</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
          </div>
        )}

        {loading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="row g-4">
            <div className="col-lg-8">
              {animals.length === 0 ? (
                <div className="card-soft empty-box">
                  <i className="bi bi-house-heart" />
                  ตอนนี้ยังไม่มีน้องที่รอรับเลี้ยง
                </div>
              ) : (
                <div className="row g-4">
                  {animals.map((a) => (
                    <AnimalCard key={a.id} animal={a} requested={requestedIds.has(a.id)} onChoose={choose} />
                  ))}
                </div>
              )}
            </div>

            <div className="col-lg-4">
              <div ref={formRef} style={{ scrollMarginTop: 90 }}>
                {selected && !requestedIds.has(selected.id) && (
                  <div className="mb-4">
                    <AdoptionForm
                      key={selected.id}
                      animal={selected}
                      user={currentUser}
                      onSubmit={addRequest}
                      onClose={() => setSelected(null)}
                    />
                  </div>
                )}
              </div>

              <div className="card-soft">
                <div className="section-label">
                  <i className="bi bi-clipboard-heart" />
                  คำขอของฉัน ({requests.length})
                </div>
                {cancelError && <div className="alert alert-danger py-2">{cancelError}</div>}
                {requests.length === 0 ? (
                  <div className="empty-box py-3">
                    <i className="bi bi-heart" />
                    ยังไม่มีคำขอรับเลี้ยง
                  </div>
                ) : (
                  <div className="timeline">
                    {requests.map((r) => (
                      <RequestItem key={r.id} request={r} onCancel={handleCancel} busy={busyId === r.id} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
