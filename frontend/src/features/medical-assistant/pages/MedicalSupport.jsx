import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import { speciesOf } from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import { CAUTION_FLAGS, TRIAGE_LEVELS, offsetDateKey } from '../data/constants.js';
import {
  awaitingTriage,
  completedToday,
  formatWaitText,
  inTreatment,
  readyForVet,
  waitMinutes,
} from '../data/selectors.js';
import { useAppointments } from '../data/useAppointments.js';
import { useNow } from '../data/useNow.js';
import { usePatients } from '../data/usePatients.js';
import { useVisits, vitalFlags } from '../data/useVisits.js';

/**
 * Medical Support Queue — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function MedicalSupportPage() {
  const { appointments, setStatus, resetAppointments } = useAppointments();
  const { getPatient, patientIdForAppt } = usePatients();
  const { getVisit } = useVisits();
  const { show, toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const todayKey = offsetDateKey(0);
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState(
    ['triage', 'ready', 'in_treatment', 'completed'].includes(initialTab) ? initialTab : 'triage',
  );
  const now = useNow();
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (location.state?.toastMessage) {
      show(location.state.toastMessage);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, show]);

  const groups = useMemo(
    () => ({
      triage: awaitingTriage(appointments, getVisit, todayKey),
      ready: readyForVet(appointments, getVisit, todayKey),
      in_treatment: inTreatment(appointments, getVisit, todayKey),
      completed: completedToday(appointments, getVisit, todayKey),
    }),
    [appointments, todayKey, getVisit],
  );

  function handleSendToVet(appt) {
    if (setStatus(appt.id, 'in_treatment')) {
      show(`ส่งน้อง ${appt.petName} เข้าห้องตรวจแล้ว`);
    }
  }

  function handleConfirmReset() {
    resetAppointments();
    setResetOpen(false);
    show('รีเซ็ตข้อมูลตัวอย่างแล้ว');
  }

  const tabs = [
    { id: 'triage', label: 'รอคัดกรอง', icon: 'bi-thermometer-half', count: groups.triage.length },
    { id: 'ready', label: 'พร้อมพบหมอ', icon: 'bi-person-check', count: groups.ready.length },
    { id: 'in_treatment', label: 'กำลังตรวจ', icon: 'bi-heart-pulse', count: groups.in_treatment.length },
    { id: 'completed', label: 'เสร็จแล้ววันนี้', icon: 'bi-check2-circle', count: groups.completed.length },
  ];

  const activeList = groups[tab] ?? [];

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>สนับสนุนการรักษา</h1>
          <p>คัดกรอง เตรียมความพร้อม และช่วยบันทึกการรักษาของผู้ป่วยในคลินิกวันนี้</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-soft" onClick={() => setResetOpen(true)}>
            <i className="bi bi-arrow-counterclockwise me-1" />
            รีเซ็ตข้อมูลตัวอย่าง
          </button>
          <Link to="/medical-assistant/appointments" className="btn btn-sky">
            <i className="bi bi-calendar2-check me-1" />
            ไปหน้านัดหมาย
          </Link>
        </div>
      </div>

      <div className="row g-2 g-md-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag warn ma-stat-icon" aria-hidden="true">
              <i className="bi bi-thermometer-half" />
            </span>
            <div className="num">{groups.triage.length}</div>
            <div className="small text-muted">รอคัดกรอง</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag sky ma-stat-icon" aria-hidden="true">
              <i className="bi bi-person-check" />
            </span>
            <div className="num">{groups.ready.length}</div>
            <div className="small text-muted">พร้อมพบหมอ</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag warn ma-stat-icon" aria-hidden="true">
              <i className="bi bi-heart-pulse" />
            </span>
            <div className="num">{groups.in_treatment.length}</div>
            <div className="small text-muted">กำลังตรวจ</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat">
            <span className="tag ok ma-stat-icon" aria-hidden="true">
              <i className="bi bi-check2-circle" />
            </span>
            <div className="num">{groups.completed.length}</div>
            <div className="small text-muted">เสร็จวันนี้</div>
          </div>
        </div>
      </div>

      <div className="card-soft mb-4">
        <div className="pill-tabs ma-status-tabs mb-0" role="tablist" aria-label="คิวผู้ป่วยวันนี้">
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
      </div>

      {activeList.length === 0 ? (
        <div className="card-soft">
          <div className="empty-box">
            <i className="bi bi-bandaid" />
            <div>
              {tab === 'triage'
                ? 'ไม่มีผู้ป่วยรอคัดกรองในขณะนี้'
                : tab === 'ready'
                  ? 'ไม่มีผู้ป่วยที่รอเข้าห้องตรวจ'
                  : tab === 'in_treatment'
                    ? 'ไม่มีเคสที่กำลังตรวจในขณะนี้'
                    : 'ยังไม่มีเคสที่เสร็จสิ้นในวันนี้'}
            </div>
            <div className="mt-3">
              <Link to="/medical-assistant/appointments" className="btn btn-sky">
                <i className="bi bi-calendar2-check me-1" />
                ไปเช็คอินที่หน้านัดหมาย
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {activeList.map((appt) => {
            const sp = speciesOf(appt.species);
            const pid = patientIdForAppt(appt);
            const patient = getPatient(pid);
            const visit = getVisit(appt.id);
            const triageMeta = visit?.triage ? TRIAGE_LEVELS[visit.triage] : null;
            const vFlags = vitalFlags(appt.species, visit?.vitals);
            const mins = waitMinutes(appt, now);
            const patientFlags = patient?.flags ?? [];

            return (
              <div className="col-12 col-lg-6" key={appt.id}>
                <div className="card-soft ma-queue-card h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <PetPhoto
                        pet={{ name: appt.petName, species: appt.species, photo: patient?.pet?.photo }}
                        size="xs"
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="mitr fs-5 lh-sm">
                          <PatientNameLink
                            patientId={pid}
                            petName={appt.petName}
                            species={appt.species}
                            flags={patientFlags}
                            allergies={patient?.pet?.allergies}
                            showEmoji={false}
                          />
                        </div>
                        <div className="small text-muted">
                          {sp.emoji} {sp.label} · {appt.ownerName}
                        </div>
                      </div>
                    </div>

                    <div className="d-flex flex-wrap justify-content-end gap-1">
                      {triageMeta && (
                        <span className={`tag ${triageMeta.tag} m-0`}>
                          ความเร่งด่วน: {triageMeta.label}
                        </span>
                      )}
                      {appt.status !== 'completed' && (
                        <span className="tag sky m-0">
                          <i className="bi bi-clock me-1" />
                          {formatWaitText(mins)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="small mb-2 d-grid gap-1">
                    <div>
                      <i className="bi bi-clipboard2-pulse me-1 text-sky" />
                      <strong>{appt.service}</strong> · {appt.vet} · เวลานัด {appt.time} น.
                    </div>
                    {appt.reason && (
                      <div className="text-muted">อาการ/เหตุผล: {appt.reason}</div>
                    )}
                    {visit?.vitals && (visit.vitals.weight || visit.vitals.temp) && (
                      <div className="text-muted">
                        สัญญาณชีพ:{' '}
                        {visit.vitals.weight ? `น้ำหนัก ${visit.vitals.weight} กก.` : ''}
                        {visit.vitals.weight && visit.vitals.temp ? ' · ' : ''}
                        {visit.vitals.temp ? `อุณหภูมิ ${visit.vitals.temp} °C` : ''}
                      </div>
                    )}
                  </div>

                  {(patientFlags.length > 0 || vFlags.length > 0) && (
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {patientFlags.map((f) => {
                        const meta = CAUTION_FLAGS[f];
                        if (!meta) return null;
                        return (
                          <span key={f} className={`tag ${meta.tag} m-0`}>
                            <i className={`bi ${meta.icon} me-1`} />
                            {meta.label}
                          </span>
                        );
                      })}
                      {vFlags.length > 0 && (
                        <span
                          className="tag danger m-0"
                          title={vFlags.map((vf) => `${vf.label}: ${vf.value} ${vf.unit}`).join(', ')}
                        >
                          <i className="bi bi-exclamation-triangle-fill me-1" />
                          สัญญาณชีพผิดปกติ {vFlags.length} ค่า
                        </span>
                      )}
                    </div>
                  )}

                  <div className="ma-actions mt-auto pt-2">
                    {tab === 'triage' && (
                      <Link
                        to={`/medical-assistant/medical-support/${appt.id}`}
                        className="btn btn-sky btn-sm"
                      >
                        <i className="bi bi-thermometer-half me-1" />
                        คัดกรอง
                      </Link>
                    )}

                    {tab === 'ready' && (
                      <>
                        <Link
                          to={`/medical-assistant/medical-support/${appt.id}`}
                          className="btn btn-soft btn-sm"
                        >
                          เปิดเคส
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sky btn-sm"
                          onClick={() => handleSendToVet(appt)}
                        >
                          <i className="bi bi-box-arrow-in-right me-1" />
                          ส่งเข้าห้องตรวจ
                        </button>
                      </>
                    )}

                    {tab === 'in_treatment' && (
                      <Link
                        to={`/medical-assistant/medical-support/${appt.id}`}
                        className="btn btn-sky btn-sm"
                      >
                        <i className="bi bi-journal-medical me-1" />
                        เปิดเคส
                      </Link>
                    )}

                    {tab === 'completed' && (
                      <Link
                        to={`/medical-assistant/medical-support/${appt.id}`}
                        className="btn btn-soft btn-sm"
                      >
                        <i className="bi bi-file-text me-1" />
                        ดูสรุป
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
