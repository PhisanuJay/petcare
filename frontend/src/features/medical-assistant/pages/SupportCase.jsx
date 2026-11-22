import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PetPhoto from '../../pet-owner/components/PetPhoto.jsx';
import { ageText, formatDate, speciesOf } from '../../pet-owner/petUtils.js';
import { newId } from '../../../shared/utils/storage.js';
import { useToast } from '../../../shared/components/Toast.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import PatientNameLink from '../components/PatientNameLink.jsx';
import {
  APPOINTMENT_STATUS,
  BCS_SCALE,
  CAUTION_FLAGS,
  CRT_OPTIONS,
  FINAL_STATUSES,
  MED_ROUTES,
  MUCOUS_OPTIONS,
  OWNER_INSTRUCTION_TEMPLATES,
  PAIN_SCALE,
  SERVICE_TYPES,
  TRIAGE_LEVELS,
  TRIAGE_LEVEL_LIST,
  VETS,
  getPrepChecklist,
  offsetDateKey,
} from '../data/constants.js';
import { findConflict, suggestSlots } from '../data/schedule.js';
import { useAppointments } from '../data/useAppointments.js';
import { usePatients } from '../data/usePatients.js';
import {
  isTriaged,
  suggestTriage,
  useVisits,
  vitalFlags,
  vitalRangeFor,
} from '../data/useVisits.js';

function formatSavedTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
}

function formatWaitSince(appt) {
  const ref = appt.checkedInAt ?? appt.updatedAt;
  if (!ref || appt.status === 'completed') return '';
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
    chiefComplaint: visit?.chiefComplaint ?? appt.reason ?? '',
    checklist,
    vetOrders: visit?.vetOrders ?? '',
    medications: visit?.medications ?? [],
    ownerInstructions: visit?.ownerInstructions ?? '',
  };
}

