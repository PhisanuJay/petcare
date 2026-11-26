import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import AppointmentModal from '../components/AppointmentModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import MaDataState from '../components/MaDataState.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import { apptVetName, isSameVet, vetList } from '../data/clinicMeta.js';
import {
  STAGE_LIST,
  STAGE_META,
  offsetDateKey,
} from '../data/constants.js';
import { useAppointments } from '../data/useAppointments.js';
import { usePatients } from '../data/usePatients.js';

function StatusActions({ appt, todayKey, onRequestAction, onReschedule }) {
  const stage = appt.stage;

  if (stage === 'pending') {
    return (
      <div className="ma-actions">
        <span className="small text-muted">รอระบบยืนยันอัตโนมัติจากการจอง/โอน</span>
      </div>
    );
  }

  if (stage === 'confirmed') {
    const isToday = appt.date === todayKey;
    const isPast = appt.date < todayKey;
    return (
      <div className="ma-actions">
        {isToday && (
          <button
            type="button"
            className="btn btn-sky btn-sm"
            onClick={() => onRequestAction('check_in', appt)}
          >
            เช็คอิน
          </button>
        )}
        {(isToday || isPast) && (
          <button
            type="button"
            className="btn btn-soft-danger btn-sm"
            onClick={() => onRequestAction('no_show', appt)}
          >
            ไม่มาตามนัด
          </button>
        )}
        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={() => onReschedule(appt)}
        >
          เปลี่ยนวันเวลา
        </button>
      </div>
    );
  }

  if (stage === 'checked_in') {
    return (
      <div className="ma-actions">
        <button
          type="button"
          className="btn btn-sky btn-sm"
          onClick={() => onRequestAction('start_treatment', appt)}
        >
          ส่งเข้าห้องตรวจ
        </button>
        <Link
          to={`/clinic-admin/appointments?focus=${appt.id}`}
          className="btn btn-soft btn-sm"
        >
          <i className="bi bi-thermometer-half me-1" />
          หน้าคัดกรอง
        </Link>
      </div>
    );
  }

  if (stage === 'in_treatment') {
    return (
      <div className="ma-actions">
        <span className="tag warn m-0">รอหมอปิดเคส</span>
        <Link
          to={`/clinic-admin/appointments?focus=${appt.id}`}
          className="btn btn-soft btn-sm"
          title="เปิดหน้าสนับสนุนการรักษา"
        >
          <i className="bi bi-bandaid" />
        </Link>
      </div>
    );
  }

  return <span className="small text-muted">—</span>;
}

function buildConfirmConfig(confirmAction) {
  if (!confirmAction) return null;
  const { type, appt } = confirmAction;
  if (type === 'check_in') {
    return {
      title: 'ยืนยันการเช็คอิน',
      icon: 'bi-geo-alt',
      message: `ยืนยันเช็คอิน "${appt.petName}" (เวลานัด ${appt.time} น.) ใช่หรือไม่?`,
      confirmLabel: 'เช็คอิน',
      confirmVariant: 'sky',
    };
  }
  if (type === 'no_show') {
    return {
      title: 'บันทึกไม่มาตามนัด',
      icon: 'bi-person-x',
      message: `ยืนยันบันทึกว่า "${appt.petName}" ไม่มาตามนัดวันที่ ${formatDate(appt.date)} เวลา ${appt.time} น. ใช่หรือไม่?`,
      confirmLabel: 'ไม่มาตามนัด',
      confirmVariant: 'danger',
    };
  }
  return {
    title: 'ส่งสัตว์เลี้ยงเข้าห้องตรวจ',
    icon: 'bi-heart-pulse',
    message: `ยืนยันส่ง "${appt.petName}" เข้าห้องตรวจกับ ${apptVetName(appt) || 'สัตวแพทย์'} ใช่หรือไม่?`,
    confirmLabel: 'ส่งเข้าห้องตรวจ',
    confirmVariant: 'sky',
  };
}

