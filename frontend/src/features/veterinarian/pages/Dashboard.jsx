import { useState } from 'react';
import { Link } from 'react-router-dom';
import VetLayout from '../components/VetLayout.jsx';
import DayChart from '../components/DayChart.jsx';
import { useAppointments } from '../useAppointments.js';
import { useDueVaccines } from '../useVaccination.js';
import { readVetName } from '../vetName.js';
import { BOOKING_STATUS, todayString } from '../../pet-owner/bookingOptions.js';
import { daysUntil, formatDate, reminderText, speciesOf } from '../../pet-owner/petUtils.js';

/**
 * Veterinarian Dashboard — Role: Veterinarian (มะแอ่ว)
 * The day at a glance: today's appointments (finish them here), upcoming appointments, vaccines that
 * are due, and the load for the coming week. Only bookings the Medical Assistant confirmed appear.
 * Built from /api/veterinarian/appointments and /vaccination/due (no extra endpoint).
 */

const pad = (n) => String(n).padStart(2, '0');
const toDateString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (dateString, days) => {
  const [y, m, d] = dateString.split('-').map(Number);
  return toDateString(new Date(y, m - 1, d + days));
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'สวัสดีตอนเช้า';
  if (hour < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
};

const todayLong = () =>
  new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Bookings that still occupy a slot in the schedule. */
const isActive = (a) => !['cancelled', 'rejected'].includes(a.status);

function Tile({ to, icon, bg, fg, value, label, sub }) {
  return (
    <div className="col-6 col-xl-3">
      <Link to={to} className="vet-tile">
        <span className="tile-icon" style={{ background: bg, color: fg }}>
          <i className={`bi ${icon}`} />
        </span>
        <div className="tile-num mt-2">{value}</div>
        <div className="tile-label">{label}</div>
        <div className="tile-sub">{sub}</div>
      </Link>
    </div>
  );
}

function Panel({ icon, title, action, children }) {
  return (
    <div className="card-soft h-100">
      <div className="d-flex align-items-start justify-content-between">
        <div className="section-label">
          <i className={`bi ${icon}`} />
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const Empty = ({ icon, text }) => (
  <div className="empty-box py-3">
    <i className={`bi ${icon}`} />
    {text}
  </div>
);

function PetAvatar({ pet, fallback }) {
  return <span className="vet-avatar">{speciesOf(pet?.species ?? fallback).emoji}</span>;
}

function SlotAction({ a, busy, onAction }) {
  // Confirming is the Medical Assistant's job (only confirmed bookings reach this page); the vet closes the case.
  if (a.status === 'confirmed') {
    return (
      <button type="button" className="btn btn-sky btn-sm" disabled={busy} onClick={() => onAction(a, 'completed')}>
        <i className="bi bi-check2-all me-1" />
        ตรวจเสร็จสิ้น
      </button>
    );
  }
  return null;
}

export default function VeterinarianDashboardPage() {
  const today = todayString();
  const { appointments, loading, error, reload, setStatus } = useAppointments('');
  const due = useDueVaccines(30);
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');

  const vetName = readVetName();
  const active = appointments.filter(isActive);

  const todays = appointments.filter((a) => a.date === today && isActive(a)).sort((x, y) => x.time.localeCompare(y.time));
  const todayDone = todays.filter((a) => a.status === 'completed' || a.status === 'no_show').length;
  // Confirmed by the Medical Assistant, from tomorrow on (today's are in the schedule above).
  const upcoming = appointments
    .filter((a) => a.status === 'confirmed' && a.date > today)
    .sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`));

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return {
      key: date,
      label: i === 0 ? 'วันนี้' : `${Number(date.slice(8))}/${Number(date.slice(5, 7))}`,
      title: formatDate(date),
      count: active.filter((a) => a.date === date).length,
    };
  });
  const weekTotal = week.reduce((sum, d) => sum + d.count, 0);
  const overdueVaccines = due.due.filter((d) => d.status === 'overdue').length;

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

  const remaining = todays.length - todayDone;

  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="vet-hero mb-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <div className="hero-date">
                  <i className="bi bi-calendar3 me-1" />
                  {todayLong()}
                </div>
                <h1 className="mb-1">
                  {greeting()}
                  {vetName ? ` คุณหมอ${vetName}` : ' คุณหมอ'}
                </h1>
                <div className="hero-sub">
                  {loading
                    ? 'กำลังโหลดตารางงานของวันนี้...'
                    : todays.length === 0
                      ? 'วันนี้ยังไม่มีนัดหมาย'
                      : `วันนี้มี ${todays.length} นัด${remaining > 0 ? ` เหลืออีก ${remaining} นัด` : ' ดำเนินการครบแล้ว'}`}
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <Link to="/veterinarian/medical-records" className="btn btn-hero">
                  <i className="bi bi-journal-plus me-1" />
                  บันทึกการรักษา
                </Link>
                <Link to="/veterinarian/appointments" className="btn btn-hero-ghost">
                  ดูนัดหมายทั้งหมด
                </Link>
              </div>
            </div>
          </div>

          {(error || actionError) && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
              <span>{error || actionError}</span>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
            </div>
          )}

          <div className="row g-3 mb-4">
            <Tile
              to="/veterinarian/appointments"
              icon="bi-calendar2-check"
              bg="#dcecfc"
              fg="#2f7fc8"
              value={todays.length}
              label="นัดหมายวันนี้"
              sub={`ดำเนินการแล้ว ${todayDone} นัด`}
            />
            <Tile
              to="/veterinarian/appointments"
              icon="bi-hourglass-split"
              bg="#fff1c9"
              fg="#c48f00"
              value={remaining}
              label="รอตรวจวันนี้"
              sub={remaining ? 'ยืนยันแล้ว รอตรวจ' : 'ไม่มีนัดค้าง'}
            />
            <Tile
              to="/veterinarian/vaccination"
              icon="bi-capsule"
              bg="#dff5e8"
              fg="#2a9d64"
              value={due.due.length}
              label="วัคซีนใกล้ถึงกำหนด"
              sub={overdueVaccines ? `เลยกำหนดแล้ว ${overdueVaccines} รายการ` : 'ภายใน 30 วัน'}
            />
            <Tile
              to="/veterinarian/reports"
              icon="bi-graph-up"
              bg="#e6e3ff"
              fg="#5b52d6"
              value={weekTotal}
              label="นัด 7 วันข้างหน้า"
              sub="ดูรายงานเต็ม"
            />
          </div>

          <div className="row g-4 mb-4">
            <div className="col-lg-7">
              <Panel
                icon="bi-clock-history"
                title="ตารางงานวันนี้"
                action={<Link to="/veterinarian/appointments" className="small text-decoration-none">จัดการนัดหมาย</Link>}
              >
                {loading ? (
                  <div className="empty-box py-3">กำลังโหลด...</div>
                ) : todays.length === 0 ? (
                  <Empty icon="bi-cup-hot" text="วันนี้ไม่มีนัดหมาย พักผ่อนได้เลย" />
                ) : (
                  todays.map((a) => {
                    const status = BOOKING_STATUS[a.status] ?? { label: a.status, tone: '' };
                    const done = a.status === 'completed' || a.status === 'no_show';
                    return (
                      <div key={a.id} className={`vet-slot ${done ? 'done' : ''}`}>
                        <div className="slot-time">{a.time}</div>
                        <div className="slot-card">
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <PetAvatar pet={a.pet} fallback={a.petSpecies} />
                            <div className="flex-grow-1">
                              <div className="fw-medium">
                                {a.pet?.name ?? a.petName}
                                {a.pet?.allergies && (
                                  <i className="bi bi-exclamation-triangle-fill ms-2 text-danger" title={`แพ้: ${a.pet.allergies}`} />
                                )}
                              </div>
                              <div className="small text-muted">{a.serviceLabel}</div>
                            </div>
                            <span className={`tag ${status.tone}`}>{status.label}</span>
                          </div>
                          {a.note && <div className="small mt-1"><i className="bi bi-chat-left-text me-1" />{a.note}</div>}
                          <div className="mt-2">
                            <SlotAction a={a} busy={busyId === a.id} onAction={handleAction} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </Panel>
            </div>

            <div className="col-lg-5">
              <div className="d-grid gap-4">
                <Panel icon="bi-bar-chart" title="ภาระงาน 7 วันข้างหน้า">
                  {loading ? (
                    <div className="empty-box py-3">กำลังโหลด...</div>
                  ) : (
                    <DayChart columns={week} highlightKey={today} compact emptyText="ยังไม่มีนัดหมายในสัปดาห์นี้" />
                  )}
                </Panel>

                <Panel
                  icon="bi-bell"
                  title="วัคซีนใกล้ถึงกำหนด"
                  action={<Link to="/veterinarian/vaccination" className="small text-decoration-none">ดูทั้งหมด</Link>}
                >
                  {due.loading ? (
                    <div className="empty-box py-3">กำลังโหลด...</div>
                  ) : due.due.length === 0 ? (
                    <Empty icon="bi-check2-circle" text="ไม่มีวัคซีนที่ใกล้ถึงหรือเลยกำหนด" />
                  ) : (
                    <div className="d-grid gap-2">
                      {due.due.slice(0, 4).map((d) => (
                        <Link
                          key={`${d.petId}-${d.name}-${d.nextDate}`}
                          to={`/veterinarian/vaccination?pet=${d.petId}&vaccine=${encodeURIComponent(d.name)}`}
                          className="vet-quick"
                        >
                          <span className="vet-avatar">{speciesOf(d.petSpecies).emoji}</span>
                          <span className="flex-grow-1">
                            <span className="fw-medium d-block">{d.petName}</span>
                            <span className="small text-muted">{d.name}</span>
                          </span>
                          <span className={`tag ${d.status === 'overdue' ? 'danger' : 'warn'}`}>
                            {reminderText({ days: daysUntil(d.nextDate) })}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-7">
              <Panel
                icon="bi-hourglass-split"
                title={`นัดที่ยืนยันแล้ว (${upcoming.length})`}
                action={<Link to="/veterinarian/appointments" className="small text-decoration-none">ดูทั้งหมด</Link>}
              >
                {loading ? (
                  <div className="empty-box py-3">กำลังโหลด...</div>
                ) : upcoming.length === 0 ? (
                  <Empty icon="bi-inbox" text="ไม่มีนัดล่วงหน้าที่ยืนยันแล้ว" />
                ) : (
                  <div className="d-grid gap-2">
                    {upcoming.slice(0, 5).map((a) => (
                      <div key={a.id} className="vet-quick">
                        <PetAvatar pet={a.pet} fallback={a.petSpecies} />
                        <span className="flex-grow-1">
                          <span className="fw-medium d-block">{a.pet?.name ?? a.petName}</span>
                          <span className="small text-muted">
                            {formatDate(a.date)} · {a.time} น. · {a.serviceLabel}
                          </span>
                        </span>
                        <span className="tag sky">ยืนยันแล้ว</span>
                      </div>
                    ))}
                    {upcoming.length > 5 && <div className="small text-muted">และอีก {upcoming.length - 5} รายการ</div>}
                  </div>
                )}
              </Panel>
            </div>

            <div className="col-lg-5">
              <Panel icon="bi-lightning-charge" title="ทางลัด">
                <div className="d-grid gap-2">
                  <Link to="/veterinarian/medical-records" className="vet-quick">
                    <i className="bi bi-journal-medical" />
                    <span>บันทึกการตรวจ / รักษา</span>
                  </Link>
                  <Link to="/veterinarian/vaccination" className="vet-quick">
                    <i className="bi bi-capsule" />
                    <span>บันทึกการฉีดวัคซีน</span>
                  </Link>
                  <Link to="/veterinarian/medical-records?kind=parasite" className="vet-quick">
                    <i className="bi bi-bug" />
                    <span>บันทึกการให้ยาถ่ายพยาธิ</span>
                  </Link>
                  <Link to="/veterinarian/patients" className="vet-quick">
                    <i className="bi bi-heart" />
                    <span>ค้นหาคนไข้</span>
                  </Link>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </VetLayout>
  );
}
