import { useEffect, useId, useState } from 'react';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';
import { usePets } from '../usePets.js';
import PetPhoto from './PetPhoto.jsx';
import { emptyPet, SPECIES } from '../petUtils.js';

export default function QuickAddPetModal({
  open,
  onClose,
  onCreated,
  title = 'เพิ่มสัตว์เลี้ยง',
  lead = 'กรอกขั้นต่ำแล้วบันทึก — แก้ไขรายละเอียดเพิ่มได้ที่หน้าสัตว์เลี้ยงของฉัน',
}) {
  const titleId = useId();
  const { addPet } = usePets();
  const [form, setForm] = useState(() => emptyPet());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setForm(emptyPet());
    setError('');
    setSaving(false);
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, saving]);

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const photo = await fileToResizedDataUrl(file, 500, 0.85);
      setForm((f) => ({ ...f, photo }));
      setError('');
    } catch (err) {
      setError(err.message || 'อัปโหลดรูปไม่สำเร็จ');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('กรุณากรอกชื่อสัตว์เลี้ยง');
      return;
    }
    const data = { ...form, name: form.name.trim() };
    delete data.id;
    delete data.ownerId;
    delete data.createdAt;
    delete data.updatedAt;
    setSaving(true);
    setError('');
    try {
      const pet = await addPet(data);
      onCreated?.(pet);
      onClose();
    } catch (err) {
      setError(err.message || 'บันทึกไม่สำเร็จ');
      setSaving(false);
    }
  }

  return (
    <div
      className="modal d-block quick-add-pet"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => !saving && onClose()}
    >
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content" style={{ borderRadius: 20, padding: '1.25rem 1.35rem' }}>
          <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
            <h2 id={titleId} className="h5 mb-0">
              <i className="bi bi-plus-circle me-2 text-primary" aria-hidden />
              {title}
            </h2>
            <button
              type="button"
              className="btn-close"
              aria-label="ปิด"
              disabled={saving}
              onClick={onClose}
            />
          </div>
          <p className="small text-muted mb-3">{lead}</p>

          {error && (
            <div className="alert alert-danger py-2 small" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="quick-add-pet__photo-row">
              <div className="quick-add-pet__photo-wrap position-relative">
                <PetPhoto pet={form} size="md" />
                <label className="upload-btn" title="เลือกรูปจากเครื่อง">
                  <i className="bi bi-camera" aria-hidden />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={handlePhoto}
                  />
                </label>
              </div>
              <div className="quick-add-pet__photo-copy">
                <span className="form-label d-block mb-1">รูปสัตว์เลี้ยง</span>
                <p className="small text-muted mb-0">
                  {form.photo ? 'มีรูปแล้ว — จะโชว์ในรายการจอง' : 'ไม่บังคับ — แตะไอคอนกล้องเพื่อเลือกรูป'}
                </p>
                {form.photo ? (
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-danger p-0 mt-1"
                    onClick={() => setForm((f) => ({ ...f, photo: '' }))}
                  >
                    ลบรูป
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="quick-pet-name">
                ชื่อสัตว์เลี้ยง <span className="text-danger">*</span>
              </label>
              <input
                id="quick-pet-name"
                className="form-control"
                value={form.name}
                onChange={set('name')}
                autoFocus
                placeholder="เช่น ดีดี้"
              />
            </div>
            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <label className="form-label" htmlFor="quick-pet-species">ชนิดสัตว์</label>
                <select id="quick-pet-species" className="form-select" value={form.species} onChange={set('species')}>
                  {SPECIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label" htmlFor="quick-pet-breed">สายพันธุ์</label>
                <input
                  id="quick-pet-breed"
                  className="form-control"
                  value={form.breed}
                  onChange={set('breed')}
                  placeholder="ไม่บังคับ"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="quick-pet-notes">หมายเหตุ / นิสัย</label>
              <textarea
                id="quick-pet-notes"
                className="form-control"
                rows={2}
                value={form.notes}
                onChange={set('notes')}
                placeholder="ไม่บังคับ"
              />
            </div>
            <div className="d-flex flex-wrap gap-2 justify-content-end">
              <button type="button" className="btn btn-soft" disabled={saving} onClick={onClose}>
                ยกเลิก
              </button>
              <button type="submit" className="btn btn-sky" disabled={saving}>
                {saving ? 'กำลังบันทึก…' : 'บันทึกและเลือก'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}