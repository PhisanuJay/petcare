import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../usePets.js';
import PlaceFields, {
  emptyZonePlace,
  placeFromCatalog,
} from '../../pet-transport/components/PlaceFields.jsx';
import PriceQuote, { ServiceZonesMap } from '../../pet-transport/components/PriceQuote.jsx';
import ThaiDateTimeInput, { parseThaiDateTime } from '../../pet-transport/components/ThaiDateTimeInput.jsx';
import TransportSubnav from '../../pet-transport/components/TransportSubnav.jsx';
import { SERVICE_TYPES, isRoundTrip } from '../../pet-transport/constants.js';
import { quotePrice } from '../../pet-transport/pricing.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import { useHotelBookings } from '../useHotelBookings.js';
import '../../pet-transport/transport.css';

const OWNER_NAV = [
  { to: '/pet-owner/transport', label: 'จองรับ–ส่ง', icon: 'bi-plus-circle', end: true },
  { to: '/pet-owner/transport/history', label: 'ประวัติการจอง', icon: 'bi-clock-history' },
  { to: '/pet-owner/transport/requests', label: 'คำขอรับ-ส่ง', icon: 'bi-truck' },
];

const PET_TYPES = [
  { id: 'dog', label: 'สุนัข' },
  { id: 'cat', label: 'แมว' },
  { id: 'other', label: 'อื่น ๆ' },
];

function petTypeFor(species) {
  return species === 'dog' || species === 'cat' ? species : 'other';
}

function clonePlace(place) {
  return place ? { ...place } : emptyZonePlace('');
}

function placesReady(place) {
  return Boolean(place?.zoneId && String(place.address || '').trim());
}

