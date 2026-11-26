import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DatePicker, { registerLocale } from 'react-datepicker';
import { th } from 'date-fns/locale/th';
import { format, isValid, parse } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import { HOTEL_STAY_PROMO } from '../../../shared/data/homeContent.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../usePets.js';
import QuickAddPetModal from '../components/QuickAddPetModal.jsx';
import StayRoomPreviewModal from '../components/StayRoomPreviewModal.jsx';
import { stayNights } from '../useHotelBookings.js';
import { speciesOf, labelOf, SEX_OPTIONS, petPhotoSrc } from '../petUtils.js';
import { useHotelCatalog, fetchHotelAvailability } from '../useHotelCatalog.js';
import { useHotelStays, formatStayHubDetail } from '../useHotelStays.js';
import { quoteHotelStay } from '../quoteHotelStay.js';
import {
  filterCatalogBySpecies,
  newRoomLineKey,
  petHotelSpecies,
  selectedSpeciesGroups,
  validateAssignment,
  validateRoomLines,
  validateRoomSpeciesCoverage,
  autoAssignRoomPets,
} from '../hotelStayRules.js';
import { scrollHubWizardIntoView } from '../hubWizardScroll.js';
import '../hotel.css';

registerLocale('th', th);

const STAY_STEPS = [
  { id: 'pets', label: 'เลือกสัตว์' },
  { id: 'rooms', label: 'เลือกห้อง' },
  { id: 'dates', label: 'วันเข้าออก' },
  { id: 'assign', label: 'จัดเข้าห้อง' },
  { id: 'confirm', label: 'สรุป' },
];

function stayHubWizardHint(
  stepId,
  { petCount, roomLineCount, speciesGroups, hasDogRoomLine, hasCatRoomLine, hubMixedRoomPhase },
) {
  if (stepId === 'pets') {
    return `กดการ์ดเพื่อเลือก — เลือกแล้ว ${petCount} ตัว${
      speciesGroups?.hasDog && speciesGroups?.hasCat ? ' · เลือกห้องสุนัขก่อน แล้วเลือกห้องแมว' : ''
    }`;
  }
  if (stepId === 'rooms') {
    if (hubMixedRoomPhase === 'dog') {
      return 'เลือกห้องสุนัข แล้วกดเพิ่มห้อง — ขั้นถัดไปจะให้เลือกห้องแมว';
    }
    if (hubMixedRoomPhase === 'cat') {
      return 'ต่อไป เลือกห้องแมว แล้วกดเพิ่มห้อง';
    }
    if (hubMixedRoomPhase === 'both') {
      return 'เลือกห้องครบแล้ว — ปรับจำนวนหรือลบรายการ แล้วไปขั้นถัดไป';
    }
    return roomLineCount
      ? `เลือกห้องทีละประเภท — ในรายการ ${roomLineCount} รายการ`
      : 'เลือกห้องทีละประเภท แล้วกดเพิ่มห้อง';
  }
  if (stepId === 'dates') {
    return 'เลือกวันเข้าพักและวันรับกลับ · หมายเหตุไม่บังคับ';
  }
  if (stepId === 'assign') return 'จัดสัตว์ให้ตรงกับแต่ละห้อง';
  return 'ตรวจสอบรายละเอียดก่อนบันทึกลงตะกร้า';
}