function SupportCaseInner({ appt, patient, existingVisit, previousWeight }) {
  const { appointments, setStatus, addAppointment } = useAppointments();
  const { saveVisit } = useVisits();
  const { show, toast } = useToast();
  const navigate = useNavigate();

  const readOnly = appt.status === 'completed';
  const checklistItems = useMemo(() => getPrepChecklist(appt.service), [appt.service]);

  const [step, setStep] = useState(() => {
    if (readOnly) return 'summary';
    if (appt.status === 'in_treatment') return 'treatment';
    if (isTriaged(existingVisit)) return 'prep';
    return 'triage';
  });

  const [draft, setDraft] = useState(() => createDraft(existingVisit, appt, checklistItems));
  const [triageLocked, setTriageLocked] = useState(() => Boolean(existingVisit?.triage));
  const [lastSavedIso, setLastSavedIso] = useState(() => existingVisit?.updatedAt ?? '');
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);

  const [followUp, setFollowUp] = useState(() => ({
    enabled: Boolean(existingVisit?.followUp),
    date: existingVisit?.followUp?.date ?? offsetDateKey(7),
    time: existingVisit?.followUp?.time ?? '10:00',
    service: existingVisit?.followUp?.service ?? 'ติดตามอาการ',
    vet: existingVisit?.followUp?.vet ?? appt.vet ?? VETS[0]?.name ?? '',
  }));

  const ranges = vitalRangeFor(appt.species);
  const vFlags = useMemo(() => vitalFlags(appt.species, draft.vitals), [appt.species, draft.vitals]);
  const flagByKey = useMemo(() => {
    const map = {};
    for (const f of vFlags) map[f.key] = f;
    return map;
  }, [vFlags]);

  const recommendedTriage = useMemo(
    () => suggestTriage(appt.species, draft.vitals),
    [appt.species, draft.vitals],
  );

  const effectiveTriage = draft.triage || recommendedTriage;
  const triagedDone = isTriaged(draft);
  const checkedCount = checklistItems.filter((item) => draft.checklist[item]).length;
  const prepDone =
    (checkedCount === checklistItems.length && checklistItems.length > 0) ||
    appt.status === 'in_treatment' ||
    appt.status === 'completed';
  const treatmentDone = Boolean(
    draft.vetOrders.trim() || draft.medications.length > 0 || draft.ownerInstructions.trim(),
  );

  const followUpConflict = useMemo(() => {
    if (!followUp.enabled) return null;
    return findConflict(appointments, {
      vet: followUp.vet,
      date: followUp.date,
      time: followUp.time,
      durationMin: 30,
    });
  }, [followUp, appointments]);

  const followUpSlots = useMemo(() => {
    if (!followUp.enabled) return [];
    return suggestSlots(
      appointments,
      { vet: followUp.vet, date: followUp.date, durationMin: 30 },
      6,
    );
  }, [followUp.enabled, followUp.vet, followUp.date, appointments]);

  function persist(nextDraft = draft, showToast = false) {
    if (readOnly) return null;
    const saved = saveVisit(appt.id, {
      patientId: patient?.patientId ?? null,
      ...nextDraft,
      triage:
        nextDraft.triage ||
        (isTriaged(nextDraft) ? suggestTriage(appt.species, nextDraft.vitals) : ''),
      startedAt: existingVisit?.startedAt ?? appt.treatmentStartedAt ?? null,
    });
    if (saved) {
      setLastSavedIso(saved.updatedAt);
      if (showToast) show('บันทึกข้อมูลเคสแล้ว');
    }
    return saved;
  }

  function updateVital(key, value) {
    setDraft((prev) => {
      const nextVitals = { ...prev.vitals, [key]: value };
      const nextTriage = triageLocked ? prev.triage : suggestTriage(appt.species, nextVitals);
      return { ...prev, vitals: nextVitals, triage: nextTriage };
    });
  }

  function updateField(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChecklist(item) {
    if (readOnly) return;
    const next = {
      ...draft,
      checklist: { ...draft.checklist, [item]: !draft.checklist[item] },
    };
    setDraft(next);
    persist(next, false);
  }

  function addMedication() {
    if (readOnly) return;
    const next = {
      ...draft,
      medications: [
        ...draft.medications,
        { id: newId(), name: '', dose: '', route: MED_ROUTES[0], frequency: '', days: '' },
      ],
    };
    setDraft(next);
  }

  function updateMedication(idx, key, val) {
    setDraft((prev) => ({
      ...prev,
      medications: prev.medications.map((m, i) => (i === idx ? { ...m, [key]: val } : m)),
    }));
  }

  function removeMedication(idx) {
    if (readOnly) return;
    const next = {
      ...draft,
      medications: draft.medications.filter((_, i) => i !== idx),
    };
    setDraft(next);
    persist(next, false);
  }

  function appendInstructionTemplate(text) {
    if (readOnly) return;
    const existing = draft.ownerInstructions.trim();
    const lines = existing ? existing.split('\n').map((s) => s.trim()) : [];
    if (lines.includes(text)) return;
    const nextText = existing ? `${existing}\n${text}` : text;
    const next = { ...draft, ownerInstructions: nextText };
    setDraft(next);
    persist(next, false);
  }

  function doSendToVet() {
    persist(draft, false);
    if (setStatus(appt.id, 'in_treatment')) {
      setSendConfirmOpen(false);
      setStep('treatment');
      show(`ส่งน้อง ${appt.petName} เข้าห้องตรวจแล้ว`);
    }
  }

  function handleRequestSendToVet() {
    if (!triagedDone || appt.status !== 'checked_in') return;
    if (checkedCount < checklistItems.length) {
      setSendConfirmOpen(true);
    } else {
      doSendToVet();
    }
  }

  function handleCloseCase() {
    if (readOnly || appt.status !== 'in_treatment') return;
    if (followUp.enabled && followUpConflict) return;

    const now = new Date().toISOString();
    const followUpData = followUp.enabled
      ? {
          date: followUp.date,
          time: followUp.time,
          service: followUp.service,
          vet: followUp.vet,
        }
      : null;

    saveVisit(appt.id, {
      patientId: patient?.patientId ?? null,
      ...draft,
      triage: effectiveTriage,
      followUp: followUpData,
      completedAt: now,
    });

    if (setStatus(appt.id, 'completed')) {
      if (followUp.enabled) {
        addAppointment({
          petId: appt.petId ?? (patient?.registered ? patient.pet.id : null),
          petName: appt.petName,
          species: appt.species,
          ownerName: appt.ownerName,
          ownerPhone: appt.ownerPhone,
          vet: followUp.vet,
          service: followUp.service,
          date: followUp.date,
          time: followUp.time,
          durationMin: 30,
          status: 'confirmed',
          source: 'walk_in',
          handledAt: now,
          reason: `นัดติดตามอาการจากการตรวจวันที่ ${formatDate(appt.date)}`,
          notes: '',
        });
      }
      navigate('/medical-assistant/medical-support', {
        state: {
          toastMessage: followUp.enabled
            ? `ปิดเคส ${appt.petName} และสร้างนัดติดตามอาการแล้ว`
            : `ปิดเคส ${appt.petName} เรียบร้อยแล้ว`,
        },
      });
    }
  }

  const sp = speciesOf(appt.species);
  const st = APPOINTMENT_STATUS[appt.status] ?? APPOINTMENT_STATUS.checked_in;
  const patientFlags = patient?.flags ?? [];
  const weightVal = Number(draft.vitals.weight);
  const prevWeightNum = previousWeight ? Number(previousWeight) : NaN;
  const weightDelta =
    draft.vitals.weight && !Number.isNaN(weightVal) && !Number.isNaN(prevWeightNum)
      ? Math.round((weightVal - prevWeightNum) * 10) / 10
      : null;

  const displayWeight = draft.vitals.weight || previousWeight || patient?.pet?.weight;
  const waitText = formatWaitSince(appt);
  const savedTimeText = formatSavedTime(lastSavedIso);

  const stepTabs = [
    { id: 'triage', label: '1. คัดกรอง', done: triagedDone, disabled: false },
    { id: 'prep', label: '2. เตรียมความพร้อม', done: prepDone, disabled: false },
    {
      id: 'treatment',
      label: '3. บันทึกการรักษา',
      done: treatmentDone,
      disabled: appt.status !== 'in_treatment' && appt.status !== 'completed',
      title:
        appt.status !== 'in_treatment' && appt.status !== 'completed'
          ? 'กรุณาส่งเข้าห้องตรวจก่อนบันทึกการรักษา'
          : '',
    },
    { id: 'summary', label: '4. สรุปและปิดเคส', done: appt.status === 'completed', disabled: false },
  ];

  return (
    <section>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 ma-no-print">
        <Link to="/medical-assistant/medical-support" className="small text-decoration-none">
          <i className="bi bi-arrow-left me-1" />
          กลับไปหน้าคิวสนับสนุนการรักษา
        </Link>
        {savedTimeText && (
          <span className="small text-muted">
            <i className="bi bi-cloud-check me-1 text-sky" />
            บันทึกล่าสุด {savedTimeText}
          </span>
        )}
      </div>

      {readOnly && (
        <div className="alert-soft info mb-3 ma-no-print">
          <i className="bi bi-lock" />
          <span>เคสนี้ปิดการรักษาแล้ว แสดงในโหมดอ่านอย่างเดียว</span>
        </div>
      )}

      {(patientFlags.length > 0 || patient?.pet?.allergies || patient?.pet?.chronicDiseases) && (
        <div className="alert-soft danger mb-3">
          <i className="bi bi-exclamation-triangle-fill" />
          <div className="d-flex flex-wrap align-items-center gap-2">
            <strong>ข้อควรระวังผู้ป่วย:</strong>
            {patientFlags.map((f) => (
              <span key={f} className={`tag ${CAUTION_FLAGS[f]?.tag ?? 'danger'} m-0`}>
                {CAUTION_FLAGS[f]?.label ?? f}
              </span>
            ))}
            {patient?.pet?.allergies && <span>แพ้: {patient.pet.allergies}</span>}
            {patient?.pet?.chronicDiseases && <span>โรคประจำตัว: {patient.pet.chronicDiseases}</span>}
          </div>
        </div>
      )}

      {vFlags.length > 0 && (
        <div className="alert-soft warn mb-3">
          <i className="bi bi-heart-pulse" />
          <span>
            <strong>ค่าสัญญาณชีพอยู่นอกเกณฑ์อ้างอิง:</strong>{' '}
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
          <PetPhoto
            pet={{ name: appt.petName, species: appt.species, photo: patient?.pet?.photo }}
            size="lg"
          />
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h1 className="h2 mb-0">
                {patient ? (
                  <PatientNameLink
                    patientId={patient.patientId}
                    petName={appt.petName}
                    species={appt.species}
                    flags={patientFlags}
                    allergies={patient?.pet?.allergies}
                    showEmoji={false}
                  />
                ) : (
                  appt.petName
                )}
              </h1>
              <span className={`tag ${st.tag} m-0`}>{st.label}</span>
              {effectiveTriage && TRIAGE_LEVELS[effectiveTriage] && (
                <span className={`tag ${TRIAGE_LEVELS[effectiveTriage].tag} m-0`}>
                  เร่งด่วน: {TRIAGE_LEVELS[effectiveTriage].label}
                </span>
              )}
              {waitText && <span className="tag sky m-0">{waitText}</span>}
            </div>

            <div className="text-muted mb-2">
              {sp.emoji} {sp.label}
              {patient?.breed ? ` · ${patient.breed}` : ''}
              {patient?.pet?.birthDate ? ` · ${ageText(patient.pet.birthDate)}` : ''}
              {displayWeight ? ` · น้ำหนัก ${displayWeight} กก.` : ''}
            </div>

            <div className="small">
              <i className="bi bi-person me-1 text-sky" />
              {appt.ownerName} · {appt.ownerPhone}
              {' · '}
              <i className="bi bi-clipboard2-pulse me-1 text-sky" />
              <strong>{appt.service}</strong> · {appt.vet}
            </div>
          </div>
        </div>
      </div>

      <div className="pill-tabs ma-status-tabs mb-4 ma-no-print" role="tablist" aria-label="ขั้นตอนการดูแลผู้ป่วย">
        {stepTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            disabled={t.disabled}
            title={t.title || undefined}
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
                className="form-control"
                disabled={readOnly}
                placeholder="อาการที่เจ้าของแจ้งหรืออาการที่สังเกตพบแรกรับ"
                value={draft.chiefComplaint}
                onChange={(e) => updateField('chiefComplaint', e.target.value)}
                onBlur={() => persist(draft, false)}
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
                min="0"
                className="form-control"
                disabled={readOnly}
                placeholder="เช่น 8.5"
                value={draft.vitals.weight}
                onChange={(e) => updateVital('weight', e.target.value)}
                onBlur={() => persist(draft, false)}
              />
              {weightDelta !== null && (
                <div className="ma-vital-hint">
                  {weightDelta > 0
                    ? `+${weightDelta} กก. จากครั้งก่อน (${previousWeight} กก.)`
                    : weightDelta < 0
                      ? `${weightDelta} กก. จากครั้งก่อน (${previousWeight} กก.)`
                      : `เท่าเดิมกับครั้งก่อน (${previousWeight} กก.)`}
                </div>
              )}
              {weightDelta === null && previousWeight && (
                <div className="ma-vital-hint">ครั้งก่อน: {previousWeight} กก.</div>
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
                className={`form-control${flagByKey.temp ? ' is-invalid' : ''}`}
                disabled={readOnly}
                placeholder={`${ranges.temp.min}–${ranges.temp.max}`}
                value={draft.vitals.temp}
                onChange={(e) => updateVital('temp', e.target.value)}
                onBlur={() => persist(draft, false)}
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
                className={`form-control${flagByKey.heartRate ? ' is-invalid' : ''}`}
                disabled={readOnly}
                placeholder={`${ranges.heartRate.min}–${ranges.heartRate.max}`}
                value={draft.vitals.heartRate}
                onChange={(e) => updateVital('heartRate', e.target.value)}
                onBlur={() => persist(draft, false)}
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
                className={`form-control${flagByKey.respRate ? ' is-invalid' : ''}`}
                disabled={readOnly}
                placeholder={`${ranges.respRate.min}–${ranges.respRate.max}`}
                value={draft.vitals.respRate}
                onChange={(e) => updateVital('respRate', e.target.value)}
                onBlur={() => persist(draft, false)}
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
                onChange={(e) => {
                  const next = { ...draft, vitals: { ...draft.vitals, bcs: e.target.value } };
                  setDraft(next);
                  persist(next, false);
                }}
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
                onChange={(e) => {
                  const val = e.target.value;
                  const nextVitals = { ...draft.vitals, pain: val };
                  const nextTriage = triageLocked
                    ? draft.triage
                    : suggestTriage(appt.species, nextVitals);
                  const next = { ...draft, vitals: nextVitals, triage: nextTriage };
                  setDraft(next);
                  persist(next, false);
                }}
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
                onChange={(e) => {
                  const next = { ...draft, vitals: { ...draft.vitals, mucous: e.target.value } };
                  setDraft(next);
                  persist(next, false);
                }}
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
                onChange={(e) => {
                  const next = { ...draft, vitals: { ...draft.vitals, crt: e.target.value } };
                  setDraft(next);
                  persist(next, false);
                }}
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
              </div>
              <div className="d-flex flex-wrap gap-2">
                {TRIAGE_LEVEL_LIST.map((lvl) => {
                  const selected = effectiveTriage === lvl.value;
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
                      onClick={() => {
                        setTriageLocked(true);
                        const next = { ...draft, triage: lvl.value };
                        setDraft(next);
                        persist(next, false);
                      }}
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
              <button type="button" className="btn btn-soft" onClick={() => persist(draft, true)}>
                <i className="bi bi-save me-1" />
                บันทึก
              </button>
              <button
                type="button"
                className="btn btn-sky"
                onClick={() => {
                  persist(draft, false);
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
              เตรียมความพร้อม ({appt.service})
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
              <button type="button" className="btn btn-soft" onClick={() => persist(draft, true)}>
                <i className="bi bi-save me-1" />
                บันทึก
              </button>
              {appt.status === 'checked_in' ? (
                <button
                  type="button"
                  className="btn btn-sky"
                  disabled={!triagedDone}
                  title={!triagedDone ? 'กรุณาคัดกรองก่อนส่งเข้าห้องตรวจ' : undefined}
                  onClick={handleRequestSendToVet}
                >
                  <i className="bi bi-box-arrow-in-right me-1" />
                  ส่งเข้าห้องตรวจ
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sky"
                  onClick={() => setStep('treatment')}
                >
                  ถัดไป: บันทึกการรักษา
                  <i className="bi bi-arrow-right ms-1" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'treatment' && (
        <div className="card-soft">
          <div className="section-label">
            <i className="bi bi-journal-medical" />
            ผู้ช่วยบันทึกตามคำสั่งสัตวแพทย์
          </div>

          <div className="mb-4">
            <label className="form-label" htmlFor="sc-orders">
              คำสั่ง / ผลวินิจฉัยของสัตวแพทย์
            </label>
            <textarea
              id="sc-orders"
              rows={3}
              className="form-control"
              disabled={readOnly}
              placeholder="บันทึกการตรวจรักษา หัตถการ หรือคำสั่งของสัตวแพทย์"
              value={draft.vetOrders}
              onChange={(e) => updateField('vetOrders', e.target.value)}
              onBlur={() => persist(draft, false)}
            />
          </div>

          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="form-label mb-0">รายการยา ({draft.medications.length})</div>
              {!readOnly && (
                <button type="button" className="btn btn-soft btn-sm" onClick={addMedication}>
                  <i className="bi bi-plus-lg me-1" />
                  เพิ่มรายการยา
                </button>
              )}
            </div>

            {draft.medications.length === 0 ? (
              <div className="empty-box py-3">
                <i className="bi bi-capsule" />
                ยังไม่มีรายการยา
              </div>
            ) : (
              draft.medications.map((med, idx) => (
                <div className="record-row" key={med.id ?? idx}>
                  {!readOnly && (
                    <button
                      type="button"
                      className="btn btn-soft-danger btn-sm remove"
                      aria-label="ลบรายการยา"
                      onClick={() => removeMedication(idx)}
                    >
                      <i className="bi bi-trash3" />
                    </button>
                  )}
                  <div className="row g-2 pb-2 pe-5">
                    <div className="col-md-4">
                      <label className="form-label small">ชื่อยา</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        disabled={readOnly}
                        placeholder="เช่น Amoxicillin"
                        value={med.name}
                        onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                        onBlur={() => persist(draft, false)}
                      />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label small">ขนาด</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        disabled={readOnly}
                        placeholder="เช่น 1 เม็ด"
                        value={med.dose}
                        onChange={(e) => updateMedication(idx, 'dose', e.target.value)}
                        onBlur={() => persist(draft, false)}
                      />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label small">วิธีให้</label>
                      <select
                        className="form-select form-select-sm"
                        disabled={readOnly}
                        value={med.route}
                        onChange={(e) => {
                          const nextMeds = draft.medications.map((m, i) =>
                            i === idx ? { ...m, route: e.target.value } : m,
                          );
                          const next = { ...draft, medications: nextMeds };
                          setDraft(next);
                          persist(next, false);
                        }}
                      >
                        {MED_ROUTES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-8 col-md-3">
                      <label className="form-label small">ความถี่</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        disabled={readOnly}
                        placeholder="เช่น เช้า-เย็น หลังอาหาร"
                        value={med.frequency}
                        onChange={(e) => updateMedication(idx, 'frequency', e.target.value)}
                        onBlur={() => persist(draft, false)}
                      />
                    </div>
                    <div className="col-4 col-md-1">
                      <label className="form-label small">วัน</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control form-control-sm"
                        disabled={readOnly}
                        placeholder="7"
                        value={med.days}
                        onChange={(e) => updateMedication(idx, 'days', e.target.value)}
                        onBlur={() => persist(draft, false)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="sc-instructions">
              คำแนะนำสำหรับเจ้าของ
            </label>
            {!readOnly && (
              <div className="ma-template-pills mb-2">
                {OWNER_INSTRUCTION_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={() => appendInstructionTemplate(tpl)}
                  >
                    + {tpl}
                  </button>
                ))}
              </div>
            )}
            <textarea
              id="sc-instructions"
              rows={3}
              className="form-control"
              disabled={readOnly}
              placeholder="คำแนะนำการดูแลที่บ้าน การป้อนยา หรืออาการที่ต้องรีบพามาพบแพทย์"
              value={draft.ownerInstructions}
              onChange={(e) => updateField('ownerInstructions', e.target.value)}
              onBlur={() => persist(draft, false)}
            />
          </div>

          {!readOnly && (
            <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
              <button type="button" className="btn btn-soft" onClick={() => persist(draft, true)}>
                <i className="bi bi-save me-1" />
                บันทึก
              </button>
              <button
                type="button"
                className="btn btn-sky"
                onClick={() => {
                  persist(draft, false);
                  setStep('summary');
                }}
              >
                ถัดไป: สรุปและปิดเคส
                <i className="bi bi-arrow-right ms-1" />
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'summary' && (
        <div className="d-grid gap-4">
          <div className="card-soft ma-print-summary">
            <div className="ma-print-only mb-3 pb-2" style={{ borderBottom: '1.5px solid var(--baby)' }}>
              <div className="mitr fs-4">ใบสรุปการตรวจรักษา · PetCare Clinic</div>
              <div className="small text-muted">
                วันที่ {formatDate(appt.date)} · เวลา {appt.time} น. · สัตวแพทย์ {appt.vet}
              </div>
            </div>

            <div className="section-label">
              <i className="bi bi-file-earmark-medical" />
              สรุปผลการตรวจและคำแนะนำ
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
                  {appt.ownerName} · {appt.ownerPhone}
                </div>
              </div>
              <div className="info-item">
                <div className="k">บริการ / สัตวแพทย์</div>
                <div className="v">
                  {appt.service} · {appt.vet}
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
                <div className="k">BCS / Pain / เยื่อเมือก</div>
                <div className="v">
                  {draft.vitals.bcs ? `${draft.vitals.bcs}/9` : '-'} ·{' '}
                  {draft.vitals.pain !== '' ? `Pain ${draft.vitals.pain}/4` : '-'} ·{' '}
                  {draft.vitals.mucous || '-'}
                </div>
              </div>
            </div>

            <div className="d-grid gap-2 mb-3">
              <div className="info-item">
                <div className="k">อาการสำคัญ</div>
                <div className="v">{draft.chiefComplaint || '-'}</div>
              </div>
              <div className="info-item">
                <div className="k">คำสั่ง / ผลวินิจฉัยของสัตวแพทย์</div>
                <div className="v">{draft.vetOrders || '-'}</div>
              </div>
              <div className="info-item">
                <div className="k">รายการยา ({draft.medications.length})</div>
                {draft.medications.length > 0 ? (
                  <ul className="mb-0 ps-3 mt-1">
                    {draft.medications.map((m, idx) => (
                      <li key={m.id ?? idx} className="small">
                        <strong>{m.name || 'ไม่ระบุชื่อยา'}</strong>
                        {m.dose ? ` · ${m.dose}` : ''}
                        {m.route ? ` · ${m.route}` : ''}
                        {m.frequency ? ` · ${m.frequency}` : ''}
                        {m.days ? ` (${m.days} วัน)` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="v">-</div>
                )}
              </div>
              <div className="info-item">
                <div className="k">คำแนะนำสำหรับเจ้าของ</div>
                <div className="v" style={{ whiteSpace: 'pre-line' }}>
                  {draft.ownerInstructions || '-'}
                </div>
              </div>
              {existingVisit?.followUp && (
                <div className="info-item">
                  <div className="k">นัดติดตามอาการ</div>
                  <div className="v">
                    {formatDate(existingVisit.followUp.date)} เวลา {existingVisit.followUp.time} น. ·{' '}
                    {existingVisit.followUp.service} ({existingVisit.followUp.vet})
                  </div>
                </div>
              )}
            </div>
          </div>

          {!readOnly && (
            <div className="card-soft ma-no-print">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div className="section-label mb-0">
                  <i className="bi bi-calendar-plus" />
                  นัดติดตามอาการ (ถ้ามี)
                </div>
                <label className="d-inline-flex align-items-center gap-2" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={followUp.enabled}
                    onChange={(e) =>
                      setFollowUp((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                  />
                  <span>สร้างนัดติดตามอาการ</span>
                </label>
              </div>

              {followUp.enabled && (
                <div className="mb-3">
                  {followUpConflict && (
                    <div className="alert-soft warn mb-3">
                      <i className="bi bi-exclamation-triangle" />
                      <span>
                        {followUp.vet} มีนัดซ้อนในช่วงเวลา {followUpConflict.rangeText} (
                        {followUpConflict.petName} · {followUpConflict.ownerName})
                      </span>
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-12 col-sm-6 col-md-3">
                      <label className="form-label" htmlFor="fu-date">
                        วันที่นัด
                      </label>
                      <input
                        id="fu-date"
                        type="date"
                        className="form-control"
                        value={followUp.date}
                        onChange={(e) =>
                          setFollowUp((prev) => ({ ...prev, date: e.target.value }))
                        }
                      />
                    </div>
                    <div className="col-12 col-sm-6 col-md-3">
                      <label className="form-label" htmlFor="fu-time">
                        เวลา
                      </label>
                      <input
                        id="fu-time"
                        type="time"
                        className="form-control"
                        value={followUp.time}
                        onChange={(e) =>
                          setFollowUp((prev) => ({ ...prev, time: e.target.value }))
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label" htmlFor="fu-service">
                        บริการ
                      </label>
                      <select
                        id="fu-service"
                        className="form-select"
                        value={followUp.service}
                        onChange={(e) =>
                          setFollowUp((prev) => ({ ...prev, service: e.target.value }))
                        }
                      >
                        {SERVICE_TYPES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label" htmlFor="fu-vet">
                        สัตวแพทย์
                      </label>
                      <select
                        id="fu-vet"
                        className="form-select"
                        value={followUp.vet}
                        onChange={(e) =>
                          setFollowUp((prev) => ({ ...prev, vet: e.target.value }))
                        }
                      >
                        {VETS.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="form-label small mb-1">เวลาว่างที่แนะนำ</div>
                    {followUpSlots.length > 0 ? (
                      <div className="ma-slot-list">
                        {followUpSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className={`btn btn-sm ${
                              followUp.time === slot ? 'btn-sky' : 'btn-soft'
                            }`}
                            onClick={() => setFollowUp((prev) => ({ ...prev, time: slot }))}
                          >
                            {slot} น.
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="small text-muted">ไม่มีเวลาว่างที่แนะนำในวันที่เลือก</div>
                    )}
                  </div>
                </div>
              )}

              {appt.status !== 'in_treatment' && (
                <div className="alert-soft warn mb-3">
                  <i className="bi bi-info-circle" />
                  <span>
                    เคสนี้ยังไม่ได้ส่งเข้าห้องตรวจ กรุณากด "ส่งเข้าห้องตรวจ" ในขั้นที่ 2 ก่อนปิดเคส
                  </span>
                </div>
              )}

              <div className="d-flex flex-wrap justify-content-end gap-2">
                <button type="button" className="btn btn-soft" onClick={() => window.print()}>
                  <i className="bi bi-printer me-1" />
                  พิมพ์ใบสรุป
                </button>
                <button
                  type="button"
                  className="btn btn-sky"
                  disabled={
                    appt.status !== 'in_treatment' || Boolean(followUp.enabled && followUpConflict)
                  }
                  onClick={handleCloseCase}
                >
                  <i className="bi bi-check2-circle me-1" />
                  ปิดเคส
                </button>
              </div>
            </div>
          )}

          {readOnly && (
            <div className="d-flex justify-content-end ma-no-print">
              <button type="button" className="btn btn-soft" onClick={() => window.print()}>
                <i className="bi bi-printer me-1" />
                พิมพ์ใบสรุป
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={sendConfirmOpen}
        title="รายการเตรียมความพร้อมยังไม่ครบ"
        icon="bi-exclamation-triangle"
        message={`ทำรายการเตรียมความพร้อมแล้ว ${checkedCount}/${checklistItems.length} รายการ ต้องการส่งน้องเข้าห้องตรวจเลยหรือไม่?`}
        confirmLabel="ส่งเข้าห้องตรวจ"
        cancelLabel="กลับไปเช็คต่อ"
        confirmVariant="sky"
        onClose={() => setSendConfirmOpen(false)}
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
  const { getAppointment } = useAppointments();
  const { getPatient, patientIdForAppt } = usePatients();
  const { getVisit, visitsByPatient } = useVisits();

  const appt = getAppointment(appointmentId);

  if (!appt || (FINAL_STATUSES.includes(appt.status) && appt.status !== 'completed')) {
    return (
      <section>
        <div className="card-soft empty-box">
          <i className="bi bi-calendar-x" />
          <div>ไม่พบเคสที่ต้องการ หรือนัดหมายถูกยกเลิกไปแล้ว</div>
          <div className="mt-3">
            <Link to="/medical-assistant/medical-support" className="btn btn-sky">
              กลับไปหน้าสนับสนุนการรักษา
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const pid = patientIdForAppt(appt);
  const patient = getPatient(pid);
  const existingVisit = getVisit(appt.id);

  const patientVisits = visitsByPatient(pid).filter(
    (v) => v.appointmentId !== appt.id && v.vitals?.weight,
  );
  const previousWeight = patientVisits[0]?.vitals?.weight || patient?.pet?.weight || '';

  return (
    <SupportCaseInner
      key={appt.id}
      appt={appt}
      patient={patient}
      existingVisit={existingVisit}
      previousWeight={previousWeight}
    />
  );
}
