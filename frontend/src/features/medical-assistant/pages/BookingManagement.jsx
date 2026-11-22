import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import ApproveBookingModal from '../components/ApproveBookingModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import RejectBookingModal from '../components/RejectBookingModal.jsx';
import {
  APPOINTMENT_STATUS,
  BOOKING_SOURCE_LIST,
  VETS,
  offsetDateKey,
  sourceOf,
  toDateKey,
} from '../data/constants.js';
import { findConflict } from '../data/schedule.js';
import {
  awaitingReschedule,
  overdueBookings,
  pendingBookings,
  relativeTimeLabel,
} from '../data/selectors.js';
import { useAppointments } from '../data/useAppointments.js';
import { usePatients } from '../data/usePatients.js';

function formatHandledAt(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const datePart = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart} น.`;
}

function hasRescheduledTime(appt) {
  return (
    Boolean(appt.rescheduledFrom) &&
    (appt.rescheduledFrom.date !== appt.date || appt.rescheduledFrom.time !== appt.time)
  );
}

/**
 * Booking Management — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function BookingManagementPage() {
  const {
    appointments,
    approveBooking,
    rejectBooking,
    rescheduleAppointment,
    resetAppointments,
  } = useAppointments();
  const { getPatient, patientIdForAppt } = usePatients();
  const { show, toast } = useToast();

  const todayKey = offsetDateKey(0);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');

  const [tab, setTab] = useState(
    initialTab === 'reschedule' || initialTab === 'history' ? initialTab : 'requests',
  );
  const [sourceFilter, setSourceFilter] = useState('all');
  const [vetFilter, setVetFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [approveModal, setApproveModal] = useState({ open: false, booking: null, mode: 'approve' });
  const [rejectTarget, setRejectTarget] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  const pendingList = useMemo(() => pendingBookings(appointments), [appointments]);
  const noShowList = useMemo(() => awaitingReschedule(appointments), [appointments]);

  const historyList = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    return appointments
      .filter((a) => a.handledAt && new Date(a.handledAt).getTime() >= sevenDaysAgo)
      .sort((a, b) => (b.handledAt || '').localeCompare(a.handledAt || ''));
  }, [appointments]);

  const overdueCount = useMemo(
    () => overdueBookings(appointments, todayKey).length,
    [appointments, todayKey],
  );

  const approvedTodayCount = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.handledAt &&
          toDateKey(new Date(a.handledAt)) === todayKey &&
          a.status !== 'rejected' &&
          a.status !== 'cancelled',
      ).length,
    [appointments, todayKey],
  );

  const filterList = useMemo(() => {
    const base = tab === 'requests' ? pendingList : tab === 'reschedule' ? noShowList : historyList;
    const q = query.trim().toLowerCase();
    return base.filter((a) => {
      if (sourceFilter !== 'all' && (a.source ?? 'walk_in') !== sourceFilter) return false;
      if (vetFilter !== 'all' && a.vet !== vetFilter) return false;
      if (q) {
        const hit = [a.petName, a.ownerName, a.ownerPhone].some((v) =>
          v?.toLowerCase().includes(q),
        );
        if (!hit) return false;
      }
      return true;
    });
  }, [tab, pendingList, noShowList, historyList, sourceFilter, vetFilter, query]);

  const hasActiveFilter = sourceFilter !== 'all' || vetFilter !== 'all' || query.trim() !== '';

  function clearFilters() {
    setSourceFilter('all');
    setVetFilter('all');
    setQuery('');
  }

  function handleDirectApprove(appt) {
    if (approveBooking(appt.id)) {
      show(`อนุมัติคำขอจองของ ${appt.petName} แล้ว`);
    }
  }

  function handleConfirmModal(values) {
    const { booking, mode } = approveModal;
    if (!booking) return;

    if (mode === 'reschedule') {
      const created = rescheduleAppointment(booking.id, values);
      if (created) {
        show(`เลื่อนนัด ${booking.petName} ไป ${formatDate(values.date)} ${values.time} น. แล้ว`);
      }
    } else if (approveBooking(booking.id, values)) {
      show(`ยืนยันการจองของ ${booking.petName} แล้ว`);
    }
    setApproveModal({ open: false, booking: null, mode: 'approve' });
  }

  function handleConfirmReject({ reason, note }) {
    if (!rejectTarget) return;
    if (rejectBooking(rejectTarget.id, { reason, note })) {
      show(`ปฏิเสธคำขอของ ${rejectTarget.petName} แล้ว`);
    }
    setRejectTarget(null);
  }

  function handleConfirmReset() {
    resetAppointments();
    clearFilters();
    setResetOpen(false);
    show('รีเซ็ตข้อมูลตัวอย่างแล้ว');
  }

  const tabs = [
    { id: 'requests', label: 'คำขอใหม่', icon: 'bi-inbox', count: pendingList.length },
    { id: 'reschedule', label: 'รอเลื่อนนัด', icon: 'bi-calendar-event', count: noShowList.length },
    { id: 'history', label: 'ประวัติการจัดการ', icon: 'bi-clock-history', count: historyList.length },
  ];

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>จัดการการจอง</h1>
          <p>ตรวจสอบและยืนยันคำขอจองคิวจากลูกค้า และติดตามนัดที่ต้องเลื่อน</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-soft" onClick={() => setResetOpen(true)}>
            <i className="bi bi-arrow-counterclockwise me-1" />
            รีเซ็ตข้อมูลตัวอย่าง
          </button>
        </div>
      </div>

      <div className="row g-2 g-md-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag warn ma-stat-icon" aria-hidden="true">
              <i className="bi bi-inbox" />
            </span>
            <div className="num">{pendingList.length}</div>
            <div className="small text-muted">คำขอรอตรวจสอบ</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag danger ma-stat-icon" aria-hidden="true">
              <i className="bi bi-exclamation-circle" />
            </span>
            <div className="num">{overdueCount}</div>
            <div className="small text-muted">เกินกำหนด</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag ok ma-stat-icon" aria-hidden="true">
              <i className="bi bi-check2-circle" />
            </span>
            <div className="num">{approvedTodayCount}</div>
            <div className="small text-muted">อนุมัติวันนี้</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag sky ma-stat-icon" aria-hidden="true">
              <i className="bi bi-calendar-event" />
            </span>
            <div className="num">{noShowList.length}</div>
            <div className="small text-muted">ไม่มาตามนัดที่รอเลื่อน</div>
          </div>
        </div>
      </div>

      <div className="card-soft mb-4">
        <div className="pill-tabs ma-status-tabs mb-3" role="tablist" aria-label="หมวดหมู่การจัดการการจอง">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              <i className={`bi ${t.icon}`} />
              {t.label}
              <span className="count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="ma-filter-bar">
          <select
            className="form-select w-auto"
            aria-label="กรองตามช่องทางการจอง"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">ช่องทางทั้งหมด</option>
            {BOOKING_SOURCE_LIST.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            className="form-select w-auto"
            aria-label="กรองตามสัตวแพทย์"
            value={vetFilter}
            onChange={(e) => setVetFilter(e.target.value)}
          >
            <option value="all">สัตวแพทย์ทั้งหมด</option>
            {VETS.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>

          <div className="input-group ma-search-group">
            <span className="input-group-text">
              <i className="bi bi-search" />
            </span>
            <input
              type="search"
              className="form-control"
              placeholder="ค้นหาชื่อสัตว์ / เจ้าของ / เบอร์"
              aria-label="ค้นหาการจอง"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {hasActiveFilter && (
            <button type="button" className="btn btn-soft btn-sm" onClick={clearFilters}>
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {filterList.length === 0 ? (
        <div className="card-soft">
          <div className="empty-box">
            <i
              className={`bi ${
                tab === 'requests'
                  ? 'bi-inbox'
                  : tab === 'reschedule'
                    ? 'bi-calendar-check'
                    : 'bi-clock-history'
              }`}
            />
            <div>
              {hasActiveFilter
                ? 'ไม่พบรายการที่ตรงกับตัวกรอง'
                : tab === 'requests'
                  ? 'ไม่มีคำขอจองใหม่ที่รอตรวจสอบ'
                  : tab === 'reschedule'
                    ? 'ไม่มีนัดค้างเลื่อนในขณะนี้'
                    : 'ยังไม่มีประวัติการจัดการใน 7 วันล่าสุด'}
            </div>
            {hasActiveFilter && (
              <button type="button" className="btn btn-soft mt-3" onClick={clearFilters}>
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      ) : tab === 'requests' ? (
        <div className="row g-3">
          {filterList.map((appt) => {
            const sp = speciesOf(appt.species);
            const src = sourceOf(appt.source);
            const isOverdue = appt.date < todayKey;
            const pid = patientIdForAppt(appt);
            const pat = getPatient(pid);
            const conflict = findConflict(
              appointments,
              {
                vet: appt.vet,
                date: appt.date,
                time: appt.time,
                durationMin: appt.durationMin,
              },
              appt.id,
            );

            return (
              <div className="col-12 col-lg-6" key={appt.id}>
                <div className="card-soft ma-request-card h-100 d-flex flex-column">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                    <div>
                      <div className="mitr fs-5 lh-sm">
                        <PatientNameLink
                          patientId={pid}
                          petName={appt.petName}
                          species={appt.species}
                          flags={pat?.flags}
                          allergies={pat?.pet?.allergies}
                        />{' '}
                        <span className="small text-muted fw-normal">· {sp.label}</span>
                      </div>
                      <div className="small text-muted mt-1">
                        {relativeTimeLabel(appt.requestedAt ?? appt.createdAt, new Date(), 'ส่งคำขอเมื่อ ')}
                      </div>
                    </div>
                    <span className={`tag ${src.tag} m-0`}>
                      <i className={`bi ${src.icon} me-1`} />
                      {src.label}
                    </span>
                  </div>

                  <div className="small mb-2 d-grid gap-1">
                    <div>
                      <i className="bi bi-person me-1 text-sky" />
                      {appt.ownerName} · <span className="text-muted">{appt.ownerPhone}</span>
                    </div>
                    <div>
                      <i className="bi bi-clipboard2-pulse me-1 text-sky" />
                      <strong>{appt.service}</strong> · {appt.vet}
                    </div>
                    <div>
                      <i className="bi bi-calendar-event me-1 text-sky" />
                      วันเวลาที่ขอ: <strong>{formatDate(appt.date)}</strong> เวลา{' '}
                      <strong>{appt.time} น.</strong> ({appt.durationMin} นาที)
                    </div>
                    {appt.reason && (
                      <div className="text-muted">
                        <i className="bi bi-chat-left-text me-1 text-sky" />
                        อาการ: {appt.reason}
                      </div>
                    )}
                  </div>

                  {isOverdue && (
                    <div className="alert-soft danger mb-2">
                      <i className="bi bi-exclamation-circle" />
                      <span>เลยวันนัดแล้ว กรุณาติดต่อลูกค้า</span>
                    </div>
                  )}

                  {conflict && (
                    <div className="alert-soft warn mb-2">
                      <i className="bi bi-exclamation-triangle" />
                      <span>
                        เวลาชนกับ {conflict.petName} ({conflict.rangeText}) — {appt.vet}
                      </span>
                    </div>
                  )}

                  <div className="ma-actions mt-auto pt-2">
                    <button
                      type="button"
                      className="btn btn-sky btn-sm"
                      disabled={Boolean(conflict)}
                      title={
                        conflict
                          ? `เวลาชนกับ ${conflict.petName} (${conflict.rangeText}) กรุณาเปลี่ยนเวลา/หมอก่อน`
                          : 'อนุมัติคำขอนี้'
                      }
                      onClick={() => handleDirectApprove(appt)}
                    >
                      <i className="bi bi-check2 me-1" />
                      อนุมัติ
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() =>
                        setApproveModal({ open: true, booking: appt, mode: 'approve' })
                      }
                    >
                      เปลี่ยนเวลา/หมอ
                    </button>
                    <button
                      type="button"
                      className="btn btn-soft-danger btn-sm"
                      onClick={() => setRejectTarget(appt)}
                    >
                      ปฏิเสธ
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === 'reschedule' ? (
        <div className="card-soft">
          <div className="section-label">
            <i className="bi bi-calendar-event" />
            นัดที่ไม่มาตามกำหนด ({filterList.length} รายการ)
          </div>

          <div className="d-none d-md-block table-responsive">
            <table className="ma-table">
              <thead>
                <tr>
                  <th>วันเวลาเดิม</th>
                  <th>สัตว์</th>
                  <th>เจ้าของ</th>
                  <th>บริการ</th>
                  <th>สัตวแพทย์</th>
                  <th>ช่องทาง</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filterList.map((appt) => {
                  const sp = speciesOf(appt.species);
                  const src = sourceOf(appt.source);
                  return (
                    <tr key={appt.id}>
                      <td className="text-nowrap">
                        <div className="fw-medium">{formatDate(appt.date)}</div>
                        <div className="small text-muted">{appt.time} น.</div>
                      </td>
                      <td className="text-nowrap">
                        <div className="fw-medium">
                          <span className="me-1" aria-hidden="true">{sp.emoji}</span>
                          {appt.petName}
                        </div>
                        <div className="small text-muted">{sp.label}</div>
                      </td>
                      <td>
                        <div>{appt.ownerName}</div>
                        <div className="small text-muted text-nowrap">{appt.ownerPhone}</div>
                      </td>
                      <td className="ma-service-cell">
                        <div>{appt.service}</div>
                        {appt.notes && (
                          <div className="small text-muted text-truncate d-none d-xl-block" style={{ maxWidth: 210 }} title={appt.notes}>
                            {appt.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="small ma-vet-cell" title={appt.vet}>
                          {appt.vet}
                        </div>
                      </td>
                      <td className="text-nowrap">
                        <span className={`tag ${src.tag} m-0`}>
                          <i className={`bi ${src.icon} me-1`} />
                          {src.label}
                        </span>
                      </td>
                      <td className="text-nowrap">
                        <div className="ma-actions">
                          <button
                            type="button"
                            className="btn btn-sky btn-sm"
                            onClick={() =>
                              setApproveModal({ open: true, booking: appt, mode: 'reschedule' })
                            }
                          >
                            <i className="bi bi-calendar-plus me-1" />
                            เลื่อนนัด
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="d-md-none d-grid gap-3">
            {filterList.map((appt) => {
              const sp = speciesOf(appt.species);
              const src = sourceOf(appt.source);
              return (
                <div className="record-row mb-0 pb-3" key={appt.id}>
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <div className="mitr">
                      {formatDate(appt.date)} · {appt.time} น.
                    </div>
                    <span className={`tag ${src.tag} m-0`}>
                      <i className={`bi ${src.icon} me-1`} />
                      {src.label}
                    </span>
                  </div>
                  <div className="fw-medium mb-1">
                    <span className="me-1" aria-hidden="true">{sp.emoji}</span>
                    {appt.petName} <span className="small text-muted fw-normal">· {sp.label}</span>
                  </div>
                  <div className="small text-muted mb-1">
                    <i className="bi bi-person me-1" />
                    {appt.ownerName} · {appt.ownerPhone}
                  </div>
                  <div className="small mb-2">
                    <i className="bi bi-clipboard2-pulse me-1 text-sky" />
                    {appt.service} · {appt.vet}
                  </div>
                  {appt.notes && <div className="small text-muted mb-2">{appt.notes}</div>}
                  <div className="ma-actions">
                    <button
                      type="button"
                      className="btn btn-sky btn-sm"
                      onClick={() =>
                        setApproveModal({ open: true, booking: appt, mode: 'reschedule' })
                      }
                    >
                      <i className="bi bi-calendar-plus me-1" />
                      เลื่อนนัด
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card-soft">
          <div className="section-label">
            <i className="bi bi-clock-history" />
            ประวัติการจัดการ 7 วันล่าสุด ({filterList.length} รายการ)
          </div>

          <div className="d-none d-md-block table-responsive">
            <table className="ma-table">
              <thead>
                <tr>
                  <th>เวลาที่จัดการ</th>
                  <th>สัตว์</th>
                  <th>เจ้าของ</th>
                  <th>ผลลัพธ์</th>
                  <th>วันนัด</th>
                  <th>เหตุผล</th>
                </tr>
              </thead>
              <tbody>
                {filterList.map((appt) => {
                  const sp = speciesOf(appt.species);
                  const isRejected = appt.status === 'rejected';
                  const st = APPOINTMENT_STATUS[appt.status] ?? APPOINTMENT_STATUS.confirmed;
                  const resultTag = isRejected ? st : APPOINTMENT_STATUS.confirmed;
                  const shifted = hasRescheduledTime(appt);

                  return (
                    <tr key={appt.id}>
                      <td className="text-nowrap small">{formatHandledAt(appt.handledAt)}</td>
                      <td className="text-nowrap">
                        <div className="fw-medium">
                          <span className="me-1" aria-hidden="true">{sp.emoji}</span>
                          {appt.petName}
                        </div>
                        <div className="small text-muted">{appt.service}</div>
                      </td>
                      <td>
                        <div>{appt.ownerName}</div>
                        <div className="small text-muted text-nowrap">{appt.ownerPhone}</div>
                      </td>
                      <td className="text-nowrap">
                        <span className={`tag ${resultTag.tag} m-0`}>
                          {isRejected ? resultTag.label : shifted ? 'อนุมัติ (เลื่อนเวลา)' : 'อนุมัติแล้ว'}
                        </span>
                      </td>
                      <td className="ma-service-cell">
                        {shifted ? (
                          <div className="small">
                            <span className="text-muted">
                              {formatDate(appt.rescheduledFrom.date)} {appt.rescheduledFrom.time}
                            </span>
                            {' → '}
                            <strong>
                              {formatDate(appt.date)} {appt.time} น.
                            </strong>
                          </div>
                        ) : (
                          <div className="small">
                            {formatDate(appt.date)} · {appt.time} น.
                          </div>
                        )}
                      </td>
                      <td className="small">
                        {isRejected ? (
                          <div>
                            <div>{appt.rejectReason || '—'}</div>
                            {appt.rejectNote && (
                              <div className="text-muted text-truncate" style={{ maxWidth: 200 }} title={appt.rejectNote}>
                                {appt.rejectNote}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="d-md-none d-grid gap-3">
            {filterList.map((appt) => {
              const sp = speciesOf(appt.species);
              const isRejected = appt.status === 'rejected';
              const st = APPOINTMENT_STATUS[appt.status] ?? APPOINTMENT_STATUS.confirmed;
              const resultTag = isRejected ? st : APPOINTMENT_STATUS.confirmed;
              const shifted = hasRescheduledTime(appt);

              return (
                <div className="record-row mb-0 pb-3" key={appt.id}>
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <div className="small text-muted">{formatHandledAt(appt.handledAt)}</div>
                    <span className={`tag ${resultTag.tag} m-0`}>
                      {isRejected ? resultTag.label : shifted ? 'อนุมัติ (เลื่อนเวลา)' : 'อนุมัติแล้ว'}
                    </span>
                  </div>
                  <div className="fw-medium mb-1">
                    <span className="me-1" aria-hidden="true">{sp.emoji}</span>
                    {appt.petName} <span className="small text-muted fw-normal">· {appt.service}</span>
                  </div>
                  <div className="small text-muted mb-1">
                    {appt.ownerName} · {appt.ownerPhone}
                  </div>
                  <div className="small mb-1">
                    วันนัด:{' '}
                    {shifted
                      ? `${formatDate(appt.rescheduledFrom.date)} ${appt.rescheduledFrom.time} → ${formatDate(appt.date)} ${appt.time} น.`
                      : `${formatDate(appt.date)} · ${appt.time} น.`}
                  </div>
                  {isRejected && (
                    <div className="small text-muted">
                      เหตุผล: {appt.rejectReason || '—'}
                      {appt.rejectNote ? ` (${appt.rejectNote})` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ApproveBookingModal
        open={approveModal.open}
        booking={approveModal.booking}
        mode={approveModal.mode}
        appointments={appointments}
        onClose={() => setApproveModal({ open: false, booking: null, mode: 'approve' })}
        onConfirm={handleConfirmModal}
      />

      <RejectBookingModal
        open={Boolean(rejectTarget)}
        booking={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleConfirmReject}
      />

      <ConfirmModal
        open={resetOpen}
        title="รีเซ็ตข้อมูลตัวอย่าง"
        icon="bi-arrow-counterclockwise"
        message="ข้อมูลนัดหมายและคำขอจองทั้งหมดจะถูกแทนที่ด้วยข้อมูลตัวอย่างเริ่มต้น ต้องการดำเนินการต่อหรือไม่?"
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
