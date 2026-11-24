import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import { PARASITE_TYPES, ageText, formatDate, labelOf, speciesOf } from '../../pet-owner/petUtils.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import MaDataState from '../components/MaDataState.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import { apptVetName } from '../data/clinicMeta.js';
import {
  BCS_SCALE,
  CAUTION_FLAGS,
  CRT_OPTIONS,
  MUCOUS_OPTIONS,
  PAIN_SCALE,
  STAGE_META,
  TRIAGE_LEVELS,
  TRIAGE_LEVEL_LIST,
  getPrepChecklist,
  todayString,
} from '../data/constants.js';
import { maRequest } from '../data/maApi.js';
import { useAppointments } from '../data/useAppointments.js';
import { usePatients } from '../data/usePatients.js';
import {
  isTriaged,
  suggestTriage,
  useVisits,
  vitalFlags,
  vitalRangeFor,
} from '../data/useVisits.js';

const AUTOSAVE_DELAY_MS = 800;

function formatSavedClock(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatWaitSince(appt) {
  const ref = appt.visit?.checkedInAt ?? appt.updatedAt;
  if (!ref || appt.stage === 'completed') return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / 60000));
  if (mins < 1) return 'เพิ่งเช็คอิน';
  if (mins < 60) return `รอแล้ว ${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `รอแล้ว ${hrs} ชม. ${rem} นาที` : `รอแล้ว ${hrs} ชม.`;
}

function createDraft(visit, appt, checklistItems) {
  const checklist = {};
  for (const item of checklistItems) {
    checklist[item] = Boolean(visit?.checklist?.[item]);
  }
  return {
    triage: visit?.triage ?? '',
    vitals: {
      weight: visit?.vitals?.weight ?? '',
      temp: visit?.vitals?.temp ?? '',
      heartRate: visit?.vitals?.heartRate ?? '',
      respRate: visit?.vitals?.respRate ?? '',
      bcs: visit?.vitals?.bcs ?? '',
      pain: visit?.vitals?.pain ?? '',
      mucous: visit?.vitals?.mucous ?? '',
      crt: visit?.vitals?.crt ?? '',
    },
    chiefComplaint: visit?.chiefComplaint || appt.note || '',
    checklist,
  };
}

function VetRecordsSection({ appt, vetRecords, vaccinesGiven, parasitesGiven }) {
  const hasAny =
    vetRecords.length > 0 || vaccinesGiven.length > 0 || parasitesGiven.length > 0;
  const followUps = vetRecords.filter((r) => r.followUp);

  return (
    <div className="card-soft mt-4">
      <div className="section-label">
        <i className="bi bi-journal-medical" />
        บันทึกของสัตวแพทย์ (อ่านอย่างเดียว)
      </div>

      {!hasAny ? (
        <div className="empty-box py-4">
          <i className="bi bi-hourglass-split" />
          <div>รอสัตวแพทย์บันทึกผลการตรวจ</div>
        </div>
      ) : (
        <div className="d-grid gap-3">
          {followUps.map((rec, idx) => (
            <div
              key={rec.id ?? idx}
              className="alert-soft info d-flex flex-wrap justify-content-between align-items-center gap-2 mb-0"
            >
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-calendar-check mt-1" />
                <div>
                  <div className="fw-medium">
                    นัดติดตาม {formatDate(rec.followUp)}
                    {rec.vet ? ` · ${rec.vet}` : ''}
                  </div>
                  <div className="small">แจ้งเจ้าของให้จองนัดติดตามผ่านระบบออนไลน์</div>
                </div>
              </div>
              {appt.ownerPhone && (
                <a href={`tel:${appt.ownerPhone}`} className="btn btn-soft btn-sm ma-no-print">
                  <i className="bi bi-telephone me-1" />
                  โทร {appt.ownerPhone}
                </a>
              )}
            </div>
          ))}

          {vetRecords.length > 0 && (
            <div className="d-grid gap-2">
              <div className="small fw-medium text-muted">ผลการตรวจและการรักษา</div>
              {vetRecords.map((rec, idx) => (
                <div className="record-row mb-0 pb-2" key={rec.id ?? idx}>
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                    <span className="small fw-medium">
                      {rec.vet || 'สัตวแพทย์'}
                      {rec.clinic ? ` · ${rec.clinic}` : ''}
                    </span>
                    <span className="tag sky m-0">สัตวแพทย์</span>
                  </div>
                  <div className="info-grid">
                    <div className="info-item bg-white">
                      <div className="k">อาการ</div>
                      <div className="v">{rec.symptoms || '—'}</div>
                    </div>
                    <div className="info-item bg-white">
                      <div className="k">ผลการวินิจฉัย</div>
                      <div className="v">{rec.diagnosis || '—'}</div>
                    </div>
                    <div className="info-item bg-white" style={{ gridColumn: '1 / -1' }}>
                      <div className="k">การรักษา / ยา</div>
                      <div className="v" style={{ whiteSpace: 'pre-line' }}>
                        {rec.treatment || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {vaccinesGiven.length > 0 && (
            <div className="d-grid gap-2">
              <div className="small fw-medium text-muted">วัคซีนที่ฉีดวันนี้</div>
              {vaccinesGiven.map((v, idx) => (
                <div className="record-row mb-0 pb-2" key={v.id ?? idx}>
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                    <span className="fw-medium">{v.name}</span>
                    <span className="tag sky m-0">สัตวแพทย์</span>
                  </div>
                  <div className="info-grid">
                    <div className="info-item bg-white">
                      <div className="k">ผู้ให้วัคซีน</div>
                      <div className="v">{v.vet || '—'}</div>
                    </div>
                    <div className="info-item bg-white">
                      <div className="k">Lot / หมายเหตุ</div>
                      <div className="v">{v.lot || '—'}</div>
                    </div>
                    <div className="info-item bg-white">
                      <div className="k">นัดครั้งถัดไป</div>
                      <div className="v">{v.nextDate ? formatDate(v.nextDate) : '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {parasitesGiven.length > 0 && (
            <div className="d-grid gap-2">
              <div className="small fw-medium text-muted">การป้องกันปรสิตวันนี้</div>
              {parasitesGiven.map((p, idx) => (
                <div className="record-row mb-0 pb-2" key={p.id ?? idx}>
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                    <span className="fw-medium">{labelOf(PARASITE_TYPES, p.type)}</span>
                    <span className="tag sky m-0">สัตวแพทย์</span>
                  </div>
                  <div className="info-grid">
                    <div className="info-item bg-white">
                      <div className="k">ผลิตภัณฑ์ / ยา</div>
                      <div className="v">{p.product || '—'}</div>
                    </div>
                    <div className="info-item bg-white">
                      <div className="k">ผู้ดำเนินการ</div>
                      <div className="v">{p.vet || '—'}</div>
                    </div>
                    <div className="info-item bg-white">
                      <div className="k">ครั้งถัดไป</div>
                      <div className="v">{p.nextDate ? formatDate(p.nextDate) : '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SupportCaseInner({ caseData, patient, meta, startTreatment, saveVisit, onAfterSave }) {
  const { show, toast } = useToast();
  const appt = caseData;
  const existingVisit = appt.visit ?? null;
  const vetRecords = appt.vetRecords ?? [];
  const vaccinesGiven = appt.vaccinesGiven ?? [];
  const parasitesGiven = appt.parasitesGiven ?? [];

  const isToday = appt.date === todayString();
  const isCheckedIn = Boolean(existingVisit?.checkedInAt);
  const readOnly = appt.stage === 'completed' || !isToday || !isCheckedIn;

  const checklistItems = useMemo(() => getPrepChecklist(appt.service), [appt.service]);
  const vitalLimits = meta?.VITAL_LIMITS ?? {};

  const [step, setStep] = useState(() => {
    if (readOnly || appt.stage === 'in_treatment') return 'summary';
    if (isTriaged(existingVisit)) return 'prep';
    return 'triage';
  });

  const [draft, setDraft] = useState(() => createDraft(existingVisit, appt, checklistItems));
  const [saveState, setSaveState] = useState(() =>
    existingVisit?.updatedAt ? 'saved' : 'idle',
  );
  const [saveError, setSaveError] = useState('');
  const [lastSavedIso, setLastSavedIso] = useState(() => existingVisit?.updatedAt ?? '');

  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const debounceRef = useRef(null);
  const latestDraftRef = useRef(draft);
  const dirtyRef = useRef(false);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const ranges = vitalRangeFor(appt.petSpecies);
  const vFlags = useMemo(
    () => vitalFlags(appt.petSpecies, draft.vitals),
    [appt.petSpecies, draft.vitals],
  );
  const flagByKey = useMemo(() => {
    const map = {};
    for (const f of vFlags) map[f.key] = f;
    return map;
  }, [vFlags]);

  const recommendedTriage = useMemo(
    () => suggestTriage(appt.petSpecies, draft.vitals),
    [appt.petSpecies, draft.vitals],
  );

  const triagedDone = isTriaged(draft);
  const checkedCount = checklistItems.filter((item) => draft.checklist[item]).length;
  const prepDone =
    (checkedCount === checklistItems.length && checklistItems.length > 0) ||
    appt.stage === 'in_treatment' ||
    appt.stage === 'completed';

  const persistNow = useCallback(
    async (targetDraft = latestDraftRef.current, showToastOnSuccess = false) => {
      if (readOnly) return null;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setSaveState('saving');
      setSaveError('');
      try {
        const saved = await saveVisit(appt.id, targetDraft);
        dirtyRef.current = false;
        setSaveState('saved');
        if (saved?.updatedAt) setLastSavedIso(saved.updatedAt);
        if (onAfterSave) onAfterSave(saved);
        if (showToastOnSuccess) show('บันทึกข้อมูลคัดกรองแล้ว');
        return saved;
      } catch (err) {
        setSaveState('error');
        setSaveError(err?.message || 'ไม่สามารถบันทึกข้อมูลได้');
        return null;
      }
    },
    [readOnly, saveVisit, appt.id, onAfterSave, show],
  );

  const scheduleAutosave = useCallback(
    (nextDraft) => {
      if (readOnly) return;
      latestDraftRef.current = nextDraft;
      dirtyRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveState('saving');
      setSaveError('');
      debounceRef.current = setTimeout(() => {
        persistNow(latestDraftRef.current, false);
      }, AUTOSAVE_DELAY_MS);
    },
    [readOnly, persistNow],
  );

  function updateVital(key, value) {
    const next = {
      ...draft,
      vitals: { ...draft.vitals, [key]: value },
    };
    setDraft(next);
    scheduleAutosave(next);
  }

  function updateComplaint(value) {
    const next = { ...draft, chiefComplaint: value };
    setDraft(next);
    scheduleAutosave(next);
  }

  function selectTriage(value) {
    if (readOnly) return;
    const next = { ...draft, triage: value };
    setDraft(next);
    persistNow(next, false);
  }

  function toggleChecklist(item) {
    if (readOnly) return;
    const next = {
      ...draft,
      checklist: { ...draft.checklist, [item]: !draft.checklist[item] },
    };
    setDraft(next);
    scheduleAutosave(next);
  }

  async function doSendToVet() {
    setSending(true);
    setSendError('');
    try {
      if (dirtyRef.current || debounceRef.current) {
        const saved = await persistNow(latestDraftRef.current, false);
        if (!saved) {
          setSendError('ไม่สามารถบันทึกข้อมูลคัดกรองก่อนส่งเข้าห้องตรวจได้');
          return;
        }
      }
      const updated = await startTreatment(appt.id);
      setSendConfirmOpen(false);
      setStep('summary');
      if (onAfterSave && updated?.visit) onAfterSave(updated.visit);
      show(`ส่งน้อง ${appt.petName} เข้าห้องตรวจแล้ว`);
    } catch (err) {
      setSendError(err?.message || 'ไม่สามารถส่งเข้าห้องตรวจได้');
    } finally {
      setSending(false);
    }
  }

  async function handleRequestSendToVet() {
    if (!triagedDone || appt.stage !== 'checked_in' || readOnly || sending) return;
    if (checkedCount < checklistItems.length) {
      setSendError('');
      setSendConfirmOpen(true);
    } else {
      await doSendToVet();
    }
  }

  const sp = speciesOf(appt.petSpecies);
  const st = STAGE_META[appt.stage] ?? STAGE_META.checked_in;
  const patientFlags = patient?.flags ?? [];
  const allergies = appt.pet?.allergies || patient?.allergies || '';
  const chronicDiseases = appt.pet?.chronicDiseases || patient?.chronicDiseases || '';
  const medications = appt.pet?.medications || patient?.medications || '';
  const prevWeight = appt.pet?.weight || patient?.weight || '';

  const weightVal = Number(draft.vitals.weight);
  const prevWeightNum = prevWeight ? Number(prevWeight) : NaN;
  const weightDelta =
    draft.vitals.weight && !Number.isNaN(weightVal) && !Number.isNaN(prevWeightNum)
      ? Math.round((weightVal - prevWeightNum) * 10) / 10
      : null;

  const displayWeight = draft.vitals.weight || prevWeight;
  const waitText = formatWaitSince(appt);
  const savedClock = formatSavedClock(lastSavedIso);

  const stepTabs = [
    { id: 'triage', label: '1. คัดกรองและสัญญาณชีพ', done: triagedDone },
    { id: 'prep', label: '2. เตรียมความพร้อม', done: prepDone },
    { id: 'summary', label: '3. สรุปและส่งต่อหมอ', done: appt.stage === 'completed' },
  ];

  const readOnlyReason =
    appt.stage === 'completed'
      ? 'เคสนี้สัตวแพทย์ปิดการรักษาแล้ว แสดงในโหมดอ่านอย่างเดียว'
      : !isToday
        ? `นัดหมายนี้เป็นของวันที่ ${formatDate(appt.date)} (ไม่ใช่วันนี้) แสดงในโหมดอ่านอย่างเดียว`
        : !isCheckedIn
          ? 'สัตว์เลี้ยงยังไม่ได้เช็คอิน แสดงในโหมดอ่านอย่างเดียว'
          : '';

  return (
    <section>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 ma-no-print">
        <Link to="/medical-assistant/medical-support" className="small text-decoration-none">
          <i className="bi bi-arrow-left me-1" />
          กลับไปหน้าคิวสนับสนุนการรักษา
        </Link>

        {!readOnly && (
          <div className="d-flex align-items-center gap-2 small">
            {saveState === 'saving' && (
              <span className="text-muted">
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                กำลังบันทึก…
              </span>
            )}
            {saveState === 'saved' && savedClock && (
              <span className="text-muted">
                <i className="bi bi-cloud-check me-1 text-sky" />
                บันทึกแล้ว {savedClock}
              </span>
            )}
            {saveState === 'error' && (
              <span className="text-danger d-inline-flex align-items-center gap-2">
                <span>
                  <i className="bi bi-exclamation-circle me-1" />
                  บันทึกไม่สำเร็จ{saveError ? `: ${saveError}` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-soft btn-sm py-0 px-2"
                  onClick={() => persistNow(latestDraftRef.current, true)}
                >
                  ลองบันทึกใหม่
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {readOnly && (
        <div className="alert-soft info mb-3 ma-no-print">
          <i className="bi bi-lock" />
          <span>{readOnlyReason}</span>
        </div>
      )}

      {appt.stage === 'in_treatment' && isToday && (
        <div className="alert-soft warn mb-3 ma-no-print">
          <i className="bi bi-heart-pulse" />
          <span>สัตว์เลี้ยงอยู่ในห้องตรวจ — รอหมอปิดเคส</span>
        </div>
      )}

      {(patientFlags.length > 0 || allergies || chronicDiseases || medications) && (
        <div className="alert-soft danger mb-3">
          <i className="bi bi-exclamation-triangle-fill" />
          <div className="d-grid gap-1">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <strong>ข้อมูลสำคัญทางการแพทย์และข้อควรระวัง:</strong>
              {patientFlags.map((f) => (
                <span key={f} className={`tag ${CAUTION_FLAGS[f]?.tag ?? 'danger'} m-0`}>
                  {CAUTION_FLAGS[f]?.label ?? f}
                </span>
              ))}
            </div>
            <div className="small d-flex flex-wrap gap-3">
              {allergies && (
                <span>
                  <strong>แพ้ยา / อาหาร:</strong> {allergies}
                </span>
              )}
              {chronicDiseases && (
                <span>
                  <strong>โรคประจำตัว:</strong> {chronicDiseases}
                </span>
              )}
              {medications && (
                <span>
                  <strong>ยาที่ใช้อยู่:</strong> {medications}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {vFlags.length > 0 && (
        <div className="alert-soft warn mb-3">
          <i className="bi bi-heart-pulse" />
          <span>
            <strong>ค่าสัญญาณชีพอยู่นอกเกณฑ์อ้างอิง ({sp.label}):</strong>{' '}
            {vFlags
              .map(
                (vf) =>
                  `${vf.label} ${vf.value} ${vf.unit} (${vf.level === 'high' ? 'สูงกว่า' : 'ต่ำกว่า'}ช่วงปกติ ${vf.range})`,
              )
              .join(' · ')}
          </span>
        </div>
      )}

      <div className="card-soft mb-4 ma-no-print">
        <div className="d-flex flex-wrap align-items-center gap-3 gap-md-4">
          <PetPhoto pet={{ name: appt.petName, species: appt.petSpecies }} size="lg" />
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h1 className="h2 mb-0">
                <PatientNameLink
                  petId={appt.petId}
                  petName={appt.petName}
                  petSpecies={appt.petSpecies}
                  flags={patientFlags}
                  allergies={allergies}
                  showEmoji={false}
                />
              </h1>
              <span className={`tag ${st.tag} m-0`}>{st.label}</span>
              {appt.stage === 'in_treatment' && (
                <span className="tag warn m-0">รอหมอปิดเคส</span>
              )}
              {draft.triage && TRIAGE_LEVELS[draft.triage] ? (
                <span className={`tag ${TRIAGE_LEVELS[draft.triage].tag} m-0`}>
                  เร่งด่วน: {TRIAGE_LEVELS[draft.triage].label}
                </span>
              ) : (
                <span className="tag warn m-0">ยังไม่คัดกรอง</span>
              )}
              {waitText && <span className="tag sky m-0">{waitText}</span>}
            </div>

            <div className="text-muted mb-2">
              {sp.emoji} {sp.label}
              {(appt.pet?.breed ?? patient?.breed) ? ` · ${appt.pet?.breed ?? patient.breed}` : ''}
              {(appt.pet?.birthDate ?? patient?.birthDate)
                ? ` · ${ageText(appt.pet?.birthDate ?? patient.birthDate)}`
                : ''}
              {displayWeight ? ` · น้ำหนัก ${displayWeight} กก.` : ''}
            </div>

            <div className="small">
              <i className="bi bi-person me-1 text-sky" />
              {appt.ownerName || '—'} ·{' '}
              {appt.ownerPhone ? (
                <a href={`tel:${appt.ownerPhone}`} className="text-decoration-none">
                  {appt.ownerPhone}
                </a>
              ) : (
                '—'
              )}
              {' · '}
              <i className="bi bi-clipboard2-pulse me-1 text-sky" />
              <strong>{appt.serviceLabel || appt.service}</strong> ·{' '}
              {apptVetName(appt) || 'ยังไม่ระบุหมอ'}
            </div>
          </div>
        </div>
      </div>

      <div className="pill-tabs ma-status-tabs mb-4 ma-no-print" role="tablist" aria-label="ขั้นตอนการดูแลสัตว์เลี้ยง">
        {stepTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={step === t.id}
            className={step === t.id ? 'active' : ''}
            onClick={() => setStep(t.id)}
          >
            {t.done && <i className="bi bi-check-circle-fill ma-step-done" />}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {step === 'triage' && (
        <div className="card-soft">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div className="section-label mb-0">
              <i className="bi bi-thermometer-half" />
              คัดกรองและวัดสัญญาณชีพ
            </div>
            <div className="small text-muted">
              ค่าอ้างอิงเพื่อการแจ้งเตือนเบื้องต้น ให้สัตวแพทย์ตรวจสอบ
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12">
              <label className="form-label" htmlFor="sc-complaint">
                อาการสำคัญ (Chief Complaint)
              </label>
              <textarea
                id="sc-complaint"
                rows={2}
                maxLength={1000}
                className="form-control"
                disabled={readOnly}
                placeholder="อาการที่เจ้าของแจ้งหรืออาการที่สังเกตพบแรกรับ"
                value={draft.chiefComplaint}
                onChange={(e) => updateComplaint(e.target.value)}
                onBlur={() => dirtyRef.current && persistNow(latestDraftRef.current, false)}
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="sc-weight">
                น้ำหนัก (กก.)
              </label>
              <input
                id="sc-weight"
                type="number"
                step="0.1"
                min={vitalLimits.weight?.min ?? 0}
                max={vitalLimits.weight?.max ?? 150}
                className="form-control"
                disabled={readOnly}
                placeholder="เช่น 8.5"
                value={draft.vitals.weight}
                onChange={(e) => updateVital('weight', e.target.value)}
                onBlur={() => dirtyRef.current && persistNow(latestDraftRef.current, false)}
              />
              {weightDelta !== null && (
                <div className="ma-vital-hint">
                  {weightDelta > 0
                    ? `+${weightDelta} กก. จากข้อมูลสัตว์ (${prevWeight} กก.)`
                    : weightDelta < 0
                      ? `${weightDelta} กก. จากข้อมูลสัตว์ (${prevWeight} กก.)`
                      : `เท่าเดิมกับข้อมูลสัตว์ (${prevWeight} กก.)`}
                </div>
              )}
              {weightDelta === null && prevWeight && (
                <div className="ma-vital-hint">น้ำหนักเดิม: {prevWeight} กก.</div>
              )}
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="sc-temp">
                อุณหภูมิ ({ranges.temp.unit})
              </label>
              <input
                id="sc-temp"
                type="number"
                step="0.1"
                min={vitalLimits.temp?.min ?? 30}
                max={vitalLimits.temp?.max ?? 45}
                className={`form-control${flagByKey.temp ? ' is-invalid' : ''}`}
                disabled={readOnly}
                placeholder={`${ranges.temp.min}–${ranges.temp.max}`}
                value={draft.vitals.temp}
                onChange={(e) => updateVital('temp', e.target.value)}
                onBlur={() => dirtyRef.current && persistNow(latestDraftRef.current, false)}
              />
              {flagByKey.temp ? (
                <div className="invalid-feedback">
                  {flagByKey.temp.level === 'high' ? 'สูงกว่าปกติ' : 'ต่ำกว่าปกติ'} (ช่วง {ranges.temp.min}–{ranges.temp.max})
                </div>
              ) : (
                <div className="ma-vital-hint">
                  ปกติ {ranges.temp.min}–{ranges.temp.max} {ranges.temp.unit}
                </div>
              )}
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="sc-hr">
                ชีพจร ({ranges.heartRate.unit})
              </label>
              <input
                id="sc-hr"
                type="number"
                min={vitalLimits.heartRate?.min ?? 20}
                max={vitalLimits.heartRate?.max ?? 400}
                className={`form-control${flagByKey.heartRate ? ' is-invalid' : ''}`}
                disabled={readOnly}
                placeholder={`${ranges.heartRate.min}–${ranges.heartRate.max}`}
                value={draft.vitals.heartRate}
                onChange={(e) => updateVital('heartRate', e.target.value)}
                onBlur={() => dirtyRef.current && persistNow(latestDraftRef.current, false)}
              />
              {flagByKey.heartRate ? (
                <div className="invalid-feedback">
                  {flagByKey.heartRate.level === 'high' ? 'สูงกว่าปกติ' : 'ต่ำกว่าปกติ'} (ช่วง {ranges.heartRate.min}–{ranges.heartRate.max})
                </div>
              ) : (
                <div className="ma-vital-hint">
                  ปกติ {ranges.heartRate.min}–{ranges.heartRate.max}
                </div>
              )}
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="sc-rr">
                อัตราหายใจ ({ranges.respRate.unit})
              </label>
              <input
                id="sc-rr"
                type="number"
                min={vitalLimits.respRate?.min ?? 5}
                max={vitalLimits.respRate?.max ?? 150}
                className={`form-control${flagByKey.respRate ? ' is-invalid' : ''}`}
                disabled={readOnly}
                placeholder={`${ranges.respRate.min}–${ranges.respRate.max}`}
                value={draft.vitals.respRate}
                onChange={(e) => updateVital('respRate', e.target.value)}
                onBlur={() => dirtyRef.current && persistNow(latestDraftRef.current, false)}
              />
              {flagByKey.respRate ? (
                <div className="invalid-feedback">
                  {flagByKey.respRate.level === 'high' ? 'สูงกว่าปกติ' : 'ต่ำกว่าปกติ'} (ช่วง {ranges.respRate.min}–{ranges.respRate.max})
                </div>
              ) : (
                <div className="ma-vital-hint">
                  ปกติ {ranges.respRate.min}–{ranges.respRate.max}
                </div>
              )}
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label" htmlFor="sc-bcs">
                คะแนนรูปร่าง (BCS)
              </label>
              <select
                id="sc-bcs"
                className="form-select"
                disabled={readOnly}
                value={draft.vitals.bcs}
                onChange={(e) => updateVital('bcs', e.target.value)}
              >
                <option value="">-- เลือก 1–9 --</option>
                {BCS_SCALE.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <label className="form-label" htmlFor="sc-pain">
                ระดับความเจ็บปวด (Pain)
              </label>
              <select
                id="sc-pain"
                className="form-select"
                disabled={readOnly}
                value={draft.vitals.pain}
                onChange={(e) => updateVital('pain', e.target.value)}
              >
                <option value="">-- เลือก 0–4 --</option>
                {PAIN_SCALE.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="sc-mucous">
                สีเยื่อเมือก
              </label>
              <select
                id="sc-mucous"
                className="form-select"
                disabled={readOnly}
                value={draft.vitals.mucous}
                onChange={(e) => updateVital('mucous', e.target.value)}
              >
                <option value="">-- เลือก --</option>
                {MUCOUS_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="sc-crt">
                CRT
              </label>
              <select
                id="sc-crt"
                className="form-select"
                disabled={readOnly}
                value={draft.vitals.crt}
                onChange={(e) => updateVital('crt', e.target.value)}
              >
                <option value="">-- เลือก --</option>
                {CRT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <div className="form-label d-flex flex-wrap align-items-center gap-2">
                <span>ระดับความเร่งด่วน (Triage)</span>
                <span className={`tag ${TRIAGE_LEVELS[recommendedTriage].tag} m-0`}>
                  ระบบแนะนำ: {TRIAGE_LEVELS[recommendedTriage].label}
                </span>
                {!readOnly && draft.triage !== recommendedTriage && (
                  <button
                    type="button"
                    className="btn btn-soft btn-sm py-0 px-2"
                    onClick={() => selectTriage(recommendedTriage)}
                  >
                    ใช้ค่าแนะนำ ({TRIAGE_LEVELS[recommendedTriage].label})
                  </button>
                )}
              </div>
              <div className="d-flex flex-wrap gap-2">
                {TRIAGE_LEVEL_LIST.map((lvl) => {
                  const selected = draft.triage === lvl.value;
                  return (
                    <button
                      key={lvl.value}
                      type="button"
                      disabled={readOnly}
                      className={
                        selected
                          ? `tag ${lvl.tag} ma-flag-toggle`
                          : 'btn btn-soft btn-sm ma-flag-toggle'
                      }
                      onClick={() => selectTriage(lvl.value)}
                    >
                      {selected && <i className="bi bi-check2" />}
                      {lvl.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {!readOnly && (
            <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-soft"
                disabled={saveState === 'saving'}
                onClick={() => persistNow(latestDraftRef.current, true)}
              >
                <i className="bi bi-save me-1" />
                บันทึก
              </button>
              <button
                type="button"
                className="btn btn-sky"
                onClick={async () => {
                  if (dirtyRef.current || debounceRef.current) {
                    await persistNow(latestDraftRef.current, false);
                  }
                  setStep('prep');
                }}
              >
                ถัดไป: เตรียมความพร้อม
                <i className="bi bi-arrow-right ms-1" />
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'prep' && (
        <div className="card-soft">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div className="section-label mb-0">
              <i className="bi bi-list-check" />
              เตรียมความพร้อม ({appt.serviceLabel || appt.service})
            </div>
            <span className="tag sky m-0">
              {checkedCount}/{checklistItems.length} รายการ
            </span>
          </div>

          {!triagedDone && !readOnly && (
            <div className="alert-soft warn mb-3">
              <i className="bi bi-info-circle" />
              <span>กรุณาบันทึกข้อมูลคัดกรองเบื้องต้นในขั้นที่ 1 ก่อนส่งเข้าห้องตรวจ</span>
            </div>
          )}

          <div className="d-grid gap-2 mb-4">
            {checklistItems.map((item) => {
              const checked = Boolean(draft.checklist[item]);
              return (
                <label
                  key={item}
                  className={`ma-reason-option${checked ? ' selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    disabled={readOnly}
                    checked={checked}
                    onChange={() => toggleChecklist(item)}
                  />
                  <span>{item}</span>
                </label>
              );
            })}
          </div>

          {!readOnly && (
            <div className="d-flex flex-wrap justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-soft"
                disabled={saveState === 'saving'}
                onClick={() => persistNow(latestDraftRef.current, true)}
              >
                <i className="bi bi-save me-1" />
                บันทึก
              </button>
              <button
                type="button"
                className="btn btn-sky"
                onClick={async () => {
                  if (dirtyRef.current || debounceRef.current) {
                    await persistNow(latestDraftRef.current, false);
                  }
                  setStep('summary');
                }}
              >
                ถัดไป: สรุปและส่งต่อหมอ
                <i className="bi bi-arrow-right ms-1" />
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'summary' && (
        <div className="card-soft ma-print-summary">
          <div className="ma-print-only mb-3 pb-2" style={{ borderBottom: '1.5px solid var(--baby)' }}>
            <div className="mitr fs-4">ใบสรุปการคัดกรองเบื้องต้น · PetCare Clinic</div>
            <div className="small text-muted">
              วันที่ {formatDate(appt.date)} · เวลา {appt.time} น. · สัตวแพทย์{' '}
              {apptVetName(appt) || 'ยังไม่ระบุ'}
            </div>
          </div>

          <div className="section-label">
            <i className="bi bi-file-earmark-medical" />
            สรุปข้อมูลคัดกรองและสัญญาณชีพ
          </div>

          <div className="info-grid mb-3">
            <div className="info-item">
              <div className="k">สัตว์เลี้ยง</div>
              <div className="v">
                {sp.emoji} {appt.petName} ({sp.label})
              </div>
            </div>
            <div className="info-item">
              <div className="k">เจ้าของ</div>
              <div className="v">
                {appt.ownerName || '—'} · {appt.ownerPhone || '—'}
              </div>
            </div>
            <div className="info-item">
              <div className="k">บริการ / สัตวแพทย์</div>
              <div className="v">
                {appt.serviceLabel || appt.service} · {apptVetName(appt) || 'ยังไม่ระบุ'}
              </div>
            </div>
            <div className="info-item">
              <div className="k">น้ำหนัก / อุณหภูมิ</div>
              <div className="v">
                {draft.vitals.weight ? `${draft.vitals.weight} กก.` : '-'} /{' '}
                {draft.vitals.temp ? `${draft.vitals.temp} °C` : '-'}
              </div>
            </div>
            <div className="info-item">
              <div className="k">ชีพจร / หายใจ</div>
              <div className="v">
                {draft.vitals.heartRate ? `${draft.vitals.heartRate} ครั้ง/นาที` : '-'} /{' '}
                {draft.vitals.respRate ? `${draft.vitals.respRate} ครั้ง/นาที` : '-'}
              </div>
            </div>
            <div className="info-item">
              <div className="k">BCS / Pain / เยื่อเมือก / CRT</div>
              <div className="v">
                {draft.vitals.bcs ? `${draft.vitals.bcs}/9` : '-'} ·{' '}
                {draft.vitals.pain !== '' ? `Pain ${draft.vitals.pain}/4` : '-'} ·{' '}
                {draft.vitals.mucous || '-'} · {draft.vitals.crt || '-'}
              </div>
            </div>
          </div>

          <div className="info-grid mb-3">
            <div className="info-item">
              <div className="k">ความเร่งด่วน (Triage)</div>
              <div className="v">
                {draft.triage && TRIAGE_LEVELS[draft.triage]
                  ? TRIAGE_LEVELS[draft.triage].label
                  : 'ยังไม่คัดกรอง'}
              </div>
            </div>
            <div className="info-item">
              <div className="k">การเตรียมความพร้อม</div>
              <div className="v">
                {checkedCount}/{checklistItems.length} รายการ
              </div>
            </div>
            <div className="info-item" style={{ gridColumn: '1 / -1' }}>
              <div className="k">อาการสำคัญ</div>
              <div className="v">{draft.chiefComplaint || '-'}</div>
            </div>
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 ma-no-print">
            <div>
              {appt.stage === 'in_treatment' && (
                <span className="tag warn m-0">รอหมอปิดเคส</span>
              )}
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-soft" onClick={() => window.print()}>
                <i className="bi bi-printer me-1" />
                พิมพ์ใบสรุป
              </button>
              {appt.stage === 'checked_in' && !readOnly && (
                <button
                  type="button"
                  className="btn btn-sky"
                  disabled={!triagedDone || sending}
                  title={!triagedDone ? 'กรุณาคัดกรองก่อนส่งเข้าห้องตรวจ' : undefined}
                  onClick={handleRequestSendToVet}
                >
                  {sending && (
                    <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                  )}
                  <i className="bi bi-box-arrow-in-right me-1" />
                  ส่งเข้าห้องตรวจ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <VetRecordsSection
        appt={appt}
        vetRecords={vetRecords}
        vaccinesGiven={vaccinesGiven}
        parasitesGiven={parasitesGiven}
      />

      <ConfirmModal
        open={sendConfirmOpen}
        title="ส่งสัตว์เลี้ยงเข้าห้องตรวจ"
        icon="bi-exclamation-triangle"
        message={`ทำรายการเตรียมความพร้อมแล้ว ${checkedCount}/${checklistItems.length} รายการ ต้องการส่งน้องเข้าห้องตรวจเลยหรือไม่?`}
        confirmLabel="ส่งเข้าห้องตรวจ"
        cancelLabel="กลับไปเช็คต่อ"
        confirmVariant="sky"
        submitting={sending}
        error={sendError}
        onClose={() => !sending && setSendConfirmOpen(false)}
        onConfirm={doSendToVet}
      />

      {toast}
    </section>
  );
}

/**
 * Support Case — Role: Medical Assistant
 * Owner: เอิร์ท
 */
export default function SupportCasePage() {
  const { appointmentId } = useParams();
  const { meta, lastLoadedAt, startTreatment } = useAppointments();
  const { patients } = usePatients();
  const { saveVisit } = useVisits();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCase = useCallback(
    async ({ silent = false } = {}) => {
      if (!appointmentId) {
        setCaseData(null);
        setLoading(false);
        setError('ไม่พบรหัสนัดหมาย');
        return;
      }
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const data = await maRequest(`/appointments/${encodeURIComponent(appointmentId)}`);
        setCaseData(data);
        setError('');
      } catch (err) {
        if (!silent) {
          setError(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [appointmentId],
  );

  useEffect(() => {
    loadCase({ silent: false });
  }, [loadCase]);

  useEffect(() => {
    if (lastLoadedAt) {
      loadCase({ silent: true });
    }
  }, [lastLoadedAt, loadCase]);

  const handleAfterSave = useCallback((savedVisit) => {
    if (!savedVisit) return;
    setCaseData((prev) =>
      prev
        ? {
            ...prev,
            visit: savedVisit,
            vetId: savedVisit.vetId ?? prev.vetId,
            vetName: savedVisit.vetName ?? prev.vetName,
          }
        : prev,
    );
  }, []);

  const handleStartTreatment = useCallback(
    async (id) => {
      const updated = await startTreatment(id);
      setCaseData((prev) => (prev ? { ...prev, ...updated } : updated));
      return updated;
    },
    [startTreatment],
  );

  if (loading || error || !caseData) {
    return (
      <section>
        <div className="mb-3">
          <Link to="/medical-assistant/medical-support" className="small text-decoration-none">
            <i className="bi bi-arrow-left me-1" />
            กลับไปหน้าคิวสนับสนุนการรักษา
          </Link>
        </div>

        <MaDataState
          loading={loading}
          error={error}
          hasData={Boolean(caseData)}
          onRetry={() => loadCase({ silent: false })}
        />

        {!loading && !error && !caseData && (
          <div className="card-soft empty-box">
            <i className="bi bi-calendar-x" />
            <div>ไม่พบเคสที่ต้องการ</div>
            <div className="mt-3">
              <Link to="/medical-assistant/medical-support" className="btn btn-sky">
                กลับไปหน้าสนับสนุนการรักษา
              </Link>
            </div>
          </div>
        )}
      </section>
    );
  }

  const patient = patients.find((p) => p.id === caseData.petId) ?? null;

  return (
    <SupportCaseInner
      key={caseData.id}
      caseData={caseData}
      patient={patient}
      meta={meta}
      startTreatment={handleStartTreatment}
      saveVisit={saveVisit}
      onAfterSave={handleAfterSave}
    />
  );
}
