import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PriceQuote from '../components/PriceQuote.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import TripStatusTimeline from '../components/TripStatusTimeline.jsx';
import { TRIP_TYPES, ZONES } from '../constants.js';
import { subdistrictById } from '../pricing.js';
import { useTransport } from '../useTransport.js';

export default function BookingAdminDetail() {
  const { bookingId } = useParams();
  const { getBooking, zones, activeDrivers, confirmPrice, assignDriver, adminMarkPaid } = useTransport();
  const booking = getBooking(bookingId);
  const [fareZoneId, setFareZoneId] = useState(booking?.fareZoneId || booking?.zoneId || '1');
  const [customPrice, setCustomPrice] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!booking) {
    return (
      <>
        <p>ไม่พบการจอง</p>
        <Link to="/admin/transport/bookings">กลับ</Link>
      </>
    );
  }

  const pickup = booking.trips[0]?.from;
  const dropoff = booking.trips[0]?.to;

  function doConfirmPrice() {
    setErr('');
    try {
      confirmPrice(booking.id, {
        fareZoneId,
        customPerTrip: customPrice !== '' ? customPrice : null,
      });
      setMsg('ยืนยันราคาแล้ว');
    } catch (e) {
      setErr(e.message);
    }
  }

  function doAssign(tripId, driverId) {
    setErr('');
    try {
      if (!driverId) return;
      assignDriver(tripId, driverId);
      setMsg('มอบหมายคนขับแล้ว');
    } catch (e) {
      setErr(e.message);
    }
  }

  function doMarkPaid() {
    setErr('');
    try {
      adminMarkPaid(booking.id);
      setMsg('Mark as Paid แล้ว — คนขับเริ่มงานได้');
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <>
      <h1>Booking Detail</h1>
      <p className="tp-lead">{booking.petName} · {booking.ownerName} · {booking.ownerPhone}</p>
      {msg && <div className="tp-alert tp-alert--ok">{msg}</div>}
      {err && <div className="tp-alert tp-alert--danger">{err}</div>}

      <div className="tp-grid tp-grid--2">
        <div className="tp-card">
          <StatusBadge label={booking.statusMeta.label} tone={booking.statusMeta.tone} />
          <p className="tp-muted">
            จุดรับ: {subdistrictById(pickup?.subdistrictId)?.label || '-'}
            {pickup?.zoneId ? ` (Zone ${pickup.zoneId})` : ''}
          </p>
          <p className="tp-muted">
            จุดส่ง: {subdistrictById(dropoff?.subdistrictId)?.label || '-'}
            {dropoff?.zoneId ? ` (Zone ${dropoff.zoneId})` : ''}
          </p>
          <p className="tp-muted">
            คิดตาม Zone {booking.fareZoneId || booking.zoneId}
            {' · '}
            Zone รับ {booking.fromZoneId || pickup?.zoneId || '-'} → ส่ง {booking.toZoneId || dropoff?.zoneId || '-'}
          </p>
          <p className="tp-muted">การชำระ: {booking.paymentStatus} {booking.paymentNote && `— ${booking.paymentNote}`}</p>

          <h3 style={{ marginTop: '1rem' }}>ยืนยันราคา (Zone)</h3>
          <div className="tp-form">
            <div className="field">
              <label htmlFor="zone">คิดตาม Zone</label>
              <select id="zone" value={fareZoneId} onChange={(e) => setFareZoneId(e.target.value)}>
                {(zones.length ? zones : ZONES).map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label} {z.price != null ? `(฿${z.price}/เที่ยว)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="custom">ราคา/เที่ยว (ถ้าต้องกำหนดเอง)</label>
              <input
                id="custom"
                type="number"
                min="0"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="เว้นว่างเพื่อใช้ราคา Zone"
              />
            </div>
          </div>
          <div className="tp-actions">
            <button type="button" className="tp-btn" onClick={doConfirmPrice}>ยืนยันราคา</button>
            {booking.paymentStatus === 'owner_confirmed' && (
              <button type="button" className="tp-btn tp-btn--ok" onClick={doMarkPaid}>Mark as Paid</button>
            )}
          </div>
        </div>
        <PriceQuote quote={booking.quote} title={booking.finalQuote ? 'ราคาสุดท้าย' : 'ราคาประเมิน'} />
      </div>

      <div className="tp-grid tp-grid--2" style={{ marginTop: '1rem' }}>
        {booking.trips.map((trip) => (
          <div key={trip.id} className="tp-card">
            <h3>{TRIP_TYPES[trip.type]?.label}</h3>
            <p className="tp-muted">{trip.fromLabel} → {trip.toLabel}</p>
            <p className="tp-muted">
              เวลารับ: {trip.pickupTime ? new Date(trip.pickupTime).toLocaleString('th-TH') : '-'}
              {trip.dropoffTime
                ? ` · เวลาส่ง: ${new Date(trip.dropoffTime).toLocaleString('th-TH')}`
                : ''}
            </p>
            <div className="tp-form">
              <div className="field">
                <label htmlFor={`drv-${trip.id}`}>Assign Driver</label>
                <select
                  id={`drv-${trip.id}`}
                  value={trip.driverId || ''}
                  onChange={(e) => doAssign(trip.id, e.target.value)}
                >
                  <option value="">— เลือกคนขับ —</option>
                  {activeDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.vehicle || 'ไม่ระบุรถ'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <TripStatusTimeline status={trip.status} />
          </div>
        ))}
      </div>
    </>
  );
}