export default function TransportPage() {
  const { currentUser } = useAuth();
  const { pets, loading: petsLoading } = usePets();
  const { zones, clinics, createBooking } = useTransport();
  const { bookings: hotelBookings, linkRelatedBooking } = useHotelBookings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const hotelBookingId = params.get('hotelBookingId');
  const requestedPetId = params.get('petId');

  const homeSeed = useMemo(
    () => emptyZonePlace(currentUser?.address || '', 'home'),
    [currentUser?.address],
  );
  const facilitySeed = useMemo(() => placeFromCatalog(clinics[0], 'facility'), [clinics]);

  const [serviceType, setServiceType] = useState('outbound');
  const [petId, setPetId] = useState('');
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('dog');
  const [petNotes, setPetNotes] = useState('');
  const [from, setFrom] = useState(() => homeSeed);
  const [to, setTo] = useState(() => facilitySeed);
  const [returnFrom, setReturnFrom] = useState(() => facilitySeed);
  const [returnTo, setReturnTo] = useState(() => homeSeed);
  const [returnEdited, setReturnEdited] = useState(false);
  const [outboundDate, setOutboundDate] = useState('');
  const [outboundTime, setOutboundTime] = useState('');
  const [error, setError] = useState('');
  const [fromTouched, setFromTouched] = useState(false);
  const appliedServiceType = useRef(null);
  const initializedPetsFor = useRef(null);

  useEffect(() => {
    if (petsLoading || initializedPetsFor.current === currentUser?.id) return;
    initializedPetsFor.current = currentUser?.id;
    const firstPet = pets.find((pet) => pet.id === requestedPetId) || pets[0];
    setPetId(firstPet?.id || '');
    setPetName(firstPet?.name || '');
    setPetSpecies(petTypeFor(firstPet?.species || 'dog'));
  }, [currentUser?.id, pets, petsLoading, requestedPetId]);

  const typedPets = pets.filter((pet) => petTypeFor(pet.species) === petSpecies);

  // Apply defaults once per service type — never fight user edits on จุดรับ
  useEffect(() => {
    if (appliedServiceType.current === serviceType) return;
    appliedServiceType.current = serviceType;
    setFromTouched(false);

    if (serviceType === 'outbound') {
      setFrom(homeSeed);
      setTo(facilitySeed);
    } else if (serviceType === 'inbound') {
      setFrom(facilitySeed);
      setTo(homeSeed);
    } else {
      setFrom(homeSeed);
      setTo(facilitySeed);
      setReturnFrom(facilitySeed);
      setReturnTo(homeSeed);
      setReturnEdited(false);
    }
  }, [serviceType, homeSeed, facilitySeed]);

  // Fill locked clinic side when catalog loads (do not overwrite user-edited pickup)
  useEffect(() => {
    if (!facilitySeed?.refId && !facilitySeed?.address) return;
    const sameFacility = (place) =>
      place?.kind === 'facility' && place?.refId === facilitySeed.refId;

    if (serviceType === 'outbound' || isRoundTrip(serviceType)) {
      setTo((prev) => (sameFacility(prev) ? prev : facilitySeed));
    }
    if (serviceType === 'inbound' && !fromTouched) {
      setFrom((prev) => (sameFacility(prev) ? prev : facilitySeed));
    }
    if (isRoundTrip(serviceType) && !returnEdited) {
      setReturnFrom((prev) => (sameFacility(prev) ? prev : facilitySeed));
    }
  }, [facilitySeed, serviceType, returnEdited, fromTouched]);

  useEffect(() => {
    if (!isRoundTrip(serviceType) || returnEdited) return;
    setReturnFrom(clonePlace(to));
    setReturnTo(clonePlace(from));
  }, [from, to, serviceType, returnEdited]);

  function onFromChange(next) {
    setFromTouched(true);
    setFrom(next);
  }

  const estimate = useMemo(() => {
    if (!from.zoneId || !to.zoneId) return null;
    if (isRoundTrip(serviceType) && (!returnFrom.zoneId || !returnTo.zoneId)) return null;
    return quotePrice({
      fromZoneId: from.zoneId,
      toZoneId: to.zoneId,
      returnFromZoneId: returnFrom.zoneId,
      returnToZoneId: returnTo.zoneId,
      serviceType,
      zones,
    });
  }, [from.zoneId, to.zoneId, returnFrom.zoneId, returnTo.zoneId, serviceType, zones]);

  function onPetChange(id) {
    setPetId(id);
    const pet = pets.find((p) => p.id === id);
    setPetName(pet?.name || '');
    if (pet) setPetSpecies(petTypeFor(pet.species));
  }

  function onPetTypeChange(type) {
    setPetSpecies(type);
    const pet = pets.find((item) => petTypeFor(item.species) === type);
    setPetId(pet?.id || '');
    setPetName(pet?.name || '');
  }

  function onReturnFromChange(next) {
    setReturnEdited(true);
    setReturnFrom(next);
  }

  function onReturnToChange(next) {
    setReturnEdited(true);
    setReturnTo(next);
  }

  function resetReturnSwap() {
    setReturnEdited(false);
    setReturnFrom(clonePlace(to));
    setReturnTo(clonePlace(from));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!petName.trim()) return setError('กรุณาระบุชื่อสัตว์เลี้ยง');
    if (!placesReady(from) || !placesReady(to)) {
      return setError('กรุณากรอกจุดรับและจุดส่งให้ครบ (แขวงหรือสถานที่ในระบบ + ที่อยู่)');
    }
    if (isRoundTrip(serviceType) && (!placesReady(returnFrom) || !placesReady(returnTo))) {
      return setError('กรุณากรอกจุดรับ–ส่งเที่ยวกลับให้ครบ');
    }
    if (!estimate || estimate.total == null) {
      return setError('คำนวณราคาไม่สำเร็จ');
    }
    if (petId && !pets.some((pet) => pet.id === petId)) {
      return setError('กรุณาเลือกสัตว์เลี้ยงอีกครั้ง');
    }
    const outboundPickupTime = parseThaiDateTime(outboundDate, outboundTime);
    if (!outboundPickupTime) {
      return setError('กรุณาระบุวันและเวลารับให้ถูกต้อง (วว/ดด/ปปปป) และเวลาในช่วง 09:00–21:00 น.');
    }
    if (hotelBookingId && !hotelBookings.some((booking) => booking.id === hotelBookingId)) {
      return setError('ไม่พบการจองโรงแรมที่ต้องการเชื่อม');
    }

    try {
      const { booking } = await createBooking({
        ownerId: currentUser.id,
        ownerName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        ownerPhone: currentUser.phone || '',
        petId: petId || null,
        petName: petName.trim(),
        petSpecies: pets.find((pet) => pet.id === petId)?.species || petSpecies,
        petBreed: pets.find((pet) => pet.id === petId)?.breed || '',
        petNotes: petNotes.trim(),
        serviceType,
        from,
        to,
        returnFrom: isRoundTrip(serviceType) ? returnFrom : null,
        returnTo: isRoundTrip(serviceType) ? returnTo : null,
        outboundPickupTime,
        outboundDropoffTime: null,
        returnPickupTime: null,
        returnDropoffTime: null,
      });
      if (hotelBookingId) {
        linkRelatedBooking(hotelBookingId, {
          kind: 'transport',
          id: booking.id,
          label: `รับ–ส่ง · ${booking.petName}`,
        });
      }
      navigate(`/pet-owner/transport/${booking.id}`);
    } catch (err) {
      setError(err.message || 'จองไม่สำเร็จ');
    }
    return undefined;
  }

  const fromLabel = serviceType === 'inbound' ? 'จุดรับ (คลินิก)' : 'จุดรับ (บ้าน / ต้นทาง)';
  const toLabel = serviceType === 'inbound' ? 'จุดส่งกลับบ้าน' : 'จุดส่ง (คลินิก)';
  const lockOutboundTo = serviceType === 'outbound' || isRoundTrip(serviceType);
  const lockInboundFrom = serviceType === 'inbound';
  const lockReturnFrom = isRoundTrip(serviceType);

  return (
    <div className="page-wrap">
      <div className="container">
        <section className="tp-page">
          <div className="tp-page-head">
            <h1>บริการรับ–ส่งสัตว์เลี้ยง</h1>
            <p className="tp-lead">
              เลือกประเภทบริการ แล้วกรอกจุดรับ–ส่งในเขตจตุจักร 4 แขวง ระบบคำนวณค่ารถตาม Zone อัตโนมัติ
            </p>
          </div>
          <TransportSubnav items={OWNER_NAV} />
          {hotelBookingId && (
            <div className="tp-alert tp-alert--info">
              กำลังเพิ่มบริการรับ–ส่งให้การจองโรงแรมนี้{' '}
              <Link to={`/pet-owner/cat-hotel/bookings/${hotelBookingId}`}>กลับรายละเอียดโรงแรม</Link>
            </div>
          )}

          <form className="tp-form" onSubmit={handleSubmit}>
            {error && <div className="tp-alert tp-alert--danger">{error}</div>}

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

            <div className="tp-grid tp-grid--2" style={{ marginTop: '1rem' }}>
              <div className="tp-card">
                <h3>รายละเอียดการจอง</h3>
                <div className="field">
                  <label htmlFor="pet">สัตว์เลี้ยง</label>
                  {!petsLoading && (
                    <div className="d-flex flex-wrap gap-2 mb-2" role="group" aria-label="ประเภทสัตว์เลี้ยง">
                      {PET_TYPES.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          className={`btn btn-sm ${petSpecies === type.id ? 'btn-sky' : 'btn-soft'}`}
                          aria-pressed={petSpecies === type.id}
                          onClick={() => onPetTypeChange(type.id)}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {petsLoading ? (
                    <select id="pet" disabled value="">
                      <option value="">กำลังโหลดรายชื่อสัตว์เลี้ยง…</option>
                    </select>
                  ) : typedPets.length ? (
                    <select id="pet" value={petId} onChange={(e) => onPetChange(e.target.value)}>
                      {typedPets.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="pet"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder="ชื่อสัตว์เลี้ยง"
                    />
                  )}
                  {!petsLoading && !typedPets.length && (
                    <p className="tp-muted">
                      ยังไม่มี{PET_TYPES.find((type) => type.id === petSpecies)?.label}ในรายการ — <Link to="/pet-owner/my-pets/new">เพิ่มสัตว์เลี้ยง</Link> หรือระบุชื่อเอง
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="notes">หมายเหตุสัตว์เลี้ยง</label>
                  <textarea id="notes" rows={2} value={petNotes} onChange={(e) => setPetNotes(e.target.value)} />
                </div>
              </div>

              <ServiceZonesMap />
            </div>

            <div className="tp-grid tp-grid--2" style={{ marginTop: '1rem' }}>
              <PlaceFields
                prefix={isRoundTrip(serviceType) ? 'เที่ยวไป · จุดรับ' : fromLabel}
                value={from}
                onChange={onFromChange}
                clinics={clinics}
                allowedKinds={lockInboundFrom ? ['facility'] : ['home', 'custom']}
                locked={lockInboundFrom}
              />
              <PlaceFields
                prefix={isRoundTrip(serviceType) ? 'เที่ยวไป · จุดส่ง (คลินิก)' : toLabel}
                value={to}
                onChange={setTo}
                clinics={clinics}
                allowedKinds={lockOutboundTo ? ['facility'] : ['home', 'custom']}
                locked={lockOutboundTo}
              />
            </div>

            {isRoundTrip(serviceType) && (
              <div style={{ marginTop: '1rem' }}>
                <div className="tp-round-toolbar">
                  <h3 style={{ margin: 0 }}>เที่ยวกลับ (สลับจากเที่ยวไปเป็นค่าเริ่มต้น)</h3>
                  <button type="button" className="btn btn-soft btn-sm" onClick={resetReturnSwap}>
                    รีเซ็ตเป็นสลับอัตโนมัติ
                  </button>
                </div>
                <div className="tp-grid tp-grid--2" style={{ marginTop: '0.75rem' }}>
                  <PlaceFields
                    prefix="เที่ยวกลับ · จุดรับ (คลินิก)"
                    value={returnFrom}
                    onChange={onReturnFromChange}
                    clinics={clinics}
                    allowedKinds={['facility']}
                    locked={lockReturnFrom}
                  />
                  <PlaceFields
                    prefix="เที่ยวกลับ · จุดส่ง"
                    value={returnTo}
                    onChange={onReturnToChange}
                    clinics={clinics}
                    allowedKinds={['home', 'custom']}
                  />
                </div>
              </div>
            )}

            <div className="tp-card" style={{ marginTop: '1rem' }}>
              <h3>{isRoundTrip(serviceType) ? 'วันและเวลารับ · เที่ยวไป' : 'วันและเวลารับ'}</h3>
              <ThaiDateTimeInput
                id="out-pick"
                date={outboundDate}
                time={outboundTime}
                onDateChange={setOutboundDate}
                onTimeChange={setOutboundTime}
              />
              {isRoundTrip(serviceType) && (
                <p className="tp-muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  เที่ยวกลับยังไม่ระบุวันเวลา เพราะเวลากลับยังไม่แน่นอน — นัดหมายภายหลังได้
                </p>
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <PriceQuote quote={estimate} title="สรุปค่ารถ (ก่อนยืนยัน)" />
              {serviceType !== 'inbound' && (
                <p className="tp-muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                  หลังยืนยันการจอง สามารถเพิ่มบริการคลินิก/โรงแรมได้ในหน้ารายละเอียด
                </p>
              )}
            </div>

            <div className="tp-actions">
              <button type="submit" className="btn btn-sky">
                <i className="bi bi-check2" />
                ยืนยันการจอง
              </button>
              <Link className="btn btn-soft" to="/pet-owner/transport/history">
                ดูประวัติ
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
