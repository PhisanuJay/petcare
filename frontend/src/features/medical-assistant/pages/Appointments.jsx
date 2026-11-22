import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import AppointmentModal from '../components/AppointmentModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import {
  APPOINTMENT_STATUS,
  FINAL_STATUSES,
  STATUS_LIST,
  VETS,
  offsetDateKey,
} from '../data/constants.js';
import { useAppointments } from '../data/useAppointments.js';
import { usePatients } from '../data/usePatients.js';

function StatusActions({ appt, onChangeStatus, onRequestCancel, onEdit }) {
  return (
    <div className="ma-actions">
      {appt.status === 'pending' && (
        <>
          <button
            type="button"
            className="btn btn-sky btn-sm"
            onClick={() => onChangeStatus(appt, 'confirmed')}
          >
            ยืนยัน
          </button>
          <button
            type="button"
            className="btn btn-soft-danger btn-sm"
            onClick={() => onRequestCancel(appt)}
          >
            ยกเลิก
          </button>
        </>
      )}

      {appt.status === 'confirmed' && (
        <>
          <button
            type="button"
            className="btn btn-sky btn-sm"
            onClick={() => onChangeStatus(appt, 'checked_in')}
          >
            เช็คอิน
          </button>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => onChangeStatus(appt, 'no_show')}
          >
            ไม่มา
          </button>
          <button
            type="button"
            className="btn btn-soft-danger btn-sm"
            onClick={() => onRequestCancel(appt)}
          >
            ยกเลิก
          </button>
        </>
      )}

      {appt.status === 'checked_in' && (
        <button
          type="button"
          className="btn btn-sky btn-sm"
          onClick={() => onChangeStatus(appt, 'in_treatment')}
        >
          เริ่มตรวจ
        </button>
      )}

      {appt.status === 'in_treatment' && (
        <button
          type="button"
          className="btn btn-sky btn-sm"
          onClick={() => onChangeStatus(appt, 'completed')}
        >
          เสร็จสิ้น
        </button>
      )}

      {(appt.status === 'checked_in' || appt.status === 'in_treatment') && (
        <Link
          to={`/medical-assistant/medical-support/${appt.id}`}
          className="btn btn-soft btn-sm"
          title="สนับสนุนการรักษา"
          aria-label={`เปิดเคสสนับสนุนการรักษา ${appt.petName}`}
        >
          <i className="bi bi-bandaid" />
        </Link>
      )}

      {!FINAL_STATUSES.includes(appt.status) && (
        <button
          type="button"
          className="btn btn-soft btn-sm"
          title="แก้ไขนัดหมาย"
          aria-label={`แก้ไขนัดหมาย ${appt.petName}`}
          onClick={() => onEdit(appt)}
        >
          <i className="bi bi-pencil" />
        </button>
      )}
    </div>
  );
}

