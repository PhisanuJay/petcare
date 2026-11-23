import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../usePets.js';
import PlaceFields from '../../pet-transport/components/PlaceFields.jsx';
import PriceQuote from '../../pet-transport/components/PriceQuote.jsx';
import TransportSubnav from '../../pet-transport/components/TransportSubnav.jsx';
import { SERVICE_TYPES } from '../../pet-transport/constants.js';
import { quotePrice, zoneFromDistance } from '../../pet-transport/pricing.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import '../../pet-transport/transport.css';

const OWNER_NAV = [
  { to: '/pet-owner/transport', label: 'จองรับ–ส่ง', icon: 'bi-plus-circle', end: true },
  { to: '/pet-owner/transport/history', label: 'ประวัติการจอง', icon: 'bi-clock-history' },
];

const emptyPlace = (kind = 'home') => ({ kind, refId: '', name: kind === 'home' ? 'บ้าน' : '', address: '' });

export default function TransportPage() {
  const { currentUser } = useAuth();
  const { pets } = usePets();
  const { clinics, hotels, zones, createBooking } = useTransport();
  const navigate = useNavigate();

  const [serviceType, setServiceType] = useState('one_way');
  const [petId, setPetId] = useState(pets[0]?.id || '');
  const [petName, setPetName] = useState(pets[0]?.name || '');
  const [petNotes, setPetNotes] = useState('');
  const [distanceKm, setDistanceKm] = useState('6');
  const [from, setFrom] = useState(() => ({
    ...emptyPlace('home'),
    address: currentUser?.address || '',
  }));
  const [to, setTo] = useState(() => ({
    kind: 'clinic',
    refId: clinics[0]?.id || '',
    name: clinics[0]?.name || '',
    address: clinics[0]?.address || '',
  }));
  const [outboundPickupTime, setOutboundPickupTime] = useState('');
  const [returnPickupTime, setReturnPickupTime] = useState('');
  const [error, setError] = useState('');

  const estimate = useMemo(() => {
    const zone = zoneFromDistance(distanceKm);
    if (!zone) return null;
    return quotePrice({ zoneId: zone.id, serviceType, zones });
  }, [distanceKm, serviceType, zones]);

  function onPetChange(id) {
    setPetId(id);
    const pet = pets.find((p) => p.id === id);
    setPetName(pet?.name || '');
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!petName.trim()) return setError('กรุณาระบุชื่อสัตว์เลี้ยง');
    if (!from.address.trim() || !to.address.trim()) return setError('กรุณากรอกที่อยู่จุดรับและจุดส่ง');
    if (!outboundPickupTime) return setError('กรุณาระบุเวลารับสัตว์เที่ยวไป');
    if (serviceType === 'round_trip' && !returnPickupTime) {
      return setError('กรุณาระบุเวลารับสัตว์เที่ยวกลับ');
    }
    if (!Number.isFinite(Number(distanceKm)) || Number(distanceKm) < 0) {
      return setError('ระยะทางไม่ถูกต้อง');
    }

    try {
      const { booking } = createBooking({
        ownerId: currentUser.id,
        ownerName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        ownerPhone: currentUser.phone || '',
        petId: petId || null,
        petName: petName.trim(),
        petNotes: petNotes.trim(),
        serviceType,
        distanceKm,
        from,
        to,
        outboundPickupTime,
        outboundDropoffTime: null,
        returnPickupTime,
        returnDropoffTime: null,
      });
      navigate(`/pet-owner/transport/${booking.id}`);
    } catch (err) {
      setError(err.message || 'จองไม่สำเร็จ');
    }
    return undefined;
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <section className="tp-page">
          <div className="tp-page-head">
            <h1>บริการรับ–ส่งสัตว์เลี้ยง</h1>
            <p className="tp-lead">
              เลือกรูปแบบเที่ยวเดียวหรือไป–กลับ ระบบคำนวณราคาจาก Zone ให้ก่อนยืนยัน
              (Admin จะตรวจและยืนยันราคาสุดท้าย)
            </p>
          </div>
          <TransportSubnav items={OWNER_NAV} />

          <form className="tp-form" onSubmit={handleSubmit}>
        {error && <div className="tp-alert tp-alert--danger">{error}</div>}

        <div className="tp-grid tp-grid--2">
          <div className="tp-card">
            <h3>รายละเอียดการจอง</h3>
            <div className="field">
              <label htmlFor="svc">ประเภทบริการ</label>
              <select id="svc" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                {SERVICE_TYPES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
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
            <div className="field">
              <label htmlFor="km">ระยะทางโดยประมาณ (กม.)</label>
              <input
                id="km"
                type="number"
                min="0"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
              />
              <p className="tp-muted">MVP: Owner กรอกระยะทาง / Admin ตรวจ Zone อีกครั้ง</p>
            </div>
          </div>

          <PriceQuote quote={estimate} title="ราคาประเมิน (ก่อนยืนยัน)" />
        </div>

        <div className="tp-grid tp-grid--2" style={{ marginTop: '1rem' }}>
          <PlaceFields
            prefix="จุดรับ (A)"
            value={from}
            onChange={setFrom}
            clinics={clinics}
            hotels={hotels}
            defaultAddress={currentUser?.address || ''}
          />
          <PlaceFields
            prefix="จุดส่ง (B)"
            value={to}
            onChange={setTo}
            clinics={clinics}
            hotels={hotels}
          />
        </div>

        <div className="tp-card" style={{ marginTop: '1rem' }}>
          <h3>เวลาเที่ยวไป</h3>
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="out-pick">เวลารับสัตว์</label>
            <input
              id="out-pick"
              type="datetime-local"
              value={outboundPickupTime}
              onChange={(e) => setOutboundPickupTime(e.target.value)}
            />
            <p className="tp-muted">ไม่ต้องใส่เวลาถึงปลายทาง — ขึ้นกับระยะทางและสภาพการจราจร</p>
          </div>

          {serviceType === 'round_trip' && (
            <>
              <h3 style={{ marginTop: '1rem' }}>เวลาเที่ยวกลับ</h3>
              <div className="field" style={{ maxWidth: 360 }}>
                <label htmlFor="ret-pick">เวลารับสัตว์</label>
                <input
                  id="ret-pick"
                  type="datetime-local"
                  value={returnPickupTime}
                  onChange={(e) => setReturnPickupTime(e.target.value)}
                />
                <p className="tp-muted">ระบุเวลาที่ต้องการให้มารับกลับเท่านั้น</p>
              </div>
            </>
          )}
        </div>

          <div className="tp-actions">
            <button type="submit" className="tp-btn">
              <i className="bi bi-check2" />
              ยืนยันการจอง
            </button>
            <Link className="tp-btn tp-btn--ghost" to="/pet-owner/transport/history">
              ดูประวัติ
            </Link>
          </div>
          </form>
        </section>
      </div>
    </div>
  );
}
