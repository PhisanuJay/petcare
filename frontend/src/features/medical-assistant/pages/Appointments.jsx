import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import AppointmentModal from '../components/AppointmentModal.jsx';
import ConfirmDialog from '../../clinic-admin/components/ConfirmDialog.jsx';
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

function serviceLines(label) {
  if (!label) return [];
  return String(label)
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function StatusActions({ appt, todayKey, onRequestAction, onReschedule }) {
  const stage = appt.stage;

  if (stage === 'pending') {
    return (
      <div className="ca-actions ca-appt-actions">
        <span className="small text-muted">รอระบบยืนยันอัตโนมัติจากการจอง/โอน</span>
      </div>
    );
  }

  if (stage === 'confirmed') {
    const isToday = appt.date === todayKey;
    const isPast = appt.date < todayKey;
    return (
      <div className="ca-actions ca-appt-actions">
        {isToday && (
          <button
            type="button"
            className="btn btn-sky btn-sm"
            onClick={() => onRequestAction('check_in', appt)}
          >
            เช็คอินและส่งเข้าตรวจ
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
    // เคสเก่าที่เช็คอินแล้วยังไม่ถูกส่งเข้าตรวจ — กดเช็คอินรอบใหม่จะส่งทันที
    // เหลือทางลัดคัดกรอง / ส่งเข้าตรวจสำรอง
    return (
      <div className="ca-actions ca-appt-actions">
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
      <div className="ca-actions ca-appt-actions">
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
      message: 'บันทึกว่าสัตว์เลี้ยงมาถึงแล้ว และส่งเข้าห้องตรวจทันที',
      detailTitle: appt.petName || '—',
      detailLines: [`เวลานัด ${appt.time} น.`, appt.ownerName ? `เจ้าของ ${appt.ownerName}` : ''].filter(Boolean),
      confirmLabel: 'เช็คอินและส่งเข้าตรวจ',
      confirmVariant: 'sky',
    };
  }
  if (type === 'no_show') {
    return {
      title: 'บันทึกไม่มาตามนัด',
      icon: 'bi-person-x',
      message: 'ยืนยันบันทึกว่าสัตว์เลี้ยงไม่มาตามเวลานัดนี้',
      detailTitle: appt.petName || '—',
      detailLines: [
        `วันที่ ${formatDate(appt.date)} · ${appt.time} น.`,
        appt.ownerName ? `เจ้าของ ${appt.ownerName}` : '',
      ].filter(Boolean),
      confirmLabel: 'ไม่มาตามนัด',
      confirmVariant: 'danger',
    };
  }
  return {
    title: 'ส่งสัตว์เลี้ยงเข้าห้องตรวจ',
    icon: 'bi-heart-pulse',
    message: 'ส่งผู้ป่วยเข้าห้องตรวจให้สัตวแพทย์เริ่มดูแล',
    detailTitle: appt.petName || '—',
    detailLines: [
      `สัตวแพทย์ ${apptVetName(appt) || 'ยังไม่ระบุ'}`,
      `เวลานัด ${appt.time} น.`,
    ],
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
        try {
          await startTreatment(appt.id);
          show(`เช็คอินและส่ง "${appt.petName}" เข้าห้องตรวจแล้ว`);
        } catch {
          show(`เช็คอิน "${appt.petName}" แล้ว แต่ส่งเข้าห้องตรวจไม่สำเร็จ — กดส่งเข้าห้องตรวจอีกครั้ง`);
        }
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
    <section className="ca-appointments">
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
          <div className="ca-stat-grid mb-4">
            <div className="stat">
              <span className="ca-stat-icon" aria-hidden="true">
                <i className="bi bi-calendar2-week" />
              </span>
              <div className="num">{stageCounts.all}</div>
              <div className="small text-muted">ทั้งหมด</div>
            </div>
            <div className="stat">
              <span className="ca-stat-icon" aria-hidden="true">
                <i className="bi bi-hourglass-split" />
              </span>
              <div className="num">{stageCounts.pending}</div>
              <div className="small text-muted">รอยืนยัน</div>
            </div>
            <div className="stat">
              <span className="ca-stat-icon" aria-hidden="true">
                <i className="bi bi-hospital" />
              </span>
              <div className="num">
                {(stageCounts.checked_in ?? 0) + (stageCounts.in_treatment ?? 0)}
              </div>
              <div className="small text-muted">อยู่ในคลินิก</div>
            </div>
            <div className="stat">
              <span className="ca-stat-icon" aria-hidden="true">
                <i className="bi bi-check2-circle" />
              </span>
              <div className="num">{stageCounts.completed}</div>
              <div className="small text-muted">เสร็จสิ้น</div>
            </div>
          </div>

          <div className="card-soft ca-appt-board">
            <div className="ca-filter-bar mb-3">
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
                className="form-control ca-appt-date"
                aria-label="เลือกวันที่"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              />

              <select
                className="form-select ca-appt-vet-filter"
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

              <div className="input-group ca-search-group">
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

            <div className="pill-tabs ca-scroll-tabs mb-0" role="group" aria-label="กรองตามสถานะ">
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

            <div className="ca-appt-board__head">
              <div className="section-label mb-0">
                <i className="bi bi-calendar2-week" />
                ตารางนัดวันที่ {formatDate(selectedDate)}
                <span className="ca-appt-board__count">{filtered.length} รายการ</span>
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
                <div className="d-none d-lg-block ca-appt-table-wrap">
                  <table className="ca-table ca-appt-table">
                    <colgroup>
                      <col className="ca-appt-col-time" />
                      <col className="ca-appt-col-pet" />
                      <col className="ca-appt-col-owner" />
                      <col className="ca-appt-col-service" />
                      <col className="ca-appt-col-vet" />
                      <col className="ca-appt-col-status" />
                      <col className="ca-appt-col-actions" />
                    </colgroup>
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
                        const services = serviceLines(appt.serviceLabel || appt.service);
                        const note = appt.note || appt.clinicNote;

                        return (
                          <tr key={appt.id}>
                            <td>
                              <div className="ca-appt-time">
                                <strong>{appt.time}</strong>
                                <span>น.</span>
                              </div>
                              <div className="ca-appt-duration">
                                {durationMin ? `${durationMin} นาที` : '—'}
                              </div>
                            </td>
                            <td>
                              <div className="ca-appt-pet">
                                <PatientNameLink
                                  petId={appt.petId}
                                  petName={appt.petName}
                                  petSpecies={appt.petSpecies}
                                  flags={pat?.flags}
                                  allergies={appt.pet?.allergies ?? pat?.allergies}
                                />
                                <span className="ca-appt-meta">{sp.label}</span>
                              </div>
                            </td>
                            <td>
                              <div className="ca-appt-owner">
                                <span className="ca-appt-owner__name">{appt.ownerName || '—'}</span>
                                {appt.ownerPhone ? (
                                  <a href={`tel:${appt.ownerPhone}`} className="ca-appt-owner__phone">
                                    {appt.ownerPhone}
                                  </a>
                                ) : (
                                  <span className="ca-appt-meta">—</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="ca-appt-service">
                                {services.length > 0 ? (
                                  <ul className="ca-appt-service__list">
                                    {services.map((line) => (
                                      <li key={line}>{line}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="ca-appt-meta">—</span>
                                )}
                                {appt.closure && (
                                  <span className="tag warn m-0 ca-appt-service__flag">
                                    <i className="bi bi-calendar-x me-1" />
                                    ปิดคลินิก: {appt.closure.reason}
                                  </span>
                                )}
                                {note && (
                                  <p className="ca-appt-service__note" title={note}>{note}</p>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="ca-appt-vet">
                                <span
                                  className={`ca-appt-vet__vis ${appt.visibleToVet ? 'is-visible' : ''}`}
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
                                <span title={vetName || 'ยังไม่ระบุ'}>
                                  {vetName || 'ยังไม่ระบุ'}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                            </td>
                            <td>
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

                <div className="d-lg-none ca-appt-cards">
                  {filtered.map((appt) => {
                    const sp = speciesOf(appt.petSpecies);
                    const st = STAGE_META[appt.stage] ?? STAGE_META.pending;
                    const pat = patientsById.get(appt.petId);
                    const vetName = apptVetName(appt);
                    const durationMin = appt.visit?.durationMin;
                    const services = serviceLines(appt.serviceLabel || appt.service);

                    return (
                      <article className="ca-appt-card" key={appt.id}>
                        <header className="ca-appt-card__head">
                          <div className="ca-appt-time">
                            <strong>{appt.time}</strong>
                            <span>น.</span>
                            {durationMin ? (
                              <span className="ca-appt-duration">· {durationMin} นาที</span>
                            ) : null}
                          </div>
                          <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                        </header>

                        {appt.closure && (
                          <span className="tag warn m-0 ca-appt-service__flag">
                            <i className="bi bi-calendar-x me-1" />
                            ปิดคลินิก: {appt.closure.reason}
                          </span>
                        )}

                        <div className="ca-appt-pet">
                          <PatientNameLink
                            petId={appt.petId}
                            petName={appt.petName}
                            petSpecies={appt.petSpecies}
                            flags={pat?.flags}
                            allergies={appt.pet?.allergies ?? pat?.allergies}
                          />
                          <span className="ca-appt-meta">{sp.label}</span>
                        </div>

                        <div className="ca-appt-owner">
                          <span className="ca-appt-owner__name">
                            <i className="bi bi-person me-1" aria-hidden="true" />
                            {appt.ownerName || '—'}
                          </span>
                          {appt.ownerPhone ? (
                            <a href={`tel:${appt.ownerPhone}`} className="ca-appt-owner__phone">
                              {appt.ownerPhone}
                            </a>
                          ) : null}
                        </div>

                        <div className="ca-appt-service">
                          <ul className="ca-appt-service__list">
                            {services.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="ca-appt-vet">
                          <span
                            className={`ca-appt-vet__vis ${appt.visibleToVet ? 'is-visible' : ''}`}
                            title={
                              appt.visibleToVet
                                ? 'แสดงในหน้าสัตวแพทย์แล้ว'
                                : 'ยังไม่แสดงในหน้าสัตวแพทย์'
                            }
                          >
                            <i className={`bi ${appt.visibleToVet ? 'bi-eye' : 'bi-eye-slash'}`} />
                          </span>
                          <span>{vetName || 'ยังไม่ระบุหมอ'}</span>
                        </div>

                        {appt.note && (
                          <p className="ca-appt-service__note">อาการ/หมายเหตุ: {appt.note}</p>
                        )}

                        <footer className="ca-appt-card__actions">
                          <StatusActions
                            appt={appt}
                            todayKey={todayKey}
                            onRequestAction={openConfirm}
                            onReschedule={setRescheduleTarget}
                          />
                        </footer>
                      </article>
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

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmCfg?.title}
        icon={confirmCfg?.icon}
        message={confirmCfg?.message}
        detailTitle={confirmCfg?.detailTitle}
        detailLines={confirmCfg?.detailLines}
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