/**
 * Appointments — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function AppointmentsPage() {
  const {
    appointments,
    addAppointment,
    updateAppointment,
    setStatus,
    resetAppointments,
  } = useAppointments();
  const { getPatient, patientIdForAppt } = usePatients();
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

  const [statusFilter, setStatusFilter] = useState('all');
  const [vetFilter, setVetFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.date === selectedDate)
        .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [appointments, selectedDate],
  );

  const statusCounts = useMemo(() => {
    const counts = { all: dayAppointments.length };
    for (const s of STATUS_LIST) counts[s.value] = 0;
    for (const a of dayAppointments) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, [dayAppointments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dayAppointments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (vetFilter !== 'all' && a.vet !== vetFilter) return false;
      if (q) {
        const hit = [a.petName, a.ownerName, a.ownerPhone].some((v) =>
          v?.toLowerCase().includes(q),
        );
        if (!hit) return false;
      }
      return true;
    });
  }, [dayAppointments, statusFilter, vetFilter, query]);

  const hasActiveFilter = statusFilter !== 'all' || vetFilter !== 'all' || query.trim() !== '';

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(appt) {
    setEditing(appt);
    setModalOpen(true);
  }

  function handleSave(data) {
    if (editing) {
      updateAppointment(editing.id, data);
      show('บันทึกการแก้ไขนัดหมายแล้ว');
    } else {
      addAppointment(data);
      show('เพิ่มนัดหมายใหม่แล้ว');
    }
    setSelectedDate(data.date);
    setModalOpen(false);
    setEditing(null);
  }

  function handleChangeStatus(appt, nextStatus) {
    if (setStatus(appt.id, nextStatus)) {
      const label = APPOINTMENT_STATUS[nextStatus]?.label ?? nextStatus;
      show(`เปลี่ยนสถานะ ${appt.petName} เป็น "${label}" แล้ว`);
    }
  }

  function handleConfirmCancel() {
    if (!cancelTarget) return;
    if (setStatus(cancelTarget.id, 'cancelled')) {
      show(`ยกเลิกนัดของ ${cancelTarget.petName} แล้ว`);
    }
    setCancelTarget(null);
  }

  function handleConfirmReset() {
    resetAppointments();
    setSelectedDate(todayKey);
    setStatusFilter('all');
    setVetFilter('all');
    setQuery('');
    setResetOpen(false);
    show('รีเซ็ตข้อมูลตัวอย่างแล้ว');
  }

  function clearFilters() {
    setStatusFilter('all');
    setVetFilter('all');
    setQuery('');
  }

  const dateTabs = [
    { label: 'เมื่อวาน', value: yesterdayKey },
    { label: 'วันนี้', value: todayKey },
    { label: 'พรุ่งนี้', value: tomorrowKey },
  ];

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
            onClick={() => setResetOpen(true)}
          >
            <i className="bi bi-arrow-counterclockwise me-1" />
            รีเซ็ตข้อมูลตัวอย่าง
          </button>
          <button type="button" className="btn btn-sky" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" />
            เพิ่มนัดหมาย
          </button>
        </div>
      </div>

      <div className="row g-2 g-md-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag sky ma-stat-icon" aria-hidden="true">
              <i className="bi bi-calendar2-week" />
            </span>
            <div className="num">{statusCounts.all}</div>
            <div className="small text-muted">ทั้งหมด</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag warn ma-stat-icon" aria-hidden="true">
              <i className="bi bi-hourglass-split" />
            </span>
            <div className="num">{statusCounts.pending}</div>
            <div className="small text-muted">รอยืนยัน</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag sky ma-stat-icon" aria-hidden="true">
              <i className="bi bi-hospital" />
            </span>
            <div className="num">
              {(statusCounts.checked_in ?? 0) + (statusCounts.in_treatment ?? 0)}
            </div>
            <div className="small text-muted">อยู่ในคลินิก</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag ok ma-stat-icon" aria-hidden="true">
              <i className="bi bi-check2-circle" />
            </span>
            <div className="num">{statusCounts.completed}</div>
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
              aria-label="ค้นหานัดหมาย"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="pill-tabs ma-status-tabs mb-0" role="group" aria-label="กรองตามสถานะ">
          <button
            type="button"
            className={statusFilter === 'all' ? 'active' : ''}
            onClick={() => setStatusFilter('all')}
          >
            ทั้งหมด
            <span className="count">{statusCounts.all}</span>
          </button>
          {STATUS_LIST.map((s) => (
            <button
              key={s.value}
              type="button"
              className={statusFilter === s.value ? 'active' : ''}
              onClick={() => setStatusFilter(s.value)}
            >
              {s.label}
              <span className="count">{statusCounts[s.value]}</span>
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
            <div className="d-flex justify-content-center gap-2 flex-wrap mt-3">
              {dayAppointments.length > 0 && hasActiveFilter && (
                <button type="button" className="btn btn-soft" onClick={clearFilters}>
                  ล้างตัวกรอง
                </button>
              )}
              <button type="button" className="btn btn-sky" onClick={openCreate}>
                <i className="bi bi-plus-lg me-1" />
                เพิ่มนัดหมาย
              </button>
            </div>
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
                    const sp = speciesOf(appt.species);
                    const st = APPOINTMENT_STATUS[appt.status] ?? APPOINTMENT_STATUS.pending;
                    const pid = patientIdForAppt(appt);
                    const pat = getPatient(pid);
                    return (
                      <tr key={appt.id}>
                        <td className="text-nowrap">
                          <div className="fw-medium">{appt.time} น.</div>
                          <div className="small text-muted">{appt.durationMin} นาที</div>
                        </td>
                        <td className="text-nowrap">
                          <div className="fw-medium text-nowrap">
                            <PatientNameLink
                              patientId={pid}
                              petName={appt.petName}
                              species={appt.species}
                              flags={pat?.flags}
                              allergies={pat?.pet?.allergies}
                            />
                          </div>
                          <div className="small text-muted text-nowrap">{sp.label}</div>
                        </td>
                        <td>
                          <div>{appt.ownerName}</div>
                          <div className="small text-muted text-nowrap">{appt.ownerPhone}</div>
                        </td>
                        <td className="ma-service-cell">
                          <div>{appt.service}</div>
                          {appt.reason && (
                            <div
                              className="small text-muted text-truncate d-none d-xl-block"
                              style={{ maxWidth: 210 }}
                              title={appt.reason}
                            >
                              {appt.reason}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="small ma-vet-cell" title={appt.vet}>
                            {appt.vet}
                          </div>
                        </td>
                        <td className="text-nowrap">
                          <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                        </td>
                        <td className="text-nowrap">
                          <StatusActions
                            appt={appt}
                            onChangeStatus={handleChangeStatus}
                            onRequestCancel={setCancelTarget}
                            onEdit={openEdit}
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
                const sp = speciesOf(appt.species);
                const st = APPOINTMENT_STATUS[appt.status] ?? APPOINTMENT_STATUS.pending;
                const pid = patientIdForAppt(appt);
                const pat = getPatient(pid);
                return (
                  <div className="record-row mb-0 pb-3" key={appt.id}>
                    <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                      <div className="mitr">
                        {appt.time} น.{' '}
                        <span className="small text-muted fw-normal">({appt.durationMin} นาที)</span>
                      </div>
                      <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                    </div>

                    <div className="fw-medium mb-1">
                      <PatientNameLink
                        patientId={pid}
                        petName={appt.petName}
                        species={appt.species}
                        flags={pat?.flags}
                        allergies={pat?.pet?.allergies}
                      />{' '}
                      <span className="small text-muted fw-normal">· {sp.label}</span>
                    </div>

                    <div className="small text-muted mb-1">
                      <i className="bi bi-person me-1" />
                      {appt.ownerName} · {appt.ownerPhone}
                    </div>
                    <div className="small mb-1">
                      <i className="bi bi-clipboard2-pulse me-1 text-sky" />
                      {appt.service} · {appt.vet}
                    </div>
                    {appt.reason && (
                      <div className="small text-muted mb-2">อาการ: {appt.reason}</div>
                    )}

                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--baby)' }}>
                      <StatusActions
                        appt={appt}
                        onChangeStatus={handleChangeStatus}
                        onRequestCancel={setCancelTarget}
                        onEdit={openEdit}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AppointmentModal
        open={modalOpen}
        initialData={editing}
        appointments={appointments}
        defaultDate={selectedDate}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />

      <ConfirmModal
        open={Boolean(cancelTarget)}
        title="ยืนยันการยกเลิกนัดหมาย"
        icon="bi-x-circle"
        message={
          cancelTarget
            ? `ต้องการยกเลิกนัดของ "${cancelTarget.petName}" เวลา ${cancelTarget.time} น. (${cancelTarget.ownerName}) ใช่หรือไม่?`
            : ''
        }
        confirmLabel="ยืนยันยกเลิกนัด"
        cancelLabel="เก็บไว้"
        confirmVariant="danger"
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
      />

      <ConfirmModal
        open={resetOpen}
        title="รีเซ็ตข้อมูลตัวอย่าง"
        icon="bi-arrow-counterclockwise"
        message="ข้อมูลนัดหมายปัจจุบันทั้งหมดจะถูกแทนที่ด้วยข้อมูลตัวอย่างเริ่มต้น ต้องการดำเนินการต่อหรือไม่?"
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
