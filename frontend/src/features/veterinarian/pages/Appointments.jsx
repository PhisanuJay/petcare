import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppointments } from '../useAppointments.js';
import VetLayout from '../components/VetLayout.jsx';
import VetPageHeader from '../components/VetPageHeader.jsx';
import { BOOKING_STATUS, todayString } from '../../pet-owner/bookingOptions.js';
import { ageText, formatDate, speciesOf } from '../../pet-owner/petUtils.js';

/**
 * Appointments — Role: Veterinarian (มะแอ่ว)
 * Bookings made by pet owners. The Medical Assistant confirms / declines them, marks no-shows and
 * reschedules; the vet examines the pet, records the work and closes the case (completed).
 * Data comes from /api/veterinarian/appointments.
 */

/**
 * The API only returns bookings the Medical Assistant has already confirmed (confirmed, completed,
 * no_show), so there is no "waiting for confirmation" state on this page.
 */
const vetStatus = (status) => BOOKING_STATUS[status] ?? { label: status, tone: '' };

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'confirmed', label: 'รอตรวจ' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'other', label: 'ไม่มาตามนัด' },
];

const inFilter = (a, filter) => {
  if (filter === 'all') return true;
  if (filter === 'other') return a.status === 'no_show';
  return a.status === filter;
};

function addDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Where the vet records what was done, depending on the service the owner booked. */
function recordLink(a) {
  if (a.service === 'vaccine') return `/veterinarian/vaccination?pet=${a.pet.id}`;
  if (a.service === 'parasite') return `/veterinarian/medical-records?pet=${a.pet.id}&kind=parasite`;
  return `/veterinarian/medical-records?pet=${a.pet.id}`;
}

const STAGE_LABEL = {
  confirmed: { label: 'ยังไม่มาถึง', tone: '' },
  checked_in: { label: 'มาถึงแล้ว รอเรียกตรวจ', tone: 'warn' },
  in_treatment: { label: 'อยู่ในห้องตรวจ', tone: 'ok' },
};
const TRIAGE = {
  urgent: { label: 'เร่งด่วน', tone: 'danger' },
  soon: { label: 'ควรตรวจเร็ว', tone: 'warn' },
  normal: { label: 'ปกติ', tone: '' },
};
const VITAL_ROWS = [
  ['weight', 'น้ำหนัก', 'กก.'],
  ['temp', 'อุณหภูมิ', '°C'],
  ['heartRate', 'ชีพจร', 'ครั้ง/นาที'],
  ['respRate', 'หายใจ', 'ครั้ง/นาที'],
  ['bcs', 'BCS', '/9'],
  ['pain', 'ความเจ็บปวด', '/4'],
  ['mucous', 'เยื่อบุ', ''],
  ['crt', 'CRT', 'วินาที'],
];

/** What the Medical Assistant recorded at the front desk: triage, chief complaint and vitals. */
function VisitInfo({ visit }) {
  if (!visit) return null;
  const triage = TRIAGE[visit.triage];
  const vitals = VITAL_ROWS.filter(([key]) => visit.vitals?.[key] !== undefined && visit.vitals[key] !== '');
  if (!triage && !visit.chiefComplaint && vitals.length === 0) return null;
  return (
    <div className="small mt-2 p-2 rounded-3 border bg-light">
      <div className="fw-medium mb-1">
        <i className="bi bi-clipboard2-pulse me-1" />
        ข้อมูลจากผู้ช่วยสัตวแพทย์
        {triage && <span className={`tag ms-2 ${triage.tone}`}>{triage.label}</span>}
      </div>
      {visit.chiefComplaint && <div>อาการเบื้องต้น: {visit.chiefComplaint}</div>}
      {vitals.length > 0 && (
        <div className="text-muted">
          {vitals.map(([key, label, unit]) => `${label} ${visit.vitals[key]}${unit ? ` ${unit}` : ''}`).join(' · ')}
        </div>
      )}
    </div>
  );
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
  const status = vetStatus(a.status);
  const stage = a.status === 'confirmed' ? STAGE_LABEL[a.visit?.stage] : null;
  const inRoom = a.visit?.stage === 'in_treatment';
  return (
    <div className={`card-soft vet-appt st-${a.status} mb-3`}>
      <div className="d-flex flex-wrap align-items-start gap-3">
        <div className="appt-time">
          <div className="mitr fs-4 lh-sm">{a.time}</div>
          {showDate && <div className="small">{formatDate(a.date)}</div>}
        </div>

        <div className="flex-grow-1">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className="tag">{a.serviceLabel}</span>
            <span className={`tag ${status.tone}`}>{status.label}</span>
            {stage && <span className={`tag ${stage.tone}`}>{stage.label}</span>}
          </div>
          <PetInfo pet={a.pet} fallbackName={a.petName} />
          {a.note && (
            <div className="small mt-1">
              <i className="bi bi-chat-left-text me-1" />
              เจ้าของแจ้ง: {a.note}
            </div>
          )}
          <VisitInfo visit={a.visit} />
          {a.clinicNote && <div className="small text-muted">หมายเหตุคลินิก: {a.clinicNote}</div>}
        </div>

        <div className="d-flex flex-column gap-2">
          {['confirmed', 'completed'].includes(a.status) && a.pet && (
            <Link to={recordLink(a)} className="btn btn-soft btn-sm">
              <i className="bi bi-journal-plus me-1" />
              {a.service === 'vaccine' ? 'บันทึกการฉีดวัคซีน' : a.service === 'parasite' ? 'บันทึกการให้ยา' : 'บันทึกการรักษา'}
            </Link>
          )}
          {a.status === 'confirmed' && (
            <button
              type="button"
              className="btn btn-sky btn-sm"
              disabled={busy || !inRoom}
              title={inRoom ? '' : 'ปิดเคสได้หลังผู้ช่วยสัตวแพทย์ส่งเข้าห้องตรวจแล้ว'}
              onClick={() => onAction(a, 'completed')}>
              <i className="bi bi-check2-all me-1" />
              ตรวจเสร็จสิ้น
            </button>
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
    setBusyId(a.id);
    setActionError('');
    try {
      await setStatus(a.id, status);
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
        <VetPageHeader
          icon="bi-calendar2-check"
          title="นัดหมาย"
          subtitle="นัดที่ผู้ช่วยสัตวแพทย์มอบหมายให้คุณ บันทึกการรักษา และปิดเคสเมื่อตรวจเสร็จ"
          stats={[
            { icon: 'bi-hourglass-split', value: count('confirmed'), label: 'รอตรวจ' },
            { icon: 'bi-check2-all', value: count('completed'), label: 'เสร็จสิ้น' },
          ]}
        />

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

          <div className="vet-chips mt-3">
            {FILTERS.map((f) => (
              <button
                type="button"
                key={f.value}
                className={`btn btn-sm vet-chip ${filter === f.value ? 'btn-sky' : 'btn-soft'}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
                <span className="chip-count">{count(f.value)}</span>
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
