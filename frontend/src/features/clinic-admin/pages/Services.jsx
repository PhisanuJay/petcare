import { useMemo, useState } from 'react';
import CaModal from '../components/CaModal.jsx';
import DataState, { useCaToast } from '../components/DataState.jsx';
import { caRequest } from '../data/caApi.js';
import { useCaResource } from '../data/useCaResource.js';

const EMPTY_FORM = {
  code: '',
  label: '',
  labelDog: '',
  labelCat: '',
  hint: '',
  icon: 'bi-calendar2-check',
  priceDog: '',
  priceCat: '',
  online: true,
  active: true,
  sortOrder: '100',
};

function baht(value) {
  return Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function toForm(service) {
  if (!service) return { ...EMPTY_FORM };
  return {
    code: service.code || '',
    label: service.label || '',
    labelDog: service.labelDog || '',
    labelCat: service.labelCat || '',
    hint: service.hint || '',
    icon: service.icon || 'bi-calendar2-check',
    priceDog: String(service.prices?.dog ?? ''),
    priceCat: String(service.prices?.cat ?? ''),
    online: service.online !== false,
    active: service.active !== false,
    sortOrder: String(service.sortOrder ?? 100),
  };
}

function toPayload(form, { includeCode = false } = {}) {
  const payload = {
    label: form.label.trim(),
    labelDog: form.labelDog.trim(),
    labelCat: form.labelCat.trim(),
    hint: form.hint.trim(),
    icon: form.icon.trim() || 'bi-calendar2-check',
    prices: {
      dog: Number(form.priceDog),
      cat: Number(form.priceCat),
    },
    online: Boolean(form.online),
    active: Boolean(form.active),
    sortOrder: Number(form.sortOrder) || 0,
  };
  if (includeCode) payload.code = form.code.trim().toLowerCase();
  return payload;
}

/**
 * Clinic Admin — service catalog & pricing
 */
export default function Services() {
  const { data, setData, loading, error, reload } = useCaResource('/services');
  const services = data?.services ?? [];
  const { show, toast } = useCaToast();

  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // 'create' | 'edit'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyCode, setBusyCode] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((svc) => (
      svc.code.includes(q)
      || svc.label.toLowerCase().includes(q)
      || (svc.labelDog || '').toLowerCase().includes(q)
      || (svc.labelCat || '').toLowerCase().includes(q)
    ));
  }, [services, query]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setModal('create');
  }

  function openEdit(service) {
    setEditing(service);
    setForm(toForm(service));
    setFormError('');
    setModal('edit');
  }

  function closeModal() {
    if (saving) return;
    setModal(null);
    setEditing(null);
    setFormError('');
  }

  function setField(key) {
    return (event) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    };
  }

  async function handleSave(event) {
    event.preventDefault();
    setFormError('');
    if (!form.label.trim()) {
      setFormError('กรุณาระบุชื่อบริการ');
      return;
    }
    if (modal === 'create' && !form.code.trim()) {
      setFormError('กรุณาระบุรหัสบริการ');
      return;
    }
    if (!Number.isFinite(Number(form.priceDog)) || Number(form.priceDog) < 0
      || !Number.isFinite(Number(form.priceCat)) || Number(form.priceCat) < 0) {
      setFormError('ราคาต้องเป็นตัวเลขไม่ติดลบ');
      return;
    }

    setSaving(true);
    try {
      if (modal === 'create') {
        const created = await caRequest('/services', {
          method: 'POST',
          body: toPayload(form, { includeCode: true }),
        });
        setData((prev) => ({
          services: [...(prev?.services || []).filter((s) => s.code !== created.code), created]
            .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'th')),
        }));
        show('เพิ่มบริการแล้ว');
      } else {
        const updated = await caRequest(`/services/${editing.code}`, {
          method: 'PATCH',
          body: toPayload(form),
        });
        setData((prev) => ({
          services: (prev?.services || []).map((s) => (s.code === updated.code ? updated : s)),
        }));
        show('บันทึกบริการแล้ว');
      }
      setModal(null);
      setEditing(null);
    } catch (err) {
      setFormError(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function patchFlags(service, patch) {
    setBusyCode(service.code);
    try {
      const updated = await caRequest(`/services/${service.code}`, {
        method: 'PATCH',
        body: patch,
      });
      setData((prev) => ({
        services: (prev?.services || []).map((s) => (s.code === updated.code ? updated : s)),
      }));
      show('อัปเดตสถานะแล้ว');
    } catch (err) {
      show(err.message || 'อัปเดตไม่สำเร็จ');
    } finally {
      setBusyCode('');
    }
  }

  return (
    <div>
      {toast}
      <div className="page-head">
        <div>
          <h1 className="mitr">บริการและราคา</h1>
          <p>เพิ่ม/แก้ไขบริการคลินิก ตั้งราคาแยกสุนัข–แมว และเปิดรับจองออนไลน์</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-soft btn-sm" disabled={loading} onClick={reload}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
            รีเฟรช
          </button>
          <button type="button" className="btn btn-sky btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            เพิ่มบริการ
          </button>
        </div>
      </div>

      <DataState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)}>
        <div className="card-soft mb-3">
          <label className="form-label" htmlFor="ca-svc-search">ค้นหา</label>
          <input
            id="ca-svc-search"
            className="form-control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ชื่อหรือรหัสบริการ"
          />
        </div>

        <div className="d-grid gap-2">
          {filtered.map((svc) => {
            const busy = busyCode === svc.code;
            return (
              <div key={svc.code} className="ca-list-item align-items-start">
                <div className="d-flex gap-3 min-w-0">
                  <span className="ca-brand-icon flex-shrink-0" aria-hidden="true">
                    <i className={`bi ${svc.icon || 'bi-calendar2-check'}`} />
                  </span>
                  <div className="min-w-0">
                    <div className="fw-medium">{svc.label}</div>
                    <div className="small text-muted">
                      รหัส <code>{svc.code}</code>
                      {svc.labelDog ? ` · สุนัข: ${svc.labelDog}` : ''}
                      {svc.labelCat ? ` · แมว: ${svc.labelCat}` : ''}
                    </div>
                    <div className="small mt-1">
                      สุนัข ฿{baht(svc.prices?.dog)} · แมว ฿{baht(svc.prices?.cat)}
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      <span className={`tag ${svc.active ? 'ok' : 'danger'}`}>
                        {svc.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                      <span className={`tag ${svc.online ? 'ok' : 'warn'}`}>
                        {svc.online ? 'เปิดจองออนไลน์' : 'ปิดจองออนไลน์'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="d-flex flex-column gap-2 align-items-stretch">
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => openEdit(svc)}>
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    disabled={busy}
                    onClick={() => patchFlags(svc, { online: !svc.online })}
                  >
                    {svc.online ? 'ปิดจองออนไลน์' : 'เปิดจองออนไลน์'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    disabled={busy}
                    onClick={() => patchFlags(svc, { active: !svc.active })}
                  >
                    {svc.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <div className="card-soft text-muted">ไม่พบบริการตามคำค้น</div>
          ) : null}
        </div>
      </DataState>

      <CaModal
        open={Boolean(modal)}
        title={modal === 'create' ? 'เพิ่มบริการ' : 'แก้ไขบริการ'}
        onClose={closeModal}
      >
        <form onSubmit={handleSave} className="d-grid gap-3">
          {formError ? (
            <div className="alert-soft danger" role="alert">
              <i className="bi bi-exclamation-circle" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          ) : null}

          {modal === 'create' ? (
            <div>
              <label className="form-label" htmlFor="ca-svc-code">รหัสบริการ</label>
              <input
                id="ca-svc-code"
                className="form-control"
                value={form.code}
                onChange={setField('code')}
                placeholder="เช่น dental_cleaning"
                required
              />
              <div className="small text-muted mt-1">ใช้ภาษาอังกฤษตัวเล็ก ตัวเลข หรือ _ เท่านั้น</div>
            </div>
          ) : (
            <div className="small text-muted">รหัส: <code>{editing?.code}</code></div>
          )}

          <div>
            <label className="form-label" htmlFor="ca-svc-label">ชื่อบริการ</label>
            <input id="ca-svc-label" className="form-control" value={form.label} onChange={setField('label')} required />
          </div>

          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label" htmlFor="ca-svc-label-dog">ชื่อสำหรับสุนัข (ถ้ามี)</label>
              <input id="ca-svc-label-dog" className="form-control" value={form.labelDog} onChange={setField('labelDog')} />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="ca-svc-label-cat">ชื่อสำหรับแมว (ถ้ามี)</label>
              <input id="ca-svc-label-cat" className="form-control" value={form.labelCat} onChange={setField('labelCat')} />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label" htmlFor="ca-svc-price-dog">ราคาสุนัข (บาท)</label>
              <input id="ca-svc-price-dog" type="number" min="0" step="1" className="form-control" value={form.priceDog} onChange={setField('priceDog')} required />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="ca-svc-price-cat">ราคาแมว (บาท)</label>
              <input id="ca-svc-price-cat" type="number" min="0" step="1" className="form-control" value={form.priceCat} onChange={setField('priceCat')} required />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="ca-svc-hint">คำอธิบายสั้น ๆ</label>
            <input id="ca-svc-hint" className="form-control" value={form.hint} onChange={setField('hint')} />
          </div>

          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label" htmlFor="ca-svc-icon">ไอคอน Bootstrap</label>
              <input id="ca-svc-icon" className="form-control" value={form.icon} onChange={setField('icon')} placeholder="bi-heart-pulse" />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="ca-svc-sort">ลำดับแสดง</label>
              <input id="ca-svc-sort" type="number" className="form-control" value={form.sortOrder} onChange={setField('sortOrder')} />
            </div>
          </div>

          <div className="d-flex flex-wrap gap-3">
            <div className="form-check form-switch">
              <input id="ca-svc-online" type="checkbox" className="form-check-input" checked={form.online} onChange={setField('online')} />
              <label className="form-check-label" htmlFor="ca-svc-online">เปิดจองออนไลน์</label>
            </div>
            <div className="form-check form-switch">
              <input id="ca-svc-active" type="checkbox" className="form-check-input" checked={form.active} onChange={setField('active')} />
              <label className="form-check-label" htmlFor="ca-svc-active">ใช้งานในระบบ</label>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-soft" onClick={closeModal} disabled={saving}>ยกเลิก</button>
            <button type="submit" className="btn btn-sky" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </CaModal>
    </div>
  );
}
