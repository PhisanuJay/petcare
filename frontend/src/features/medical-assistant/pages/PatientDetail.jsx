import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import {
  NEUTER_OPTIONS,
  SEX_OPTIONS,
  ageText,
  careReminders,
  daysUntil,
  formatDate,
  labelOf,
  reminderText,
  speciesOf,
} from '../../pet-owner/petUtils.js';
import {
  PARASITE_FIELDS,
  TREATMENT_FIELDS,
  VACCINE_FIELDS,
} from '../../pet-owner/recordFields.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import MaDataState from '../components/MaDataState.jsx';
import { apptVetName } from '../data/clinicMeta.js';
import {
  CAUTION_FLAGS,
  CAUTION_FLAG_LIST,
  FALLBACK_NOTE_CATEGORIES,
  STAGE_META,
} from '../data/constants.js';
import { usePatient } from '../data/usePatients.js';

function formatNoteDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const datePart = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart} น.`;
}

function formatFieldValue(field, val) {
  if (!val) return '-';
  if (field.type === 'date') return formatDate(val);
  if (field.type === 'select' && field.options) return labelOf(field.options, val);
  return val;
}

function ReadOnlyRecords({ rows = [], fields, emptyIcon, emptyText }) {
  if (!rows.length) {
    return (
      <div className="empty-box py-3">
        <i className={`bi ${emptyIcon}`} />
        {emptyText}
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="d-grid gap-2">
      {sorted.map((row, idx) => (
        <div className="record-row mb-0 pb-2" key={row.id ?? idx}>
          {row.source === 'vet' && (
            <div className="mb-2">
              <span className="tag sky m-0">
                <i className="bi bi-patch-check me-1" />
                สัตวแพทย์
              </span>
            </div>
          )}
          <div className="info-grid">
            {fields.map((f) => (
              <div className="info-item bg-white" key={f.key}>
                <div className="k">{f.label}</div>
                <div className="v">{formatFieldValue(f, row[f.key])}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Patient Detail — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function PatientDetailPage() {
  const { patientId } = useParams();
  const { patient, loading, error, meta, reload, setFlags, addNote, deleteNote } =
    usePatient(patientId);
  const { show, toast } = useToast();

  const noteCategories = useMemo(
    () => (meta?.NOTE_CATEGORIES?.length ? meta.NOTE_CATEGORIES : FALLBACK_NOTE_CATEGORIES),
    [meta],
  );
  const flagOptions = useMemo(() => {
    if (meta?.CAUTION_FLAGS?.length) {
      return meta.CAUTION_FLAGS.map((k) => CAUTION_FLAGS[k]).filter(Boolean);
    }
    return CAUTION_FLAG_LIST;
  }, [meta]);

  const [recordTab, setRecordTab] = useState('vaccines');
  const [noteCategory, setNoteCategory] = useState(noteCategories[0]);
  const [noteText, setNoteText] = useState('');
  const [noteError, setNoteError] = useState('');
  const [savingFlags, setSavingFlags] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (loading || error || !patient) {
    return (
      <section>
        <div className="mb-3">
          <Link to="/clinic-admin/patients" className="small text-decoration-none">
            <i className="bi bi-arrow-left me-1" />
            กลับไปหน้ารายชื่อสัตว์เลี้ยง
          </Link>
        </div>

        {(loading || error) ? (
          <MaDataState loading={loading} error={error} hasData={Boolean(patient)} onRetry={reload} />
        ) : (
          <div className="card-soft empty-box">
            <i className="bi bi-question-circle" />
            <div>ไม่พบข้อมูลสัตว์เลี้ยงนี้</div>
            <div className="mt-3">
              <Link to="/clinic-admin/patients" className="btn btn-sky">
                กลับไปหน้ารายชื่อสัตว์เลี้ยง
              </Link>
            </div>
          </div>
        )}
      </section>
    );
  }

  const sp = speciesOf(patient.species);
  const flags = patient.flags ?? [];
  const notes = patient.notes ?? [];
  const patientAppointments = patient.appointments ?? [];
  const hasAllergyAlert = flags.includes('drug_allergy') || Boolean(patient.allergies);

  const nextAppt = patient.nextAppointment;
  const nextDays = nextAppt ? daysUntil(nextAppt.date) : null;
  const showUpcomingAlert = nextDays !== null && nextDays >= 0 && nextDays <= 7;

  const reminders = careReminders([patient]).filter((r) => r.status !== 'later');
  const vaccines = patient.vaccines ?? [];
  const treatments = patient.treatments ?? [];
  const parasites = patient.parasites ?? [];
  const latestVitals = patient.latestVitals;
  const latestV = latestVitals?.vitals ?? null;
  const displayWeight = latestV?.weight || patient.weight || '';

  async function handleToggleFlag(flagKey) {
    if (savingFlags) return;
    const exists = flags.includes(flagKey);
    const nextFlags = exists ? flags.filter((f) => f !== flagKey) : [...flags, flagKey];
    setSavingFlags(true);
    try {
      await setFlags(nextFlags);
      const label = CAUTION_FLAGS[flagKey]?.label ?? flagKey;
      show(exists ? `นำข้อควรระวัง "${label}" ออกแล้ว` : `เพิ่มข้อควรระวัง "${label}" แล้ว`);
    } catch (err) {
      show(err?.message || 'ไม่สามารถบันทึกข้อควรระวังได้');
    } finally {
      setSavingFlags(false);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim()) {
      setNoteError('กรุณากรอกข้อความบันทึก');
      return;
    }
    setSavingNote(true);
    setNoteError('');
    try {
      await addNote({ category: noteCategory, text: noteText.trim() });
      setNoteText('');
      show('บันทึกข้อมูลสัตว์เลี้ยงแล้ว');
    } catch (err) {
      setNoteError(err?.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSavingNote(false);
    }
  }

  async function handleConfirmDeleteNote() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setDeleteError('');
    try {
      await deleteNote(deleteTarget.id);
      setDeleteTarget(null);
      show('ลบบันทึกแล้ว');
    } catch (err) {
      setDeleteError(err?.message || 'ไม่สามารถลบบันทึกได้');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <section>
      <div className="mb-3">
        <Link to="/clinic-admin/patients" className="small text-decoration-none">
          <i className="bi bi-arrow-left me-1" />
          กลับไปหน้ารายชื่อสัตว์เลี้ยง
        </Link>
      </div>

      {hasAllergyAlert && (
        <div className="alert-soft danger mb-3">
          <i className="bi bi-capsule" />
          <span>
            <strong>ระวังประวัติแพ้ยา / แพ้อาหาร</strong>
            {patient.allergies ? `: ${patient.allergies}` : ' — กรุณาตรวจสอบกับสัตวแพทย์ก่อนให้ยา'}
          </span>
        </div>
      )}

      {showUpcomingAlert && (
        <div className="alert-soft info mb-3">
          <i className="bi bi-calendar-event" />
          <span>
            <strong>{nextDays === 0 ? 'มีนัดวันนี้' : `นัดหมายถัดไปในอีก ${nextDays} วัน`}</strong>
            {' · '}
            {formatDate(nextAppt.date)} เวลา {nextAppt.time} น. ({nextAppt.serviceLabel}
            {nextAppt.vet ? ` · ${nextAppt.vet}` : ''})
          </span>
        </div>
      )}

      <div className="card-soft mb-4">
        <div className="d-flex flex-wrap align-items-center gap-3 gap-md-4">
          <PetPhoto pet={{ name: patient.name, species: patient.species, photo: patient.photo }} size="lg" />

          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h1 className="h2 mb-0">{patient.name}</h1>
            </div>

            <div className="text-muted mb-2">
              {sp.emoji} {sp.label}
              {patient.breed ? ` · ${patient.breed}` : ''}
              {patient.birthDate ? ` · ${ageText(patient.birthDate)}` : ''}
            </div>

            {flags.length > 0 && (
              <div className="d-flex flex-wrap gap-1">
                {flags.map((f) => {
                  const flagMeta = CAUTION_FLAGS[f];
                  if (!flagMeta) return null;
                  return (
                    <span key={f} className={`tag ${flagMeta.tag} m-0`}>
                      <i className={`bi ${flagMeta.icon} me-1`} />
                      {flagMeta.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card-soft mb-4">
            <div className="section-label">
              <i className="bi bi-info-circle" />
              ข้อมูลสัตว์
            </div>

            <div className="info-grid">
              <div className="info-item">
                <div className="k">พันธุ์</div>
                <div className="v">{patient.breed || '-'}</div>
              </div>
              <div className="info-item">
                <div className="k">เพศ</div>
                <div className="v">{labelOf(SEX_OPTIONS, patient.sex)}</div>
              </div>
              <div className="info-item">
                <div className="k">อายุ / วันเกิด</div>
                <div className="v">
                  {patient.birthDate ? `${ageText(patient.birthDate)} (${formatDate(patient.birthDate)})` : '-'}
                </div>
              </div>
              <div className="info-item">
                <div className="k">น้ำหนักล่าสุด</div>
                <div className="v">{displayWeight ? `${displayWeight} กก.` : '-'}</div>
              </div>
              <div className="info-item">
                <div className="k">การทำหมัน</div>
                <div className="v">{labelOf(NEUTER_OPTIONS, patient.neutered)}</div>
              </div>
              <div className="info-item">
                <div className="k">แพ้ยา / แพ้อาหาร</div>
                <div className="v">{patient.allergies || '-'}</div>
              </div>
              <div className="info-item">
                <div className="k">โรคประจำตัว</div>
                <div className="v">{patient.chronicDiseases || '-'}</div>
              </div>
              <div className="info-item">
                <div className="k">ยาที่ใช้ประจำ</div>
                <div className="v">{patient.medications || '-'}</div>
              </div>
            </div>
          </div>

          <div className="card-soft mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div className="section-label mb-0">
                <i className="bi bi-heart-pulse" />
                สัญญาณชีพล่าสุด
              </div>
              {latestVitals && (
                <span className="small text-muted">
                  บันทึกเมื่อ {formatDate(latestVitals.date)} · {latestVitals.time} น.
                </span>
              )}
            </div>

            {latestV ? (
              <div className="info-grid">
                <div className="info-item">
                  <div className="k">น้ำหนัก</div>
                  <div className="v">{latestV.weight ? `${latestV.weight} กก.` : '-'}</div>
                </div>
                <div className="info-item">
                  <div className="k">อุณหภูมิ</div>
                  <div className="v">{latestV.temp ? `${latestV.temp} °C` : '-'}</div>
                </div>
                <div className="info-item">
                  <div className="k">ชีพจร</div>
                  <div className="v">{latestV.heartRate ? `${latestV.heartRate} ครั้ง/นาที` : '-'}</div>
                </div>
                <div className="info-item">
                  <div className="k">อัตราหายใจ</div>
                  <div className="v">{latestV.respRate ? `${latestV.respRate} ครั้ง/นาที` : '-'}</div>
                </div>
                <div className="info-item">
                  <div className="k">BCS / Pain</div>
                  <div className="v">
                    {latestV.bcs ? `${latestV.bcs}/9` : '-'} ·{' '}
                    {latestV.pain !== '' && latestV.pain !== undefined ? `Pain ${latestV.pain}/4` : '-'}
                  </div>
                </div>
                <div className="info-item">
                  <div className="k">สีเยื่อเมือก / CRT</div>
                  <div className="v">
                    {latestV.mucous || '-'} · {latestV.crt || '-'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-box py-3">
                <i className="bi bi-heart-pulse" />
                ยังไม่มีการบันทึกสัญญาณชีพ
              </div>
            )}
          </div>

          <div className="card-soft mb-4">
            <div className="section-label">
              <i className="bi bi-journal-medical" />
              ประวัติการรักษา / วัคซีน / ป้องกันปรสิต (อ่านอย่างเดียว)
            </div>

            {reminders.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mb-3">
                {reminders.map((r, idx) => (
                  <span
                    key={`${r.title}-${r.date}-${idx}`}
                    className={`tag ${r.status === 'overdue' ? 'danger' : 'warn'} m-0`}
                  >
                    <i className="bi bi-bell me-1" />
                    {r.title} · {formatDate(r.date)} ({reminderText(r)})
                  </span>
                ))}
              </div>
            )}

            <div className="pill-tabs ma-status-tabs mb-3" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={recordTab === 'vaccines'}
                className={recordTab === 'vaccines' ? 'active' : ''}
                onClick={() => setRecordTab('vaccines')}
              >
                <i className="bi bi-capsule" />
                วัคซีน
                <span className="count">{vaccines.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={recordTab === 'treatments'}
                className={recordTab === 'treatments' ? 'active' : ''}
                onClick={() => setRecordTab('treatments')}
              >
                <i className="bi bi-clipboard2-pulse" />
                การรักษา
                <span className="count">{treatments.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={recordTab === 'parasites'}
                className={recordTab === 'parasites' ? 'active' : ''}
                onClick={() => setRecordTab('parasites')}
              >
                <i className="bi bi-bug" />
                ป้องกันปรสิต
                <span className="count">{parasites.length}</span>
              </button>
            </div>

            {recordTab === 'vaccines' && (
              <ReadOnlyRecords
                rows={vaccines}
                fields={VACCINE_FIELDS}
                emptyIcon="bi-capsule"
                emptyText="ยังไม่มีประวัติวัคซีน"
              />
            )}
            {recordTab === 'treatments' && (
              <ReadOnlyRecords
                rows={treatments}
                fields={TREATMENT_FIELDS}
                emptyIcon="bi-journal-medical"
                emptyText="ยังไม่มีประวัติการรักษา"
              />
            )}
            {recordTab === 'parasites' && (
              <ReadOnlyRecords
                rows={parasites}
                fields={PARASITE_FIELDS}
                emptyIcon="bi-bug"
                emptyText="ยังไม่มีประวัติป้องกันปรสิต"
              />
            )}
          </div>

          <div className="card-soft">
            <div className="section-label">
              <i className="bi bi-clock-history" />
              ประวัตินัดหมายในคลินิก ({patientAppointments.length} รายการ)
            </div>

            {patientAppointments.length > 0 ? (
              <div className="timeline">
                {patientAppointments.map((a) => {
                  const st = STAGE_META[a.stage] ?? STAGE_META.pending;
                  const visit = a.visit;
                  const checkedIn = Boolean(visit?.checkedInAt);

                  return (
                    <div className="tl-item" key={a.id}>
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div className="date">
                          {formatDate(a.date)} · {a.time} น.
                        </div>
                        <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                      </div>
                      <div className="fw-medium mt-1">
                        {a.serviceLabel || a.service}
                        {apptVetName(a) ? (
                          <span className="text-muted fw-normal"> · {apptVetName(a)}</span>
                        ) : null}
                      </div>
                      {a.note && <div className="small text-muted">ข้อความเจ้าของ: {a.note}</div>}
                      {visit?.vitals && (visit.vitals.weight || visit.vitals.temp) && (
                        <div className="small text-muted mt-1">
                          สัญญาณชีพ:{' '}
                          {visit.vitals.weight ? `น้ำหนัก ${visit.vitals.weight} กก.` : ''}
                          {visit.vitals.weight && visit.vitals.temp ? ' · ' : ''}
                          {visit.vitals.temp ? `อุณหภูมิ ${visit.vitals.temp} °C` : ''}
                        </div>
                      )}
                      {a.clinicNote && <div className="small mt-1">หมายเหตุ: {a.clinicNote}</div>}
                      {checkedIn && (
                        <div className="mt-1">
                          <Link
                            to={`/clinic-admin/appointments`}
                            className="small text-decoration-none"
                          >
                            เปิดข้อมูลสนับสนุนการรักษา <i className="bi bi-arrow-right-short" />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-box py-3">
                <i className="bi bi-calendar-x" />
                ยังไม่มีประวัตินัดหมายในคลินิก
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card-soft mb-4">
            <div className="section-label">
              <i className="bi bi-person" />
              เจ้าของ
            </div>
            <div className="d-grid gap-2">
              <div className="info-item">
                <div className="k">ชื่อเจ้าของ</div>
                <div className="v">{patient.ownerName || '—'}</div>
              </div>
              <div className="info-item">
                <div className="k">เบอร์โทรศัพท์</div>
                <div className="v d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <span>{patient.ownerPhone || '—'}</span>
                  {patient.ownerPhone && (
                    <a href={`tel:${patient.ownerPhone}`} className="btn btn-soft btn-sm">
                      <i className="bi bi-telephone me-1" />
                      โทรหาเจ้าของ
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card-soft mb-4">
            <div className="section-label">
              <i className="bi bi-exclamation-triangle" />
              ข้อควรระวัง
            </div>
            <p className="small text-muted mb-3">
              กดเลือกเพื่อติดหรือถอดป้ายเตือนก่อนส่งต่อเข้าห้องตรวจ
            </p>
            <div className="d-flex flex-wrap gap-2">
              {flagOptions.map((flag) => {
                const active = flags.includes(flag.value);
                return (
                  <button
                    key={flag.value}
                    type="button"
                    disabled={savingFlags}
                    aria-pressed={active}
                    className={
                      active
                        ? `tag ${flag.tag} ma-flag-toggle`
                        : 'btn btn-soft btn-sm ma-flag-toggle'
                    }
                    onClick={() => handleToggleFlag(flag.value)}
                  >
                    <i className={`bi ${flag.icon}`} />
                    <span>{flag.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card-soft">
            <div className="section-label">
              <i className="bi bi-journal-text" />
              บันทึกภายในของผู้ช่วยสัตวแพทย์ ({notes.length})
            </div>

            <form onSubmit={handleAddNote} noValidate className="mb-3">
              <div className="mb-2">
                <label className="form-label" htmlFor="ma-note-cat">
                  หมวดหมู่
                </label>
                <select
                  id="ma-note-cat"
                  className="form-select"
                  disabled={savingNote}
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value)}
                >
                  {noteCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label" htmlFor="ma-note-text">
                  ข้อความบันทึก
                </label>
                <textarea
                  id="ma-note-text"
                  rows={2}
                  maxLength={1000}
                  disabled={savingNote}
                  className={`form-control${noteError ? ' is-invalid' : ''}`}
                  placeholder="เช่น น้องกลัวเสียงดัง ให้พาเข้าห้องตรวจด้านใน"
                  value={noteText}
                  onChange={(e) => {
                    setNoteText(e.target.value);
                    if (noteError) setNoteError('');
                  }}
                />
                {noteError && <div className="invalid-feedback">{noteError}</div>}
              </div>
              <div className="text-end">
                <button type="submit" className="btn btn-sky btn-sm" disabled={savingNote}>
                  {savingNote && (
                    <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                  )}
                  <i className="bi bi-check2 me-1" />
                  บันทึก
                </button>
              </div>
            </form>

            {notes.length > 0 ? (
              <div className="d-grid gap-2">
                {notes.map((n) => (
                  <div className="record-row mb-0 pb-2" key={n.id}>
                    <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                      <span className="tag sky m-0">{n.category}</span>
                      <div className="d-flex align-items-center gap-2">
                        <span className="small text-muted">{formatNoteDateTime(n.createdAt)}</span>
                        <button
                          type="button"
                          className="btn btn-soft-danger btn-sm py-0 px-2"
                          title="ลบบันทึก"
                          aria-label="ลบบันทึก"
                          onClick={() => {
                            setDeleteError('');
                            setDeleteTarget(n);
                          }}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </div>
                    <div className="small">{n.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-box py-3">
                <i className="bi bi-journal-text" />
                ยังไม่มีบันทึกภายในของผู้ช่วยสัตวแพทย์
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบบันทึก"
        icon="bi-trash3"
        message="ต้องการลบบันทึกนี้ใช่หรือไม่?"
        confirmLabel="ลบบันทึก"
        cancelLabel="ยกเลิก"
        confirmVariant="danger"
        submitting={deleteSubmitting}
        error={deleteError}
        onClose={() => !deleteSubmitting && setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteNote}
      />

      {toast}
    </section>
  );
}