/**
 * Appointments — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function AppointmentsPage() {
  const {
    appointments,
    loading,
    error,
    reload,
    meta,
    markNoShow,
    reschedule,
    checkIn,
    startTreatment,
  } = useAppointments();
  const { patients } = usePatients();
  const { show, toast } = useToast();

  const yesterdayKey = offsetDateKey(-1);
  const todayKey = offsetDateKey(0);
  const tomorrowKey = offsetDateKey(1);

  const [searchParams, setSearchParams] = useSearchParams();
  const paramDate = searchParams.get('date');
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(paramDate || '') ? paramDate : todayKey;

  const setSelectedDate = useCallback(
    (dateKey) => {
      if (dateKey === todayKey) setSearchParams({}, { replace: true });
      else setSearchParams({ date: dateKey }, { replace: true });
    },
    [todayKey, setSearchParams],
  );

  const [stageFilter, setStageFilter] = useState('all');
  const [vetFilter, setVetFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const patientsById = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients],
  );

  const vets = useMemo(() => vetList(meta), [meta]);

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.date === selectedDate)
        .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [appointments, selectedDate],
  );

  const stageCounts = useMemo(() => {
    const counts = { all: dayAppointments.length };
    for (const s of STAGE_LIST) counts[s.value] = 0;
    for (const a of dayAppointments) {
      counts[a.stage] = (counts[a.stage] ?? 0) + 1;
    }
    return counts;
  }, [dayAppointments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dayAppointments.filter((a) => {
      if (stageFilter !== 'all' && a.stage !== stageFilter) return false;
      if (vetFilter !== 'all' && !isSameVet(a, vetFilter)) return false;
      if (q) {
        const hit = [a.petName, a.ownerName, a.ownerPhone, a.serviceLabel].some((v) =>
          v?.toLowerCase().includes(q),
        );
        if (!hit) return false;
      }
      return true;
    });
  }, [dayAppointments, stageFilter, vetFilter, query]);

  const hasActiveFilter = stageFilter !== 'all' || vetFilter !== 'all' || query.trim() !== '';
  const hasData = Boolean(meta) || appointments.length > 0;
  const blockedByState = !hasData && (loading || Boolean(error));

  function openConfirm(type, appt) {
    setConfirmError('');
    setConfirmAction({ type, appt });
  }

  async function handleConfirmSubmit() {
    if (!confirmAction) return;
    const { type, appt } = confirmAction;
    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      if (type === 'check_in') {
        await checkIn(appt.id);
        show(`เช็คอิน "${appt.petName}" แล้ว`);
      } else if (type === 'no_show') {
        await markNoShow(appt.id);
        show(`บันทึก "${appt.petName}" เป็นไม่มาตามนัดแล้ว`);
      } else if (type === 'start_treatment') {
        await startTreatment(appt.id);
        show(`ส่ง "${appt.petName}" เข้าห้องตรวจแล้ว`);
      }
      setConfirmAction(null);
    } catch (err) {
      setConfirmError(err?.message || 'ไม่สามารถดำเนินการได้');
    } finally {
      setConfirmSubmitting(false);
    }
  }

  async function handleRescheduleSave(values) {
    if (!rescheduleTarget) return;
    const updated = await reschedule(rescheduleTarget.id, values);
    setSelectedDate(updated.date);
    setRescheduleTarget(null);
    show(`เปลี่ยนวันเวลานัด "${updated.petName}" ไป ${formatDate(updated.date)} ${updated.time} น. แล้ว`);
  }

  function clearFilters() {
    setStageFilter('all');
    setVetFilter('all');
    setQuery('');
  }

  const dateTabs = [
    { label: 'เมื่อวาน', value: yesterdayKey },
    { label: 'วันนี้', value: todayKey },
    { label: 'พรุ่งนี้', value: tomorrowKey },
  ];

  const confirmCfg = buildConfirmConfig(confirmAction);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>นัดหมาย</h1>
          <p>จัดการตารางนัดและสถานะการเข้ารับบริการของแต่ละวัน</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-soft"
            disabled={loading}
            onClick={reload}
          >
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
                <span className="tag sky ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-calendar2-week" />
                </span>
                <div className="num">{stageCounts.all}</div>
                <div className="small text-muted">ทั้งหมด</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat">
                <span className="tag warn ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-hourglass-split" />
                </span>
                <div className="num">{stageCounts.pending}</div>
                <div className="small text-muted">รอยืนยัน</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat">
                <span className="tag sky ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-hospital" />
                </span>
                <div className="num">
                  {(stageCounts.checked_in ?? 0) + (stageCounts.in_treatment ?? 0)}
                </div>
                <div className="small text-muted">อยู่ในคลินิก</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat">
                <span className="tag ok ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-check2-circle" />
                </span>
                <div className="num">{stageCounts.completed}</div>
                <div className="small text-muted">เสร็จสิ้น</div>
              </div>
            </div>
          </div>

          <div className="card-soft mb-4">
            <div className="ma-filter-bar mb-3">
              <div className="pill-tabs mb-0" role="group" aria-label="เลือกวัน">
                {dateTabs.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={selectedDate === d.value ? 'active' : ''}
                    onClick={() => setSelectedDate(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <input
                type="date"
                className="form-control w-auto"
                aria-label="เลือกวันที่"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              />

              <select
                className="form-select w-auto"
                aria-label="กรองตามสัตวแพทย์"
                value={vetFilter}
                onChange={(e) => setVetFilter(e.target.value)}
              >
                <option value="all">สัตวแพทย์ทั้งหมด</option>
                {vets.map((v) => {
                  const val = v.id ?? v.name;
                  return (
                    <option key={val} value={val}>
                      {v.name}
                    </option>
                  );
                })}
              </select>

              <div className="input-group ma-search-group">
                <span className="input-group-text">
                  <i className="bi bi-search" />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="ค้นหาชื่อสัตว์ / เจ้าของ / เบอร์"
                  aria-label="ค้นหานัดหมาย"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="pill-tabs ma-status-tabs mb-0" role="group" aria-label="กรองตามสถานะ">
              <button
                type="button"
                className={stageFilter === 'all' ? 'active' : ''}
                onClick={() => setStageFilter('all')}
              >
                ทั้งหมด
                <span className="count">{stageCounts.all}</span>
              </button>
              {STAGE_LIST.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={stageFilter === s.value ? 'active' : ''}
                  onClick={() => setStageFilter(s.value)}
                >
                  {s.label}
                  <span className="count">{stageCounts[s.value]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card-soft">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div className="section-label mb-0">
                <i className="bi bi-calendar2-week" />
                ตารางนัดวันที่ {formatDate(selectedDate)} ({filtered.length} รายการ)
              </div>
              {hasActiveFilter && (
                <button type="button" className="btn btn-soft btn-sm" onClick={clearFilters}>
                  ล้างตัวกรอง
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="empty-box">
                <i className="bi bi-calendar-x" />
                <div>
                  {dayAppointments.length === 0
                    ? `ยังไม่มีนัดหมายในวันที่ ${formatDate(selectedDate)}`
                    : 'ไม่พบนัดหมายที่ตรงกับตัวกรอง'}
                </div>
                {dayAppointments.length > 0 && hasActiveFilter && (
                  <div className="mt-3">
                    <button type="button" className="btn btn-soft" onClick={clearFilters}>
                      ล้างตัวกรอง
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="d-none d-md-block table-responsive">
                  <table className="ma-table">
                    <thead>
                      <tr>
                        <th>เวลา</th>
                        <th>สัตว์</th>
                        <th>เจ้าของ</th>
                        <th>บริการ</th>
                        <th>สัตวแพทย์</th>
                        <th>สถานะ</th>
                        <th>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((appt) => {
                        const sp = speciesOf(appt.petSpecies);
                        const st = STAGE_META[appt.stage] ?? STAGE_META.pending;
                        const pat = patientsById.get(appt.petId);
                        const vetName = apptVetName(appt);
                        const durationMin = appt.visit?.durationMin;

                        return (
                          <tr key={appt.id}>
                            <td className="text-nowrap">
                              <div className="fw-medium">{appt.time} น.</div>
                              <div className="small text-muted">
                                {durationMin ? `${durationMin} นาที` : '—'}
                              </div>
                            </td>
                            <td className="text-nowrap">
                              <div className="fw-medium text-nowrap">
                                <PatientNameLink
                                  petId={appt.petId}
                                  petName={appt.petName}
                                  petSpecies={appt.petSpecies}
                                  flags={pat?.flags}
                                  allergies={appt.pet?.allergies ?? pat?.allergies}
                                />
                              </div>
                              <div className="small text-muted text-nowrap">{sp.label}</div>
                            </td>
                            <td>
                              <div>{appt.ownerName || '—'}</div>
                              <div className="small text-muted text-nowrap">
                                {appt.ownerPhone ? (
                                  <a href={`tel:${appt.ownerPhone}`} className="text-decoration-none">
                                    {appt.ownerPhone}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </div>
                            </td>
                            <td className="ma-service-cell">
                              <div>{appt.serviceLabel || appt.service}</div>
                              {appt.closure && (
                                <div className="mt-1">
                                  <span className="tag warn m-0">
                                    <i className="bi bi-calendar-x me-1" />
                                    ตรงวันปิดคลินิก: {appt.closure.reason}
                                  </span>
                                </div>
                              )}
                              {(appt.note || appt.clinicNote) && (
                                <div
                                  className="small text-muted text-truncate d-none d-xl-block"
                                  style={{ maxWidth: 220 }}
                                  title={appt.note || appt.clinicNote}
                                >
                                  {appt.note || appt.clinicNote}
                                </div>
                              )}
                            </td>
                            <td className="text-nowrap">
                              <div className="d-flex align-items-center gap-1">
                                <span
                                  className={`ma-vet-vis ${appt.visibleToVet ? 'text-sky' : 'text-muted'}`}
                                  title={
                                    appt.visibleToVet
                                      ? 'แสดงในหน้าสัตวแพทย์แล้ว'
                                      : 'ยังไม่แสดงในหน้าสัตวแพทย์'
                                  }
                                  aria-label={
                                    appt.visibleToVet
                                      ? 'แสดงในหน้าสัตวแพทย์แล้ว'
                                      : 'ยังไม่แสดงในหน้าสัตวแพทย์'
                                  }
                                >
                                  <i className={`bi ${appt.visibleToVet ? 'bi-eye' : 'bi-eye-slash'}`} />
                                </span>
                                <span className="small ma-vet-cell" title={vetName || 'ยังไม่ระบุ'}>
                                  {vetName || 'ยังไม่ระบุ'}
                                </span>
                              </div>
                            </td>
                            <td className="text-nowrap">
                              <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                            </td>
                            <td className="text-nowrap">
                              <StatusActions
                                appt={appt}
                                todayKey={todayKey}
                                onRequestAction={openConfirm}
                                onReschedule={setRescheduleTarget}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="d-md-none d-grid gap-3">
                  {filtered.map((appt) => {
                    const sp = speciesOf(appt.petSpecies);
                    const st = STAGE_META[appt.stage] ?? STAGE_META.pending;
                    const pat = patientsById.get(appt.petId);
                    const vetName = apptVetName(appt);
                    const durationMin = appt.visit?.durationMin;

                    return (
                      <div className="record-row mb-0 pb-3" key={appt.id}>
                        <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                          <div className="mitr">
                            {appt.time} น.{' '}
                            {durationMin && (
                              <span className="small text-muted fw-normal">({durationMin} นาที)</span>
                            )}
                          </div>
                          <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                        </div>
                        {appt.closure && (
                          <div className="mb-2">
                            <span className="tag warn m-0">
                              <i className="bi bi-calendar-x me-1" />
                              ตรงวันปิดคลินิก: {appt.closure.reason}
                            </span>
                          </div>
                        )}

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
                          {appt.ownerName || '—'} ·{' '}
                          {appt.ownerPhone ? (
                            <a href={`tel:${appt.ownerPhone}`} className="text-decoration-none">
                              {appt.ownerPhone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </div>
                        <div className="small mb-1 d-flex align-items-center flex-wrap gap-1">
                          <i className="bi bi-clipboard2-pulse text-sky" />
                          <span>
                            {appt.serviceLabel || appt.service} · {vetName || 'ยังไม่ระบุหมอ'}
                          </span>
                          <span
                            className={`ma-vet-vis ms-1 ${appt.visibleToVet ? 'text-sky' : 'text-muted'}`}
                            title={
                              appt.visibleToVet
                                ? 'แสดงในหน้าสัตวแพทย์แล้ว'
                                : 'ยังไม่แสดงในหน้าสัตวแพทย์'
                            }
                          >
                            <i className={`bi ${appt.visibleToVet ? 'bi-eye' : 'bi-eye-slash'}`} />
                          </span>
                        </div>
                        {appt.note && (
                          <div className="small text-muted mb-2">อาการ/หมายเหตุ: {appt.note}</div>
                        )}

                        <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--baby)' }}>
                          <StatusActions
                            appt={appt}
                            todayKey={todayKey}
                            onRequestAction={openConfirm}
                            onReschedule={setRescheduleTarget}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <AppointmentModal
        open={Boolean(rescheduleTarget)}
        appointment={rescheduleTarget}
        appointments={appointments}
        meta={meta}
        onClose={() => setRescheduleTarget(null)}
        onReschedule={handleRescheduleSave}
      />

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmCfg?.title}
        icon={confirmCfg?.icon}
        message={confirmCfg?.message}
        confirmLabel={confirmCfg?.confirmLabel}
        cancelLabel="ยกเลิก"
        confirmVariant={confirmCfg?.confirmVariant}
        submitting={confirmSubmitting}
        error={confirmError}
        onClose={() => !confirmSubmitting && setConfirmAction(null)}
        onConfirm={handleConfirmSubmit}
      />

      {toast}
    </section>
  );
}
