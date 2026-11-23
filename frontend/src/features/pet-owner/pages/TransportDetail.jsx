import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import PriceQuote from '../../pet-transport/components/PriceQuote.jsx';
import StatusBadge from '../../pet-transport/components/StatusBadge.jsx';
import TransportSubnav from '../../pet-transport/components/TransportSubnav.jsx';
import TripStatusTimeline from '../../pet-transport/components/TripStatusTimeline.jsx';
import {
  TRIP_TYPES,
  canOwnerRequestCancel,
  isFacilityKind,
  serviceTypeMeta,
} from '../../pet-transport/constants.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import '../../pet-transport/transport.css';

const OWNER_NAV = [
  { to: '/pet-owner/transport', label: 'จองรับ–ส่ง', icon: 'bi-plus-circle', end: true },
  { to: '/pet-owner/transport/history', label: 'ประวัติการจอง', icon: 'bi-clock-history' },
];

const CANCEL_MAX = 200;

function formatPickupThai(iso, { short = false } = {}) {
  if (!iso) return 'ยังไม่ระบุ';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ยังไม่ระบุ';
  const datePart = d.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return short ? `${datePart} ${timePart} น.` : `${datePart} เวลา ${timePart} น.`;
}

function placeKindLabel(place) {
  if (!place) return 'สถานที่';
  if (place.kind === 'home') return 'บ้าน';
  if (isFacilityKind(place.kind)) return place.name || 'คลินิกสัตว์เลี้ยง';
  return place.name || 'สถานที่อื่น';
}

function placeIcon(place) {
  if (place?.kind === 'home') return 'bi-house-door';
  if (isFacilityKind(place?.kind)) return 'bi-hospital';
  return 'bi-geo-alt';
}