function formatDay(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function baht(value) {
  return `฿${Number(value).toLocaleString('th-TH')}`;
}

export function StayBookPage({
  embedded = false,
  checkoutMode = 'standalone',
  onBooked,
  onHubLine,
} = {}) {
  const hubCheckout = checkoutMode === 'hub';
  const { currentUser } = useAuth();
  const { pets } = usePets();
  const { catalog, loading: catalogLoading, error: catalogError } = useHotelCatalog();
  const { createStay } = useHotelStays();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedPetId = params.get('petId');

  const [petIds, setPetIds] = useState([]);
  const [roomLines, setRoomLines] = useState([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');
  const [availability, setAvailability] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stayStepIndex, setStayStepIndex] = useState(0);
  const [maxStepIndex, setMaxStepIndex] = useState(0);
  const stayStepScrollRef = useRef(stayStepIndex);
  const [addPetOpen, setAddPetOpen] = useState(false);
  const [pendingRoomTypeId, setPendingRoomTypeId] = useState('');
  const [roomPreview, setRoomPreview] = useState(null);

  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const speciesGroups = useMemo(
    () => selectedSpeciesGroups(pets, petIds),
    [pets, petIds],
  );
  const filteredCatalog = useMemo(
    () => filterCatalogBySpecies(catalog, speciesGroups),
    [catalog, speciesGroups],
  );
  const availMap = useMemo(
    () => (availability ? new Map(availability.map((item) => [item.roomTypeId, item.minAvailable])) : null),
    [availability],
  );

  const selectedPets = useMemo(
    () => pets.filter((pet) => petIds.includes(pet.id)),
    [pets, petIds],
  );

  const nights = stayNights(checkIn, checkOut);
  const quote = useMemo(() => {
    if (!nights || !roomLines.length) return null;
    const lines = roomLines.map((line) => ({
      roomTypeId: line.roomTypeId,
      units: line.units,
      petIds: line.petIds || [],
    }));
    return quoteHotelStay({ checkIn, checkOut, lines, catalogById });
  }, [checkIn, checkOut, roomLines, catalogById, nights]);

  const wizardSteps = useMemo(
    () => (hubCheckout ? STAY_STEPS.filter((step) => step.id !== 'assign') : STAY_STEPS),
    [hubCheckout],
  );
  const stayStep = wizardSteps[stayStepIndex]?.id ?? 'pets';
  const isLastStayStep = stayStepIndex === wizardSteps.length - 1;

  useEffect(() => {
    if (!hubCheckout) return undefined;
    if (stayStepScrollRef.current === stayStepIndex) return undefined;
    stayStepScrollRef.current = stayStepIndex;
    const id = requestAnimationFrame(() => scrollHubWizardIntoView());
    return () => cancelAnimationFrame(id);
  }, [stayStepIndex, hubCheckout]);

  useEffect(() => {
    setPetIds((current) => current.filter((id) => pets.some((pet) => pet.id === id)));
  }, [pets]);


  useEffect(() => {
    if (requestedPetId && pets.some((pet) => pet.id === requestedPetId)) {
      setPetIds((current) => (current.length ? current : [requestedPetId]));
    }
  }, [pets, requestedPetId]);

  useEffect(() => {
    if (!checkIn || !checkOut || !nights || !currentUser?.id) {
      setAvailability(null);
      return undefined;
    }
    let gone = false;
    setAvailLoading(true);
    fetchHotelAvailability(currentUser.id, checkIn, checkOut)
      .then((map) => {
        if (!gone) setAvailability([...map.entries()].map(([roomTypeId, minAvailable]) => ({ roomTypeId, minAvailable })));
      })
      .catch(() => {
        if (!gone) setAvailability(null);
      })
      .finally(() => {
        if (!gone) setAvailLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [checkIn, checkOut, nights, currentUser?.id]);

  function validateStayStep(stepId) {
    if (catalogLoading && stepId !== 'pets') return 'กำลังโหลดข้อมูลห้องพัก';
    if (stepId === 'pets') {
      if (!petIds.length) return 'เลือกสัตว์เลี้ยงอย่างน้อย 1 ตัว';
      return '';
    }
    if (stepId === 'rooms') {
      const base = validateRoomLines(roomLines, catalogById, null);
      if (base) return base;
      return validateRoomSpeciesCoverage(roomLines, catalogById, speciesGroups);
    }
    if (stepId === 'dates') {
      if (!checkIn || !checkOut) return 'เลือกวันเข้าพักและวันรับกลับ';
      if (!nights) return 'จำนวนคืนไม่ถูกต้อง';
      const base = validateRoomLines(roomLines, catalogById, availMap);
      if (base) return base;
      return validateRoomSpeciesCoverage(roomLines, catalogById, speciesGroups);
    }
    if (stepId === 'assign') {
      return validateAssignment(roomLines, petIds, pets, catalogById);
    }
    if (stepId === 'confirm') {
      if (!quote) return 'ข้อมูลยังไม่ครบ';
      const assignErr = validateAssignment(roomLines, petIds, pets, catalogById);
      if (assignErr) return assignErr;
      return '';
    }
    return '';
  }

  function applyHubAutoAssign() {
    const { lines, error: assignErr } = autoAssignRoomPets(roomLines, petIds, pets, catalogById);
    if (assignErr) return assignErr;
    setRoomLines(lines);
    return '';
  }

  function goToStayStep(index) {
    if (index < 0 || index >= wizardSteps.length) return;
    if (index > maxStepIndex + 1) return;
    setPendingRoomTypeId('');
    setStayStepIndex(index);
    setError('');
  }

  function goNextStayStep() {
    if (stayStep === 'rooms' && pendingRoomTypeId) {
      setError('');
      addRoomLine(pendingRoomTypeId);
      setPendingRoomTypeId('');
      return;
    }
    const err = validateStayStep(stayStep);
    if (err) {
      setError(err);
      return;
    }
    if (hubCheckout && stayStep === 'dates') {
      const assignErr = applyHubAutoAssign();
      if (assignErr) {
        setError(assignErr);
        return;
      }
    }
    setError('');
    const next = stayStepIndex + 1;
    if (next < wizardSteps.length) {
      setStayStepIndex(next);
      setMaxStepIndex((prev) => Math.max(prev, next));
    }
  }

  function goPrevStayStep() {
    setError('');
    setPendingRoomTypeId('');
    if (stayStepIndex > 0) setStayStepIndex(stayStepIndex - 1);
  }

  function onPetCreated(pet) {
    setPetIds((ids) => (ids.includes(pet.id) ? ids : [...ids, pet.id]));
  }

  function togglePet(id) {
    setPetIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }

  function addRoomLine(roomTypeId) {
    setRoomLines((lines) => [...lines, { key: newRoomLineKey(), roomTypeId, units: 1, petIds: [] }]);
  }

  function updateRoomLine(key, patch) {
    setRoomLines((lines) => lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeRoomLine(key) {
    setRoomLines((lines) => lines.filter((line) => line.key !== key));
  }

  function toggleAssignPet(lineKey, petId) {
    setRoomLines((lines) => lines.map((line) => {
      if (line.key !== lineKey) return line;
      const ids = new Set(line.petIds || []);
      if (ids.has(petId)) ids.delete(petId);
      else ids.add(petId);
      return { ...line, petIds: [...ids] };
    }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!isLastStayStep) {
      goNextStayStep();
      return;
    }
    setError('');
    if (hubCheckout) {
      const assignErr = applyHubAutoAssign();
      if (assignErr) {
        setError(assignErr);
        return;
      }
    }
    const confirmErr = validateStayStep('confirm');
    if (confirmErr) {
      setError(confirmErr);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        checkIn,
        checkOut,
        note,
        lines: roomLines.map((line) => ({
          roomTypeId: line.roomTypeId,
          units: line.units,
          petIds: line.petIds,
        })),
      };
      const stay = await createStay(payload);
      if (hubCheckout) {
        onHubLine?.({
          category: 'hotel',
          refId: stay.id,
          label: 'โรงแรมสัตว์',
          detail: formatStayHubDetail(stay),
          total: stay.total,
        });
        onBooked?.(stay);
        return;
      }
      onBooked?.(stay);
      navigate(`/pet-owner/cat-hotel/bookings/${stay.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const start = checkIn ? parse(checkIn, 'yyyy-MM-dd', new Date()) : null;
  const end = checkOut ? parse(checkOut, 'yyyy-MM-dd', new Date()) : null;

  function renderRoomTypeCard(room) {
    const on = pendingRoomTypeId === room.id;
    if (hubCheckout) {
      return (
        <div
          key={room.id}
          className={`stay-room-pick__card stay-room-pick__card--row${on ? ' stay-room-pick__card--active' : ''}`}
        >
          <div className="stay-room-pick__thumb">
            <img src={room.imageUrl} alt="" loading="lazy" decoding="async" />
            <button
              type="button"
              className="stay-room-pick__zoom"
              aria-label={`ดูรูป ${room.titleTh}`}
              onClick={() => setRoomPreview(room)}
            >
              <i className="bi bi-arrows-fullscreen" aria-hidden />
              ดูรูป
            </button>
          </div>
          <button
            type="button"
            role="radio"
            aria-checked={on}
            className="stay-room-pick__select"
            onClick={() => setPendingRoomTypeId(room.id)}
          >
            <span className="stay-room-pick__body">
              <span className="stay-room-pick__title">{room.titleTh}</span>
              <span className="stay-room-pick__hint stay-room-pick__hint--clip">{room.descriptionTh}</span>
              <span className="stay-room-pick__cap">รองรับ {room.maxPetsPerUnit} ตัว/ห้อง</span>
            </span>
            <span className="stay-room-pick__end">
              <span className="stay-room-pick__price">
                {baht(room.price)}
                <small>/ คืน</small>
              </span>
              {on ? <span className="stay-room-pick__badge">เลือกอยู่</span> : null}
            </span>
          </button>
        </div>
      );
    }
    return (
      <button
        key={room.id}
        type="button"
        role="radio"
        aria-checked={on}
        className={`stay-room-pick__card${on ? ' stay-room-pick__card--active' : ''}`}
        onClick={() => setPendingRoomTypeId(room.id)}
      >
        <>
          {on ? (
            <span className="stay-room-pick__ribbon" aria-hidden>เลือกอยู่</span>
          ) : null}
          <img className="stay-room-pick__photo" src={room.imageUrl} alt="" />
          <span className="stay-room-pick__title">{room.titleTh}</span>
          <span className="stay-room-pick__hint">{room.descriptionTh}</span>
          <span className="stay-room-pick__hint">รองรับ {room.maxPetsPerUnit} ตัว/ห้อง</span>
          <span className="stay-room-pick__price">
            {baht(room.price)} <small>/ คืน</small>
          </span>
        </>
      </button>
    );
  }

  function renderRoomSpeciesBlock(species, heading, ariaLabel) {
    const rooms = filteredCatalog.filter((r) => r.species === species);
    if (!rooms.length) return null;
    return (
      <div key={species} className="stay-room-species-block">
        <h3 className={`stay-room-species-block__title h6${hubCheckout ? ' stay-room-species-block__title--hub' : ''}`}>
          {heading}
        </h3>
        <div
          className={`stay-room-pick${hubCheckout ? ' stay-room-pick--hub' : ''}`}
          role="radiogroup"
          aria-label={ariaLabel}
        >
          {rooms.map((room) => renderRoomTypeCard(room))}
        </div>
      </div>
    );
  }

  const needDogRoom = speciesGroups.hasDog;
  const needCatRoom = speciesGroups.hasCat;
  const hasDogRoomLine = roomLines.some((line) => catalogById.get(line.roomTypeId)?.species === 'dog');
  const hasCatRoomLine = roomLines.some((line) => catalogById.get(line.roomTypeId)?.species === 'cat');
  const hubMixedRoomPhase = hubCheckout && needDogRoom && needCatRoom
    ? (!hasDogRoomLine ? 'dog' : !hasCatRoomLine ? 'cat' : 'both')
    : null;
  const showDogRoomPick = needDogRoom && (
    !hubMixedRoomPhase || hubMixedRoomPhase === 'dog'
  );
  const showCatRoomPick = needCatRoom && (
    !hubMixedRoomPhase || hubMixedRoomPhase === 'cat'
  );
  const hubRoomsComplete = hubMixedRoomPhase === 'both';

  function roomsStepNextLabel() {
    if (stayStep !== 'rooms') return 'ดำเนินการต่อ';
    if (pendingRoomTypeId) {
      const species = catalogById.get(pendingRoomTypeId)?.species;
      if (hubMixedRoomPhase === 'dog' || species === 'dog') {
        return 'เพิ่มห้องสุนัข — ต่อไปเลือกแมว';
      }
      if (hubMixedRoomPhase === 'cat' || species === 'cat') {
        return 'เพิ่มห้องแมว';
      }
      return 'เพิ่มห้องนี้ แล้วเลือกต่อ';
    }
    if (roomLines.length) return 'ไปขั้นถัดไป';
    return 'ดำเนินการต่อ';
  }

  return (
    <div className={embedded ? 'stay-page stay-page--embedded' : 'stay-page page-wrap'}>
      <div className={embedded ? '' : 'container'}>
        {!embedded && (
          <Link className="stay-back" to="/pet-owner/cat-hotel">กลับไปหน้าโรงแรม</Link>
        )}
        {!embedded && (
          <header className="book-head">
            <h1>จองโรงแรมสัตว์</h1>
            <p>เลือกน้อง ห้อง วัน จัดเข้าห้อง แล้วยืนยัน — รองรับสุนัขและแมวหลายห้อง</p>
          </header>
        )}
        <form
          className={`book-sheet book-sheet--wizard${hubCheckout ? ' book-sheet--hub' : ''}`}
          onSubmit={onSubmit}
        >
          {error ? <p className="book-error">{error}</p> : null}
          {catalogError ? <p className="hotel-pricing-error" role="alert">{catalogError}</p> : null}
          {hubCheckout ? (
            <header className="stay-hub-wizard" aria-label="ขั้นตอนจองโรงแรม">
              <div
                className="stay-hub-wizard__track"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={wizardSteps.length}
                aria-valuenow={stayStepIndex + 1}
                aria-label={`ขั้น ${stayStepIndex + 1} จาก ${wizardSteps.length}`}
              >
                {wizardSteps.map((step, index) => {
                  const active = stayStepIndex === index;
                  const done = index < stayStepIndex;
                  return (
                    <span
                      key={step.id}
                      className={`stay-hub-wizard__segment${active ? ' stay-hub-wizard__segment--active' : ''}${done ? ' stay-hub-wizard__segment--done' : ''}`}
                    />
                  );
                })}
              </div>
              <div className="stay-hub-wizard__head">
                <h2 className="stay-hub-wizard__title">{wizardSteps[stayStepIndex]?.label}</h2>
                <p className="stay-hub-wizard__hint">
                  {stayHubWizardHint(stayStep, {
                    petCount: petIds.length,
                    roomLineCount: roomLines.length,
                    speciesGroups,
                    hasDogRoomLine,
                    hasCatRoomLine,
                    hubMixedRoomPhase,
                  })}
                </p>
              </div>
              <div className="stay-hub-wizard__pills" role="tablist" aria-label="กระโดดไปขั้นที่ทำแล้ว">
                {wizardSteps.map((step, index) => {
                  const active = stayStepIndex === index;
                  const done = index < stayStepIndex;
                  const canJump = index <= maxStepIndex;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={!canJump && !active}
                      className={`stay-hub-wizard__pill${active ? ' stay-hub-wizard__pill--active' : ''}${done ? ' stay-hub-wizard__pill--done' : ''}`}
                      onClick={() => canJump && goToStayStep(index)}
                    >
                      <span className="stay-hub-wizard__pill-num" aria-hidden>
                        {done && !active ? (
                          <i className="bi bi-check-lg" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className="stay-hub-wizard__pill-label">{step.label}</span>
                    </button>
                  );
                })}
              </div>
            </header>
          ) : (
            <div className="stay-wizard-steps-wrap">
              <div className="stay-wizard-steps stay-wizard-steps--five" role="tablist" aria-label="ขั้นตอนจองโรงแรม">
                {wizardSteps.map((step, index) => {
                  const active = stayStepIndex === index;
                  const done = index < stayStepIndex;
                  const canJump = index <= maxStepIndex;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={!canJump && !active}
                      className={`stay-wizard-step${active ? ' stay-wizard-step--active' : ''}${done ? ' stay-wizard-step--done' : ''}`}
                      onClick={() => canJump && goToStayStep(index)}
                    >
                      <span className="stay-wizard-step__num">{index + 1}</span>
                      <span className="stay-wizard-step__label">{step.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="stay-wizard-panel">
            {stayStep === 'pets' && (
              <section className={`book-card stay-pet-step${hubCheckout ? ' stay-pet-step--hub' : ''}`}>
                {!hubCheckout ? (
                  <div className="stay-pet-step__head">
                    <h2 className="h6 mb-1">เลือกสัตว์ที่ต้องการฝาก</h2>
                    <p className="small text-muted mb-0">
                      กดการ์ดเพื่อเลือก — เลือกแล้ว {petIds.length} ตัว
                      {speciesGroups.hasDog && speciesGroups.hasCat ? ' (มีทั้งสุนัขและแมว จะเลือกห้องแยกในขั้นถัดไป)' : ''}
                    </p>
                  </div>
                ) : null}
                {pets.length === 0 ? (
                  <p className="small text-muted">ยังไม่มีสัตว์ในโปรไฟล์ — เพิ่มน้องก่อนจอง</p>
                ) : (
                  <div
                    className={`stay-pet-pick${hubCheckout ? ' stay-pet-pick--hub' : ''}`}
                    role="group"
                    aria-label="เลือกสัตว์เลี้ยง"
                  >
                    {pets.map((pet) => {
                      const on = petIds.includes(pet.id);
                      return (
                        <button
                          key={pet.id}
                          type="button"
                          aria-pressed={on}
                          className={`stay-pet-pick__card${hubCheckout ? ' stay-pet-pick__card--row' : ''}${on ? ' stay-pet-pick__card--on' : ''}`}
                          onClick={() => togglePet(pet.id)}
                        >
                          {hubCheckout ? (
                            <>
                              <div className="stay-pet-pick__thumb">
                                <img src={petPhotoSrc(pet)} alt="" loading="lazy" decoding="async" />
                              </div>
                              <div className="stay-pet-pick__body">
                                <strong className="stay-pet-pick__name">{pet.name}</strong>
                                <span className="stay-pet-pick__meta">
                                  {speciesOf(pet.species).label}
                                  {pet.breed ? ` · ${pet.breed}` : ''}
                                </span>
                                <span className="stay-pet-pick__tags">
                                  {pet.weight ? <span>{pet.weight} กก.</span> : null}
                                  {pet.sex && pet.sex !== 'unknown' ? (
                                    <span>{labelOf(SEX_OPTIONS, pet.sex)}</span>
                                  ) : null}
                                </span>
                              </div>
                              <span className={`stay-pet-pick__tick${on ? ' stay-pet-pick__tick--on' : ''}`} aria-hidden>
                                {on ? <i className="bi bi-check-lg" /> : null}
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="stay-pet-pick__media">
                                <img src={petPhotoSrc(pet)} alt="" loading="lazy" decoding="async" />
                                {on ? (
                                  <span className="stay-pet-pick__check" aria-hidden>
                                    <i className="bi bi-check-lg" />
                                  </span>
                                ) : null}
                              </div>
                              <div className="stay-pet-pick__body">
                                <strong className="stay-pet-pick__name">{pet.name}</strong>
                                <span className="stay-pet-pick__meta">
                                  {speciesOf(pet.species).label}
                                  {pet.breed ? ` · ${pet.breed}` : ''}
                                </span>
                                <span className="stay-pet-pick__tags">
                                  {pet.weight ? <span>{pet.weight} กก.</span> : null}
                                  {pet.sex && pet.sex !== 'unknown' ? (
                                    <span>{labelOf(SEX_OPTIONS, pet.sex)}</span>
                                  ) : null}
                                </span>
                              </div>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className={hubCheckout ? 'stay-pet-step__foot' : undefined}>
                  <button
                    type="button"
                    className={`stay-pets-add${hubCheckout ? ' stay-pets-add--hub' : ' mt-3'}`}
                    onClick={() => setAddPetOpen(true)}
                  >
                    <i className="bi bi-plus-lg" aria-hidden />
                    {hubCheckout ? 'เพิ่มสัตว์เลี้ยงใหม่' : 'เพิ่มสัตว์เลี้ยง'}
                  </button>
                </div>
              </section>
            )}

            {stayStep === 'rooms' && (
              <section className={`book-card stay-room-step${hubCheckout ? ' stay-room-step--hub' : ''}`}>
                {!hubCheckout ? (
                  <>
                    <h2 className="h6 mb-1">เลือกประเภทและขนาดห้อง</h2>
                    <p className="small text-muted mb-3">
                      เลือกห้องทีละประเภท แล้วกดดำเนินการต่อ — จะเพิ่มในรายการและเลือกห้องถัดไปได้ในขั้นนี้
                      {roomLines.length ? ` (เลือกแล้ว ${roomLines.length} รายการ)` : ''}
                    </p>
                  </>
                ) : null}
                {catalogLoading ? <p role="status">กำลังโหลด...</p> : null}
                {roomLines.length ? (
                  <>
                    {hubCheckout ? (
                      <p className={`stay-room-lines__heading${hubRoomsComplete ? ' stay-room-lines__heading--solo' : ''}`}>
                        {hubRoomsComplete ? 'สรุปห้องที่เลือก' : 'ห้องที่เลือกแล้ว'}
                      </p>
                    ) : null}
                    <ul
                      className={`stay-room-lines stay-room-lines--summary${hubCheckout ? ' stay-room-lines--hub' : ''}${hubRoomsComplete ? ' stay-room-lines--hub-complete' : ''}`}
                    >
                      {roomLines.map((line) => {
                        const type = catalogById.get(line.roomTypeId);
                        const speciesLabel = type?.species === 'dog' ? 'สุนัข' : 'แมว';
                        return (
                          <li key={line.key} className={hubCheckout ? 'stay-room-lines__item' : undefined}>
                            {hubCheckout && type?.imageUrl ? (
                              <img
                                className="stay-room-lines__thumb"
                                src={type.imageUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                              />
                            ) : null}
                            {hubCheckout ? (
                              <div className="stay-room-lines__main">
                                <span className="stay-room-lines__kind">{speciesLabel}</span>
                                <span className="stay-room-lines__name">{type?.titleTh || line.roomTypeId}</span>
                              </div>
                            ) : (
                              <span className="stay-room-lines__name">{type?.titleTh || line.roomTypeId}</span>
                            )}
                            <label className="stay-room-lines__qty">
                              <span className="stay-room-lines__qty-label">จำนวนห้อง</span>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                className="form-control form-control-sm"
                                value={line.units}
                                onChange={(e) => updateRoomLine(line.key, { units: Number(e.target.value) || 1 })}
                              />
                            </label>
                            <button
                              type="button"
                              className={`stay-room-lines__remove${hubCheckout ? ' btn btn-outline-danger btn-sm' : ' btn btn-link btn-sm text-danger'}`}
                              onClick={() => removeRoomLine(line.key)}
                            >
                              {hubCheckout ? (
                                <>
                                  <i className="bi bi-trash" aria-hidden />
                                  ลบ
                                </>
                              ) : (
                                'ลบ'
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}
                <div className="stay-room-species-wrap">
                  {showDogRoomPick
                    ? renderRoomSpeciesBlock(
                      'dog',
                      hubCheckout ? 'ห้องสุนัข' : 'Dog Room',
                      'เลือกห้องสุนัข',
                    )
                    : null}
                  {showCatRoomPick
                    ? renderRoomSpeciesBlock(
                      'cat',
                      hubCheckout ? 'ห้องแมว' : 'Cat Room',
                      'เลือกห้องแมว',
                    )
                    : null}
                </div>
              </section>
            )}

            {stayStep === 'dates' && (
              <section className={`book-card${hubCheckout ? ' stay-dates-step--hub' : ''}`}>
                {!hubCheckout ? <h2 className="h6">วันเข้าพักและรับกลับ</h2> : null}
                <div className="book-dates">
                  <DatePicker
                    inline
                    selectsRange
                    startDate={start && isValid(start) ? start : null}
                    endDate={end && isValid(end) ? end : null}
                    onChange={(value) => {
                      const [from, to] = value || [];
                      setCheckIn(from && isValid(from) ? format(from, 'yyyy-MM-dd') : '');
                      setCheckOut(to && isValid(to) ? format(to, 'yyyy-MM-dd') : '');
                    }}
                    locale="th"
                    minDate={new Date()}
                    monthsShown={1}
                    calendarClassName="stay-range-cal"
                  />
                  <div className="book-span">
                    <div><p>เข้าพัก</p><strong>{checkIn ? formatDay(checkIn) : '—'}</strong></div>
                    <div><p>รับกลับ</p><strong>{checkOut ? formatDay(checkOut) : '—'}</strong></div>
                    <div><p>คืน</p><strong>{nights ? `${nights} คืน` : '—'}</strong></div>
                  </div>
                </div>
                {checkIn && checkOut ? (
                  <div className="stay-avail mt-2">
                    {availLoading ? <p className="small">กำลังตรวจห้องว่าง...</p> : null}
                    {roomLines.map((line) => {
                      const type = catalogById.get(line.roomTypeId);
                      const left = availMap?.get(line.roomTypeId);
                      return (
                        <p key={line.key} className={`small mb-1${left != null && line.units > left ? ' text-danger' : ''}`}>
                          {type?.titleTh}: ว่าง {left ?? '—'} ห้อง (จอง {line.units} ห้อง)
                        </p>
                      );
                    })}
                  </div>
                ) : null}
                {hubCheckout ? (
                  <div className="stay-dates-note mt-3">
                    <label className="form-label" htmlFor="stay-note-dates">
                      หมายเหตุ <span className="text-muted fw-normal">(ไม่บังคับ)</span>
                    </label>
                    <textarea
                      id="stay-note-dates"
                      className="form-control stay-dates-note__input"
                      rows={2}
                      maxLength={500}
                      placeholder="เช่น เวลารับ–ส่งน้อง หรืออาหารพิเศษ"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                ) : null}
              </section>
            )}

            {!hubCheckout && stayStep === 'assign' && (
              <section className="book-card">
                <h2 className="h6">จัดสัตว์เข้าแต่ละห้อง</h2>
                {roomLines.map((line) => {
                  const type = catalogById.get(line.roomTypeId);
                  const bucket = type?.species;
                  const pool = selectedPets.filter((pet) => petHotelSpecies(pet.species) === bucket);
                  return (
                    <div key={line.key} className="stay-assign-block">
                      <strong>{type?.titleTh} × {line.units}</strong>
                      <div className="stay-assign-pets">
                        {pool.map((pet) => {
                          const on = (line.petIds || []).includes(pet.id);
                          return (
                            <button
                              key={pet.id}
                              type="button"
                              aria-pressed={on}
                              className={`stay-assign-pet${on ? ' stay-assign-pet--on' : ''}`}
                              onClick={() => toggleAssignPet(line.key, pet.id)}
                            >
                              <span className="stay-assign-pet__thumb">
                                <img src={petPhotoSrc(pet)} alt="" loading="lazy" decoding="async" />
                              </span>
                              <span className="stay-assign-pet__name">{pet.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <label className="form-label" htmlFor="stay-note">หมายเหตุ</label>
                <textarea id="stay-note" className="form-control" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </section>
            )}

            {stayStep === 'confirm' && (
              <section className="book-card book-pay book-pay--inline">
                <h2 className="h6">{hubCheckout ? 'สรุปก่อนบันทึก' : 'สรุปการจอง'}</h2>
                <div className="stay-confirm-lines">
                  {(quote?.lines || []).map((line) => {
                    const type = catalogById.get(line.roomTypeId);
                    const names = (line.petIds || []).map((id) => pets.find((p) => p.id === id)?.name).filter(Boolean).join(', ');
                    return (
                      <div key={line.roomTypeId + line.units} className="stay-confirm-line">
                        <strong>{type?.titleTh}</strong>
                        <span>{line.units} ห้อง · {names} · {nights} คืน</span>
                        <b>{baht(line.lineSubtotal)}</b>
                      </div>
                    );
                  })}
                </div>
                <dl>
                  <div><dt>เข้าพัก</dt><dd>{formatDay(checkIn)}</dd></div>
                  <div><dt>รับกลับ</dt><dd>{formatDay(checkOut)}</dd></div>
                  <div><dt>ยอดรวม</dt><dd>{quote ? baht(quote.total) : '—'}</dd></div>
                </dl>
                {!hubCheckout ? (
                  <p className="small text-muted mb-0">ชำระค่าบริการเมื่อใช้บริการที่สาขา ไม่ต้องโอนล่วงหน้า</p>
                ) : null}
              </section>
            )}
          </div>

          <nav className="stay-wizard-nav">
            <button type="button" className="btn btn-soft" disabled={stayStepIndex <= 0} onClick={goPrevStayStep}>
              ก่อนหน้า
            </button>
            {!hubCheckout ? (
              <span className="stay-wizard-nav__status">
                ขั้นที่ {stayStepIndex + 1} / {wizardSteps.length}
              </span>
            ) : (
              <span className="stay-wizard-nav__status stay-wizard-nav__status--hub" aria-hidden />
            )}
            {isLastStayStep ? (
              <button type="submit" className="btn btn-sky" disabled={!quote || saving}>
                {hubCheckout ? 'บันทึกลงรายการ' : 'ยืนยันการจอง'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sky"
                disabled={stayStep === 'rooms' && !pendingRoomTypeId && !roomLines.length}
                onClick={goNextStayStep}
              >
                {stayStep === 'rooms' ? roomsStepNextLabel() : 'ดำเนินการต่อ'}
              </button>
            )}
          </nav>
        </form>
      </div>
      <QuickAddPetModal open={addPetOpen} onClose={() => setAddPetOpen(false)} onCreated={onPetCreated} />
      <StayRoomPreviewModal
        room={roomPreview}
        open={Boolean(roomPreview)}
        onClose={() => setRoomPreview(null)}
        onSelect={hubCheckout ? setPendingRoomTypeId : undefined}
      />
    </div>
  );
}