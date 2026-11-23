import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import PriceQuote from '../../pet-transport/components/PriceQuote.jsx';
import StatusBadge from '../../pet-transport/components/StatusBadge.jsx';
import TransportSubnav from '../../pet-transport/components/TransportSubnav.jsx';
import TripStatusTimeline from '../../pet-transport/components/TripStatusTimeline.jsx';
import { TRIP_TYPES, canOwnerRequestCancel } from '../../pet-transport/constants.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import '../../pet-transport/transport.css';

const OWNER_NAV = [
  { to: '/pet-owner/transport', label: 'จองรับ–ส่ง', icon: 'bi-plus-circle', end: true },
  { to: '/pet-owner/transport/history', label: 'ประวัติการจอง', icon: 'bi-clock-history' },
];

export default function TransportDetailPage() {
  const { bookingId } = useParams();
  const { currentUser } = useAuth();
  const { getBooking, ownerConfirmPayment, requestCancel, trips } = useTransport();
  const booking = getBooking(bookingId);
  const [note, setNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!booking || booking.ownerId !== currentUser?.id) {
    return (
      <div className="page-wrap">
        <div className="container">
          <section className="tp-page">
            <p>ไม่พบการจอง</p>
            <Link to="/pet-owner/transport/history">กลับประวัติ</Link>
          </section>
        </div>
      </div>
    );
  }

  const canPay = ['awaiting_payment', 'driver_assigned', 'price_confirmed'].includes(booking.status)
    && booking.paymentStatus !== 'paid';
  const canCancel = canOwnerRequestCancel(booking, trips);

  function pay() {
    setErr('');
    try {
      ownerConfirmPayment(booking.id, note);
      setMsg('บันทึกแล้วว่าคุณชำระเงินแล้ว — รอ Admin ตรวจสอบ');
    } catch (e) {
      setErr(e.message);
    }
  }

  function cancel() {
    setErr('');
    if (!cancelReason.trim()) return setErr('กรุณาระบุเหตุผล');
    try {
      requestCancel(booking.id, cancelReason.trim());
      setMsg('ส่งคำขอยกเลิกแล้ว รอ Admin อนุมัติ');
    } catch (e) {
      setErr(e.message);
    }
    return undefined;
  }

  return (
    <div className="page-wrap">
      <div className="container">
        <section className="tp-page">
          <div className="tp-page-head">
            <h1>รายละเอียดการจอง</h1>
            <p className="tp-lead">{booking.petName} · {booking.ownerName}</p>
          </div>
          <TransportSubnav items={OWNER_NAV} />

      {msg && <div className="tp-alert tp-alert--ok">{msg}</div>}
      {err && <div className="tp-alert tp-alert--danger">{err}</div>}

      <div className="tp-grid tp-grid--2">
        <div className="tp-card">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <StatusBadge label={booking.statusMeta.label} tone={booking.statusMeta.tone} />
            <StatusBadge
              label={
                booking.paymentStatus === 'paid'
                  ? 'ชำระแล้ว'
                  : booking.paymentStatus === 'owner_confirmed'
                    ? 'รอ Admin ยืนยันเงิน'
                    : 'ยังไม่ชำระ'
              }
              tone={booking.paymentStatus === 'paid' ? 'ok' : 'warn'}
            />
          </div>
          <p className="tp-muted">ประเภท: {booking.serviceType === 'round_trip' ? 'ไป–กลับ' : 'เที่ยวเดียว'}</p>
          <p className="tp-muted">
            Zone รับ {booking.fromZoneId || '-'} → ส่ง {booking.toZoneId || '-'}
            {' · '}คิดตาม Zone {booking.fareZoneId || booking.zoneId}
          </p>
          {booking.petNotes && <p className="tp-muted">หมายเหตุ: {booking.petNotes}</p>}
          {booking.cancelRequest && (
            <div className="tp-alert tp-alert--info" style={{ marginTop: '0.75rem' }}>
              คำขอยกเลิก: {booking.cancelRequest.reason} ({booking.cancelRequest.status})
            </div>
          )}
        </div>
        <PriceQuote
          quote={booking.quote}
          title={booking.finalQuote ? 'ราคาสุดท้าย (Admin ยืนยัน)' : 'ราคาประเมิน'}
        />
      </div>

      {canPay && (
        <div className="tp-card" style={{ marginTop: '1rem' }}>
          <h3>ชำระเงิน (ไม่มี Payment Gateway ใน MVP)</h3>
          <p className="tp-muted">โอนนอกระบบแล้วกดยืนยัน — Admin จะ Mark as Paid</p>
          <div className="tp-form">
            <div className="field">
              <label htmlFor="pay-note">หมายเหตุการชำระ</label>
              <input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น โอนแล้วเมื่อ 15:00" />
            </div>
          </div>
          <div className="tp-actions">
            <button type="button" className="tp-btn tp-btn--ok" onClick={pay}>
              ยืนยันว่าชำระแล้ว
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1rem' }} className="tp-grid tp-grid--2">
        {booking.trips.map((trip) => (
          <div key={trip.id} className="tp-card">
            <h3>{TRIP_TYPES[trip.type]?.label || trip.type}</h3>
            <p className="tp-muted">จาก: {trip.fromLabel}</p>
            <p className="tp-muted">ถึง: {trip.toLabel}</p>
            <p className="tp-muted">เวลารับ: {trip.pickupTime ? new Date(trip.pickupTime).toLocaleString('th-TH') : '-'}</p>
            {trip.dropoffTime && (
              <p className="tp-muted">เวลาส่ง: {new Date(trip.dropoffTime).toLocaleString('th-TH')}</p>
            )}
            <p className="tp-muted">คนขับ: {trip.driver?.name || 'รอ Assign'}</p>
            <TripStatusTimeline status={trip.status} />
            {(trip.evidencePickup || trip.evidenceDropoff) && (
              <div className="tp-evidence" style={{ marginTop: '0.75rem' }}>
                {trip.evidencePickup && (
                  <div>
                    <div className="tp-muted">หลักฐานรับ</div>
                    <img src={trip.evidencePickup.url} alt="หลักฐานรับ" />
                  </div>
                )}
                {trip.evidenceDropoff && (
                  <div>
                    <div className="tp-muted">หลักฐานส่ง</div>
                    <img src={trip.evidenceDropoff.url} alt="หลักฐานส่ง" />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {canCancel && (
        <div className="tp-card" style={{ marginTop: '1rem' }}>
          <h3>ขอยกเลิก</h3>
          <p className="tp-muted">ยกเลิกเองได้ก่อนสถานะ “รับสัตว์แล้ว” — Admin เป็นผู้อนุมัติ</p>
          <div className="tp-form">
            <div className="field">
              <label htmlFor="cancel">เหตุผล</label>
              <textarea id="cancel" rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
          </div>
          <div className="tp-actions">
            <button type="button" className="tp-btn tp-btn--danger" onClick={cancel}>ส่งคำขอยกเลิก</button>
          </div>
        </div>
      )}

          {!canCancel && !['cancelled', 'cancel_requested'].includes(booking.status) && (
            <p className="tp-muted" style={{ marginTop: '1rem' }}>
              หากต้องการยกเลิกหลังรับสัตว์แล้ว กรุณาติดต่อ Admin
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
