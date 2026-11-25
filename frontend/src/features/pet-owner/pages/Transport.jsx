<<<<<<< HEAD
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../usePets.js';
import PlaceFields, {
  emptyZonePlace,
  mergeFacilities,
  placeFromCatalog,
} from '../../pet-transport/components/PlaceFields.jsx';
import PriceQuote, { ServiceZonesMap } from '../../pet-transport/components/PriceQuote.jsx';
import ThaiDateTimeInput, { parseThaiDateTime } from '../../pet-transport/components/ThaiDateTimeInput.jsx';
import TransportSubnav from '../../pet-transport/components/TransportSubnav.jsx';
import { SERVICE_TYPES, isRoundTrip } from '../../pet-transport/constants.js';
import { quotePrice } from '../../pet-transport/pricing.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import { createPayment, PAY_KIND } from '../../payments/store.js';
import '../../pet-transport/transport.css';

const OWNER_NAV = [
  { to: '/pet-owner/transport', label: 'จองรับ–ส่ง', icon: 'bi-plus-circle', end: true },
  { to: '/pet-owner/transport/history', label: 'ประวัติการจอง', icon: 'bi-clock-history' },
];

function clonePlace(place) {
  return place ? { ...place } : emptyZonePlace('');
}

function placesReady(place) {
  return Boolean(place?.zoneId && String(place.address || '').trim());
}

