import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import ApproveBookingModal from '../components/ApproveBookingModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import MaDataState from '../components/MaDataState.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import RejectBookingModal from '../components/RejectBookingModal.jsx';
import {
  STAGE_META,
  VETS,
  offsetDateKey,
  toDateKey,
} from '../data/constants.js';
import {
  needsContact,
  overdueBookings,
  pendingBookings,
  relativeTimeLabel,
} from '../data/selectors.js';
import { useAppointments } from '../data/useAppointments.js';
import { usePatients } from '../data/usePatients.js';

function formatHandledAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart} น.`;
}

function hasRescheduledTime(appt) {
  const from = appt.visit?.rescheduledFrom;
  return Boolean(from && (from.date !== appt.date || from.time !== appt.time));
}

function normalizeTab(param) {
  if (param === 'contact' || param === 'needs_contact' || param === 'reschedule') return 'contact';
  if (param === 'history') return 'history';
  return 'pending';
}

/**
 * Booking Management — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function BookingManagementPage() {
  const {
    appointments,
    loading,
    error,
    reload,
    meta,
    confirm,
    reject,
    reschedule,
    markContacted,
  } = useAppointments();
  const { patients } = usePatients();
  const { show, toast } = useToast();

  const todayKey = offsetDateKey(0);
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState(() => normalizeTab(searchParams.get('tab')));
  const [vetFilter, setVetFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [contactTarget, setContactTarget] = useState(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState('');

  const patientsById = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients],
  );

  const vetNames = useMemo(
    () => (meta?.VET_NAMES?.length ? meta.VET_NAMES : VETS.map((v) => v.name)),
    [meta],
  );

  const pendingList = useMemo(() => pendingBookings(appointments), [appointments]);
  const needsContactList = useMemo(() => needsContact(appointments), [appointments]);

  const historyList = useMemo(() => {
    return appointments
      .filter((a) => {
        if (a.status === 'rejected' && a.visit?.handledAt) return true;
        if (
          ['confirmed', 'checked_in', 'in_treatment', 'completed'].includes(a.stage) &&
          a.visit?.handledAt
        ) {
          return true;
        }
        if (a.stage === 'no_show' && a.visit?.contactedAt) return true;
        return false;
      })
      .sort((a, b) => {
        const ta = a.visit?.contactedAt ?? a.visit?.handledAt ?? '';
        const tb = b.visit?.contactedAt ?? b.visit?.handledAt ?? '';
        return tb.localeCompare(ta);
      });
  }, [appointments]);

  const overdueCount = useMemo(
    () => overdueBookings(appointments, todayKey).length,
    [appointments, todayKey],
  );

  const confirmedTodayCount = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.visit?.handledAt &&
          toDateKey(new Date(a.visit.handledAt)) === todayKey &&
          a.status !== 'rejected' &&
          a.status !== 'cancelled',
      ).length,
    [appointments, todayKey],
  );

  const filterList = useMemo(() => {
    const base =
      tab === 'pending' ? pendingList : tab === 'contact' ? needsContactList : historyList;
    const q = query.trim().toLowerCase();
    return base.filter((a) => {
      if (vetFilter !== 'all' && (a.visit?.vet ?? '') !== vetFilter) return false;
      if (q) {
        const hit = [a.petName, a.ownerName, a.ownerPhone, a.serviceLabel].some((v) =>
          v?.toLowerCase().includes(q),
        );
        if (!hit) return false;
      }
      return true;
    });
  }, [tab, pendingList, needsContactList, historyList, vetFilter, query]);

  const hasActiveFilter = vetFilter !== 'all' || query.trim() !== '';
  const hasData = Boolean(meta) || appointments.length > 0;
  const blockedByState = !hasData && (loading || Boolean(error));

  function clearFilters() {
    setVetFilter('all');
    setQuery('');
  }

  function handleApproveSuccess() {
    setApproveTarget(null);
    show('ยืนยันแล้ว — นัดนี้แสดงในหน้าสัตวแพทย์แล้ว');
  }

  async function handleConfirmReject({ reason, note }) {
    if (!rejectTarget) return;
    const petName = rejectTarget.petName;
    await reject(rejectTarget.id, { reason, note });
    setRejectTarget(null);
    show(`ปฏิเสธคำขอของ ${petName} แล้ว`);
  }

  function openContactConfirm(appt) {
    setContactError('');
    setContactTarget(appt);
  }

  async function handleConfirmContacted() {
    if (!contactTarget) return;
    setContactSubmitting(true);
    setContactError('');
    try {
      await markContacted(contactTarget.id);
      show(`บันทึกว่าติดต่อเจ้าของของ ${contactTarget.petName} แล้ว`);
      setContactTarget(null);
    } catch (err) {
      setContactError(err?.message || 'ไม่สามารถบันทึกการติดต่อได้');
    } finally {
      setContactSubmitting(false);
    }
  }

  const tabs = [
    { id: 'pending', label: 'รอยืนยัน', icon: 'bi-inbox', count: pendingList.length },
    {
      id: 'contact',
      label: 'ติดต่อให้จองใหม่',
      icon: 'bi-telephone-outbound',
      count: needsContactList.length,
    },
    { id: 'history', label: 'ประวัติการจัดการ', icon: 'bi-clock-history', count: historyList.length },
  ];

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>จัดการการจอง</h1>
          <p>คัดกรองและยืนยันคำขอจองจากเจ้าของสัตว์ และติดตามนัดที่ไม่มาตามกำหนด</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-soft" disabled={loading} onClick={reload}>
            <i className="bi bi-arrow-clockwise me-1" />
            รีเฟรช
          </button>
        </div>
      </div>

      <MaDataState loading={loading} error={error} hasData={hasData} onRetry={reload} />

      {!blockedByState && (
        <>
          <div className="row g-2 g-md-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="stat">
                <span className="tag warn ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-inbox" />
                </span>
                <div className="num">{pendingList.length}</div>
                <div className="small text-muted">รอยืนยัน</div>
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
                <div className="num">{confirmedTodayCount}</div>
                <div className="small text-muted">ยืนยันวันนี้</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat">
                <span className="tag sky ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-telephone-outbound" />
                </span>
                <div className="num">{needsContactList.length}</div>
                <div className="small text-muted">ติดต่อให้จองใหม่</div>
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
              {tab !== 'pending' && (
                <select
                  className="form-select w-auto"
                  aria-label="กรองตามสัตวแพทย์"
                  value={vetFilter}
                  onChange={(e) => setVetFilter(e.target.value)}
                >
                  <option value="all">สัตวแพทย์ทั้งหมด</option>
                  {vetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}

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
                    tab === 'pending'
                      ? 'bi-inbox'
                      : tab === 'contact'
                        ? 'bi-telephone-check'
                        : 'bi-clock-history'
                  }`}
                />
                <div>
                  {hasActiveFilter
                    ? 'ไม่พบรายการที่ตรงกับตัวกรอง'
                    : tab === 'pending'
                      ? 'ไม่มีคำขอจองใหม่ที่รอยืนยัน'
                      : tab === 'contact'
                        ? 'ไม่มีรายการรอติดต่อให้จองใหม่ในขณะนี้'
                        : 'ยังไม่มีประวัติการจัดการ'}
                </div>
                {hasActiveFilter && (
                  <button type="button" className="btn btn-soft mt-3" onClick={clearFilters}>
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            </div>
          ) : tab === 'pending' ? (
            <div className="row g-3">
              {filterList.map((appt) => {
                const sp = speciesOf(appt.petSpecies);
                const isOverdue = appt.date < todayKey;
                const pat = patientsById.get(appt.petId);
                const allergies = appt.pet?.allergies ?? pat?.allergies ?? '';
                const chronicDiseases = appt.pet?.chronicDiseases ?? pat?.chronicDiseases ?? '';

                return (
                  <div className="col-12 col-lg-6" key={appt.id}>
                    <div className="card-soft ma-request-card h-100 d-flex flex-column">
                      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                        <div>
                          <div className="mitr fs-5 lh-sm">
                            <PatientNameLink
                              petId={appt.petId}
                              petName={appt.petName}
                              petSpecies={appt.petSpecies}
                              flags={pat?.flags}
                              allergies={allergies}
                            />{' '}
                            <span className="small text-muted fw-normal">· {sp.label}</span>
                          </div>
                          <div className="small text-muted mt-1">
                            {relativeTimeLabel(appt.createdAt, new Date(), 'ส่งคำขอเมื่อ ')}
                          </div>
                        </div>
                        <span className="tag warn m-0">รอยืนยัน</span>
                      </div>

                      <div className="small mb-2 d-grid gap-1">
                        <div>
                          <i className="bi bi-person me-1 text-sky" />
                          {appt.ownerName || '—'} ·{' '}
                          {appt.ownerPhone ? (
                            <a href={`tel:${appt.ownerPhone}`} className="text-decoration-none">
                              {appt.ownerPhone}
                            </a>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                        <div>
                          <i className="bi bi-clipboard2-pulse me-1 text-sky" />
                          <strong>{appt.serviceLabel || appt.service}</strong>
                        </div>
                        <div>
                          <i className="bi bi-calendar-event me-1 text-sky" />
                          วันเวลาที่ขอ: <strong>{formatDate(appt.date)}</strong> เวลา{' '}
                          <strong>{appt.time} น.</strong>
                        </div>
                        {appt.note && (
                          <div className="text-muted">
                            <i className="bi bi-chat-left-text me-1 text-sky" />
                            ข้อความเจ้าของ: {appt.note}
                          </div>
                        )}
                      </div>

                      {(allergies || chronicDiseases) && (
                        <div className="alert-soft danger mb-2">
                          <i className="bi bi-exclamation-triangle-fill" />
                          <span className="small">
                            {allergies && `แพ้: ${allergies}`}
                            {allergies && chronicDiseases && ' · '}
                            {chronicDiseases && `โรคประจำตัว: ${chronicDiseases}`}
                          </span>
                        </div>
                      )}

                      {isOverdue && (
                        <div className="alert-soft danger mb-2">
                          <i className="bi bi-exclamation-circle" />
                          <span>เลยวันนัดที่ขอแล้ว กรุณาเปลี่ยนวันเวลาหรือปฏิเสธคำขอ</span>
                        </div>
                      )}

                      <div className="ma-actions mt-auto pt-2">
                        <button
                          type="button"
                          className="btn btn-sky btn-sm"
                          onClick={() => setApproveTarget(appt)}
                        >
                          <i className="bi bi-check2 me-1" />
                          ยืนยันและเลือกหมอ
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
          ) : tab === 'contact' ? (
            <div className="card-soft">
              <div className="section-label mb-3">
                <i className="bi bi-telephone-outbound" />
                นัดที่ไม่มาตามกำหนด ({filterList.length} รายการ)
              </div>

              <div className="alert-soft info mb-3">
                <i className="bi bi-info-circle" />
                <span>ให้เจ้าของจองนัดใหม่ผ่านระบบออนไลน์ หลังติดต่อเจ้าของแล้วกดปุ่ม "ติดต่อแล้ว"</span>
              </div>

              <div className="d-none d-md-block table-responsive">
                <table className="ma-table">
                  <thead>
                    <tr>
                      <th>วันเวลาที่ไม่มา</th>
                      <th>สัตว์</th>
                      <th>เจ้าของ / เบอร์โทร</th>
                      <th>บริการ / หมอ</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterList.map((appt) => {
                      const sp = speciesOf(appt.petSpecies);
                      const pat = patientsById.get(appt.petId);
                      return (
                        <tr key={appt.id}>
                          <td className="text-nowrap">
                            <div className="fw-medium">{formatDate(appt.date)}</div>
                            <div className="small text-muted">{appt.time} น.</div>
                          </td>
                          <td className="text-nowrap">
                            <div className="fw-medium">
                              <PatientNameLink
                                petId={appt.petId}
                                petName={appt.petName}
                                petSpecies={appt.petSpecies}
                                flags={pat?.flags}
                                allergies={appt.pet?.allergies ?? pat?.allergies}
                              />
                            </div>
                            <div className="small text-muted">{sp.label}</div>
                          </td>
                          <td>
                            <div>{appt.ownerName || '—'}</div>
                            <div className="small text-muted text-nowrap">
                              {appt.ownerPhone || '—'}
                            </div>
                          </td>
                          <td className="ma-service-cell">
                            <div>{appt.serviceLabel || appt.service}</div>
                            <div className="small text-muted">
                              {appt.visit?.vet || 'ยังไม่ระบุหมอ'}
                            </div>
                          </td>
                          <td className="text-nowrap">
                            <div className="ma-actions">
                              {appt.ownerPhone && (
                                <a href={`tel:${appt.ownerPhone}`} className="btn btn-soft btn-sm">
                                  <i className="bi bi-telephone me-1" />
                                  โทร
                                </a>
                              )}
                              <button
                                type="button"
                                className="btn btn-sky btn-sm"
                                onClick={() => openContactConfirm(appt)}
                              >
                                <i className="bi bi-check2 me-1" />
                                ติดต่อแล้ว
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
                  const sp = speciesOf(appt.petSpecies);
                  const pat = patientsById.get(appt.petId);
                  return (
                    <div className="record-row mb-0 pb-3" key={appt.id}>
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                        <div className="mitr">
                          {formatDate(appt.date)} · {appt.time} น.
                        </div>
                        <span className="tag danger m-0">ไม่มาตามนัด</span>
                      </div>
                      <div className="fw-medium mb-1">
                        <PatientNameLink
                          petId={appt.petId}
                          petName={appt.petName}
                          petSpecies={appt.petSpecies}
                          flags={pat?.flags}
                          allergies={appt.pet?.allergies ?? pat?.allergies}
                        />{' '}
                        <span className="small text-muted fw-normal">· {sp.label}</span>
                      </div>
                      <div className="small text-muted mb-1">
                        <i className="bi bi-person me-1" />
                        {appt.ownerName || '—'} · {appt.ownerPhone || '—'}
                      </div>
                      <div className="small mb-2">
                        <i className="bi bi-clipboard2-pulse me-1 text-sky" />
                        {appt.serviceLabel || appt.service} · {appt.visit?.vet || 'ยังไม่ระบุหมอ'}
                      </div>
                      <div className="ma-actions">
                        {appt.ownerPhone && (
                          <a href={`tel:${appt.ownerPhone}`} className="btn btn-soft btn-sm">
                            <i className="bi bi-telephone me-1" />
                            โทร
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn btn-sky btn-sm"
                          onClick={() => openContactConfirm(appt)}
                        >
                          <i className="bi bi-check2 me-1" />
                          ติดต่อแล้ว
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
                ประวัติการจัดการ ({filterList.length} รายการ)
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
                      <th>หมายเหตุ / เหตุผล</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterList.map((appt) => {
                      const pat = patientsById.get(appt.petId);
                      const isRejected = appt.stage === 'rejected';
                      const isContactedNoShow = appt.stage === 'no_show';
                      const shifted = hasRescheduledTime(appt);
                      const handledTime = appt.visit?.contactedAt ?? appt.visit?.handledAt;

                      return (
                        <tr key={appt.id}>
                          <td className="text-nowrap small">{formatHandledAt(handledTime)}</td>
                          <td className="text-nowrap">
                            <div className="fw-medium">
                              <PatientNameLink
                                petId={appt.petId}
                                petName={appt.petName}
                                petSpecies={appt.petSpecies}
                                flags={pat?.flags}
                                allergies={appt.pet?.allergies ?? pat?.allergies}
                              />
                            </div>
                            <div className="small text-muted">
                              {appt.serviceLabel || appt.service}
                              {appt.visit?.vet ? ` · ${appt.visit.vet}` : ''}
                            </div>
                          </td>
                          <td>
                            <div>{appt.ownerName || '—'}</div>
                            <div className="small text-muted text-nowrap">
                              {appt.ownerPhone || '—'}
                            </div>
                          </td>
                          <td className="text-nowrap">
                            {isRejected ? (
                              <span className={`tag ${STAGE_META.rejected.tag} m-0`}>
                                {STAGE_META.rejected.label}
                              </span>
                            ) : isContactedNoShow ? (
                              <span className="tag sky m-0">ติดต่อให้จองใหม่แล้ว</span>
                            ) : (
                              <span className="tag ok m-0">
                                {shifted ? 'ยืนยัน (เปลี่ยนเวลา)' : 'ยืนยันแล้ว'}
                              </span>
                            )}
                          </td>
                          <td className="ma-service-cell">
                            {shifted ? (
                              <div className="small">
                                <span className="text-muted">
                                  {formatDate(appt.visit.rescheduledFrom.date)}{' '}
                                  {appt.visit.rescheduledFrom.time}
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
                              <div>{appt.clinicNote || appt.visit?.rejectReason || '—'}</div>
                            ) : appt.clinicNote ? (
                              <div className="text-muted">{appt.clinicNote}</div>
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
                  const pat = patientsById.get(appt.petId);
                  const isRejected = appt.stage === 'rejected';
                  const isContactedNoShow = appt.stage === 'no_show';
                  const shifted = hasRescheduledTime(appt);
                  const handledTime = appt.visit?.contactedAt ?? appt.visit?.handledAt;

                  return (
                    <div className="record-row mb-0 pb-3" key={appt.id}>
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                        <div className="small text-muted">{formatHandledAt(handledTime)}</div>
                        {isRejected ? (
                          <span className={`tag ${STAGE_META.rejected.tag} m-0`}>
                            {STAGE_META.rejected.label}
                          </span>
                        ) : isContactedNoShow ? (
                          <span className="tag sky m-0">ติดต่อให้จองใหม่แล้ว</span>
                        ) : (
                          <span className="tag ok m-0">
                            {shifted ? 'ยืนยัน (เปลี่ยนเวลา)' : 'ยืนยันแล้ว'}
                          </span>
                        )}
                      </div>
                      <div className="fw-medium mb-1">
                        <PatientNameLink
                          petId={appt.petId}
                          petName={appt.petName}
                          petSpecies={appt.petSpecies}
                          flags={pat?.flags}
                          allergies={appt.pet?.allergies ?? pat?.allergies}
                        />{' '}
                        <span className="small text-muted fw-normal">
                          · {appt.serviceLabel || appt.service}
                        </span>
                      </div>
                      <div className="small text-muted mb-1">
                        {appt.ownerName || '—'} · {appt.ownerPhone || '—'}
                      </div>
                      <div className="small mb-1">
                        วันนัด:{' '}
                        {shifted
                          ? `${formatDate(appt.visit.rescheduledFrom.date)} ${appt.visit.rescheduledFrom.time} → ${formatDate(appt.date)} ${appt.time} น.`
                          : `${formatDate(appt.date)} · ${appt.time} น.`}
                      </div>
                      {(isRejected || appt.clinicNote) && (
                        <div className="small text-muted">
                          {isRejected
                            ? `เหตุผล: ${appt.clinicNote || appt.visit?.rejectReason || '—'}`
                            : `หมายเหตุ: ${appt.clinicNote}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <ApproveBookingModal
        open={Boolean(approveTarget)}
        booking={approveTarget}
        appointments={appointments}
        meta={meta}
        onClose={() => setApproveTarget(null)}
        onReschedule={reschedule}
        onConfirm={confirm}
        onSuccess={handleApproveSuccess}
      />

      <RejectBookingModal
        open={Boolean(rejectTarget)}
        booking={rejectTarget}
        meta={meta}
        onClose={() => setRejectTarget(null)}
        onReject={handleConfirmReject}
      />

      <ConfirmModal
        open={Boolean(contactTarget)}
        title="ยืนยันการติดต่อเจ้าของ"
        icon="bi-telephone-check"
        message={
          contactTarget
            ? `บันทึกว่าได้ติดต่อเจ้าของของ "${contactTarget.petName}" เพื่อแจ้งให้จองนัดใหม่ผ่านระบบออนไลน์แล้วใช่หรือไม่?`
            : ''
        }
        confirmLabel="ติดต่อแล้ว"
        cancelLabel="ยกเลิก"
        confirmVariant="sky"
        submitting={contactSubmitting}
        error={contactError}
        onClose={() => !contactSubmitting && setContactTarget(null)}
        onConfirm={handleConfirmContacted}
      />

      {toast}
    </section>
  );
}
