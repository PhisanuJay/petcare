import { useState } from 'react';
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
import AppointmentModal from '../components/AppointmentModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import {
  APPOINTMENT_STATUS,
  CAUTION_FLAGS,
  CAUTION_FLAG_LIST,
  NOTE_CATEGORIES,
  offsetDateKey,
} from '../data/constants.js';
import { useAppointments } from '../data/useAppointments.js';
import { usePatientNotes } from '../data/usePatientNotes.js';
import { usePatients } from '../data/usePatients.js';
import { useVisits } from '../data/useVisits.js';

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
  const { getPatient } = usePatients();
  const { appointments, addAppointment } = useAppointments();
  const { getEntry, toggleFlag, addNote, deleteNote } = usePatientNotes();
  const { getVisit } = useVisits();
  const { show, toast } = useToast();

  const patient = getPatient(patientId);
  const entry = getEntry(patientId);

  const [recordTab, setRecordTab] = useState('vaccines');
  const [noteCategory, setNoteCategory] = useState(NOTE_CATEGORIES[0]);
  const [noteText, setNoteText] = useState('');
  const [noteError, setNoteError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [apptModalOpen, setApptModalOpen] = useState(false);

  if (!patient) {
    return (
      <section>
        <div className="card-soft empty-box">
          <i className="bi bi-question-circle" />
          <div>ไม่พบข้อมูลผู้ป่วยนี้</div>
          <div className="mt-3">
            <Link to="/medical-assistant/patients" className="btn btn-sky">
              กลับไปหน้ารายชื่อผู้ป่วย
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const sp = speciesOf(patient.species);
  const pet = patient.pet;
  const hasAllergyAlert = entry.flags.includes('drug_allergy') || Boolean(pet?.allergies);

  const nextAppt = patient.nextAppointment;
  const nextDays = nextAppt ? daysUntil(nextAppt.date) : null;
  const showUpcomingAlert = nextDays !== null && nextDays >= 0 && nextDays <= 7;

  const reminders = pet ? careReminders([pet]).filter((r) => r.status !== 'later') : [];
  const vaccines = pet?.vaccines ?? [];
  const treatments = pet?.treatments ?? [];
  const parasites = pet?.parasites ?? [];

  const latestVisitWeight =
    patient.appointments
      .map((a) => getVisit(a.id)?.vitals?.weight)
      .find((w) => Boolean(w)) || pet?.weight || '';

  function handleToggleFlag(flagKey) {
    const added = toggleFlag(patient.patientId, flagKey);
    const label = CAUTION_FLAGS[flagKey]?.label ?? flagKey;
    show(added ? `เพิ่มข้อควรระวัง "${label}" แล้ว` : `นำข้อควรระวัง "${label}" ออกแล้ว`);
  }

  function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim()) {
      setNoteError('กรุณากรอกข้อความบันทึก');
      return;
    }
    const created = addNote(patient.patientId, { category: noteCategory, text: noteText });
    if (created) {
      setNoteText('');
      setNoteError('');
      show('บันทึกข้อมูลผู้ป่วยแล้ว');
    }
  }

  function handleConfirmDeleteNote() {
    if (!deleteTarget) return;
    deleteNote(patient.patientId, deleteTarget.id);
    setDeleteTarget(null);
    show('ลบบันทึกแล้ว');
  }

  function handleCreateAppt(data) {
    addAppointment(data);
    setApptModalOpen(false);
    show(`สร้างนัดหมายให้ ${patient.petName} แล้ว`);
  }

  return (
    <section>
      <div className="mb-3">
        <Link to="/medical-assistant/patients" className="small text-decoration-none">
          <i className="bi bi-arrow-left me-1" />
          กลับไปหน้ารายชื่อผู้ป่วย
        </Link>
      </div>

      {hasAllergyAlert && (
        <div className="alert-soft danger mb-3">
          <i className="bi bi-capsule" />
          <span>
            <strong>ระวังประวัติแพ้ยา / แพ้อาหาร</strong>
            {pet?.allergies ? `: ${pet.allergies}` : ' — กรุณาตรวจสอบกับสัตวแพทย์ก่อนให้ยา'}
          </span>
        </div>
      )}

      {showUpcomingAlert && (
        <div className="alert-soft info mb-3">
          <i className="bi bi-calendar-event" />
          <span>
            <strong>{nextDays === 0 ? 'มีนัดวันนี้' : `นัดหมายถัดไปในอีก ${nextDays} วัน`}</strong>
            {' · '}
            {formatDate(nextAppt.date)} เวลา {nextAppt.time} น. ({nextAppt.service} · {nextAppt.vet})
          </span>
        </div>
      )}

      <div className="card-soft mb-4">
        <div className="d-flex flex-wrap align-items-center gap-3 gap-md-4">
          <PetPhoto
            pet={{ name: patient.petName, species: patient.species, photo: pet?.photo }}
            size="lg"
          />

          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h1 className="h2 mb-0">{patient.petName}</h1>
              <span className={`tag ${patient.registered ? 'sky' : ''} m-0`}>
                {patient.registered ? 'ลงทะเบียน' : 'Walk-in'}
              </span>
            </div>

            <div className="text-muted mb-2">
              {sp.emoji} {sp.label}
              {patient.breed ? ` · ${patient.breed}` : ''}
              {pet?.birthDate ? ` · ${ageText(pet.birthDate)}` : ''}
            </div>

            {entry.flags.length > 0 && (
              <div className="d-flex flex-wrap gap-1">
                {entry.flags.map((f) => {
                  const meta = CAUTION_FLAGS[f];
                  if (!meta) return null;
                  return (
                    <span key={f} className={`tag ${meta.tag} m-0`}>
                      <i className={`bi ${meta.icon} me-1`} />
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sky" onClick={() => setApptModalOpen(true)}>
              <i className="bi bi-calendar-plus me-1" />
              สร้างนัดหมาย
            </button>
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

            {patient.registered ? (
              <div className="info-grid">
                <div className="info-item">
                  <div className="k">เพศ</div>
                  <div className="v">{labelOf(SEX_OPTIONS, pet.sex)}</div>
                </div>
                <div className="info-item">
                  <div className="k">วันเกิด</div>
                  <div className="v">{formatDate(pet.birthDate)}</div>
                </div>
                <div className="info-item">
                  <div className="k">อายุ</div>
                  <div className="v">{ageText(pet.birthDate)}</div>
                </div>
                <div className="info-item">
                  <div className="k">น้ำหนักล่าสุด</div>
                  <div className="v">{latestVisitWeight ? `${latestVisitWeight} กก.` : '-'}</div>
                </div>
                <div className="info-item">
                  <div className="k">สี / ลักษณะเด่น</div>
                  <div className="v">{pet.color || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="k">ไมโครชิป</div>
                  <div className="v">{pet.microchip || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="k">การทำหมัน</div>
                  <div className="v">{labelOf(NEUTER_OPTIONS, pet.neutered)}</div>
                </div>
                <div className="info-item">
                  <div className="k">โรคประจำตัว</div>
                  <div className="v">{pet.chronicDiseases || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="k">ยาที่ใช้ประจำ</div>
                  <div className="v">{pet.medications || '-'}</div>
                </div>
                <div className="info-item">
                  <div className="k">อาหารที่กิน</div>
                  <div className="v">{pet.food || '-'}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="alert-soft info mb-3">
                  <i className="bi bi-info-circle" />
                  <span>ยังไม่ได้ลงทะเบียนในระบบ ข้อมูลมาจากนัดหมาย</span>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <div className="k">ชื่อสัตว์</div>
                    <div className="v">{patient.petName}</div>
                  </div>
                  <div className="info-item">
                    <div className="k">ชนิดสัตว์</div>
                    <div className="v">{sp.label}</div>
                  </div>
                  <div className="info-item">
                    <div className="k">มาคลินิกแล้ว</div>
                    <div className="v">{patient.visitCount} ครั้ง</div>
                  </div>
                  <div className="info-item">
                    <div className="k">มาล่าสุด</div>
                    <div className="v">
                      {patient.lastVisit ? formatDate(patient.lastVisit.date) : '-'}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="k">น้ำหนักล่าสุด</div>
                    <div className="v">{latestVisitWeight ? `${latestVisitWeight} กก.` : '-'}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {patient.registered && (
            <div className="card-soft mb-4">
              <div className="section-label">
                <i className="bi bi-journal-medical" />
                ประวัติการรักษา
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
          )}

          <div className="card-soft">
            <div className="section-label">
              <i className="bi bi-clock-history" />
              ประวัติการมาคลินิก ({patient.appointments.length} รายการ)
            </div>

            {patient.appointments.length > 0 ? (
              <div className="timeline">
                {patient.appointments.map((a) => {
                  const st = APPOINTMENT_STATUS[a.status] ?? APPOINTMENT_STATUS.pending;
                  const visit = getVisit(a.id);
                  const showSummaryLink =
                    Boolean(visit) ||
                    a.status === 'checked_in' ||
                    a.status === 'in_treatment' ||
                    a.status === 'completed';

                  return (
                    <div className="tl-item" key={a.id}>
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div className="date">
                          {formatDate(a.date)} · {a.time} น.
                        </div>
                        <span className={`tag ${st.tag} m-0`}>{st.label}</span>
                      </div>
                      <div className="fw-medium mt-1">
                        {a.service} · <span className="text-muted fw-normal">{a.vet}</span>
                      </div>
                      {a.reason && <div className="small text-muted">อาการ: {a.reason}</div>}
                      {visit?.vitals && (visit.vitals.weight || visit.vitals.temp) && (
                        <div className="small text-muted mt-1">
                          สัญญาณชีพ:{' '}
                          {visit.vitals.weight ? `น้ำหนัก ${visit.vitals.weight} กก.` : ''}
                          {visit.vitals.weight && visit.vitals.temp ? ' · ' : ''}
                          {visit.vitals.temp ? `อุณหภูมิ ${visit.vitals.temp} °C` : ''}
                        </div>
                      )}
                      {visit?.medications?.length > 0 && (
                        <div className="small mt-1">
                          ยาที่ได้:{' '}
                          {visit.medications
                            .map((m) => `${m.name || 'ยา'}${m.dose ? ` (${m.dose})` : ''}`)
                            .join(', ')}
                        </div>
                      )}
                      {a.notes && <div className="small mt-1">หมายเหตุ: {a.notes}</div>}
                      {showSummaryLink && (
                        <div className="mt-1">
                          <Link
                            to={`/medical-assistant/medical-support/${a.id}`}
                            className="small text-decoration-none"
                          >
                            ดูสรุป <i className="bi bi-arrow-right-short" />
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
                <div className="v">{patient.owner.name}</div>
              </div>
              <div className="info-item">
                <div className="k">เบอร์โทรศัพท์</div>
                <div className="v">
                  {patient.owner.phone ? (
                    <a href={`tel:${patient.owner.phone}`} className="text-decoration-none">
                      <i className="bi bi-telephone me-1" />
                      {patient.owner.phone}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              {patient.owner.email && (
                <div className="info-item">
                  <div className="k">อีเมล</div>
                  <div className="v">{patient.owner.email}</div>
                </div>
              )}
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
              {CAUTION_FLAG_LIST.map((flag) => {
                const active = entry.flags.includes(flag.value);
                return (
                  <button
                    key={flag.value}
                    type="button"
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
              บันทึกของผู้ช่วยสัตวแพทย์ ({entry.notes.length})
            </div>

            <form onSubmit={handleAddNote} noValidate className="mb-3">
              <div className="mb-2">
                <label className="form-label" htmlFor="ma-note-cat">
                  หมวดหมู่
                </label>
                <select
                  id="ma-note-cat"
                  className="form-select"
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value)}
                >
                  {NOTE_CATEGORIES.map((c) => (
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
                <button type="submit" className="btn btn-sky btn-sm">
                  <i className="bi bi-check2 me-1" />
                  บันทึก
                </button>
              </div>
            </form>

            {entry.notes.length > 0 ? (
              <div className="d-grid gap-2">
                {entry.notes.map((n) => (
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
                          onClick={() => setDeleteTarget(n)}
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
                ยังไม่มีบันทึกของผู้ช่วยสัตวแพทย์
              </div>
            )}
          </div>
        </div>
      </div>

      <AppointmentModal
        open={apptModalOpen}
        initialData={null}
        prefill={{
          petId: patient.registered ? pet.id : null,
          petName: patient.petName,
          species: patient.species,
          ownerName: patient.owner.name,
          ownerPhone: patient.owner.phone,
        }}
        appointments={appointments}
        defaultDate={offsetDateKey(0)}
        onClose={() => setApptModalOpen(false)}
        onSave={handleCreateAppt}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบบันทึก"
        icon="bi-trash3"
        message="ต้องการลบบันทึกนี้ใช่หรือไม่?"
        confirmLabel="ลบบันทึก"
        cancelLabel="ยกเลิก"
        confirmVariant="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteNote}
      />

      {toast}
    </section>
  );
}