export default function TransportPage() {
  const { currentUser } = useAuth();
  const { pets } = usePets();
  const { zones, clinics, hotels, createBooking } = useTransport();
  const navigate = useNavigate();

  const homeSeed = useMemo(
    () => emptyZonePlace(currentUser?.address || '', 'home'),
    [currentUser?.address],
  );
  const facilitySeed = useMemo(() => {
    const list = mergeFacilities(clinics, hotels);
    return placeFromCatalog(list[0], 'facility');
  }, [clinics, hotels]);

  const [serviceType, setServiceType] = useState('outbound');
  const [petId, setPetId] = useState(pets[0]?.id || '');
  const [petName, setPetName] = useState(pets[0]?.name || '');
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
    const outboundPickupTime = parseThaiDateTime(outboundDate, outboundTime);
    if (!outboundPickupTime) {
      return setError('กรุณาระบุวันและเวลารับให้ถูกต้อง (วว/ดด/ปปปป) และเวลาในช่วง 09:00–21:00 น.');
    }

    try {
      const { booking } = await createBooking({
        ownerId: currentUser.id,
        ownerName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        ownerPhone: currentUser.phone || '',
        petId: petId || null,
        petName: petName.trim(),
        petSpecies: pets.find((pet) => pet.id === petId)?.species || '',
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
      const payment = createPayment({
        kind: PAY_KIND.transport,
        refId: booking.id,
        ownerId: currentUser.id,
        ownerName: booking.ownerName,
        email: currentUser.email,
        title: 'รับ–ส่งสัตว์',
        detail: `${booking.petName} · ${SERVICE_TYPES.find((item) => item.id === booking.serviceType)?.label || booking.serviceType}`,
        total: booking.estimatedQuote?.total,
      });
      navigate(`/pet-owner/pay/${payment.id}`);
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
                  {pets.length ? (
                    <select id="pet" value={petId} onChange={(e) => onPetChange(e.target.value)}>
                      {pets.map((p) => (
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
                  {!pets.length && (
                    <p className="tp-muted">
                      ยังไม่มีสัตว์ในระบบ — <Link to="/pet-owner/my-pets/new">เพิ่มสัตว์เลี้ยง</Link> หรือกรอกชื่อเอง
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
                hotels={hotels}
                allowedKinds={lockInboundFrom ? ['facility'] : ['home', 'custom']}
                locked={lockInboundFrom}
              />
              <PlaceFields
                prefix={isRoundTrip(serviceType) ? 'เที่ยวไป · จุดส่ง (คลินิก)' : toLabel}
                value={to}
                onChange={setTo}
                clinics={clinics}
                hotels={hotels}
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
                    hotels={hotels}
                    allowedKinds={['facility']}
                    locked={lockReturnFrom}
                  />
                  <PlaceFields
                    prefix="เที่ยวกลับ · จุดส่ง"
                    value={returnTo}
                    onChange={onReturnToChange}
                    clinics={clinics}
                    hotels={hotels}
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
=======
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../usePets.js';
import { useTransportRequests } from '../useTransportRequests.js';
import { TRANSPORT_DIRECTIONS, TRANSPORT_STATUS } from '../transportOptions.js';
import { CLINIC_PHONE, availableSlots, todayString } from '../bookingOptions.js';
import { formatDate } from '../petUtils.js';

/**
 * Transport — Role: Pet Owner (มะแอ่ว)
 * Request pickup / drop-off of a pet and manage existing requests.
 * Saved by the backend (/api/pet-owner/transport/requests); status starts as "pending"
 * until the transport team confirms it. The fee is not defined yet, so none is shown.
 */

function TransportForm({ pets, user, onSubmit }) {
  const [form, setForm] = useState({
    petId: pets[0]?.id ?? '',
    direction: 'round_trip',
    date: '',
    time: '',
    address: user?.address ?? '',
    phone: user?.phone ?? '',
    note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const slots = availableSlots(form.date);
  const direction = TRANSPORT_DIRECTIONS.find((d) => d.value === form.direction);

  const set = (key) => (e) => {
    setDone(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  // Opening hours differ between weekdays and weekends, so a chosen time may no longer exist.
  const setDate = (e) => {
    const date = e.target.value;
    setDone(false);
    setForm((f) => ({ ...f, date, time: availableSlots(date).includes(f.time) ? f.time : '' }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date) return setError('กรุณาเลือกวันที่');
    if (!form.time) return setError('กรุณาเลือกเวลา');
    if (form.address.trim().length < 10) return setError('กรุณากรอกที่อยู่ให้ละเอียด');
    if (!/^0\d{8,9}$/.test(form.phone.replace(/[-\s]/g, ''))) return setError('เบอร์โทร 9-10 หลัก ขึ้นต้นด้วย 0');
    setSaving(true);
    setError('');
    try {
      await onSubmit(form);
      setForm((f) => ({ ...f, date: '', time: '', note: '' }));
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card-soft" onSubmit={handleSubmit}>
      <div className="section-label">
        <i className="bi bi-truck" />
        เรียกบริการรับ-ส่ง
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {done && <div className="alert alert-success py-2">ส่งคำขอแล้ว รอทีมงานติดต่อกลับเพื่อยืนยัน</div>}

      <div className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="tr-pet">สัตว์เลี้ยง</label>
          <select id="tr-pet" className="form-select" value={form.petId} onChange={set('petId')}>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="tr-dir">รูปแบบ</label>
          <select id="tr-dir" className="form-select" value={form.direction} onChange={set('direction')}>
            {TRANSPORT_DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {direction && <div className="form-text">{direction.desc}</div>}
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="tr-date">วันที่</label>
          <input
            id="tr-date"
            type="date"
            className="form-control"
            min={todayString()}
            value={form.date}
            onChange={setDate}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="tr-time">เวลานัดรับ</label>
          <select
            id="tr-time"
            className="form-select"
            value={form.time}
            onChange={set('time')}
            disabled={!form.date || slots.length === 0}
          >
            <option value="">{form.date ? 'เลือกเวลา' : 'เลือกวันที่ก่อน'}</option>
            {slots.map((t) => (
              <option key={t} value={t}>{t} น.</option>
            ))}
          </select>
          {form.date && slots.length === 0 && (
            <div className="form-text text-danger">วันนี้หมดเวลาให้บริการแล้ว กรุณาเลือกวันอื่น</div>
          )}
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="tr-addr">ที่อยู่สำหรับรับ-ส่ง</label>
          <textarea
            id="tr-addr"
            rows={3}
            maxLength={300}
            className="form-control"
            placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด และจุดสังเกต"
            value={form.address}
            onChange={set('address')}
          />
          <div className="form-text">
            ดึงจากโปรไฟล์ของคุณ แก้ไขได้ที่นี่โดยไม่เปลี่ยนข้อมูลในโปรไฟล์
          </div>
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="tr-phone">เบอร์โทรติดต่อ</label>
          <input
            id="tr-phone"
            type="tel"
            className="form-control"
            placeholder="08x-xxx-xxxx"
            value={form.phone}
            onChange={set('phone')}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="tr-note">หมายเหตุ</label>
          <input
            id="tr-note"
            type="text"
            maxLength={500}
            className="form-control"
            placeholder="ไม่บังคับ เช่น น้องกลัวรถ มีกรง"
            value={form.note}
            onChange={set('note')}
          />
        </div>
      </div>

      <div className="small text-muted mt-3">
        <i className="bi bi-info-circle me-1" />
        ค่าบริการประเมินโดยทีมงานหลังรับคำขอ ·{' '}
        <i className="bi bi-telephone me-1" />
        สอบถามเพิ่มเติม {CLINIC_PHONE}
      </div>

      <div className="text-end mt-3">
        <button type="submit" className="btn btn-sky" disabled={saving}>
          <i className="bi bi-check2 me-1" />
          {saving ? 'กำลังส่ง...' : 'ส่งคำขอ'}
        </button>
      </div>
    </form>
  );
}

function RequestItem({ request: r, onCancel, busy }) {
  const status = TRANSPORT_STATUS[r.status] ?? TRANSPORT_STATUS.pending;
  const direction = TRANSPORT_DIRECTIONS.find((d) => d.value === r.direction);
  const canCancel = r.status !== 'cancelled' && r.date >= todayString();

  return (
    <div className="tl-item">
      <div className="date">
        {formatDate(r.date)} · {r.time} น.
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="fw-medium">{r.petName}</span>
        <span className="tag">
          <i className={`bi ${direction?.icon ?? 'bi-truck'} me-1`} />
          {r.directionLabel}
        </span>
        <span className={`tag ${status.tone}`}>{status.label}</span>
      </div>
      <div className="small text-muted mt-1">
        <i className="bi bi-geo-alt me-1" />
        {r.address}
      </div>
      {r.note && <div className="small text-muted">{r.note}</div>}
      {canCancel && (
        <button
          type="button"
          className="btn btn-sm btn-soft-danger mt-2"
          disabled={busy}
          onClick={() => onCancel(r)}
        >
          ยกเลิกคำขอ
        </button>
      )}
    </div>
  );
}

export default function TransportPage() {
  const { currentUser } = useAuth();
  const { pets, loading: petsLoading, error: petsError } = usePets();
  const { requests, loading, error, reload, addRequest, cancelRequest } = useTransportRequests();
  const [cancelError, setCancelError] = useState('');
  const [busyId, setBusyId] = useState('');

  const today = todayString();
  const upcoming = requests.filter((r) => r.status !== 'cancelled' && r.date >= today);
  const history = requests.filter((r) => r.status === 'cancelled' || r.date < today).reverse();

  async function handleCancel(r) {
    const text = `ยกเลิกคำขอรับ-ส่งของ "${r.petName}" วันที่ ${formatDate(r.date)} เวลา ${r.time} น.?`;
    if (!window.confirm(text)) return;
    setBusyId(r.id);
    setCancelError('');
    try {
      await cancelRequest(r.id);
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>รับ-ส่งสัตว์เลี้ยง</h1>
            <p>ทีมงานไปรับ-ส่งน้องถึงบ้านอย่างปลอดภัย</p>
          </div>
        </div>

        {(petsError || error) && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{petsError || error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
          </div>
        )}

        {petsLoading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : pets.length === 0 ? (
          <div className="card-soft empty-box">
            <i className="bi bi-heart" />
            ต้องมีข้อมูลสัตว์เลี้ยงก่อนจึงจะเรียกบริการรับ-ส่งได้
            <div className="mt-3">
              <Link to="/pet-owner/my-pets/new" className="btn btn-sky">เพิ่มสัตว์เลี้ยง</Link>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            <div className="col-lg-7">
              <TransportForm pets={pets} user={currentUser} onSubmit={addRequest} />
            </div>

            <div className="col-lg-5">
              <div className="card-soft mb-4">
                <div className="section-label">
                  <i className="bi bi-calendar-event" />
                  คำขอที่กำลังจะถึง ({upcoming.length})
                </div>
                {cancelError && <div className="alert alert-danger py-2">{cancelError}</div>}
                {loading ? (
                  <div className="empty-box py-3">กำลังโหลด...</div>
                ) : upcoming.length === 0 ? (
                  <div className="empty-box py-3">
                    <i className="bi bi-truck" />
                    ยังไม่มีคำขอรับ-ส่ง
                  </div>
                ) : (
                  <div className="timeline">
                    {upcoming.map((r) => (
                      <RequestItem key={r.id} request={r} onCancel={handleCancel} busy={busyId === r.id} />
                    ))}
                  </div>
                )}
              </div>

              {history.length > 0 && (
                <div className="card-soft">
                  <div className="section-label">
                    <i className="bi bi-clock-history" />
                    ประวัติการรับ-ส่ง ({history.length})
                  </div>
                  <div className="timeline">
                    {history.map((r) => (
                      <RequestItem key={r.id} request={r} onCancel={handleCancel} busy={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
>>>>>>> origin/Pet-Owner-Vet
      </div>
    </div>
  );
}
