import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import {
  careReminders,
  formatDate,
  reminderText,
  speciesOf,
} from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import AppointmentModal from '../components/AppointmentModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import {
  APPOINTMENT_STATUS,
  BOOKING_SOURCE_LIST,
  CLINIC_HOURS,
  SERVICE_TYPES,
  TRIAGE_LEVELS,
  VETS,
  minutesToTime,
  offsetDateKey,
  timeToMinutes,
  toDateKey,
} from '../data/constants.js';
import { suggestSlots } from '../data/schedule.js';
import {
  abnormalVitalCases,
  awaitingReschedule,
  awaitingTriage,
  bookingConflicts,
  completedToday,
  formatWaitText,
  inTreatment,
  lateArrivals,
  overdueBookings,
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

function ganttBarModifier(status) {
  if (status === 'completed') return 'ma-gantt-bar--ok';
  if (status === 'in_treatment' || status === 'checked_in') return 'ma-gantt-bar--active';
  if (status === 'confirmed') return 'ma-gantt-bar--confirmed';
  return 'ma-gantt-bar--pending';
}

const GANTT_HIDDEN_STATUSES = ['cancelled', 'rejected', 'no_show'];

/**
 * Medical Assistant Dashboard
 * Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function MedicalAssistantDashboardPage() {
  const { appointments, addAppointment, setStatus, resetAppointments } = useAppointments();
  const { patients, getPatient, patientIdForAppt } = usePatients();
  const { getVisit } = useVisits();
  const { show, toast } = useToast();
  const now = useNow();

  const [showAllTodos, setShowAllTodos] = useState(false);
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const todayKey = toDateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const openMin = timeToMinutes(CLINIC_HOURS.open);
  const closeMin = timeToMinutes(CLINIC_HOURS.close);
  const spanMin = Math.max(1, closeMin - openMin);
  const showNowLine = nowMin >= openMin && nowMin <= closeMin;
  const nowPct = ((nowMin - openMin) / spanMin) * 100;

  const todayAll = useMemo(() => todayAppointments(appointments, todayKey), [appointments, todayKey]);
  const todayActive = useMemo(
    () => todayAll.filter((a) => !['cancelled', 'rejected', 'no_show'].includes(a.status)),
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
  const overdueList = useMemo(
    () => overdueBookings(appointments, todayKey),
    [appointments, todayKey],
  );

  const remainingTodayCount = useMemo(
    () =>
      todayActive.filter((a) => a.status === 'pending' || a.status === 'confirmed').length,
    [todayActive],
  );

  const inClinicQueue = useMemo(() => {
    const merged = [...treatmentList, ...readyList, ...triageList];
    return merged.sort((a, b) => {
      const pa = TRIAGE_LEVELS[getVisit(a.id)?.triage]?.priority ?? 99;
      const pb = TRIAGE_LEVELS[getVisit(b.id)?.triage]?.priority ?? 99;
      if (pa !== pb) return pa - pb;
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [treatmentList, readyList, triageList, getVisit]);

  const todoItems = useMemo(() => {
    const items = [];
    const urgentIds = new Set();

    // 1. Urgent cases not yet in exam room
    for (const a of [...readyList, ...triageList]) {
      if (getVisit(a.id)?.triage === 'urgent') {
        urgentIds.add(a.id);
        items.push({
          key: `urgent-${a.id}`,
          level: 'danger',
          icon: 'bi-exclamation-diamond-fill',
          appt: a,
          text: `เคสด่วน (${a.service}) รอเข้าห้องตรวจ · ${formatWaitText(waitMinutes(a, now))}`,
          actionType: 'link',
          actionLabel: 'เปิดเคส',
          actionTo: `/medical-assistant/medical-support/${a.id}`,
          actionVariant: 'btn-sky',
        });
      }
    }

    // 2. Abnormal vital cases
    for (const entry of abnormalVitalCases(appointments, getVisit, null, todayKey)) {
      if (urgentIds.has(entry.appt.id)) continue;
      const summary = entry.flags
        .map((f) => `${f.label} ${f.value} ${f.unit}`)
        .join(', ');
      items.push({
        key: `vital-${entry.appt.id}`,
        level: 'danger',
        icon: 'bi-heart-pulse-fill',
        appt: entry.appt,
        text: `สัญญาณชีพผิดปกติ: ${summary}`,
        actionType: 'link',
        actionLabel: 'ดูเคส',
        actionTo: `/medical-assistant/medical-support/${entry.appt.id}`,
        actionVariant: 'btn-soft',
      });
    }

    // 3. Late arrivals >= 15 min
    for (const a of lateArrivals(appointments, now)) {
      const lateMin = Math.max(15, nowMin - timeToMinutes(a.time));
      items.push({
        key: `late-${a.id}`,
        level: 'warn',
        icon: 'bi-clock-history',
        appt: a,
        text: `มาสาย ${lateMin} นาที (นัด ${a.time} น. · ${a.vet})`,
        actionType: 'late',
      });
    }

    // 4. Overdue pending bookings
    const overdueIds = new Set();
    for (const a of overdueList) {
      overdueIds.add(a.id);
      items.push({
        key: `overdue-${a.id}`,
        level: 'warn',
        icon: 'bi-calendar-x',
        appt: a,
        text: `คำขอเลยวันนัด (${formatDate(a.date)} ${a.time} น.)`,
        actionType: 'link',
        actionLabel: 'จัดการ',
        actionTo: '/medical-assistant/booking-management',
        actionVariant: 'btn-soft',
      });
    }

    // 5. Conflicting pending bookings
    for (const { appt: a, conflict } of bookingConflicts(appointments)) {
      if (overdueIds.has(a.id)) continue;
      items.push({
        key: `conflict-${a.id}`,
        level: 'warn',
        icon: 'bi-exclamation-triangle-fill',
        appt: a,
        text: `คำขอชนเวลากับ ${conflict.petName} (${conflict.rangeText})`,
        actionType: 'link',
        actionLabel: 'แก้เวลา',
        actionTo: '/medical-assistant/booking-management',
        actionVariant: 'btn-soft',
      });
    }

    // 6. Waiting triage > 20 min
    for (const a of triageList) {
      if (urgentIds.has(a.id)) continue;
      const mins = waitMinutes(a, now);
      if (mins > 20) {
        items.push({
          key: `triage-${a.id}`,
          level: 'warn',
          icon: 'bi-thermometer-half',
          appt: a,
          text: `รอคัดกรองนาน ${mins} นาที (${a.service})`,
          actionType: 'link',
          actionLabel: 'คัดกรอง',
          actionTo: `/medical-assistant/medical-support/${a.id}`,
          actionVariant: 'btn-sky',
        });
      }
    }

    // 7. no_show awaiting reschedule
    for (const a of awaitingReschedule(appointments)) {
      items.push({
        key: `noshow-${a.id}`,
        level: 'sky',
        icon: 'bi-calendar-event',
        appt: a,
        text: `ไม่มาตามนัดวันที่ ${formatDate(a.date)} — รอเลื่อนนัดใหม่`,
        actionType: 'link',
        actionLabel: 'เลื่อนนัด',
        actionTo: '/medical-assistant/booking-management?tab=reschedule',
        actionVariant: 'btn-soft',
      });
    }

    return items;
  }, [appointments, readyList, triageList, overdueList, getVisit, now, nowMin, todayKey]);

  const visibleTodos = showAllTodos ? todoItems : todoItems.slice(0, 6);

  // 7-day vertical bar chart (today to +6)
  const sevenDayData = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const dateKey = offsetDateKey(i);
      const count = appointments.filter(
        (a) => a.date === dateKey && a.status !== 'cancelled' && a.status !== 'rejected',
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

  // Popular services (last 30 days up to today) + booking source breakdown
  const stats30d = useMemo(() => {
    const startKey = offsetDateKey(-30);
    const windowAppts = appointments.filter(
      (a) =>
        a.date >= startKey &&
        a.date <= todayKey &&
        a.status !== 'cancelled' &&
        a.status !== 'rejected',
    );

    const svcCounts = {};
    for (const s of SERVICE_TYPES) svcCounts[s] = 0;
    const srcCounts = { online: 0, phone: 0, walk_in: 0 };

    for (const a of windowAppts) {
      if (a.service) svcCounts[a.service] = (svcCounts[a.service] ?? 0) + 1;
      const src = a.source ?? 'walk_in';
      srcCounts[src] = (srcCounts[src] ?? 0) + 1;
    }

    const topServices = Object.entries(svcCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const maxSvc = Math.max(1, ...topServices.map((s) => s.count));
    const totalSrc = Math.max(1, windowAppts.length);

    const sourceShares = BOOKING_SOURCE_LIST.map((s) => ({
      ...s,
      count: srcCounts[s.value] ?? 0,
      pct: windowAppts.length ? Math.round(((srcCounts[s.value] ?? 0) / totalSrc) * 100) : 0,
    }));

    return { topServices, maxSvc, sourceShares, total: windowAppts.length };
  }, [appointments, todayKey]);

  // Registered pets upcoming/overdue care reminders
  const registeredPets = useMemo(
    () => patients.filter((p) => p.registered && p.pet),
    [patients],
  );

  const upcomingCareReminders = useMemo(() => {
    const items = [];
    for (const p of registeredPets) {
      for (const r of careReminders([p.pet])) {
        if (r.status === 'overdue' || r.status === 'soon') {
          items.push({ ...r, patient: p });
        }
      }
    }
    return items.sort((a, b) => a.days - b.days).slice(0, 6);
  }, [registeredPets]);

  // Recent 8 activities
  const recentActivities = useMemo(() => {
    const events = [];
    for (const a of appointments) {
      if (a.completedAt) {
        events.push({
          id: `${a.id}-done`,
          time: a.completedAt,
          text: `ปิดเคส ${a.petName} (${a.service})`,
        });
      }
      if (a.treatmentStartedAt) {
        events.push({
          id: `${a.id}-start`,
          time: a.treatmentStartedAt,
          text: `ส่ง ${a.petName} เข้าห้องตรวจกับ ${a.vet}`,
        });
      }
      if (a.checkedInAt) {
        events.push({
          id: `${a.id}-checkin`,
          time: a.checkedInAt,
          text: `${a.petName} เช็คอินแล้ว`,
        });
      }
      if (a.handledAt) {
        events.push({
          id: `${a.id}-handle`,
          time: a.handledAt,
          text:
            a.status === 'rejected'
              ? `ปฏิเสธคำขอของ ${a.petName}`
              : a.rescheduledFrom
                ? `เลื่อนนัด ${a.petName} ไป ${formatDate(a.date)} ${a.time} น.`
                : `อนุมัติคำขอของ ${a.petName}`,
        });
      }
      const reqTime = a.requestedAt ?? a.createdAt;
      if (reqTime) {
        events.push({
          id: `${a.id}-req`,
          time: reqTime,
          text:
            a.source === 'walk_in'
              ? `ลงทะเบียนนัด ${a.petName} (${a.service})`
              : `มีคำขอจองคิว ${a.petName} (${a.service})`,
        });
      }
    }

    return events
      .filter((ev) => ev.time)
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 8);
  }, [appointments]);

  function handleMarkNoShow(appt) {
    if (setStatus(appt.id, 'no_show')) {
      show(`บันทึก ${appt.petName} เป็น "ไม่มาตามนัด" แล้ว`);
    }
  }

  function handleSaveNewAppt(data) {
    addAppointment(data);
    setApptModalOpen(false);
    show(`เพิ่มนัดหมายให้ ${data.petName} แล้ว`);
  }

  function handleConfirmReset() {
    resetAppointments();
    setResetOpen(false);
    show('รีเซ็ตข้อมูลตัวอย่างแล้ว');
  }

  const hourTicks = [];
  for (let m = openMin; m <= closeMin; m += 60) {
    hourTicks.push({
      label: minutesToTime(m),
      pct: ((m - openMin) / spanMin) * 100,
    });
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>{greetingFor(now)}</h1>
          <p>
            {fullThaiDate(now)} · เวลาทำการ {CLINIC_HOURS.open}–{CLINIC_HOURS.close} น.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-soft" onClick={() => setResetOpen(true)}>
            <i className="bi bi-arrow-counterclockwise me-1" />
            รีเซ็ตข้อมูลตัวอย่าง
          </button>
          <Link to="/medical-assistant/patients" className="btn btn-soft">
            <i className="bi bi-search me-1" />
            ค้นหาผู้ป่วย
          </Link>
          <button type="button" className="btn btn-sky" onClick={() => setApptModalOpen(true)}>
            <i className="bi bi-plus-lg me-1" />
            เพิ่มนัดหมาย
          </button>
        </div>
      </div>

      {/* 3.2 Stat 5 cards */}
      <div className="ma-stat-grid-5 mb-4">
        <Link to="/medical-assistant/appointments" className="stat ma-stat-link">
          <span className="tag sky ma-stat-icon" aria-hidden="true">
            <i className="bi bi-calendar2-week" />
          </span>
          <div className="num">{todayActive.length}</div>
          <div className="small fw-medium">นัดวันนี้</div>
          <div className="small text-muted">
            {remainingTodayCount > 0 ? `เหลืออีก ${remainingTodayCount} นัด` : 'ครบทุกนัดแล้ว'}
          </div>
        </Link>

        <Link to="/medical-assistant/medical-support" className="stat ma-stat-link">
          <span className="tag sky ma-stat-icon" aria-hidden="true">
            <i className="bi bi-hospital" />
          </span>
          <div className="num">{inClinicQueue.length}</div>
          <div className="small fw-medium">อยู่ในคลินิก</div>
          <div className="small text-muted">กำลังตรวจ {treatmentList.length} เคส</div>
        </Link>

        <Link to="/medical-assistant/medical-support?tab=triage" className="stat ma-stat-link">
          <span className="tag warn ma-stat-icon" aria-hidden="true">
            <i className="bi bi-thermometer-half" />
          </span>
          <div className="num">{triageList.length}</div>
          <div className="small fw-medium">รอคัดกรอง</div>
          <div className="small text-muted">พร้อมพบหมอ {readyList.length}</div>
        </Link>

        <Link to="/medical-assistant/booking-management" className="stat ma-stat-link">
          <span className="tag warn ma-stat-icon" aria-hidden="true">
            <i className="bi bi-inbox" />
          </span>
          <div className="num">{pendingList.length}</div>
          <div className="small fw-medium">คำขอรอตรวจสอบ</div>
          <div className="small text-muted">
            {overdueList.length > 0 ? `เกินกำหนด ${overdueList.length}` : 'ไม่มีรายการเกินกำหนด'}
          </div>
        </Link>

        <Link to="/medical-assistant/medical-support?tab=completed" className="stat ma-stat-link">
          <span className="tag ok ma-stat-icon" aria-hidden="true">
            <i className="bi bi-check2-circle" />
          </span>
          <div className="num">{completedList.length}</div>
          <div className="small fw-medium">เสร็จแล้ววันนี้</div>
          <div className="small text-muted">ปิดเคสเรียบร้อย</div>
        </Link>
      </div>

      {/* 3.3 & 3.4 Todo & In-clinic Queue */}
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
                  const pid = patientIdForAppt(item.appt);
                  const pat = getPatient(pid);
                  return (
                    <div key={item.key} className="ma-todo-item">
                      <div className="d-flex align-items-start gap-2" style={{ minWidth: 0, flex: 1 }}>
                        <span className={`tag ${item.level} m-0 mt-1 flex-shrink-0`}>
                          <i className={`bi ${item.icon}`} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="fw-medium">
                            <PatientNameLink
                              patientId={pid}
                              petName={item.appt.petName}
                              species={item.appt.species}
                              flags={pat?.flags}
                              allergies={pat?.pet?.allergies}
                            />
                          </div>
                          <div className="small text-muted">{item.text}</div>
                        </div>
                      </div>

                      <div className="ma-actions flex-shrink-0">
                        {item.actionType === 'late' ? (
                          <>
                            {item.appt.ownerPhone && (
                              <a href={`tel:${item.appt.ownerPhone}`} className="btn btn-soft btn-sm">
                                <i className="bi bi-telephone me-1" />
                                โทร
                              </a>
                            )}
                            <button
                              type="button"
                              className="btn btn-soft-danger btn-sm"
                              onClick={() => handleMarkNoShow(item.appt)}
                            >
                              ไม่มา
                            </button>
                          </>
                        ) : (
                          <Link
                            to={item.actionTo}
                            className={`btn ${item.actionVariant} btn-sm`}
                          >
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
              <Link to="/medical-assistant/medical-support" className="small text-decoration-none">
                ไปหน้าสนับสนุนการรักษา
              </Link>
            </div>

            {inClinicQueue.length === 0 ? (
              <div className="empty-box py-4 my-auto">
                <i className="bi bi-bandaid" />
                <div>ยังไม่มีผู้ป่วยเช็คอินเข้าคลินิก</div>
              </div>
            ) : (
              <div className="d-grid gap-2">
                {inClinicQueue.map((appt) => {
                  const pid = patientIdForAppt(appt);
                  const pat = getPatient(pid);
                  const visit = getVisit(appt.id);
                  const st = APPOINTMENT_STATUS[appt.status] ?? APPOINTMENT_STATUS.checked_in;
                  const triageMeta = visit?.triage ? TRIAGE_LEVELS[visit.triage] : null;
                  const waitText = formatWaitText(waitMinutes(appt, now));

                  return (
                    <div key={appt.id} className="ma-todo-item">
                      <div className="d-flex align-items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                        <PetPhoto
                          pet={{ name: appt.petName, species: appt.species, photo: pat?.pet?.photo }}
                          size="xs"
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className="d-flex flex-wrap align-items-center gap-1">
                            <PatientNameLink
                              patientId={pid}
                              petName={appt.petName}
                              species={appt.species}
                              flags={pat?.flags}
                              allergies={pat?.pet?.allergies}
                              showEmoji={false}
                            />
                            <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                            {triageMeta && (
                              <span className={`tag ${triageMeta.tag} m-0`}>{triageMeta.label}</span>
                            )}
                          </div>
                          <div className="small text-muted">
                            {appt.service} · {waitText}
                          </div>
                        </div>
                      </div>
                      <Link
                        to={`/medical-assistant/medical-support/${appt.id}`}
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

      {/* 3.5 Vet Schedule Today */}
      <div className="card-soft mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="section-label mb-0">
            <i className="bi bi-calendar2-range" />
            ตารางสัตวแพทย์วันนี้
          </div>
          <div className="d-flex flex-wrap gap-2 small">
            <span className="tag ok m-0">เสร็จสิ้น</span>
            <span className="tag sky m-0">ในคลินิก / ยืนยันแล้ว</span>
            <span className="tag warn m-0">รอยืนยัน</span>
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

            {VETS.map((vet) => {
              const vetAppts = todayAll.filter(
                (a) => a.vet === vet.name && !GANTT_HIDDEN_STATUSES.includes(a.status),
              );
              const nextSlot = suggestSlots(
                appointments,
                { vet: vet.name, date: todayKey, durationMin: 30 },
                1,
              )[0];

              return (
                <div className="ma-gantt-row" key={vet.name}>
                  <div className="ma-gantt-vet">
                    <div className="fw-medium small text-truncate" title={vet.name}>
                      {vet.name}
                    </div>
                    <div className="small text-muted">
                      {nextSlot ? `ว่างถัดไป ${nextSlot} น.` : 'ไม่มีคิวว่างวันนี้'}
                    </div>
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
                      const dur = Number(a.durationMin) || 30;
                      if (sMin + dur <= openMin || sMin >= closeMin) return null;
                      const clampedStart = Math.max(openMin, Math.min(closeMin, sMin));
                      const clampedEnd = Math.max(clampedStart + 10, Math.min(closeMin, sMin + dur));
                      const leftPct = ((clampedStart - openMin) / spanMin) * 100;
                      const widthPct = Math.max(4, ((clampedEnd - clampedStart) / spanMin) * 100);
                      const endText = minutesToTime(sMin + dur);

                      return (
                        <Link
                          key={a.id}
                          to={`/medical-assistant/appointments?date=${todayKey}`}
                          className={`ma-gantt-bar ${ganttBarModifier(a.status)}`}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          title={`${a.time}–${endText} น. · ${a.petName} (${a.service})`}
                        >
                          <span className="text-truncate">{a.petName}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3.6 Bottom 3 Cards */}
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
                    to={`/medical-assistant/appointments?date=${d.date}`}
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
              aria-label={`บริการยอดนิยม 30 วัน: ${stats30d.topServices
                .map((s) => `${s.name} ${s.count} ครั้ง`)
                .join(', ')}`}
            >
              {stats30d.topServices.map((s) => {
                const widthPct = stats30d.maxSvc ? Math.round((s.count / stats30d.maxSvc) * 100) : 0;
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

            <div className="mt-auto pt-3" style={{ borderTop: '1px solid var(--baby)' }}>
              <div className="small fw-medium mb-2">
                สัดส่วนช่องทางการจอง ({stats30d.total} รายการ)
              </div>
              <div
                className="ma-source-bar mb-2"
                role="img"
                aria-label={`สัดส่วนช่องทางการจอง: ${stats30d.sourceShares
                  .map((s) => `${s.label} ${s.pct}%`)
                  .join(', ')}`}
              >
                {stats30d.sourceShares.map((s) =>
                  s.pct > 0 ? (
                    <div
                      key={s.value}
                      className={`ma-source-seg--${s.value}`}
                      style={{ width: `${s.pct}%` }}
                      title={`${s.label}: ${s.count} (${s.pct}%)`}
                    />
                  ) : null,
                )}
              </div>
              <div className="d-flex flex-wrap gap-3 small text-muted">
                {stats30d.sourceShares.map((s) => (
                  <span key={s.value} className="d-inline-flex align-items-center gap-1">
                    <span className={`ma-dot ma-dot--${s.value}`} />
                    {s.label} {s.pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-12 col-lg-4">
          <div className="card-soft h-100 d-flex flex-column">
            <div className="section-label">
              <i className="bi bi-heart-pulse" />
              ใกล้ครบกำหนดดูแล
            </div>

            {registeredPets.length === 0 ? (
              <div className="empty-box py-4 my-auto">
                <i className="bi bi-heart" />
                <div>ยังไม่มีสัตว์ที่เจ้าของลงทะเบียน</div>
              </div>
            ) : upcomingCareReminders.length === 0 ? (
              <div className="empty-box py-4 my-auto">
                <i className="bi bi-check2-circle" />
                <div>ไม่มีรายการใกล้ครบกำหนดใน 30 วัน</div>
              </div>
            ) : (
              <div className="d-grid gap-2">
                {upcomingCareReminders.map((r, idx) => (
                  <div className="ma-todo-item" key={`${r.patient.patientId}-${r.title}-${idx}`}>
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-medium small">
                        <PatientNameLink
                          patientId={r.patient.patientId}
                          petName={r.patient.petName}
                          species={r.patient.species}
                          flags={r.patient.flags}
                          allergies={r.patient.pet?.allergies}
                        />
                      </div>
                      <div className="small text-muted">{r.title}</div>
                      <span className={`tag ${r.status === 'overdue' ? 'danger' : 'warn'} m-0 mt-1`}>
                        {reminderText(r)}
                      </span>
                    </div>
                    {r.patient.owner.phone && (
                      <a
                        href={`tel:${r.patient.owner.phone}`}
                        className="btn btn-soft btn-sm flex-shrink-0"
                        title={`โทรหา ${r.patient.owner.name}`}
                      >
                        <i className="bi bi-telephone" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3.7 Recent Activity */}
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

      <AppointmentModal
        open={apptModalOpen}
        initialData={null}
        appointments={appointments}
        defaultDate={todayKey}
        onClose={() => setApptModalOpen(false)}
        onSave={handleSaveNewAppt}
      />

      <ConfirmModal
        open={resetOpen}
        title="รีเซ็ตข้อมูลตัวอย่าง"
        icon="bi-arrow-counterclockwise"
        message="ข้อมูลนัดหมายและข้อมูลสนับสนุนการรักษาทั้งหมดจะถูกแทนที่ด้วยข้อมูลตัวอย่างเริ่มต้น ต้องการดำเนินการต่อหรือไม่?"
        confirmLabel="รีเซ็ตข้อมูล"
        cancelLabel="ยกเลิก"
        confirmVariant="sky"
        onClose={() => setResetOpen(false)}
        onConfirm={handleConfirmReset}
      />

      {toast}
    </section>
  );
}
