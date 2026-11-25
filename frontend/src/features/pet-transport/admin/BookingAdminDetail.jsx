import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PriceQuote from '../components/PriceQuote.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import TripStatusTimeline from '../components/TripStatusTimeline.jsx';
import { PAYMENT_STATUSES, TRIP_TYPES, ZONES, serviceTypeMeta } from '../constants.js';
import { formatBaht, subdistrictById } from '../pricing.js';
import { useTransport } from '../useTransport.js';
import { bookingBucket, shortBookingId } from './adminBookingUtils.js';

function formatWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingAdminDetail() {
  const { bookingId } = useParams();
  const {
    getBooking,
    zones,
    activeDrivers,
    confirmPrice,
    assignDriver,
    updateTripSchedule,
  } = useTransport();
  const booking = getBooking(bookingId);
  const [fareZoneId, setFareZoneId] = useState(booking?.fareZoneId || booking?.zoneId || '1');
  const [customPrice, setCustomPrice] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [assignDraft, setAssignDraft] = useState({});
  const [scheduleDraft, setScheduleDraft] = useState({});

  if (!booking) {
    return (
      <>
        <p>ไม่พบการจอง</p>
        <Link to="/admin/transport/bookings">กลับรายการ</Link>
      </>
    );
  }

  const pickup = booking.trips[0]?.from;
  const dropoff = booking.trips[0]?.to;
  const pay = PAYMENT_STATUSES[booking.paymentStatus] || { label: booking.paymentStatus || '—' };
  const service = serviceTypeMeta(booking.serviceType);
  const bucket = bookingBucket(booking);

  function askConfirmPrice() {
    setErr('');
    setConfirm({
      type: 'price',
      title: 'ยืนยันราคา?',
      body: `บันทึกราคา Zone ${fareZoneId}${customPrice !== '' ? ` / กำหนดเอง ฿${customPrice}` : ''} สำหรับ ${booking.petName}`,
    });
  }

  function askAssign(tripId) {
    const trip = booking.trips.find((t) => t.id === tripId);
    const driverId = assignDraft[tripId] ?? trip?.driverId;
    if (!driverId) {
      setErr('เลือกคนขับก่อนยืนยัน');
      return;
    }
    const driver = activeDrivers.find((d) => d.id === driverId);
    setErr('');
    setConfirm({
      type: 'assign',
      tripId,
      driverId,
      title: 'ยืนยันมอบหมายคนขับ?',
      body: `มอบหมาย ${driver?.name || driverId} ให้ทริปนี้`,
    });
  }

  function askSchedule(tripId) {
    const trip = booking.trips.find((t) => t.id === tripId);
    const next = scheduleDraft[tripId] || toLocalInput(trip?.pickupTime);
    if (!next) {
      setErr('เลือกเวลานัดรับก่อนบันทึก');
      return;
    }
    const iso = new Date(next).toISOString();
    setErr('');
    setConfirm({
      type: 'schedule',
      tripId,
      pickupTime: iso,
      title: 'ยืนยันเปลี่ยนเวลานัดรับ?',
      body: `${booking.petName} · จาก ${formatWhen(trip?.pickupTime)} เป็น ${formatWhen(iso)} — คนขับจะได้รับการแจ้งเตือน`,
    });
  }

  async function runConfirm() {
    if (!confirm) return;
    try {
      if (confirm.type === 'price') {
        await confirmPrice(booking.id, {
          fareZoneId,
          customPerTrip: customPrice !== '' ? customPrice : null,
        });
        setMsg('ยืนยันราคาแล้ว');
      } else if (confirm.type === 'assign') {
        await assignDriver(confirm.tripId, confirm.driverId);
        setMsg('มอบหมายคนขับแล้ว');
      } else if (confirm.type === 'schedule') {
        await updateTripSchedule(confirm.tripId, { pickupTime: confirm.pickupTime });
        setMsg('เปลี่ยนเวลานัดรับแล้ว — แจ้งคนขับแล้ว');
      }
      setConfirm(null);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="tp-booking-detail">
      <div className="tp-detail-top">
        <div>
          <Link className="tp-back" to="/admin/transport/bookings">← กลับรายการ Booking</Link>
          <h1>รายละเอียด Booking</h1>
          <p className="tp-lead">
            <code className="tp-code" title={booking.id}>{shortBookingId(booking.id)}</code>
            {' · '}
            {booking.petName} · {booking.ownerName} · {booking.ownerPhone || 'ไม่มีเบอร์'}
          </p>
        </div>
        <div className="tp-detail-badges">
          <StatusBadge label={booking.statusMeta.label} tone={booking.statusMeta.tone} />
          <StatusBadge
            label={pay.label}
            tone={booking.paymentStatus === 'paid' ? 'ok' : booking.paymentStatus === 'owner_confirmed' ? 'warn' : 'info'}
          />
        </div>
      </div>

      {msg ? <div className="tp-alert tp-alert--ok">{msg}</div> : null}
      {err ? <div className="tp-alert tp-alert--danger">{err}</div> : null}

      <div className="tp-card tp-detail-summary">
        <div className="tp-detail-summary__grid">
          <div>
            <span className="tp-label">ประเภทบริการ</span>
            <strong>{service?.label || booking.serviceType}</strong>
          </div>
          <div>
            <span className="tp-label">Zone รับ → ส่ง</span>
            <strong>
              {booking.fromZoneId || pickup?.zoneId || '?'} → {booking.toZoneId || dropoff?.zoneId || '?'}
            </strong>
          </div>
          <div>
            <span className="tp-label">คิดตาม Zone</span>
            <strong>{booking.fareZoneId || booking.zoneId || '—'}</strong>
          </div>
          <div>
            <span className="tp-label">ราคารวม</span>
            <strong>{formatBaht(booking.quote?.total)}</strong>
          </div>
          <div>
            <span className="tp-label">จุดรับ (แขวง)</span>
            <strong>
              {subdistrictById(pickup?.subdistrictId)?.label || pickup?.name || '—'}
            </strong>
          </div>
          <div>
            <span className="tp-label">จุดส่ง (แขวง)</span>
            <strong>
              {subdistrictById(dropoff?.subdistrictId)?.label || dropoff?.name || '—'}
            </strong>
          </div>
        </div>
        <p className="tp-muted" style={{ marginTop: '0.75rem' }}>
          ลำดับงาน: ยืนยันราคา → มอบหมายคนขับ → ยืนยันชำระเงิน → คนขับอัปเดตสถานะ
          {bucket === 'awaiting_price' ? ' · ตอนนี้อยู่ขั้นยืนยันราคา' : ''}
          {bucket === 'awaiting_assign' ? ' · ตอนนี้อยู่ขั้น Assign' : ''}
          {bucket === 'awaiting_payment' ? ' · ตอนนี้อยู่ขั้นรอชำระ' : ''}
        </p>
      </div>

      <div className="tp-grid tp-grid--2" style={{ marginTop: '1rem' }}>
        <div className="tp-card">
          <h3>1) ยืนยันราคา</h3>
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
            <button type="button" className="btn btn-sky" onClick={askConfirmPrice}>
              ยืนยันราคา
            </button>
          </div>
          <p className="tp-muted" style={{ marginBottom: 0 }}>
            การตรวจ/ยืนยันชำระเงินเป็นหน้าที่ฝ่ายการเงิน
          </p>
        </div>
        <PriceQuote quote={booking.quote} title={booking.finalQuote ? 'ราคาสุดท้าย' : 'ราคาก่อนยืนยัน'} />
      </div>

      <div className="tp-grid tp-grid--2" style={{ marginTop: '1rem' }}>
        {booking.trips.map((trip) => (
          <div key={trip.id} className="tp-card">
            <h3>{TRIP_TYPES[trip.type]?.label || trip.type}</h3>
            <p className="tp-muted">{trip.fromLabel} → {trip.toLabel}</p>
            <p className="tp-muted">
              เวลารับ: {formatWhen(trip.pickupTime)}
              {trip.dropoffTime ? ` · เวลาส่ง: ${formatWhen(trip.dropoffTime)}` : ''}
            </p>
            <div className="tp-form">
              <div className="field">
                <label htmlFor={`pick-${trip.id}`}>เปลี่ยนเวลานัดรับ</label>
                <input
                  id={`pick-${trip.id}`}
                  type="datetime-local"
                  value={scheduleDraft[trip.id] ?? toLocalInput(trip.pickupTime)}
                  onChange={(e) => setScheduleDraft((d) => ({ ...d, [trip.id]: e.target.value }))}
                />
              </div>
            </div>
            <div className="tp-actions" style={{ marginTop: '0.35rem' }}>
              <button type="button" className="btn btn-soft" onClick={() => askSchedule(trip.id)}>
                บันทึกเวลาใหม่
              </button>
            </div>
            <div className="tp-form">
              <div className="field">
                <label htmlFor={`drv-${trip.id}`}>2) มอบหมายคนขับ</label>
                <select
                  id={`drv-${trip.id}`}
                  value={assignDraft[trip.id] ?? trip.driverId ?? ''}
                  onChange={(e) => setAssignDraft((d) => ({ ...d, [trip.id]: e.target.value }))}
                >
                  <option value="">— เลือกคนขับ —</option>
                  {activeDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.vehicle || 'ไม่ระบุรถ'}
                    </option>
                  ))}
                </select>
                {!activeDrivers.length ? (
                  <p className="tp-muted">ยังไม่มีบัญชีคนขับ — สร้างที่เมนูจัดการคนขับ</p>
                ) : null}
                {trip.driver?.name ? (
                  <p className="tp-muted">ปัจจุบัน: {trip.driver.name}</p>
                ) : null}
              </div>
            </div>
            <div className="tp-actions" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-sky"
                disabled={!activeDrivers.length}
                onClick={() => askAssign(trip.id)}
              >
                ยืนยัน Assign
              </button>
            </div>
            <TripStatusTimeline status={trip.status} />
          </div>
        ))}
      </div>

      {confirm ? (
        <div className="tp-modal" role="dialog" aria-modal="true" aria-labelledby="bd-confirm-title">
          <button type="button" className="tp-modal__backdrop" aria-label="ปิด" onClick={() => setConfirm(null)} />
          <div className="tp-modal__panel tp-card">
            <h2 id="bd-confirm-title">{confirm.title}</h2>
            <p className="tp-muted">{confirm.body}</p>
            <div className="tp-actions">
              <button type="button" className="btn btn-soft" onClick={() => setConfirm(null)}>ยกเลิก</button>
              <button type="button" className="btn btn-sky" onClick={runConfirm}>ยืนยัน</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
