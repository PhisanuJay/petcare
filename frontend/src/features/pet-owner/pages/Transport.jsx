import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../usePets.js';
import { useTransportRequests } from '../useTransportRequests.js';
import { TRANSPORT_DIRECTIONS, TRANSPORT_STATUS } from '../transportOptions.js';
import { CLINIC_PHONE, availableSlots, todayString } from '../bookingOptions.js';
import { formatDate } from '../petUtils.js';

/**
 * Transport — Role: Pet Owner (มะแอ่ว)
 * Request pickup / drop-off of a pet and manage existing requests.
 * Saved by the backend (/api/pet-owner/transport/requests); status starts as "pending"
 * until the transport team confirms it. The fee is not defined yet, so none is shown.
 */

function TransportForm({ pets, user, onSubmit }) {
  const [form, setForm] = useState({
    petId: pets[0]?.id ?? '',
    direction: 'round_trip',
    date: '',
    time: '',
    address: user?.address ?? '',
    phone: user?.phone ?? '',
    note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const slots = availableSlots(form.date);
  const direction = TRANSPORT_DIRECTIONS.find((d) => d.value === form.direction);

  const set = (key) => (e) => {
    setDone(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  // Opening hours differ between weekdays and weekends, so a chosen time may no longer exist.
  const setDate = (e) => {
    const date = e.target.value;
    setDone(false);
    setForm((f) => ({ ...f, date, time: availableSlots(date).includes(f.time) ? f.time : '' }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date) return setError('กรุณาเลือกวันที่');
    if (!form.time) return setError('กรุณาเลือกเวลา');
    if (form.address.trim().length < 10) return setError('กรุณากรอกที่อยู่ให้ละเอียด');
    if (!/^0\d{8,9}$/.test(form.phone.replace(/[-\s]/g, ''))) return setError('เบอร์โทร 9-10 หลัก ขึ้นต้นด้วย 0');
    setSaving(true);
    setError('');
    try {
      await onSubmit(form);
      setForm((f) => ({ ...f, date: '', time: '', note: '' }));
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card-soft" onSubmit={handleSubmit}>
      <div className="section-label">
        <i className="bi bi-truck" />
        เรียกบริการรับ-ส่ง
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {done && <div className="alert alert-success py-2">ส่งคำขอแล้ว รอทีมงานติดต่อกลับเพื่อยืนยัน</div>}

      <div className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="tr-pet">สัตว์เลี้ยง</label>
          <select id="tr-pet" className="form-select" value={form.petId} onChange={set('petId')}>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="tr-dir">รูปแบบ</label>
          <select id="tr-dir" className="form-select" value={form.direction} onChange={set('direction')}>
            {TRANSPORT_DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {direction && <div className="form-text">{direction.desc}</div>}
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="tr-date">วันที่</label>
          <input
            id="tr-date"
            type="date"
            className="form-control"
            min={todayString()}
            value={form.date}
            onChange={setDate}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="tr-time">เวลานัดรับ</label>
          <select
            id="tr-time"
            className="form-select"
            value={form.time}
            onChange={set('time')}
            disabled={!form.date || slots.length === 0}
          >
            <option value="">{form.date ? 'เลือกเวลา' : 'เลือกวันที่ก่อน'}</option>
            {slots.map((t) => (
              <option key={t} value={t}>{t} น.</option>
            ))}
          </select>
          {form.date && slots.length === 0 && (
            <div className="form-text text-danger">วันนี้หมดเวลาให้บริการแล้ว กรุณาเลือกวันอื่น</div>
          )}
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="tr-addr">ที่อยู่สำหรับรับ-ส่ง</label>
          <textarea
            id="tr-addr"
            rows={3}
            maxLength={300}
            className="form-control"
            placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด และจุดสังเกต"
            value={form.address}
            onChange={set('address')}
          />
          <div className="form-text">
            ดึงจากโปรไฟล์ของคุณ แก้ไขได้ที่นี่โดยไม่เปลี่ยนข้อมูลในโปรไฟล์
          </div>
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="tr-phone">เบอร์โทรติดต่อ</label>
          <input
            id="tr-phone"
            type="tel"
            className="form-control"
            placeholder="08x-xxx-xxxx"
            value={form.phone}
            onChange={set('phone')}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="tr-note">หมายเหตุ</label>
          <input
            id="tr-note"
            type="text"
            maxLength={500}
            className="form-control"
            placeholder="ไม่บังคับ เช่น น้องกลัวรถ มีกรง"
            value={form.note}
            onChange={set('note')}
          />
        </div>
      </div>

      <div className="small text-muted mt-3">
        <i className="bi bi-info-circle me-1" />
        ค่าบริการประเมินโดยทีมงานหลังรับคำขอ ·{' '}
        <i className="bi bi-telephone me-1" />
        สอบถามเพิ่มเติม {CLINIC_PHONE}
      </div>

      <div className="text-end mt-3">
        <button type="submit" className="btn btn-sky" disabled={saving}>
          <i className="bi bi-check2 me-1" />
          {saving ? 'กำลังส่ง...' : 'ส่งคำขอ'}
        </button>
      </div>
    </form>
  );
}

function RequestItem({ request: r, onCancel, busy }) {
  const status = TRANSPORT_STATUS[r.status] ?? TRANSPORT_STATUS.pending;
  const direction = TRANSPORT_DIRECTIONS.find((d) => d.value === r.direction);
  const canCancel = r.status !== 'cancelled' && r.date >= todayString();

  return (
    <div className="tl-item">
      <div className="date">
        {formatDate(r.date)} · {r.time} น.
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="fw-medium">{r.petName}</span>
        <span className="tag">
          <i className={`bi ${direction?.icon ?? 'bi-truck'} me-1`} />
          {r.directionLabel}
        </span>
        <span className={`tag ${status.tone}`}>{status.label}</span>
      </div>
      <div className="small text-muted mt-1">
        <i className="bi bi-geo-alt me-1" />
        {r.address}
      </div>
      {r.note && <div className="small text-muted">{r.note}</div>}
      {canCancel && (
        <button
          type="button"
          className="btn btn-sm btn-soft-danger mt-2"
          disabled={busy}
          onClick={() => onCancel(r)}
        >
          ยกเลิกคำขอ
        </button>
      )}
    </div>
  );
}

export default function TransportPage() {
  const { currentUser } = useAuth();
  const { pets, loading: petsLoading, error: petsError } = usePets();
  const { requests, loading, error, reload, addRequest, cancelRequest } = useTransportRequests();
  const [cancelError, setCancelError] = useState('');
  const [busyId, setBusyId] = useState('');

  const today = todayString();
  const upcoming = requests.filter((r) => r.status !== 'cancelled' && r.date >= today);
  const history = requests.filter((r) => r.status === 'cancelled' || r.date < today).reverse();

  async function handleCancel(r) {
    const text = `ยกเลิกคำขอรับ-ส่งของ "${r.petName}" วันที่ ${formatDate(r.date)} เวลา ${r.time} น.?`;
    if (!window.confirm(text)) return;
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
            <h1>รับ-ส่งสัตว์เลี้ยง</h1>
            <p>ทีมงานไปรับ-ส่งน้องถึงบ้านอย่างปลอดภัย</p>
          </div>
        </div>

        {(petsError || error) && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{petsError || error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
          </div>
        )}

        {petsLoading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : pets.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-heart" />
            ต้องมีข้อมูลสัตว์เลี้ยงก่อนจึงจะเรียกบริการรับ-ส่งได้
            <div className="mt-3">
              <Link to="/pet-owner/my-pets/new" className="btn btn-sky">เพิ่มสัตว์เลี้ยง</Link>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            <div className="col-lg-7">
              <TransportForm pets={pets} user={currentUser} onSubmit={addRequest} />
            </div>

            <div className="col-lg-5">
              <div className="card-soft mb-4">
                <div className="section-label">
                  <i className="bi bi-calendar-event" />
                  คำขอที่กำลังจะถึง ({upcoming.length})
                </div>
                {cancelError && <div className="alert alert-danger py-2">{cancelError}</div>}
                {loading ? (
                  <div className="empty-box py-3">กำลังโหลด...</div>
                ) : upcoming.length === 0 ? (
                  <div className="empty-box py-3">
                    <i className="bi bi-truck" />
                    ยังไม่มีคำขอรับ-ส่ง
                  </div>
                ) : (
                  <div className="timeline">
                    {upcoming.map((r) => (
                      <RequestItem key={r.id} request={r} onCancel={handleCancel} busy={busyId === r.id} />
                    ))}
                  </div>
                )}
              </div>

              {history.length > 0 && (
                <div className="card-soft">
                  <div className="section-label">
                    <i className="bi bi-clock-history" />
                    ประวัติการรับ-ส่ง ({history.length})
                  </div>
                  <div className="timeline">
                    {history.map((r) => (
                      <RequestItem key={r.id} request={r} onCancel={handleCancel} busy={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
