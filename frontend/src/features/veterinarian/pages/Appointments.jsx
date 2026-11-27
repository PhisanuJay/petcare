import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppointments } from '../useAppointments.js';
import VetLayout from '../components/VetLayout.jsx';
import VetPageHeader from '../components/VetPageHeader.jsx';
import RecordVisitModal from '../components/RecordVisitModal.jsx';
import { BOOKING_STATUS, todayString } from '../../pet-owner/bookingOptions.js';
import { ageText, formatDate, speciesOf } from '../../pet-owner/petUtils.js';

const RECORDED_APPT_KEY = 'petcare.vet.recorded-appointments';

function readRecordedAppointmentIds() {
  try {
    const raw = sessionStorage.getItem(RECORDED_APPT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeRecordedAppointmentIds(ids) {
  try {
    sessionStorage.setItem(RECORDED_APPT_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

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
  { value: 'other', label: 'ไม่มาตามนัด' },
];

const inFilter = (a, filter) => {
  if (a.status === 'completed') return false;
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

function isVaccineService(service) {
  return ['vaccine', 'vaccine_combo', 'vaccine_rabies'].includes(service);
}

function isParasiteService(service) {
  return ['parasite', 'deworming', 'flea_prevention'].includes(service);
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
        ข้อมูลจากแอดมินคลินิก
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

function AppointmentCard({ appointment: a, showDate, busy, onAction, onRecord, recorded }) {
  const status = vetStatus(a.status);
  const stage = a.status === 'confirmed' ? STAGE_LABEL[a.visit?.stage] : null;
  const visitStage = a.visit?.stage;
  const inRoom = visitStage === 'in_treatment';
  const arrived = visitStage === 'checked_in' || visitStage === 'in_treatment';
  const canRecord = Boolean(a.pet && a.status === 'confirmed' && arrived && !recorded);
  const vaccine = isVaccineService(a.service);
  const recordLabel = vaccine
    ? 'บันทึกการฉีดวัคซีน'
    : isParasiteService(a.service)
      ? 'บันทึกการให้ยา'
      : 'ตรวจและบันทึกการรักษา';

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
            {recorded && a.status === 'confirmed' && (
              <span className="tag ok">บันทึกแล้ว</span>
            )}
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
          {canRecord && vaccine && (
            <Link to={`/veterinarian/vaccination?pet=${a.pet.id}`} className="btn btn-soft btn-sm">
              <i className="bi bi-journal-plus me-1" />
              {recordLabel}
            </Link>
          )}
          {canRecord && !vaccine && (
            <button type="button" className="btn btn-soft btn-sm" onClick={() => onRecord(a)}>
              <i className="bi bi-journal-plus me-1" />
              {recordLabel}
            </button>
          )}
          {a.status === 'confirmed' && recorded && (
            <button
              type="button"
              className="btn btn-sky btn-sm"
              disabled={busy || !inRoom}
              title={inRoom ? '' : 'ปิดเคสได้หลังแอดมินคลินิกส่งเข้าห้องตรวจแล้ว'}
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
  const [filter, setFilter] = useState('all');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [recordTarget, setRecordTarget] = useState(null);
  const [recordNotice, setRecordNotice] = useState('');
  const [recordedIds, setRecordedIds] = useState(readRecordedAppointmentIds);
  const { appointments, loading, error, reload, setStatus } = useAppointments(date);

  const openAppointments = appointments.filter((a) => a.status !== 'completed');
  const shown = openAppointments.filter((a) => inFilter(a, filter));
  const count = (f) => openAppointments.filter((a) => inFilter(a, f)).length;

  function markAppointmentRecorded(appointmentId) {
    if (!appointmentId) return;
    setRecordedIds((prev) => {
      const next = new Set(prev);
      next.add(String(appointmentId));
      writeRecordedAppointmentIds(next);
      return next;
    });
  }

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

  async function handleRecordSaved() {
    const appointmentId = recordTarget?.id;
    setRecordTarget(null);
    markAppointmentRecorded(appointmentId);
    setRecordNotice('บันทึกเรียบร้อยแล้ว');
  }

  return (
    <VetLayout>
    <div className="page-wrap">
      <div className="container">
        <VetPageHeader
          icon="bi-calendar2-check"
          title="นัดหมาย"
          subtitle="นัดที่แอดมินคลินิกมอบหมายให้คุณ บันทึกการรักษาที่นี่ และปิดเคสเมื่อตรวจเสร็จ"
          stats={[
            { icon: 'bi-hourglass-split', value: count('confirmed'), label: 'รอตรวจ' },
            { icon: 'bi-list-ul', value: count('all'), label: 'นัดที่ยังเปิดอยู่' },
          ]}
        />

        <div className="card-soft mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className="btn btn-soft btn-sm"
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
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="วันที่"
            />
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={() => setDate((d) => addDays(d, 1))}
              aria-label="วันถัดไป"
            >
              <i className="bi bi-chevron-right" />
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setDate(todayString())}>
              วันนี้
            </button>
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
        {recordNotice && (
          <div className="alert alert-success d-flex align-items-center justify-content-between" role="status">
            <span>{recordNotice}</span>
            <button type="button" className="btn btn-sm btn-outline-success" onClick={() => setRecordNotice('')}>
              ปิด
            </button>
          </div>
        )}

        {loading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : shown.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-calendar-x" />
            ไม่มีนัดหมายในวันที่ {formatDate(date)}
          </div>
        ) : (
          shown.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              busy={busyId === a.id}
              onAction={handleAction}
              onRecord={setRecordTarget}
              recorded={recordedIds.has(String(a.id))}
            />
          ))
        )}
      </div>
    </div>

    <RecordVisitModal
      appointment={recordTarget}
      onClose={() => setRecordTarget(null)}
      onSaved={handleRecordSaved}
    />
    </VetLayout>
  );
}
