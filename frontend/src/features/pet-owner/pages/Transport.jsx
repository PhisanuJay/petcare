import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../usePets.js';
import PlaceFields, {
  emptyZonePlace,
  placeFromCatalog,
} from '../../pet-transport/components/PlaceFields.jsx';
import ClinicPlaceSummary from '../../pet-transport/components/ClinicPlaceSummary.jsx';
import PriceQuote, { ServiceZonesMap } from '../../pet-transport/components/PriceQuote.jsx';
import ThaiDateTimeInput, { parseThaiDateTime } from '../../pet-transport/components/ThaiDateTimeInput.jsx';
import TransportSubnav from '../../pet-transport/components/TransportSubnav.jsx';
import PlacePointChoice from '../../pet-transport/components/PlacePointChoice.jsx';
import { SERVICE_TYPES, ZONES, isRoundTrip, serviceTypeMeta } from '../../pet-transport/constants.js';
import { quotePrice } from '../../pet-transport/pricing.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import { useHotelBookings } from '../useHotelBookings.js';
import QuickAddPetModal from '../components/QuickAddPetModal.jsx';
import { petPhotoSrc, speciesOf } from '../petUtils.js';
import { scrollHubWizardIntoView } from '../hubWizardScroll.js';
import '../../pet-transport/transport.css';

const OWNER_NAV = [
  { to: '/pet-owner/transport', label: 'จองรับ–ส่ง', icon: 'bi-plus-circle', end: true },
  { to: '/pet-owner/transport/history', label: 'ประวัติการจอง', icon: 'bi-clock-history' },
];

const TRANSPORT_STEPS = [
  { id: 'service', label: 'ประเภทบริการ' },
  { id: 'pet', label: 'สัตว์เลี้ยง' },
  { id: 'places', label: 'จุดรับ–ส่ง' },
  { id: 'schedule', label: 'วันเวลา' },
  { id: 'confirm', label: 'ยืนยัน' },
];

const SPECIES_LABEL = {
  dog: 'สุนัข',
  cat: 'แมว',
  other: 'อื่น ๆ',
};

function petTypeFor(species) {
  return species === 'dog' || species === 'cat' ? species : 'other';
}

function speciesLabel(species) {
  return SPECIES_LABEL[petTypeFor(species)] ?? species ?? '';
}

function placesReady(place) {
  return Boolean(place?.zoneId && String(place.address || '').trim());
}