function paymentLabel(status) {
  if (status === 'paid') return 'ชำระแล้ว';
  if (status === 'owner_confirmed') return 'รอ Admin ยืนยันเงิน';
  return 'ยังไม่ชำระ';
}

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
  const svc = serviceTypeMeta(booking.serviceType);
  const primaryTrip = booking.trips[0];
  const primaryPickup = primaryTrip?.pickupTime;

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
        <section className="tp-page tp-page--detail">
          <div className="tp-page-head">
            <h1>รายละเอียดการจอง</h1>
            <p className="tp-lead">{booking.petName} · {booking.ownerName}</p>
          </div>
          <TransportSubnav items={OWNER_NAV} />

          {msg && <div className="tp-alert tp-alert--ok">{msg}</div>}
          {err && <div className="tp-alert tp-alert--danger">{err}</div>}

          <div className="tp-summary-card">
            <div className="tp-summary-card__badges">
              <StatusBadge label={booking.statusMeta.label} tone={booking.statusMeta.tone} />
              <StatusBadge
                label={paymentLabel(booking.paymentStatus)}
                tone={booking.paymentStatus === 'paid' ? 'ok' : 'warn'}
              />
            </div>
            <div className="tp-summary-card__meta">
              <div className="tp-summary-meta">
                <span className="tp-summary-meta__icon"><i className={`bi ${svc?.icon || 'bi-truck'}`} /></span>
                <div>
                  <div className="tp-summary-meta__label">ประเภทบริการ</div>
                  <div className="tp-summary-meta__value">{svc?.label || booking.serviceType}</div>
                </div>
              </div>
              <div className="tp-summary-meta">
                <span className="tp-summary-meta__icon"><i className="bi bi-signpost-2" /></span>
                <div>
                  <div className="tp-summary-meta__label">เส้นทาง Zone</div>
                  <div className="tp-summary-meta__value">
                    Zone {booking.fromZoneId || '-'} → Zone {booking.toZoneId || '-'}
                  </div>
                </div>
              </div>
              <div className="tp-summary-meta">
                <span className="tp-summary-meta__icon"><i className="bi bi-calendar3" /></span>
                <div>
                  <div className="tp-summary-meta__label">วันและเวลารับ</div>
                  <div className="tp-summary-meta__value">{formatPickupThai(primaryPickup, { short: true })}</div>
                </div>
              </div>
            </div>
            {booking.petNotes && (
              <p className="tp-muted tp-summary-card__note">หมายเหตุ: {booking.petNotes}</p>
            )}
            {booking.cancelRequest && (
              <div className="tp-alert tp-alert--info tp-summary-card__note">
                คำขอยกเลิก: {booking.cancelRequest.reason} ({booking.cancelRequest.status})
              </div>
            )}
          </div>

          <div className="tp-detail-layout">
            <div className="tp-detail-main">
              {booking.trips.map((trip) => (
                <div key={trip.id} className="tp-trip-card">
                  <h3 className="tp-section-title">
                    <i className="bi bi-geo-alt-fill" />
                    {TRIP_TYPES[trip.type]?.label || trip.type}
                  </h3>

                  <div className="tp-route-box">
                    <div className="tp-route-point">
                      <span className="tp-route-point__icon"><i className={`bi ${placeIcon(trip.from)}`} /></span>
                      <div className="tp-route-point__text">
                        <div className="tp-route-point__label">จาก (จุดรับ)</div>
                        <div className="tp-route-point__value">{placeKindLabel(trip.from)}</div>
                      </div>
                    </div>
                    <span className="tp-route-arrow" aria-hidden="true"><i className="bi bi-arrow-right" /></span>
                    <div className="tp-route-point">
                      <span className="tp-route-point__icon"><i className={`bi ${placeIcon(trip.to)}`} /></span>
                      <div className="tp-route-point__text">
                        <div className="tp-route-point__label">ถึง (จุดส่ง)</div>
                        <div className="tp-route-point__value">{placeKindLabel(trip.to)}</div>
                      </div>
                    </div>
                  </div>

                  <ul className="tp-trip-facts">
                    <li>
                      <span className="tp-trip-facts__icon"><i className="bi bi-pin-map" /></span>
                      <span className="tp-trip-facts__body">
                        <strong>ที่อยู่ปลายทาง</strong>
                        <em>{trip.to?.address || trip.toLabel || '—'}</em>
                      </span>
                    </li>
                    <li>
                      <span className="tp-trip-facts__icon"><i className="bi bi-calendar-event" /></span>
                      <span className="tp-trip-facts__body">
                        <strong>วันและเวลารับ</strong>
                        <em>{formatPickupThai(trip.pickupTime)}</em>
                      </span>
                    </li>
                  </ul>

                  {(trip.evidencePickup || trip.evidenceDropoff) && (
                    <div className="tp-evidence tp-trip-card__evidence">
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

            <aside className="tp-detail-side">
              <div className="tp-price-card">
                <h3 className="tp-section-title">
                  <i className="bi bi-tags" />
                  {booking.finalQuote ? 'ราคาสุดท้าย' : 'ราคาประมาณ'}
                </h3>
                <PriceQuote quote={booking.quote} title="" />
              </div>
            </aside>
          </div>

          {primaryTrip && (
            <div className="tp-status-card">
              <h3 className="tp-section-title">
                <i className="bi bi-truck" />
                สถานะการดำเนินการ
              </h3>
              <TripStatusTimeline status={primaryTrip.status} orientation="horizontal" />
            </div>
          )}

          {canPay && (
            <div className="tp-card" style={{ marginTop: '1rem' }}>
              <h3 className="tp-section-title">
                <i className="bi bi-cash-coin" />
                ชำระเงิน
              </h3>
              <p className="tp-muted">โอนนอกระบบแล้วกดยืนยัน — Admin จะ Mark as Paid (ไม่มี Payment Gateway ใน MVP)</p>
              <div className="tp-form">
                <div className="field">
                  <label htmlFor="pay-note">หมายเหตุการชำระ</label>
                  <input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น โอนแล้วเมื่อ 15:00" />
                </div>
              </div>
              <div className="tp-actions">
                <button type="button" className="btn btn-sky" onClick={pay}>
                  ยืนยันว่าชำระแล้ว
                </button>
              </div>
            </div>
          )}

          {canCancel && (
            <div className="tp-cancel-card">
              <h3 className="tp-section-title tp-section-title--danger">
                <i className="bi bi-x-circle" />
                ขอยกเลิกการจอง
              </h3>
              <p className="tp-muted">
                ยกเลิกเองได้ก่อนสถานะ “รับสัตว์แล้ว” — Admin เป็นผู้อนุมัติ
              </p>
              <div className="tp-form">
                <div className="field">
                  <label htmlFor="cancel">เหตุผลในการยกเลิก</label>
                  <textarea
                    id="cancel"
                    rows={3}
                    maxLength={CANCEL_MAX}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="ระบุเหตุผลที่ต้องการยกเลิก"
                  />
                  <p className="tp-char-count">
                    {cancelReason.length}/{CANCEL_MAX}
                  </p>
                </div>
              </div>
              <div className="tp-actions tp-actions--end">
                <button type="button" className="btn btn-soft-danger" onClick={cancel}>
                  <i className="bi bi-trash" />
                  ส่งคำขอยกเลิก
                </button>
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
