import { useState } from 'react';
import { useAppointments } from '../useAppointments.js';
import VetLayout from '../components/VetLayout.jsx';
import { BOOKING_STATUS, todayString } from '../../pet-owner/bookingOptions.js';
import { ageText, formatDate, speciesOf } from '../../pet-owner/petUtils.js';

/**
 * Appointments — Role: Veterinarian (มะแอ่ว)
 * Bookings made by pet owners: the vet confirms or declines new ones and marks confirmed ones
 * as completed or no-show. Data comes from /api/veterinarian/appointments.
 */

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอยืนยัน' },
  { value: 'confirmed', label: 'ยืนยันแล้ว' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'other', label: 'อื่นๆ' },
];

const inFilter = (a, filter) => {
  if (filter === 'all') return true;
  if (filter === 'other') return !['pending', 'confirmed', 'completed'].includes(a.status);
  return a.status === filter;
};

function addDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function PetInfo({ pet, fallbackName }) {
  if (!pet) {
    return <div className="fw-medium">{fallbackName} <span className="small text-muted">(ไม่พบข้อมูลสัตว์เลี้ยงแล้ว)</span></div>;
  }
  const species = speciesOf(pet.species);
  return (
    <div>
      <div className="fw-medium">
        {species.emoji} {pet.name}
        <span className="small text-muted ms-2">
          {species.label}
          {pet.breed ? ` · ${pet.breed}` : ''} · {ageText(pet.birthDate)}
          {pet.weight ? ` · ${pet.weight} กก.` : ''}
        </span>
      </div>
      {pet.allergies && (
        <div className="small text-danger">
          <i className="bi bi-exclamation-triangle me-1" />
          แพ้: {pet.allergies}
        </div>
      )}
      {pet.chronicDiseases && <div className="small text-muted">โรคประจำตัว: {pet.chronicDiseases}</div>}
      {pet.medications && <div className="small text-muted">ยาที่ใช้: {pet.medications}</div>}
    </div>
  );
}

function AppointmentCard({ appointment: a, showDate, busy, onAction }) {
  const status = BOOKING_STATUS[a.status] ?? { label: a.status, tone: '' };
  return (
    <div className="card-soft mb-3">
      <div className="d-flex flex-wrap align-items-start gap-3">
        <div className="text-center" style={{ minWidth: 72 }}>
          <div className="mitr fs-4">{a.time}</div>
          {showDate && <div className="small text-muted">{formatDate(a.date)}</div>}
        </div>

        <div className="flex-grow-1">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className="tag">{a.serviceLabel}</span>
            <span className={`tag ${status.tone}`}>{status.label}</span>
          </div>
          <PetInfo pet={a.pet} fallbackName={a.petName} />
          {a.note && (
            <div className="small mt-1">
              <i className="bi bi-chat-left-text me-1" />
              เจ้าของแจ้ง: {a.note}
            </div>
          )}
          {a.clinicNote && <div className="small text-muted">หมายเหตุคลินิก: {a.clinicNote}</div>}
        </div>

        <div className="d-flex flex-column gap-2">
          {a.status === 'pending' && (
            <>
              <button type="button" className="btn btn-sky btn-sm" disabled={busy} onClick={() => onAction(a, 'confirmed')}>
                <i className="bi bi-check2 me-1" />
                ยืนยันนัด
              </button>
              <button type="button" className="btn btn-soft-danger btn-sm" disabled={busy} onClick={() => onAction(a, 'rejected')}>
                ปฏิเสธ
              </button>
            </>
          )}
          {a.status === 'confirmed' && (
            <>
              <button type="button" className="btn btn-sky btn-sm" disabled={busy} onClick={() => onAction(a, 'completed')}>
                <i className="bi bi-check2-all me-1" />
                ตรวจเสร็จสิ้น
              </button>
              <button type="button" className="btn btn-soft-danger btn-sm" disabled={busy} onClick={() => onAction(a, 'no_show')}>
                ไม่มาตามนัด
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const [date, setDate] = useState(todayString());
  const [allDays, setAllDays] = useState(false);
  const [filter, setFilter] = useState('all');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const { appointments, loading, error, reload, setStatus } = useAppointments(allDays ? '' : date);

  const shown = appointments.filter((a) => inFilter(a, filter));
  const count = (f) => appointments.filter((a) => inFilter(a, f)).length;

  async function handleAction(a, status) {
    let note = '';
    if (status === 'rejected') {
      const reason = window.prompt(`เหตุผลที่ไม่สามารถรับนัดของ "${a.petName}" (แสดงให้เจ้าของเห็น ไม่บังคับ)`, '');
      if (reason === null) return;
      note = reason;
    } else if (status === 'no_show' && !window.confirm(`บันทึกว่า "${a.petName}" ไม่มาตามนัด?`)) {
      return;
    }
    setBusyId(a.id);
    setActionError('');
    try {
      await setStatus(a.id, status, note);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <VetLayout>
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>นัดหมาย</h1>
            <p>นัดที่เจ้าของสัตว์เลี้ยงจองเข้ามา ยืนยัน หรือบันทึกผลการนัด</p>
          </div>
        </div>

        <div className="card-soft mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className="btn btn-soft btn-sm"
              disabled={allDays}
              onClick={() => setDate((d) => addDays(d, -1))}
              aria-label="วันก่อนหน้า"
            >
              <i className="bi bi-chevron-left" />
            </button>
            <input
              type="date"
              className="form-control"
              style={{ maxWidth: 190 }}
              value={date}
              disabled={allDays}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="วันที่"
            />
            <button
              type="button"
              className="btn btn-soft btn-sm"
              disabled={allDays}
              onClick={() => setDate((d) => addDays(d, 1))}
              aria-label="วันถัดไป"
            >
              <i className="bi bi-chevron-right" />
            </button>
            <button type="button" className="btn btn-soft btn-sm" disabled={allDays} onClick={() => setDate(todayString())}>
              วันนี้
            </button>
            <div className="form-check ms-md-3">
              <input
                id="all-days"
                type="checkbox"
                className="form-check-input"
                checked={allDays}
                onChange={(e) => setAllDays(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="all-days">ดูทุกวัน</label>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mt-3">
            {FILTERS.map((f) => (
              <button
                type="button"
                key={f.value}
                className={`btn btn-sm ${filter === f.value ? 'btn-sky' : 'btn-soft'}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label} ({count(f.value)})
              </button>
            ))}
          </div>
        </div>

        {(error || actionError) && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{error || actionError}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
          </div>
        )}

        {loading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : shown.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-calendar-x" />
            ไม่มีนัดหมาย{allDays ? '' : `ในวันที่ ${formatDate(date)}`}
          </div>
        ) : (
          shown.map((a) => (
            <AppointmentCard key={a.id} appointment={a} showDate={allDays} busy={busyId === a.id} onAction={handleAction} />
          ))
        )}
      </div>
    </div>
    </VetLayout>
  );
}