export default function TransportPage({
  embedded = false,
  hubCheckout = false,
  hotelBookingId: hotelBookingIdProp,
  clinicBookingId: clinicBookingIdProp,
  clinicPresetDate = '',
  clinicPresetTime = '',
  onBooked,
  onHubLine,
} = {}) {
  const { currentUser } = useAuth();
  const { pets, loading: petsLoading } = usePets();
  const { zones, clinics, createBooking } = useTransport();
  const { bookings: hotelBookings, linkRelatedBooking } = useHotelBookings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const hotelBookingId = hotelBookingIdProp ?? params.get('hotelBookingId');
  const clinicBookingId = clinicBookingIdProp ?? params.get('clinicBookingId');
  const requestedPetId = params.get('petId');

  const homeSeed = useMemo(
    () => emptyZonePlace(currentUser?.address || '', 'home'),
    [currentUser?.address],
  );
  const clinicPlace = useMemo(() => placeFromCatalog(clinics[0], 'facility'), [clinics]);

  const [serviceType, setServiceType] = useState('outbound');
  const [homePlace, setHomePlace] = useState(() => homeSeed);
  const [alternatePickup, setAlternatePickup] = useState(false);
  const [pickupCustom, setPickupCustom] = useState(() => emptyZonePlace('', 'custom'));
  const [alternateReturnTo, setAlternateReturnTo] = useState(false);
  const [returnToCustom, setReturnToCustom] = useState(() => homeSeed);
  const [petIds, setPetIds] = useState([]);
  const [petId, setPetId] = useState('');
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('dog');
  const [petNotes, setPetNotes] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [outboundTime, setOutboundTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [error, setError] = useState('');
  const [addPetOpen, setAddPetOpen] = useState(false);
  const [transportStepIndex, setTransportStepIndex] = useState(0);
  const [maxStepIndex, setMaxStepIndex] = useState(0);
  const appliedServiceType = useRef(null);
  const transportStepScrollRef = useRef(transportStepIndex);

  const transportStep = TRANSPORT_STEPS[transportStepIndex]?.id ?? 'service';
  const isLastStep = transportStepIndex === TRANSPORT_STEPS.length - 1;

  useEffect(() => {
    if (!hubCheckout) return undefined;
    if (transportStepScrollRef.current === transportStepIndex) return undefined;
    transportStepScrollRef.current = transportStepIndex;
    const id = requestAnimationFrame(() => scrollHubWizardIntoView());
    return () => cancelAnimationFrame(id);
  }, [transportStepIndex, hubCheckout]);

  useEffect(() => {
    if (!embedded && !clinicBookingId) return;
    if (clinicBookingId || clinicPresetDate) {
      setServiceType('outbound');
    }
    if (clinicPresetDate) setOutboundDate(clinicPresetDate);
    if (clinicPresetTime) setOutboundTime(clinicPresetTime);
  }, [embedded, clinicBookingId, clinicPresetDate, clinicPresetTime]);

  useEffect(() => {
    setHomePlace((prev) => ({
      ...prev,
      kind: prev.kind === 'custom' ? 'custom' : 'home',
      name: prev.kind === 'custom' ? prev.name : 'บ้าน',
      address: homeSeed.address || prev.address,
    }));
  }, [homeSeed.address]);

  function applyPetSelection(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    const selected = pets.filter((p) => unique.includes(p.id));
    setPetIds(unique);
    setPetId(unique[0] || '');
    setPetName(selected.map((p) => p.name).filter(Boolean).join(', '));
    const types = [...new Set(selected.map((p) => petTypeFor(p.species)))];
    setPetSpecies(types.length === 1 ? types[0] : 'mixed');
    const profileNotes = selected.map((p) => p.notes).filter(Boolean).join(' · ');
    if (profileNotes) setPetNotes(profileNotes);
  }

  useEffect(() => {
    if (petsLoading || pets.length === 0) return;
    if (hubCheckout) {
      const stillValid = petIds.filter((id) => pets.some((pet) => pet.id === id));
      if (stillValid.length) {
        if (stillValid.length !== petIds.length) applyPetSelection(stillValid);
        return;
      }
      const pick = pets.find((pet) => pet.id === requestedPetId) || pets[0];
      if (pick) applyPetSelection([pick.id]);
      return;
    }
    if (petId && pets.some((pet) => pet.id === petId)) return;
    const pick = pets.find((pet) => pet.id === requestedPetId) || pets[0];
    if (!pick) return;
    applyPetSelection([pick.id]);
  }, [pets, petsLoading, petId, petIds, requestedPetId, hubCheckout]);

  useEffect(() => {
    if (appliedServiceType.current === serviceType) return;
    appliedServiceType.current = serviceType;
    setAlternatePickup(false);
    setAlternateReturnTo(false);
    if (!isRoundTrip(serviceType)) {
      setReturnDate('');
      setReturnTime('');
    }
  }, [serviceType]);

  const selectedPets = useMemo(
    () => pets.filter((pet) => petIds.includes(pet.id)),
    [pets, petIds],
  );
  const selectedPet = useMemo(() => pets.find((pet) => pet.id === petId), [pets, petId]);

  const from = useMemo(() => {
    if (serviceType === 'inbound') return clinicPlace;
    return alternatePickup ? pickupCustom : homePlace;
  }, [serviceType, alternatePickup, pickupCustom, homePlace, clinicPlace]);

  const to = useMemo(() => {
    if (serviceType === 'inbound') return homePlace;
    return clinicPlace;
  }, [serviceType, homePlace, clinicPlace]);

  const returnFrom = useMemo(() => (isRoundTrip(serviceType) ? clinicPlace : null), [serviceType, clinicPlace]);

  const returnTo = useMemo(() => {
    if (!isRoundTrip(serviceType)) return null;
    return alternateReturnTo ? returnToCustom : homePlace;
  }, [serviceType, alternateReturnTo, returnToCustom, homePlace]);

  const homeReady = placesReady(homePlace);

  const estimate = useMemo(() => {
    if (!from?.zoneId || !to?.zoneId) return null;
    if (isRoundTrip(serviceType) && (!returnFrom?.zoneId || !returnTo?.zoneId)) return null;
    return quotePrice({
      fromZoneId: from.zoneId,
      toZoneId: to.zoneId,
      returnFromZoneId: returnFrom?.zoneId,
      returnToZoneId: returnTo?.zoneId,
      serviceType,
      zones,
    });
  }, [from, to, returnFrom, returnTo, serviceType, zones]);

  const serviceLabel = serviceTypeMeta(serviceType)?.label ?? serviceType;

  function onPetChange(id) {
    applyPetSelection([id]);
  }

  function toggleHubPet(id) {
    const has = petIds.includes(id);
    if (has && petIds.length <= 1) return;
    const next = has ? petIds.filter((x) => x !== id) : [...petIds, id];
    applyPetSelection(next);
  }

  function validateStep(stepId) {
    if (stepId === 'service') {
      return SERVICE_TYPES.some((s) => s.id === serviceType) ? null : 'กรุณาเลือกประเภทบริการ';
    }
    if (stepId === 'pet') {
      if (pets.length === 0) return 'กรุณาเพิ่มสัตว์เลี้ยงก่อนจองรับ–ส่ง';
      const ids = hubCheckout ? petIds : (petId ? [petId] : []);
      if (!ids.length || !ids.every((id) => pets.some((pet) => pet.id === id))) {
        return 'กรุณาเลือกสัตว์เลี้ยงอย่างน้อย 1 ตัว';
      }
      if (!petName.trim()) return 'กรุณาเลือกสัตว์เลี้ยง';
      return null;
    }
    if (stepId === 'places') {
      if (!placesReady(from) || !placesReady(to)) {
        return 'กรุณากรอกจุดรับให้ครบ (แขวง + ที่อยู่ในพื้นที่บริการ)';
      }
      if (isRoundTrip(serviceType) && !placesReady(homePlace)) {
        return 'กรุณากรอกที่อยู่หลักให้ครบ (ใช้เป็นตัวอ้างอิงส่งกลับ)';
      }
      if (isRoundTrip(serviceType) && (!placesReady(returnFrom) || !placesReady(returnTo))) {
        return 'กรุณากรอกจุดส่งกลับให้ครบ (แขวง + ที่อยู่ในพื้นที่บริการ)';
      }
      return null;
    }
    if (stepId === 'schedule') {
      if (!parseThaiDateTime(outboundDate, outboundTime)) {
        return 'กรุณาระบุวันและเวลารับเที่ยวไปให้ถูกต้อง (วว/ดด/ปปปป) และเวลาในช่วง 09:00–21:00 น.';
      }
      if (isRoundTrip(serviceType)) {
        if (!parseThaiDateTime(returnDate, returnTime)) {
          return 'กรุณาระบุวันและเวลารับกลับ (เที่ยวกลับ) ในช่วง 09:00–21:00 น.';
        }
        const outAt = new Date(parseThaiDateTime(outboundDate, outboundTime));
        const retAt = new Date(parseThaiDateTime(returnDate, returnTime));
        if (retAt < outAt) {
          return 'เวลารับกลับต้องไม่ก่อนเวลารับเที่ยวไป';
        }
      }
      return null;
    }
    if (stepId === 'confirm') {
      if (!estimate || estimate.total == null) return 'คำนวณราคาไม่สำเร็จ';
      if (
        hotelBookingId
        && !hubCheckout
        && !hotelBookings.some((booking) => booking.id === hotelBookingId)
      ) {
        return 'ไม่พบการจองโรงแรมที่ต้องการเชื่อม';
      }
      const scheduleErr = validateStep('schedule');
      if (scheduleErr) return scheduleErr;
      const placesErr = validateStep('places');
      if (placesErr) return placesErr;
      const petErr = validateStep('pet');
      if (petErr) return petErr;
      return null;
    }
    return null;
  }

  function goToStep(index) {
    if (index < 0 || index >= TRANSPORT_STEPS.length) return;
    if (index > maxStepIndex + 1) return;
    setTransportStepIndex(index);
    setError('');
  }

  function goNextStep() {
    const err = validateStep(transportStep);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    const next = transportStepIndex + 1;
    if (next < TRANSPORT_STEPS.length) {
      setTransportStepIndex(next);
      setMaxStepIndex((prev) => Math.max(prev, next));
    }
  }

  function goPrevStep() {
    setError('');
    if (transportStepIndex > 0) setTransportStepIndex(transportStepIndex - 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isLastStep) {
      goNextStep();
      return;
    }
    setError('');
    const confirmErr = validateStep('confirm');
    if (confirmErr) {
      setError(confirmErr);
      return;
    }
    const outboundPickupTime = parseThaiDateTime(outboundDate, outboundTime);
    const returnPickupTime = isRoundTrip(serviceType)
      ? parseThaiDateTime(returnDate, returnTime)
      : null;

    try {
      const { booking } = await createBooking({
        ownerId: currentUser.id,
        ownerName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        ownerPhone: currentUser.phone || '',
        petId: petId || null,
        petIds: petIds.length ? petIds : (petId ? [petId] : []),
        petName: petName.trim(),
        petSpecies: selectedPets.length
          ? (selectedPets.every((p) => p.species === selectedPets[0].species)
            ? (selectedPets[0].species || petSpecies)
            : 'mixed')
          : petSpecies,
        petBreed: selectedPets.map((p) => p.breed).filter(Boolean).join(', '),
        petNotes: petNotes.trim(),
        serviceType,
        from,
        to,
        returnFrom: isRoundTrip(serviceType) ? returnFrom : null,
        returnTo: isRoundTrip(serviceType) ? returnTo : null,
        outboundPickupTime,
        outboundDropoffTime: null,
        returnPickupTime,
        returnDropoffTime: null,
      });
      if (hotelBookingId && hotelBookings.some((row) => row.id === hotelBookingId)) {
        linkRelatedBooking(hotelBookingId, {
          kind: 'transport',
          id: booking.id,
          label: `รับ–ส่ง · ${booking.petName}`,
        });
      }
      const quoteTotal = booking.estimatedQuote?.total ?? booking.finalQuote?.total ?? estimate?.total;
      if (hubCheckout && onHubLine && quoteTotal != null) {
        onHubLine({
          category: 'transport',
          refId: booking.id,
          label: `รับ–ส่ง · ${booking.petName}`,
          detail: serviceLabel,
          total: quoteTotal,
        });
        onBooked?.(booking);
        return;
      }
      if (onBooked) {
        onBooked(booking);
        return;
      }
      navigate(`/pet-owner/transport/${booking.id}`);
    } catch (err) {
      setError(err.message || 'จองไม่สำเร็จ');
    }
  }

  const showHomePrimary = serviceType !== 'inbound';

  const homeZoneLabel = useMemo(
    () => ZONES.find((z) => z.id === homePlace.zoneId)?.label,
    [homePlace.zoneId],
  );

  const placesSection = (
    <div className="tp-places-stack">
      {!homeReady && (showHomePrimary || serviceType === 'inbound') && (
        <div className="tp-alert tp-alert--info">
          เลือกแขวงและกรอกที่อยู่ในบล็อกด้านล่าง หรือ{' '}
          <Link to="/pet-owner/profile">อัปเดตที่อยู่ในโปรไฟล์</Link>
        </div>
      )}

      {serviceType === 'inbound' ? (
        <>
          <ClinicPlaceSummary title="จุดรับ (คลินิก)" value={clinicPlace} clinics={clinics} />
          <PlaceFields
            prefix="จุดส่ง (บ้าน / ที่อยู่หลัก)"
            value={homePlace}
            onChange={setHomePlace}
            clinics={clinics}
            allowedKinds={['home', 'custom']}
            hideZoneBadge={hubCheckout}
            hubZonesMap={hubCheckout}
          />
        </>
      ) : isRoundTrip(serviceType) ? (
        <>
          <div className="tp-places-leg tp-places-leg--pickup">
            <PlacePointChoice
              title="จุดรับ (เที่ยวไป)"
              sameLabel="ที่อยู่หลัก"
              otherLabel="ที่อยู่อื่น"
              useAlternate={alternatePickup}
              onUseAlternate={setAlternatePickup}
              sameBody={(
                <PlaceFields
                  prefix="ที่อยู่รับ — เที่ยวไป"
                  value={homePlace}
                  onChange={setHomePlace}
                  clinics={clinics}
                  allowedKinds={['home', 'custom']}
                  hideZoneBadge={hubCheckout}
                  hubZonesMap={hubCheckout}
                />
              )}
              otherBody={(
                <div className="tp-place-choice__stack">
                  <PlaceFields
                    prefix="จุดรับ (ที่อยู่อื่น)"
                    value={pickupCustom}
                    onChange={setPickupCustom}
                    clinics={clinics}
                    allowedKinds={['home', 'custom']}
                    hideZoneBadge={hubCheckout}
                    hubZonesMap={hubCheckout}
                  />
                  <PlaceFields
                    prefix="ที่อยู่หลัก (อ้างอิงส่งกลับ)"
                    value={homePlace}
                    onChange={setHomePlace}
                    clinics={clinics}
                    allowedKinds={['home', 'custom']}
                    hideZoneBadge={hubCheckout}
                  />
                </div>
              )}
            />
          </div>
          <ClinicPlaceSummary
            title="คลินิก (ไป–กลับ)"
            value={clinicPlace}
            clinics={clinics}
          />
          <div className="tp-places-leg tp-places-leg--return">
            <PlacePointChoice
              title="จุดส่งกลับ (เที่ยวกลับ)"
              sameLabel="ที่อยู่เดิม"
              otherLabel="ส่งที่อื่น"
              useAlternate={alternateReturnTo}
              onUseAlternate={setAlternateReturnTo}
              sameBody={(
                <div className="tp-place-same-summary">
                  <span className="tp-place-same-summary__label">ส่งกลับที่</span>
                  <p className="tp-place-same-summary__addr mb-0">
                    {String(homePlace.address || '').trim() || 'กรอกที่อยู่หลักในส่วนรับด้านบน'}
                  </p>
                  {homeZoneLabel ? (
                    <p className="tp-muted small mb-0">{homeZoneLabel} · คลินิก → ที่อยู่หลัก</p>
                  ) : (
                    <p className="tp-muted small mb-0">เลือกแขวงที่อยู่หลักเพื่อคำนวณ Zone</p>
                  )}
                </div>
              )}
              otherBody={(
                <PlaceFields
                  prefix="จุดส่งกลับ (ที่อยู่อื่น)"
                  value={returnToCustom}
                  onChange={setReturnToCustom}
                  clinics={clinics}
                  allowedKinds={['home', 'custom']}
                  hideZoneBadge={hubCheckout}
                />
              )}
            />
          </div>
        </>
      ) : (
        <>
          <PlaceFields
            prefix="ที่อยู่รับ (บ้าน)"
            value={homePlace}
            onChange={setHomePlace}
            clinics={clinics}
            allowedKinds={['home', 'custom']}
            hideZoneBadge={hubCheckout}
            hubZonesMap={hubCheckout}
          />
          <ClinicPlaceSummary title="ปลายทาง (คลินิก)" value={clinicPlace} clinics={clinics} />
        </>
      )}
    </div>
  );

  return (
    <>
      <div className={embedded ? 'tp-page--embedded' : 'page-wrap'}>
        <div className={embedded ? '' : 'container'}>
          <section className={`tp-page${embedded && hubCheckout ? ' tp-page--hub' : ''}`}>
            {!embedded && (
              <div className="tp-page-head">
                <h1>บริการรับ–ส่งสัตว์เลี้ยง</h1>
                <p className="tp-lead">
                  ทำทีละขั้น — เลือกบริการ กรอกข้อมูล แล้วยืนยันการจอง
                </p>
              </div>
            )}
            {embedded && !hubCheckout ? <h2 className="h5 mb-2">รับ–ส่งสัตว์เลี้ยง</h2> : null}
            {!embedded && <TransportSubnav items={OWNER_NAV} />}
            {!hubCheckout && clinicBookingId && (
              <div className="tp-alert tp-alert--info">
                กำลังจองรับ–ส่งสำหรับนัดรักษาที่คลินิก — ปลายทางตั้งเป็นคลินิกให้แล้ว
              </div>
            )}
            {!hubCheckout && hotelBookingId && (
              <div className="tp-alert tp-alert--info">
                กำลังเพิ่มบริการรับ–ส่งให้การจองโรงแรมนี้{' '}
                <Link to={`/pet-owner/cat-hotel/bookings/${hotelBookingId}`}>กลับรายละเอียดโรงแรม</Link>
              </div>
            )}

            <form className="tp-form" onSubmit={handleSubmit}>
              {error && <div className="tp-alert tp-alert--danger">{error}</div>}

              <div className="tp-wizard-steps-wrap">
                <div className="tp-wizard-steps" role="tablist" aria-label="ขั้นตอนจองรับส่ง">
                  {TRANSPORT_STEPS.map((step, index) => {
                    const active = transportStepIndex === index;
                    const done = index < transportStepIndex;
                    const canJump = index <= maxStepIndex;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        disabled={!canJump && !active}
                        className={`tp-wizard-step${active ? ' tp-wizard-step--active' : ''}${done ? ' tp-wizard-step--done' : ''}`}
                        onClick={() => canJump && goToStep(index)}
                      >
                        <span className="tp-wizard-step__num">{index + 1}</span>
                        <span className="tp-wizard-step__label">{step.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="tp-wizard-panel">
                {transportStep === 'service' && (
                  <div className="tp-card">
                    <h3>ประเภทบริการ</h3>
                    <div className="tp-service-cards" role="radiogroup" aria-label="ประเภทบริการ">
                      {SERVICE_TYPES.map((s) => {
                        const active = serviceType === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={`tp-service-card ${active ? 'is-active' : ''}`}
                            onClick={() => setServiceType(s.id)}
                          >
                            <span className="tp-service-card__icon"><i className={`bi ${s.icon}`} /></span>
                            <span className="tp-service-card__label">{s.label}</span>
                            <span className="tp-service-card__hint">{s.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {transportStep === 'pet' && (
                  <div className="tp-card">
                    <h3>รายละเอียดการจอง</h3>
                    <div className="field">
                      <span className="tp-field-label" id="tp-pet-step-label">สัตว์เลี้ยง</span>
                      {petsLoading ? (
                        <p className="tp-muted small mb-0">กำลังโหลดรายชื่อสัตว์เลี้ยง…</p>
                      ) : hubCheckout ? (
                        <div className="tp-transport-pet-step" aria-labelledby="tp-pet-step-label">
                          <p className="tp-muted small tp-transport-pet-step__lead mb-0">
                            เลือกจากโปรไฟล์ได้หลายตัว หรือลงประวัติสัตว์ที่ยังไม่เคยบันทึก
                          </p>
                          {pets.length > 0 ? (
                            <div
                              className="stay-pet-pick stay-pet-pick--hub tp-transport-pet-pick"
                              role="group"
                              aria-labelledby="tp-pet-step-label"
                            >
                              {pets.map((pet) => {
                                const on = petIds.includes(pet.id);
                                return (
                                  <button
                                    key={pet.id}
                                    type="button"
                                    aria-pressed={on}
                                    className={`stay-pet-pick__card stay-pet-pick__card--row${on ? ' stay-pet-pick__card--on' : ''}`}
                                    onClick={() => toggleHubPet(pet.id)}
                                  >
                                    <div className="stay-pet-pick__thumb">
                                      <img src={petPhotoSrc(pet)} alt="" loading="lazy" decoding="async" />
                                    </div>
                                    <div className="stay-pet-pick__body">
                                      <strong className="stay-pet-pick__name">{pet.name}</strong>
                                      <span className="stay-pet-pick__meta">
                                        {speciesOf(pet.species).label}
                                        {pet.breed ? ` · ${pet.breed}` : ''}
                                      </span>
                                    </div>
                                    <span className={`stay-pet-pick__tick${on ? ' stay-pet-pick__tick--on' : ''}`} aria-hidden>
                                      {on ? <i className="bi bi-check-lg" /> : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="tp-muted small mb-0">ยังไม่มีสัตว์ในโปรไฟล์ — ลงประวัติด้านล่างก่อนจอง</p>
                          )}
                          {pets.length > 0 ? (
                            <p className="form-text text-muted mb-0 tp-transport-pet-step__count">
                              เลือกแล้ว <strong>{petIds.length}</strong> ตัว
                              {selectedPets.length ? (
                                <span className="tp-transport-pet-step__names">
                                  {' — '}
                                  {selectedPets.map((p) => p.name).join(', ')}
                                </span>
                              ) : null}
                            </p>
                          ) : null}
                          <div className="tp-transport-pet-step__foot">
                            <button
                              type="button"
                              className="stay-pets-add stay-pets-add--hub"
                              onClick={() => setAddPetOpen(true)}
                            >
                              <i className="bi bi-plus-lg" aria-hidden />
                              ลงประวัติสัตว์ใหม่ (ยังไม่เคยมีในระบบ)
                            </button>
                          </div>
                        </div>
                      ) : pets.length === 0 ? (
                        <div className="tp-pet-empty">
                          <p className="tp-muted mb-2">ยังไม่มีสัตว์เลี้ยงในระบบ — ลงประวัติก่อนจึงจะจองรับ–ส่งได้</p>
                          <button type="button" className="btn btn-sky btn-sm" onClick={() => setAddPetOpen(true)}>
                            <i className="bi bi-plus-lg me-1" />
                            ลงประวัติสัตว์ใหม่
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="tp-pet-row">
                            <select id="pet" value={petId} onChange={(e) => onPetChange(e.target.value)}>
                              {pets.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                  {p.breed ? ` · ${p.breed}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn btn-soft btn-sm tp-pet-row__add"
                              title="ลงประวัติสัตว์ที่ยังไม่เคยมีในระบบ"
                              onClick={() => setAddPetOpen(true)}
                            >
                              <i className="bi bi-plus-lg" aria-hidden />
                              <span>ลงประวัติใหม่</span>
                            </button>
                          </div>
                          {selectedPet && (
                            <p className="tp-muted small mt-2 mb-0">
                              {speciesLabel(selectedPet.species)}
                              {selectedPet.breed ? ` · ${selectedPet.breed}` : ''}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="field">
                      <label htmlFor="notes">หมายเหตุสัตว์เลี้ยง</label>
                      <textarea id="notes" rows={2} value={petNotes} onChange={(e) => setPetNotes(e.target.value)} />
                    </div>
                  </div>
                )}

                {transportStep === 'places' && placesSection}

                {transportStep === 'schedule' && (
                  <div className={`tp-card${hubCheckout ? ' tp-card--schedule' : ''}`}>
                    <h3>{isRoundTrip(serviceType) ? 'วันและเวลา · ไป–กลับ' : 'วันและเวลารับ'}</h3>
                    <div className="tp-schedule-legs">
                      <section className="tp-schedule-leg" aria-labelledby="tp-leg-out-label">
                        <h4 className="tp-schedule-leg__title" id="tp-leg-out-label">
                          {isRoundTrip(serviceType) ? 'เที่ยวไป · รับที่บ้าน' : 'รับสัตว์'}
                        </h4>
                        <ThaiDateTimeInput
                          id="out-pick"
                          date={outboundDate}
                          time={outboundTime}
                          onDateChange={setOutboundDate}
                          onTimeChange={setOutboundTime}
                          dateLabel="วันที่รับ"
                          timeLabel="เวลารับ"
                          summaryLabel="นัดรับ"
                          variant={hubCheckout ? 'comfortable' : 'default'}
                        />
                      </section>
                      {isRoundTrip(serviceType) ? (
                        <section className="tp-schedule-leg tp-schedule-leg--return" aria-labelledby="tp-leg-ret-label">
                          <h4 className="tp-schedule-leg__title" id="tp-leg-ret-label">
                            เที่ยวกลับ · รับกลับที่จุดส่ง
                          </h4>
                          <p className="tp-schedule-leg__hint tp-muted small mb-0">
                            มักเป็นวันหลังคลินิก/ฝากเสร็จ — เลือกวันเวลาที่ต้องการให้รถมารับกลับ
                          </p>
                          <ThaiDateTimeInput
                            id="ret-pick"
                            date={returnDate}
                            time={returnTime}
                            onDateChange={setReturnDate}
                            onTimeChange={setReturnTime}
                            dateLabel="วันที่รับกลับ"
                            timeLabel="เวลารับกลับ"
                            summaryLabel="นัดรับกลับ"
                            variant={hubCheckout ? 'comfortable' : 'default'}
                          />
                        </section>
                      ) : null}
                    </div>
                  </div>
                )}

                {transportStep === 'confirm' && (
                  <>
                    <div className="tp-confirm-summary">
                      <div className="tp-confirm-summary__row">
                        <span>บริการ</span>
                        <strong>{serviceLabel}</strong>
                      </div>
                      <div className="tp-confirm-summary__row">
                        <span>สัตว์เลี้ยง</span>
                        <strong>{petName || '—'}</strong>
                      </div>
                      <div className="tp-confirm-summary__row">
                        <span>{isRoundTrip(serviceType) ? 'รับเที่ยวไป' : 'วันรับ'}</span>
                        <strong>
                          {outboundDate && outboundTime
                            ? `${outboundDate} ${outboundTime} น.`
                            : '—'}
                        </strong>
                      </div>
                      {isRoundTrip(serviceType) ? (
                        <div className="tp-confirm-summary__row">
                          <span>รับเที่ยวกลับ</span>
                          <strong>
                            {returnDate && returnTime
                              ? `${returnDate} ${returnTime} น.`
                              : '—'}
                          </strong>
                        </div>
                      ) : null}
                      <div className="tp-confirm-summary__row">
                        <span>ที่อยู่หลัก</span>
                        <strong className="text-end" style={{ maxWidth: '60%' }}>
                          {homePlace.address?.trim() || '—'}
                        </strong>
                      </div>
                    </div>
                    <PriceQuote quote={estimate} title="สรุปค่ารถ (ก่อนยืนยัน)" />
                    {!hubCheckout ? (
                      <details className="tp-zones-details">
                        <summary>ดูแผนเขต Zone ค่ารถ</summary>
                        <ServiceZonesMap />
                      </details>
                    ) : null}
                    {!embedded && serviceType !== 'inbound' && (
                      <p className="tp-muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                        หลังยืนยันการจอง สามารถเพิ่มบริการคลินิก/โรงแรมได้ในหน้ารายละเอียด
                      </p>
                    )}
                  </>
                )}
              </div>

              <nav className="tp-wizard-nav" aria-label="นำทางขั้นตอนรับส่ง">
                <button
                  type="button"
                  className="btn btn-soft"
                  disabled={transportStepIndex <= 0}
                  onClick={goPrevStep}
                >
                  <i className="bi bi-chevron-left me-1" />
                  ก่อนหน้า
                </button>
                <span className="tp-wizard-nav__status">
                  ขั้นที่ {transportStepIndex + 1} / {TRANSPORT_STEPS.length} · {TRANSPORT_STEPS[transportStepIndex].label}
                </span>
                {isLastStep ? (
                  <button type="submit" className="btn btn-sky">
                    <i className="bi bi-check2 me-1" />
                    ยืนยันการจอง
                  </button>
                ) : (
                  <button type="button" className="btn btn-sky" onClick={goNextStep}>
                    ดำเนินการต่อ
                    <i className="bi bi-chevron-right ms-1" />
                  </button>
                )}
              </nav>

              {!embedded && isLastStep && (
                <div className="tp-actions" style={{ marginTop: '0.75rem' }}>
                  <Link className="btn btn-soft" to="/pet-owner/transport/history">
                    ดูประวัติ
                  </Link>
                </div>
              )}
            </form>
          </section>
        </div>
      </div>
      <QuickAddPetModal
        open={addPetOpen}
        onClose={() => setAddPetOpen(false)}
        onCreated={(pet) => {
          if (hubCheckout) {
            applyPetSelection(petIds.includes(pet.id) ? petIds : [...petIds, pet.id]);
          } else {
            onPetChange(pet.id);
          }
        }}
        title="ลงประวัติสัตว์เลี้ยงใหม่"
        lead="สำหรับน้องที่ยังไม่เคยบันทึกในโปรไฟล์ — หลังบันทึกจะติ๊กเลือกในรายการให้อัตโนมัติ"
      />
    </>
  );
}