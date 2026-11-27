import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import MaDataState from '../components/MaDataState.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import {
  apptVetId,
  apptVetName,
  closureFor,
  hoursForMeta,
  isSameVet,
  vetList,
  vetsOnDutyFor,
} from '../data/clinicMeta.js';
import {
  BOOKING_SERVICES,
  OPENING_HOURS,
  STAGE_META,
  TRIAGE_LEVELS,
  minutesToTime,
  offsetDateKey,
  timeToMinutes,
  toDateKey,
} from '../data/constants.js';
import { maRequest } from '../data/maApi.js';
import { suggestSlots } from '../data/schedule.js';
import {
  awaitingTriage,
  completedToday,
  formatWaitText,
  inTreatment,
  lateArrivals,
  needsContact,
  pendingBookings,
  readyForVet,
  relativeTimeLabel,
  todayAppointments,
  waitMinutes,
} from '../data/selectors.js';
import { useAppointments } from '../data/useAppointments.js';
import { useNow } from '../data/useNow.js';
import { usePatients } from '../data/usePatients.js';
import { useVisits } from '../data/useVisits.js';

function greetingFor(now) {
  const h = now.getHours();
  if (h < 12) return 'สวัสดีตอนเช้า';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

function fullThaiDate(now) {
  return now.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function shortThaiDay(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.toLocaleDateString('th-TH', { weekday: 'short' });
  return `${wd} ${d}`;
}

function ganttBarModifier(stage) {
  if (stage === 'completed') return 'ma-gantt-bar--ok';
  if (stage === 'in_treatment' || stage === 'checked_in') return 'ma-gantt-bar--active';
  if (stage === 'confirmed') return 'ma-gantt-bar--confirmed';
  return 'ma-gantt-bar--pending';
}

const GANTT_HIDDEN_STAGES = ['cancelled', 'rejected', 'no_show'];

/**
 * Medical Assistant Dashboard
 * Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function MedicalAssistantDashboardPage() {
  const { appointments, loading, error, meta, lastLoadedAt, reload, markNoShow } =
    useAppointments();
  const { patients } = usePatients();
  const { getVisit } = useVisits();
  const { show, toast } = useToast();
  const now = useNow();

  const [showAllTodos, setShowAllTodos] = useState(false);
  const [dueVaccines, setDueVaccines] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [noShowTarget, setNoShowTarget] = useState(null);
  const [noShowSubmitting, setNoShowSubmitting] = useState(false);
  const [noShowError, setNoShowError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      maRequest('/vaccination/due?days=30'),
      maRequest('/follow-ups?days=7'),
    ])
      .then(([vaccinesRes, followUpsRes]) => {
        if (cancelled) return;
        if (Array.isArray(vaccinesRes)) setDueVaccines(vaccinesRes);
        if (Array.isArray(followUpsRes)) setFollowUps(followUpsRes);
      })
      .catch(() => {
        // Store error banner handles backend offline state cleanly
      });
    return () => {
      cancelled = true;
    };
  }, [appointments, lastLoadedAt]);

  const patientsById = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients],
  );

  const todayKey = toDateKey(now);
  const tomorrowKey = offsetDateKey(1);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const todayClosure = closureFor(meta, todayKey);
  const todayHours = hoursForMeta(meta, todayKey);
  const clinicHours = todayHours ?? (isWeekend ? OPENING_HOURS.weekend : OPENING_HOURS.weekday);
  const clinicHoursLabel = todayClosure
    ? `คลินิกปิดทำการ (${todayClosure.reason})`
    : !todayHours
      ? 'ปิดทำการวันนี้'
      : `เวลาทำการ ${todayHours.open}–${todayHours.close} น.`;

  const openMin = timeToMinutes(clinicHours.open);
  const closeMin = timeToMinutes(clinicHours.close);
  const spanMin = Math.max(1, closeMin - openMin);
  const showNowLine = nowMin >= openMin && nowMin <= closeMin;
  const isAfterClose = nowMin >= closeMin;
  const nowPct = ((nowMin - openMin) / spanMin) * 100;

  const todayAll = useMemo(() => todayAppointments(appointments, todayKey), [appointments, todayKey]);
  const todayStatsList = useMemo(
    () => todayAll.filter((a) => a.stage !== 'rejected' && a.stage !== 'cancelled'),
    [todayAll],
  );
  const triageList = useMemo(
    () => awaitingTriage(appointments, getVisit, todayKey),
    [appointments, getVisit, todayKey],
  );
  const readyList = useMemo(
    () => readyForVet(appointments, getVisit, todayKey),
    [appointments, getVisit, todayKey],
  );
  const treatmentList = useMemo(
    () => inTreatment(appointments, getVisit, todayKey),
    [appointments, getVisit, todayKey],
  );
  const completedList = useMemo(
    () => completedToday(appointments, getVisit, todayKey),
    [appointments, getVisit, todayKey],
  );
  const pendingList = useMemo(() => pendingBookings(appointments), [appointments]);

  const remainingNotArrivedCount = useMemo(
    () => todayStatsList.filter((a) => a.stage === 'pending' || a.stage === 'confirmed').length,
    [todayStatsList],
  );

  const inClinicQueue = useMemo(() => {
    const merged = [...treatmentList, ...readyList, ...triageList];
    return merged.sort((a, b) => {
      const pa = TRIAGE_LEVELS[a.visit?.triage]?.priority ?? 99;
      const pb = TRIAGE_LEVELS[b.visit?.triage]?.priority ?? 99;
      if (pa !== pb) return pa - pb;
      const ca = a.visit?.checkedInAt ?? '';
      const cb = b.visit?.checkedInAt ?? '';
      if (ca !== cb) {
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb);
      }
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [treatmentList, readyList, triageList]);

  const closureAffected = useMemo(
    () => appointments.filter((a) => Boolean(a.closure)),
    [appointments],
  );

  const ganttVetRows = useMemo(() => {
    const dutyVets = vetsOnDutyFor(meta, todayKey);
    const allActive = vetList(meta);
    const rows = dutyVets.map((v) => ({
      id: v.id,
      name: v.name,
      key: v.id ?? v.name,
      onDuty: true,
    }));

    for (const a of todayAll) {
      if (GANTT_HIDDEN_STAGES.includes(a.stage)) continue;
      const vId = apptVetId(a);
      const vName = apptVetName(a);
      if (!vId && !vName) continue;
      const alreadyInRows = rows.some((r) => isSameVet(a, r));
      if (!alreadyInRows) {
        const matchedActive = allActive.find((v) =>
          vId && v.id ? v.id === vId : Boolean(vName && v.name === vName),
        );
        rows.push({
          id: vId ?? matchedActive?.id ?? null,
          name: matchedActive?.name || vName,
          key: vId || vName,
          onDuty: false,
        });
      }
    }
    return rows;
  }, [meta, todayKey, todayAll]);

  const todoItems = useMemo(() => {
    const items = [];

    if (closureAffected.length > 0) {
      items.push({
        key: 'closure-affected',
        level: 'danger',
        icon: 'bi-calendar-x',
        title: `นัดตรงวันปิดคลินิก ${closureAffected.length} รายการ ต้องโทรเลื่อนนัด`,
        text: 'กรุณาติดต่อเจ้าของสัตว์เพื่อเลื่อนนัดหรือจัดการคำขอ',
        actionType: 'link',
        actionLabel: 'ดูนัดวันปิด',
        actionTo: '/clinic-admin/appointments?closure=1',
        actionVariant: 'btn-soft-danger',
      });
    }

    // 1. Pending bookings whose requested date is today/tomorrow (<= 1 day) or overdue
    for (const a of pendingList) {
      if (a.date > tomorrowKey) continue;
      const isOverdue = a.date < todayKey;
      items.push({
        key: `pending-${a.id}`,
        level: isOverdue ? 'danger' : 'warn',
        icon: isOverdue ? 'bi-calendar-x' : 'bi-hourglass-split',
        petId: a.petId,
        petName: a.petName,
        petSpecies: a.petSpecies,
        allergies: a.pet?.allergies,
        text: isOverdue
          ? `คำขอรอยืนยันเลยวันนัดแล้ว (${formatDate(a.date)} ${a.time} น.)`
          : `คำขอรอยืนยันนัดใกล้ถึง (${formatDate(a.date)} ${a.time} น. · ${a.serviceLabel || a.service})`,
        actionType: 'link',
        actionLabel: 'จัดการ',
        actionTo: '/clinic-admin/appointments',
        actionVariant: isOverdue ? 'btn-soft-danger' : 'btn-sky',
      });
    }

    // 2. Confirmed appointments >= 15 min past scheduled time without check-in
    for (const a of lateArrivals(appointments, now, meta)) {
      const lateMin = Math.max(15, nowMin - timeToMinutes(a.time));
      items.push({
        key: `late-${a.id}`,
        level: 'warn',
        icon: 'bi-clock-history',
        petId: a.petId,
        petName: a.petName,
        petSpecies: a.petSpecies,
        allergies: a.pet?.allergies,
        ownerPhone: a.ownerPhone,
        appt: a,
        text: `เลยเวลานัด ${lateMin} นาที ยังไม่เช็คอิน (นัด ${a.time} น. · ${apptVetName(a) || 'ยังไม่ระบุหมอ'})`,
        actionType: 'late',
      });
    }

    // 3. Checked-in today waiting for triage
    for (const a of triageList) {
      const mins = waitMinutes(a, now);
      items.push({
        key: `triage-${a.id}`,
        level: mins > 20 ? 'danger' : 'warn',
        icon: 'bi-thermometer-half',
        petId: a.petId,
        petName: a.petName,
        petSpecies: a.petSpecies,
        allergies: a.pet?.allergies,
        text: `เช็คอินแล้วยังไม่คัดกรอง (${a.serviceLabel || a.service}) · ${formatWaitText(mins)}`,
        actionType: 'link',
        actionLabel: 'คัดกรอง',
        actionTo: `/clinic-admin/appointments/${a.id}`,
        actionVariant: 'btn-sky',
      });
    }

    // 4. no_show not yet contacted
    for (const a of needsContact(appointments)) {
      items.push({
        key: `noshow-${a.id}`,
        level: 'sky',
        icon: 'bi-telephone-outbound',
        petId: a.petId,
        petName: a.petName,
        petSpecies: a.petSpecies,
        allergies: a.pet?.allergies,
        ownerPhone: a.ownerPhone,
        text: `ไม่มาตามนัดวันที่ ${formatDate(a.date)} — ยังไม่ติดต่อเจ้าของ`,
        actionType: 'phone_and_link',
        actionLabel: 'ติดต่อให้จองใหม่',
        actionTo: '/clinic-admin/appointments?tab=contact',
        actionVariant: 'btn-soft',
      });
    }

    // 5. Vet record follow-ups due within 7 days without a subsequent booking
    for (const f of followUps) {
      items.push({
        key: `followup-${f.petId}-${f.followUpDate}-${f.id}`,
        level: f.status === 'overdue' ? 'danger' : 'sky',
        icon: 'bi-calendar-heart',
        petId: f.petId,
        petName: f.petName,
        petSpecies: f.petSpecies,
        ownerPhone: f.ownerPhone,
        text: `${f.status === 'overdue' ? 'เลยวันนัดติดตาม' : 'นัดติดตามจากบันทึกหมอ'} ${formatDate(f.followUpDate)}${f.vet ? ` (${f.vet})` : ''} — ยังไม่มีนัดหลังวันตรวจ ${formatDate(f.visitDate)}`,
        actionType: 'phone_and_link',
        actionLabel: 'ดูประวัติ',
        actionTo: `/clinic-admin/patients/${encodeURIComponent(f.petId)}`,
        actionVariant: 'btn-soft',
      });
    }

    return items;
  }, [closureAffected, pendingList, tomorrowKey, todayKey, appointments, now, nowMin, meta, triageList, followUps]);

  const visibleTodos = showAllTodos ? todoItems : todoItems.slice(0, 6);

  const sevenDayData = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const dateKey = offsetDateKey(i);
      const count = appointments.filter(
        (a) => a.date === dateKey && a.stage !== 'cancelled' && a.stage !== 'rejected',
      ).length;
      days.push({
        date: dateKey,
        label: shortThaiDay(dateKey),
        count,
        isToday: i === 0,
      });
    }
    return days;
  }, [appointments]);

  const max7d = Math.max(1, ...sevenDayData.map((d) => d.count));

  const popularServices30d = useMemo(() => {
    const startKey = offsetDateKey(-30);
    const windowAppts = appointments.filter(
      (a) =>
        a.date >= startKey &&
        a.date <= todayKey &&
        a.stage !== 'cancelled' &&
        a.stage !== 'rejected',
    );

    const svcCounts = {};
    for (const svc of BOOKING_SERVICES) {
      svcCounts[svc.label] = 0;
    }

    for (const a of windowAppts) {
      const label =
        a.serviceLabel || BOOKING_SERVICES.find((s) => s.value === a.service)?.label || a.service;
      if (label) svcCounts[label] = (svcCounts[label] ?? 0) + 1;
    }

    const topServices = Object.entries(svcCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const maxSvc = Math.max(1, ...topServices.map((s) => s.count));
    return { topServices, maxSvc };
  }, [appointments, todayKey]);

  const recentActivities = useMemo(() => {
    const events = [];
    for (const a of appointments) {
      if (a.stage === 'completed' && a.updatedAt) {
        events.push({
          id: `${a.id}-done`,
          time: a.updatedAt,
          text: `หมอปิดเคส ${a.petName} (${a.serviceLabel || a.service})`,
        });
      }
      if (a.visit?.treatmentStartedAt) {
        events.push({
          id: `${a.id}-start`,
          time: a.visit.treatmentStartedAt,
          text: `ส่ง ${a.petName} เข้าห้องตรวจกับ ${apptVetName(a) || 'สัตวแพทย์'}`,
        });
      }
      if (a.visit?.checkedInAt) {
        events.push({
          id: `${a.id}-checkin`,
          time: a.visit.checkedInAt,
          text: `${a.petName} เช็คอินแล้ว`,
        });
      }
      if (a.visit?.handledAt) {
        events.push({
          id: `${a.id}-handle`,
          time: a.visit.handledAt,
          text:
            a.stage === 'rejected'
              ? `ปฏิเสธคำขอของ ${a.petName}`
              : a.visit?.rescheduledFrom
                ? `เลื่อนนัด ${a.petName} ไป ${formatDate(a.date)} ${a.time} น.`
                : `ยืนยันคำขอของ ${a.petName}`,
        });
      }
      if (a.createdAt) {
        events.push({
          id: `${a.id}-req`,
          time: a.createdAt,
          text: `มีคำขอจองคิว ${a.petName} (${a.serviceLabel || a.service})`,
        });
      }
    }

    return events
      .filter((ev) => ev.time)
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 8);
  }, [appointments]);

  async function handleConfirmNoShow() {
    if (!noShowTarget) return;
    setNoShowSubmitting(true);
    setNoShowError('');
    try {
      await markNoShow(noShowTarget.id);
      show(`บันทึก ${noShowTarget.petName} เป็น "ไม่มาตามนัด" แล้ว`);
      setNoShowTarget(null);
    } catch (err) {
      setNoShowError(err?.message || 'ไม่สามารถบันทึกไม่มาตามนัดได้');
    } finally {
      setNoShowSubmitting(false);
    }
  }

  const hourTicks = [];
  for (let m = openMin; m <= closeMin; m += 120) {
    hourTicks.push({
      label: minutesToTime(m),
      pct: ((m - openMin) / spanMin) * 100,
    });
  }

  const hasData = Boolean(meta) || appointments.length > 0;
  const blockedByState = !hasData && (loading || Boolean(error));

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>{greetingFor(now)}</h1>
          <p>
            {fullThaiDate(now)} · {clinicHoursLabel}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-soft" disabled={loading} onClick={reload}>
            <i className="bi bi-arrow-clockwise me-1" />
            รีเฟรช
          </button>
          <Link to="/clinic-admin/patients" className="btn btn-soft">
            <i className="bi bi-search me-1" />
            ค้นหาสัตว์เลี้ยง
          </Link>
          <Link to="/clinic-admin/appointments" className="btn btn-sky">
            <i className="bi bi-calendar2-check me-1" />
            นัดหมาย
          </Link>
        </div>
      </div>

      <MaDataState loading={loading} error={error} hasData={hasData} onRetry={reload} />

      {!blockedByState && (
        <>
          <div className="ma-stat-grid-5 mb-4">
            <Link to="/clinic-admin/appointments" className="stat ma-stat-link">
              <span className="tag sky ma-stat-icon" aria-hidden="true">
                <i className="bi bi-calendar2-week" />
              </span>
              <div className="num">{todayStatsList.length}</div>
              <div className="small fw-medium">นัดวันนี้</div>
              <div className="small text-muted">
                {todayStatsList.length === 0
                  ? 'ยังไม่มีนัดวันนี้'
                  : remainingNotArrivedCount > 0
                    ? `เหลือ ${remainingNotArrivedCount} นัดที่ยังไม่มา`
                    : 'มาครบแล้ว'}
              </div>
            </Link>

            <Link to="/clinic-admin/appointments" className="stat ma-stat-link">
              <span className="tag sky ma-stat-icon" aria-hidden="true">
                <i className="bi bi-hospital" />
              </span>
              <div className="num">{inClinicQueue.length}</div>
              <div className="small fw-medium">อยู่ในคลินิก</div>
              <div className="small text-muted">กำลังตรวจ {treatmentList.length} เคส</div>
            </Link>

            <Link to="/clinic-admin/appointments?tab=triage" className="stat ma-stat-link">
              <span className="tag warn ma-stat-icon" aria-hidden="true">
                <i className="bi bi-thermometer-half" />
              </span>
              <div className="num">{triageList.length}</div>
              <div className="small fw-medium">รอคัดกรอง</div>
              <div className="small text-muted">พร้อมเข้าตรวจ {readyList.length}</div>
            </Link>

            <Link to="/clinic-admin/appointments" className="stat ma-stat-link">
              <span className="tag warn ma-stat-icon" aria-hidden="true">
                <i className="bi bi-inbox" />
              </span>
              <div className="num">{pendingList.length}</div>
              <div className="small fw-medium">รอยืนยันอัตโนมัติ</div>
              <div className="small text-muted">
                {pendingList.length > 0 ? 'ระบบยืนยันจากการจอง/โอน' : 'ไม่มีรายการค้าง'}
              </div>
            </Link>

            <Link to="/clinic-admin/appointments?tab=completed" className="stat ma-stat-link">
              <span className="tag ok ma-stat-icon" aria-hidden="true">
                <i className="bi bi-check2-circle" />
              </span>
              <div className="num">{completedList.length}</div>
              <div className="small fw-medium">เสร็จแล้ว</div>
              <div className="small text-muted">ปิดเคสแล้ววันนี้</div>
            </Link>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-lg-7">
              <div className="card-soft h-100">
                <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                  <div className="section-label mb-0">
                    <i className="bi bi-bell" />
                    สิ่งที่ต้องทำตอนนี้ ({todoItems.length})
                  </div>
                  {todoItems.length > 6 && (
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() => setShowAllTodos((v) => !v)}
                    >
                      {showAllTodos ? 'ย่อรายการ' : `ดูทั้งหมด (${todoItems.length})`}
                    </button>
                  )}
                </div>

                {todoItems.length === 0 ? (
                  <div className="empty-box py-4">
                    <i className="bi bi-check2-circle" />
                    <div>ไม่มีงานค้าง เยี่ยมมาก!</div>
                  </div>
                ) : (
                  <div className="d-grid gap-2">
                    {visibleTodos.map((item) => {
                      const pat = patientsById.get(item.petId);
                      return (
                        <div key={item.key} className="ma-todo-item">
                          <div className="d-flex align-items-start gap-2" style={{ minWidth: 0, flex: 1 }}>
                            <span className={`tag ${item.level} m-0 mt-1 flex-shrink-0`}>
                              <i className={`bi ${item.icon}`} />
                            </span>
                            <div style={{ minWidth: 0 }}>
                              {item.title ? (
                                <div className="fw-medium">{item.title}</div>
                              ) : (
                                <div className="fw-medium">
                                  <PatientNameLink
                                    petId={item.petId}
                                    petName={item.petName}
                                    petSpecies={item.petSpecies}
                                    flags={pat?.flags}
                                    allergies={item.allergies ?? pat?.allergies}
                                  />
                                </div>
                              )}
                              <div className="small text-muted">{item.text}</div>
                            </div>
                          </div>

                          <div className="ma-actions flex-shrink-0">
                            {item.actionType === 'late' && (
                              <>
                                {item.ownerPhone && (
                                  <a href={`tel:${item.ownerPhone}`} className="btn btn-soft btn-sm">
                                    <i className="bi bi-telephone me-1" />
                                    โทร
                                  </a>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-soft-danger btn-sm"
                                  onClick={() => {
                                    setNoShowError('');
                                    setNoShowTarget(item.appt);
                                  }}
                                >
                                  ไม่มา
                                </button>
                              </>
                            )}
                            {item.actionType === 'phone_and_link' && (
                              <>
                                {item.ownerPhone && (
                                  <a href={`tel:${item.ownerPhone}`} className="btn btn-soft btn-sm">
                                    <i className="bi bi-telephone me-1" />
                                    โทร
                                  </a>
                                )}
                                <Link to={item.actionTo} className={`btn ${item.actionVariant} btn-sm`}>
                                  {item.actionLabel}
                                </Link>
                              </>
                            )}
                            {item.actionType === 'link' && (
                              <Link to={item.actionTo} className={`btn ${item.actionVariant} btn-sm`}>
                                {item.actionLabel}
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card-soft h-100 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                  <div className="section-label mb-0">
                    <i className="bi bi-people" />
                    คิวในคลินิกตอนนี้ ({inClinicQueue.length})
                  </div>
                  <Link to="/clinic-admin/appointments" className="small text-decoration-none">
                    ไปหน้าสนับสนุนการรักษา
                  </Link>
                </div>

                {inClinicQueue.length === 0 ? (
                  <div className="empty-box py-4 my-auto">
                    <i className="bi bi-bandaid" />
                    <div>ยังไม่มีสัตว์เลี้ยงเช็คอินเข้าคลินิก</div>
                  </div>
                ) : (
                  <div className="d-grid gap-2">
                    {inClinicQueue.map((appt) => {
                      const pat = patientsById.get(appt.petId);
                      const st = STAGE_META[appt.stage] ?? STAGE_META.checked_in;
                      const triageMeta = appt.visit?.triage ? TRIAGE_LEVELS[appt.visit.triage] : null;
                      const waitText = formatWaitText(waitMinutes(appt, now));

                      return (
                        <div key={appt.id} className="ma-todo-item">
                          <div className="d-flex align-items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                            <PetPhoto pet={{ name: appt.petName, species: appt.petSpecies }} size="xs" />
                            <div style={{ minWidth: 0 }}>
                              <div className="d-flex flex-wrap align-items-center gap-1">
                                <PatientNameLink
                                  petId={appt.petId}
                                  petName={appt.petName}
                                  petSpecies={appt.petSpecies}
                                  flags={pat?.flags}
                                  allergies={appt.pet?.allergies ?? pat?.allergies}
                                  showEmoji={false}
                                />
                                <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                                {triageMeta ? (
                                  <span className={`tag ${triageMeta.tag} m-0`}>{triageMeta.label}</span>
                                ) : (
                                  <span className="tag warn m-0">ยังไม่คัดกรอง</span>
                                )}
                              </div>
                              <div className="small text-muted">
                                {appt.serviceLabel || appt.service} · {waitText}
                              </div>
                            </div>
                          </div>
                          <Link
                            to={`/clinic-admin/appointments/${appt.id}`}
                            className="btn btn-soft btn-sm flex-shrink-0"
                          >
                            เปิดเคส
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card-soft mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div className="section-label mb-0">
                <i className="bi bi-calendar2-range" />
                ตารางสัตวแพทย์วันนี้
              </div>
              <div className="d-flex flex-wrap gap-2 small">
                <span className="tag ok m-0">เสร็จสิ้น</span>
                <span className="tag sky m-0">ในคลินิก / ยืนยันแล้ว</span>
              </div>
            </div>

            <div className="ma-gantt-scroll">
              <div className="ma-gantt-table">
                <div className="ma-gantt-row ma-gantt-header">
                  <div className="ma-gantt-vet small text-muted fw-medium">สัตวแพทย์</div>
                  <div className="ma-gantt-track ma-gantt-axis">
                    {hourTicks.map((tick) => (
                      <span
                        key={tick.label}
                        className="ma-gantt-tick"
                        style={{ left: `${tick.pct}%` }}
                      >
                        {tick.label}
                      </span>
                    ))}
                  </div>
                </div>

                {ganttVetRows.length === 0 ? (
                  <div className="empty-box py-4">
                    <i className="bi bi-calendar-x" />
                    <div>วันนี้ไม่มีสัตวแพทย์เข้าเวร</div>
                  </div>
                ) : (
                  ganttVetRows.map((row) => {
                    const vetAppts = todayAll.filter(
                      (a) => isSameVet(a, row) && !GANTT_HIDDEN_STAGES.includes(a.stage),
                    );
                    const nextSlot =
                      row.onDuty && vetAppts.length > 0 && !isAfterClose && !todayClosure && todayHours
                        ? suggestSlots(
                            appointments,
                            { vet: row, date: todayKey, durationMin: 30, meta },
                            1,
                          )[0]
                        : null;

                    let subStatusText = '';
                    if (!row.onDuty) {
                      subStatusText = `${vetAppts.length} นัดวันนี้`;
                    } else if (vetAppts.length === 0) {
                      subStatusText = 'ไม่มีนัดวันนี้';
                    } else if (!isAfterClose) {
                      subStatusText = nextSlot ? `ว่างถัดไป ${nextSlot} น.` : 'ไม่มีคิวว่างวันนี้';
                    } else {
                      subStatusText = `${vetAppts.length} นัดวันนี้`;
                    }

                    return (
                      <div className="ma-gantt-row" key={row.key}>
                        <div className="ma-gantt-vet">
                          <div className="fw-medium small text-truncate" title={row.name}>
                            {row.name}
                          </div>
                          {!row.onDuty && <span className="tag warn m-0">ไม่อยู่เวร</span>}
                          <div className="small text-muted">{subStatusText}</div>
                        </div>

                      <div className="ma-gantt-track">
                        {hourTicks.map((tick) => (
                          <span
                            key={tick.label}
                            className="ma-gantt-gridline"
                            style={{ left: `${tick.pct}%` }}
                          />
                        ))}

                        {showNowLine && (
                          <div
                            className="ma-gantt-now"
                            style={{ left: `${nowPct}%` }}
                            aria-label={`เวลาปัจจุบัน ${minutesToTime(nowMin)} น.`}
                          >
                            <span className="ma-gantt-now-label">ตอนนี้</span>
                          </div>
                        )}

                        {vetAppts.map((a) => {
                          const sMin = timeToMinutes(a.time);
                          if (Number.isNaN(sMin)) return null;
                          const dur = Number(a.visit?.durationMin) || 30;
                          if (sMin + dur <= openMin || sMin >= closeMin) return null;
                          const clampedStart = Math.max(openMin, Math.min(closeMin, sMin));
                          const clampedEnd = Math.max(clampedStart + 10, Math.min(closeMin, sMin + dur));
                          const leftPct = ((clampedStart - openMin) / spanMin) * 100;
                          const widthPct = Math.max(4, ((clampedEnd - clampedStart) / spanMin) * 100);
                          const endText = minutesToTime(sMin + dur);

                          return (
                            <Link
                              key={a.id}
                              to={`/clinic-admin/appointments?date=${todayKey}`}
                              className={`ma-gantt-bar ${ganttBarModifier(a.stage)}`}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              title={`${a.petName} · ${a.time}–${endText} น. (${a.serviceLabel || a.service})`}
                            >
                              <span className="text-truncate">{a.petName}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-md-6 col-lg-4">
              <div className="card-soft h-100 d-flex flex-column">
                <div className="section-label">
                  <i className="bi bi-bar-chart" />
                  นัดหมาย 7 วันข้างหน้า
                </div>

                <div
                  className="ma-bar-chart-7d mt-auto"
                  role="img"
                  aria-label={`กราฟจำนวนนัดหมาย 7 วันข้างหน้า: ${sevenDayData
                    .map((d) => `${d.label} ${d.count} นัด`)
                    .join(', ')}`}
                >
                  {sevenDayData.map((d) => {
                    const heightPct = d.count > 0 ? Math.max(12, Math.round((d.count / max7d) * 100)) : 4;
                    return (
                      <Link
                        key={d.date}
                        to={`/clinic-admin/appointments?date=${d.date}`}
                        className={`ma-bar-col${d.isToday ? ' is-today' : ''}`}
                        aria-label={`${formatDate(d.date)} จำนวน ${d.count} นัด`}
                        title={`${formatDate(d.date)} · ${d.count} นัด`}
                      >
                        <span className="small fw-medium mb-1">{d.count}</span>
                        <div className="ma-bar-track">
                          <div className="ma-bar-fill" style={{ height: `${heightPct}%` }} />
                        </div>
                        <span className="ma-bar-label">{d.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="col-md-6 col-lg-4">
              <div className="card-soft h-100 d-flex flex-column">
                <div className="section-label">
                  <i className="bi bi-clipboard2-data" />
                  บริการยอดนิยม 30 วัน
                </div>

                <div
                  aria-label={`บริการยอดนิยม 30 วัน: ${popularServices30d.topServices
                    .map((s) => `${s.name} ${s.count} ครั้ง`)
                    .join(', ')}`}
                >
                  {popularServices30d.topServices.map((s) => {
                    const widthPct = popularServices30d.maxSvc
                      ? Math.round((s.count / popularServices30d.maxSvc) * 100)
                      : 0;
                    return (
                      <div className="ma-hbar-row" key={s.name}>
                        <div className="d-flex justify-content-between small mb-1">
                          <span>{s.name}</span>
                          <span className="fw-medium">{s.count}</span>
                        </div>
                        <div className="ma-hbar-track">
                          <div className="ma-hbar-fill" style={{ width: `${widthPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="col-md-12 col-lg-4">
              <div className="card-soft h-100 d-flex flex-column">
                <div className="section-label">
                  <i className="bi bi-heart-pulse" />
                  ใกล้ครบกำหนดวัคซีน ({dueVaccines.length})
                </div>

                {dueVaccines.length === 0 ? (
                  <div className="empty-box py-4 my-auto">
                    <i className="bi bi-check2-circle" />
                    <div>ไม่มีรายการวัคซีนใกล้ครบกำหนดใน 30 วัน</div>
                  </div>
                ) : (
                  <div className="d-grid gap-2">
                    {dueVaccines.slice(0, 6).map((item, idx) => {
                      const pat = patientsById.get(item.petId);
                      const sp = speciesOf(item.petSpecies);
                      return (
                        <div className="ma-todo-item" key={`${item.petId}-${item.name}-${idx}`}>
                          <div style={{ minWidth: 0 }}>
                            <div className="fw-medium small">
                              <PatientNameLink
                                petId={item.petId}
                                petName={item.petName}
                                petSpecies={item.petSpecies}
                                flags={pat?.flags}
                                allergies={pat?.allergies}
                              />
                              <span className="small text-muted ms-1">({sp.label})</span>
                            </div>
                            <div className="small text-muted">
                              วัคซีน {item.name} · เจ้าของ {pat?.ownerName || '—'}
                            </div>
                            <span
                              className={`tag ${item.status === 'overdue' ? 'danger' : 'warn'} m-0 mt-1`}
                            >
                              {item.status === 'overdue' ? 'เลยกำหนด' : 'ครบกำหนด'} ·{' '}
                              {formatDate(item.nextDate)}
                            </span>
                          </div>
                          {pat?.ownerPhone && (
                            <a
                              href={`tel:${pat.ownerPhone}`}
                              className="btn btn-soft btn-sm flex-shrink-0"
                              title={`โทรหา ${pat.ownerName || 'เจ้าของ'}`}
                            >
                              <i className="bi bi-telephone me-1" />
                              โทร
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card-soft">
            <div className="section-label">
              <i className="bi bi-clock-history" />
              กิจกรรมล่าสุด
            </div>

            {recentActivities.length === 0 ? (
              <div className="empty-box py-3">
                <i className="bi bi-clock-history" />
                <div>ยังไม่มีกิจกรรมในระบบ</div>
              </div>
            ) : (
              <div className="timeline">
                {recentActivities.map((ev) => (
                  <div className="tl-item" key={ev.id}>
                    <div className="date">{relativeTimeLabel(ev.time, now)}</div>
                    <div className="small fw-medium">{ev.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmModal
        open={Boolean(noShowTarget)}
        title="บันทึกไม่มาตามนัด"
        icon="bi-person-x"
        message={
          noShowTarget
            ? `ยืนยันบันทึกว่า "${noShowTarget.petName}" ไม่มาตามนัดเวลา ${noShowTarget.time} น. ใช่หรือไม่?`
            : ''
        }
        confirmLabel="ไม่มาตามนัด"
        cancelLabel="ยกเลิก"
        confirmVariant="danger"
        submitting={noShowSubmitting}
        error={noShowError}
        onClose={() => !noShowSubmitting && setNoShowTarget(null)}
        onConfirm={handleConfirmNoShow}
      />

      {toast}
    </section>
  );
}
