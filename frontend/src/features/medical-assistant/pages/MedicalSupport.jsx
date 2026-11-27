import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import { speciesOf } from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import MaDataState from '../components/MaDataState.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import { apptVetName } from '../data/clinicMeta.js';
import { CAUTION_FLAGS, STAGE_META, TRIAGE_LEVELS, offsetDateKey } from '../data/constants.js';
import {
  awaitingTriage,
  completedToday,
  formatWaitText,
  inClinicToday,
  inTreatment,
  waitMinutes,
} from '../data/selectors.js';
import { useAppointments } from '../data/useAppointments.js';
import { useNow } from '../data/useNow.js';
import { usePatients } from '../data/usePatients.js';
import { isTriaged, useVisits, vitalFlags } from '../data/useVisits.js';

/**
 * Medical Support Queue — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function MedicalSupportPage() {
  const { appointments, loading, error, meta, reload, startTreatment } = useAppointments();
  const { patients } = usePatients();
  const { getVisit } = useVisits();
  const { show, toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const todayKey = offsetDateKey(0);
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState(
    ['queue', 'triage', 'completed'].includes(initialTab) ? initialTab : 'queue',
  );
  const now = useNow();

  const [sendTarget, setSendTarget] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    if (location.state?.toastMessage) {
      show(location.state.toastMessage);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, show]);

  const patientsById = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients],
  );

  const groups = useMemo(
    () => ({
      queue: inClinicToday(appointments, getVisit, todayKey),
      triage: awaitingTriage(appointments, getVisit, todayKey),
      treatment: inTreatment(appointments, getVisit, todayKey),
      completed: completedToday(appointments, getVisit, todayKey),
    }),
    [appointments, todayKey, getVisit],
  );

  async function handleConfirmSendToVet() {
    if (!sendTarget) return;
    setSending(true);
    setSendError('');
    try {
      await startTreatment(sendTarget.id);
      show(`ส่งน้อง ${sendTarget.petName} เข้าห้องตรวจแล้ว`);
      setSendTarget(null);
    } catch (err) {
      setSendError(err?.message || 'ไม่สามารถส่งเข้าห้องตรวจได้');
    } finally {
      setSending(false);
    }
  }

  const tabs = [
    { id: 'queue', label: 'คิวในคลินิก', icon: 'bi-people', count: groups.queue.length },
    { id: 'triage', label: 'รอคัดกรอง', icon: 'bi-thermometer-half', count: groups.triage.length },
    { id: 'completed', label: 'เสร็จแล้ววันนี้', icon: 'bi-check2-circle', count: groups.completed.length },
  ];

  const activeList = groups[tab] ?? [];
  const hasData = Boolean(meta) || appointments.length > 0;
  const blockedByState = !hasData && (loading || Boolean(error));

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>สนับสนุนการรักษา</h1>
          <p>คัดกรอง วัดสัญญาณชีพ เตรียมความพร้อม และติดตามบันทึกจากสัตวแพทย์</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-soft" disabled={loading} onClick={reload}>
            <i className="bi bi-arrow-clockwise me-1" />
            รีเฟรช
          </button>
          <Link to="/clinic-admin/appointments" className="btn btn-sky">
            <i className="bi bi-calendar2-check me-1" />
            ไปหน้านัดหมาย
          </Link>
        </div>
      </div>

      <MaDataState loading={loading} error={error} hasData={hasData} onRetry={reload} />

      {!blockedByState && (
        <>
          <div className="row g-2 g-md-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="stat">
                <span className="tag sky ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-people" />
                </span>
                <div className="num">{groups.queue.length}</div>
                <div className="small text-muted">คิวในคลินิก</div>
              </div>
            </div>
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
                <span className="tag warn ma-stat-icon" aria-hidden="true">
                  <i className="bi bi-heart-pulse" />
                </span>
                <div className="num">{groups.treatment.length}</div>
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
            <div className="pill-tabs ma-status-tabs mb-0" role="tablist" aria-label="คิวสัตว์เลี้ยงวันนี้">
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
                  {tab === 'queue'
                    ? 'ไม่มีสัตว์เลี้ยงในคิวคลินิกวันนี้'
                    : tab === 'triage'
                      ? 'ไม่มีสัตว์เลี้ยงรอคัดกรองในขณะนี้'
                      : 'ยังไม่มีเคสที่เสร็จสิ้นในวันนี้'}
                </div>
                <div className="mt-3">
                  <Link to="/clinic-admin/appointments" className="btn btn-sky">
                    <i className="bi bi-calendar2-check me-1" />
                    ไปเช็คอินที่หน้านัดหมาย
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="row g-3">
              {activeList.map((appt) => {
                const sp = speciesOf(appt.petSpecies);
                const stageMeta = STAGE_META[appt.stage] ?? STAGE_META.checked_in;
                const patient = patientsById.get(appt.petId);
                const visit = appt.visit;
                const triaged = isTriaged(visit);
                const triageMeta = visit?.triage ? TRIAGE_LEVELS[visit.triage] : null;
                const vFlags = vitalFlags(appt.petSpecies, visit?.vitals);
                const mins = waitMinutes(appt, now);
                const patientFlags = patient?.flags ?? [];
                const allergies = appt.pet?.allergies ?? patient?.allergies ?? '';
                const isDone = appt.stage === 'completed';

                return (
                  <div className="col-12 col-lg-6" key={appt.id}>
                    <div className="card-soft ma-queue-card h-100 d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                          <PetPhoto pet={{ name: appt.petName, species: appt.petSpecies }} size="xs" />
                          <div style={{ minWidth: 0 }}>
                            <div className="mitr fs-5 lh-sm">
                              <PatientNameLink
                                petId={appt.petId}
                                petName={appt.petName}
                                petSpecies={appt.petSpecies}
                                flags={patientFlags}
                                allergies={allergies}
                                showEmoji={false}
                              />
                            </div>
                            <div className="small text-muted">
                              {sp.emoji} {sp.label} · {appt.ownerName || '—'}
                            </div>
                          </div>
                        </div>

                        <div className="d-flex flex-wrap justify-content-end gap-1">
                          <span className={`tag ${stageMeta.tag} m-0`}>{stageMeta.label}</span>
                          {triageMeta ? (
                            <span className={`tag ${triageMeta.tag} m-0`}>
                              ความเร่งด่วน: {triageMeta.label}
                            </span>
                          ) : !isDone ? (
                            <span className="tag warn m-0">ยังไม่คัดกรอง</span>
                          ) : null}
                          {!isDone && (
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
                          <strong>{appt.serviceLabel || appt.service}</strong> ·{' '}
                          {apptVetName(appt) || 'ยังไม่ระบุหมอ'} · เวลานัด {appt.time} น.
                        </div>
                        {(visit?.chiefComplaint || appt.note) && (
                          <div className="text-muted">
                            อาการ/เหตุผล: {visit?.chiefComplaint || appt.note}
                          </div>
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

                      {(patientFlags.length > 0 || allergies || vFlags.length > 0) && (
                        <div className="d-flex flex-wrap gap-1 mb-2">
                          {patientFlags.map((f) => {
                            const flagMeta = CAUTION_FLAGS[f];
                            if (!flagMeta) return null;
                            return (
                              <span key={f} className={`tag ${flagMeta.tag} m-0`}>
                                <i className={`bi ${flagMeta.icon} me-1`} />
                                {flagMeta.label}
                              </span>
                            );
                          })}
                          {allergies && !patientFlags.includes('drug_allergy') && (
                            <span className="tag danger m-0" title={allergies}>
                              <i className="bi bi-capsule me-1" />
                              แพ้: {allergies}
                            </span>
                          )}
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
                        {appt.stage === 'checked_in' && (
                          <>
                            <Link
                              to={`/clinic-admin/medical-support/${appt.id}`}
                              className={`btn ${triaged ? 'btn-soft' : 'btn-sky'} btn-sm`}
                            >
                              <i className="bi bi-thermometer-half me-1" />
                              {triaged ? 'เปิดเคส / แก้ไข' : 'คัดกรอง'}
                            </Link>
                            <button
                              type="button"
                              className="btn btn-sky btn-sm"
                              disabled={!triaged}
                              title={!triaged ? 'กรุณาคัดกรองก่อนส่งเข้าห้องตรวจ' : undefined}
                              onClick={() => {
                                setSendError('');
                                setSendTarget(appt);
                              }}
                            >
                              <i className="bi bi-box-arrow-in-right me-1" />
                              ส่งเข้าห้องตรวจ
                            </button>
                          </>
                        )}

                        {appt.stage === 'in_treatment' && (
                          <>
                            <span className="tag warn m-0">รอหมอปิดเคส</span>
                            <Link
                              to={`/clinic-admin/medical-support/${appt.id}`}
                              className="btn btn-soft btn-sm"
                            >
                              <i className="bi bi-journal-medical me-1" />
                              เปิดเคส
                            </Link>
                          </>
                        )}

                        {isDone && (
                          <Link
                            to={`/clinic-admin/medical-support/${appt.id}`}
                            className="btn btn-soft btn-sm"
                          >
                            <i className="bi bi-file-text me-1" />
                            ดูสรุป (อ่านอย่างเดียว)
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={Boolean(sendTarget)}
        title="ส่งสัตว์เลี้ยงเข้าห้องตรวจ"
        icon="bi-heart-pulse"
        message={
          sendTarget
            ? `ยืนยันส่ง "${sendTarget.petName}" เข้าห้องตรวจกับ ${apptVetName(sendTarget) || 'สัตวแพทย์'} ใช่หรือไม่?`
            : ''
        }
        confirmLabel="ส่งเข้าห้องตรวจ"
        cancelLabel="ยกเลิก"
        confirmVariant="sky"
        submitting={sending}
        error={sendError}
        onClose={() => !sending && setSendTarget(null)}
        onConfirm={handleConfirmSendToVet}
      />

      {toast}
    </section>
  );
}
