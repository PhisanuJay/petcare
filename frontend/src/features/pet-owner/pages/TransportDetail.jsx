import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';
import PaymentQr from '../../pet-transport/components/PaymentQr.jsx';
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
import {
  catalogOptionsForPlace,
  otherServiceKindForPlace,
} from '../../pet-transport/serviceCatalog.js';
import { useHotelBookings } from '../useHotelBookings.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import CancellationRequestForm from '../../cancellations/CancellationRequestForm.jsx';
import CancellationSummary from '../../cancellations/CancellationSummary.jsx';
import {
  cancellationFor,
  createCancellationRequest,
  hasOpenCancellation,
  removeCancellationRequest,
  useCancellationRequests,
} from '../../cancellations/store.js';
import { PAY_KIND } from '../../payments/store.js';
import '../../pet-transport/transport.css';

const OWNER_NAV = [
  { to: '/pet-owner/transport', label: 'จองรับ–ส่ง', icon: 'bi-plus-circle', end: true },
  { to: '/pet-owner/transport/history', label: 'ประวัติการจอง', icon: 'bi-clock-history' },
];

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
  if (status === 'owner_confirmed') return 'รอตรวจสอบการชำระ';
  return 'ยังไม่ชำระ';
}

export default function TransportDetailPage() {
  const { bookingId } = useParams();
  const { currentUser } = useAuth();
  const {
    getBooking,
    ownerConfirmPayment,
    requestCancel,
    setBookingOtherService,
    trips,
    hotelRoomPrices,
  } = useTransport();
  const { bookings: hotelBookings } = useHotelBookings();
  const cancellations = useCancellationRequests(currentUser?.id);
  const booking = getBooking(bookingId);
  const [slip, setSlip] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [otherServiceId, setOtherServiceId] = useState('');
  const [hotelNights, setHotelNights] = useState(1);
  const [savingService, setSavingService] = useState(false);
  const [wantExtra, setWantExtra] = useState(false);

  const primaryTrip = booking?.trips?.[0] || null;
  const facilityPlace = primaryTrip?.to || null;
  const otherKind = otherServiceKindForPlace(facilityPlace);
  const otherOptions = useMemo(
    () => catalogOptionsForPlace(facilityPlace, hotelRoomPrices),
    [facilityPlace, hotelRoomPrices],
  );

  useEffect(() => {
    const existing = booking?.quote?.otherService;
    if (existing?.id) {
      setOtherServiceId(existing.id);
      setHotelNights(existing.nights || 1);
      setWantExtra(true);
    } else {
      setOtherServiceId('');
      setWantExtra(false);
    }
  }, [booking?.id, booking?.quote?.otherService?.id, booking?.quote?.otherService?.nights]);

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

  const canPay = !['paid', 'owner_confirmed'].includes(booking.paymentStatus)
    && !['cancelled', 'cancel_requested', 'completed'].includes(booking.status);
  const cancellation = cancellationFor(PAY_KIND.transport, booking.id, cancellations);
  const canCancel = canOwnerRequestCancel(booking, trips)
    && !hasOpenCancellation(PAY_KIND.transport, booking.id, cancellations);
  const canAddServices = booking.serviceType !== 'inbound'
    && !['paid', 'owner_confirmed'].includes(booking.paymentStatus)
    && !['cancelled', 'cancel_requested', 'completed'].includes(booking.status);
  const showOtherServiceOptions = otherOptions.length > 0
    && (otherKind !== 'hotel' || Boolean(booking.quote?.otherService));
  const linkedHotel = hotelBookings.find((item) =>
    item.linkedBookings?.some((linked) => linked.kind === 'transport' && linked.id === booking.id));
  const svc = serviceTypeMeta(booking.serviceType);
  const primaryPickup = primaryTrip?.pickupTime;
  const quote = booking.quote;
  const payAmount = quote?.total;

  async function onSlipFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErr('');
    setSlip('');
    try {
      setSlip(await fileToResizedDataUrl(file, 960, 0.82));
    } catch (error) {
      setErr(error.message);
    }
  }

  async function saveOtherService() {
    setErr('');
    setMsg('');
    setSavingService(true);
    try {
      const id = otherServiceId || null;
      await setBookingOtherService(booking.id, {
        otherServiceId: id,
        hotelNights: otherKind === 'hotel' ? hotelNights : 1,
      });
      setMsg(id ? 'เพิ่มบริการแล้ว — ยอดในใบสรุปอัปเดตแล้ว' : 'ไม่เพิ่มบริการอื่น ใช้เฉพาะค่ารถ');
      setWantExtra(false);
      setShowQr(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSavingService(false);
    }
  }

  async function clearOtherService() {
    setErr('');
    setMsg('');
    setSavingService(true);
    try {
      await setBookingOtherService(booking.id, { otherServiceId: null });
      setMsg('ลบบริการเพิ่มแล้ว เหลือเฉพาะค่ารถ');
      setWantExtra(false);
      setOtherServiceId('');
      setShowQr(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSavingService(false);
    }
  }

  async function pay() {
    setErr('');
    if (!slip) {
      setErr('กรุณาแนบสลิปก่อนส่งให้ฝ่ายบัญชีตรวจสอบ');
      return;
    }
    try {
      await ownerConfirmPayment(booking.id, slip);
      setMsg('ส่งสลิปแล้ว รอฝ่ายบัญชีตรวจสอบ');
      setSlip('');
      setShowQr(false);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function cancel(details) {
    let cancellationRequest;
    try {
      cancellationRequest = await createCancellationRequest({
        ...details,
        kind: PAY_KIND.transport,
        source: 'transport',
        refId: booking.id,
        ownerId: booking.ownerId,
        ownerName: booking.ownerName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim(),
        ownerEmail: currentUser?.email || '',
        petName: booking.petName,
        title: 'จองรับ–ส่งสัตว์เลี้ยง',
        bookingDate: primaryPickup || '',
      });
      await requestCancel(booking.id, currentUser.id, cancellationRequest.id, cancellationRequest.reason);
      setMsg('ส่งคำขอยกเลิกแล้ว รอ Admin อนุมัติ');
    } catch (e) {
      if (cancellationRequest) await removeCancellationRequest(cancellationRequest.id, booking.ownerId);
      throw e;
    }
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
                tone={booking.paymentStatus === 'paid' ? 'ok' : booking.paymentStatus === 'owner_confirmed' ? 'info' : 'warn'}
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
            {cancellation ? <CancellationSummary request={cancellation} /> : null}
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
                  {booking.finalQuote ? 'ราคาสุดท้าย' : 'สรุปค่าใช้จ่าย'}
                </h3>
                <PriceQuote quote={quote} title="" />
              </div>
            </aside>
          </div>

          {canAddServices && (
            <div className="tp-card" style={{ marginTop: '1rem' }}>
              {showOtherServiceOptions ? (
                <>
                  <div className="tp-add-service-head">
                    <div>
                      <h3 className="tp-section-title" style={{ marginBottom: 0 }}>
                        เพิ่มบริการ
                      </h3>
                      <p className="tp-muted" style={{ margin: '0.35rem 0 0' }}>
                        เพิ่มค่าบริการสถานที่ในยอดรับ–ส่ง ส่วนการจองห้องพักจริงจะแยกใบจองและชำระแยก
                      </p>
                      {quote?.otherService && !wantExtra && (
                        <p style={{ margin: '0.5rem 0 0' }}>
                          เพิ่มแล้ว: <strong>{quote.otherService.label}</strong>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`tp-add-service-btn ${wantExtra ? 'is-open' : ''}`}
                      aria-expanded={wantExtra}
                      aria-label={wantExtra ? 'ปิดฟอร์มเพิ่มบริการ' : 'เพิ่มบริการคลินิกหรือโรงแรม'}
                      title={wantExtra ? 'ปิด' : 'เพิ่มบริการ'}
                      onClick={() => {
                        if (wantExtra) {
                          setWantExtra(false);
                          setOtherServiceId(quote?.otherService?.id || '');
                        } else {
                          setWantExtra(true);
                          setOtherServiceId(quote?.otherService?.id || otherOptions[0]?.id || '');
                        }
                      }}
                    >
                      <i className={`bi ${wantExtra ? 'bi-x-lg' : 'bi-plus-lg'}`} />
                    </button>
                  </div>

                  {wantExtra && (
                    <>
                      <div className="tp-form" style={{ marginTop: '0.85rem' }}>
                        <div className="field">
                          <label htmlFor="detail-other-service">
                            {otherKind === 'hotel' ? 'เลือกห้อง' : 'เลือกบริการ'}
                          </label>
                          <select
                            id="detail-other-service"
                            value={otherServiceId}
                            onChange={(e) => setOtherServiceId(e.target.value)}
                          >
                            {otherOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label} — ฿{Number(opt.price).toLocaleString('th-TH')}
                                {opt.unit ? ` / ${opt.unit}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        {otherKind === 'hotel' && otherServiceId && (
                          <div className="field">
                            <label htmlFor="detail-hotel-nights">จำนวนคืน</label>
                            <input
                              id="detail-hotel-nights"
                              type="number"
                              min={1}
                              max={30}
                              value={hotelNights}
                              onChange={(e) => setHotelNights(Math.max(1, Number(e.target.value) || 1))}
                            />
                          </div>
                        )}
                      </div>
                      <div className="tp-actions">
                        <button
                          type="button"
                          className="btn btn-sky"
                          disabled={savingService || !otherServiceId}
                          onClick={saveOtherService}
                        >
                          บันทึกบริการ
                        </button>
                        {quote?.otherService && (
                          <button
                            type="button"
                            className="btn btn-soft"
                            disabled={savingService}
                            onClick={clearOtherService}
                          >
                            ลบบริการเพิ่ม
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div>
                  <h3 className="tp-section-title" style={{ marginBottom: 0 }}>เพิ่มบริการ</h3>
                  <p className="tp-muted" style={{ margin: '0.35rem 0 0' }}>
                    สร้างใบจองโรงแรมแยกจากรายการรับ–ส่ง
                  </p>
                </div>
              )}
              <div className="tp-actions" style={{ marginTop: '0.75rem' }}>
                <Link
                  className="btn btn-soft"
                  to={`/pet-owner/cat-hotel/book?transportBookingId=${encodeURIComponent(booking.id)}${booking.petId ? `&petId=${encodeURIComponent(booking.petId)}` : ''}`}
                >
                  <i className="bi bi-building me-1" />
                  สร้างใบจองโรงแรมแยก
                </Link>
              </div>
            </div>
          )}

          {linkedHotel && (
            <div className="tp-card" style={{ marginTop: '1rem' }}>
              <h3 className="tp-section-title">
                <i className="bi bi-building" />
                รายการโรงแรมที่เชื่อมไว้
              </h3>
              <p className="tp-muted">{linkedHotel.petName} · {linkedHotel.checkIn} – {linkedHotel.checkOut}</p>
              <Link className="btn btn-soft" to={`/pet-owner/cat-hotel/bookings/${linkedHotel.id}`}>
                ดูรายละเอียดการจองโรงแรม
              </Link>
            </div>
          )}

          {booking.serviceType === 'inbound' && (
            <p className="tp-muted" style={{ marginTop: '1rem' }}>
              ประเภท “รับกลับ” คิดเฉพาะค่ารถ ไม่เพิ่มบริการอื่น
            </p>
          )}

          {primaryTrip && (
            <div className="tp-status-card">
              <h3 className="tp-section-title">
                <i className="bi bi-truck" />
                สถานะการดำเนินการ
              </h3>
              <TripStatusTimeline status={primaryTrip.status} orientation="horizontal" />
            </div>
          )}

          {booking.paymentStatus === 'unpaid' && booking.paymentNote ? (
            <div className="tp-alert tp-alert--danger" role="status">
              ฝ่ายบัญชีไม่อนุมัติสลิป: {booking.paymentNote} กรุณาแนบสลิปใหม่
            </div>
          ) : null}

          {canPay && (
            <div className="tp-card" style={{ marginTop: '1rem' }}>
              <h3 className="tp-section-title">
                <i className="bi bi-cash-coin" />
                ชำระเงิน
              </h3>
              <p className="tp-muted">
                สแกน QR ด้วยแอปธนาคาร แล้วแนบสลิปเพื่อส่งให้ฝ่ายบัญชีตรวจสอบ
              </p>

              {!showQr ? (
                <div className="tp-actions">
                  <button type="button" className="btn btn-sky" onClick={() => setShowQr(true)}>
                    <i className="bi bi-qr-code-scan" />
                    ยืนยันการชำระ — แสดง QR
                  </button>
                </div>
              ) : (
                <>
                  <PaymentQr bookingId={booking.id} amount={payAmount} visible />
                  <div className="tp-form">
                    <div className="field">
                      <label htmlFor="pay-slip">สลิปการโอนเงิน (จำเป็น)</label>
                      <input
                        id="pay-slip"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={onSlipFile}
                      />
                    </div>
                    {slip ? (
                      <img
                        src={slip}
                        alt="ตัวอย่างสลิปที่แนบ"
                        style={{ display: 'block', maxWidth: '240px', maxHeight: '240px', objectFit: 'contain', marginTop: '0.5rem' }}
                      />
                    ) : null}
                  </div>
                  <div className="tp-actions">
                    <button type="button" className="btn btn-sky" onClick={pay} disabled={!slip}>
                      ส่งสลิปให้ฝ่ายบัญชีตรวจสอบ
                    </button>
                    <button type="button" className="btn btn-soft" onClick={() => setShowQr(false)}>
                      ปิด QR
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {booking.paymentStatus === 'owner_confirmed' && (
            <div className="tp-card" style={{ marginTop: '1rem' }}>
              <h3 className="tp-section-title">
                <i className="bi bi-hourglass-split" />
                รอตรวจสอบการชำระเงิน
              </h3>
              <p className="tp-muted">ส่งสลิปให้ฝ่ายบัญชีแล้ว รอการตรวจสอบ</p>
              {booking.paymentSlip ? (
                <img
                  src={booking.paymentSlip}
                  alt="สลิปที่ส่งให้ฝ่ายบัญชี"
                  style={{ display: 'block', maxWidth: '240px', maxHeight: '240px', objectFit: 'contain' }}
                />
              ) : null}
            </div>
          )}

          {canCancel && (
            <div className="tp-cancel-card">
              <h3 className="tp-section-title tp-section-title--danger">
                <i className="bi bi-x-circle" />
                ขอยกเลิกการจอง
              </h3>
              <p className="tp-muted">
                Admin จะพิจารณาคำขอก่อนส่งต่อให้ฝ่ายบัญชี
              </p>
              <CancellationRequestForm
                idPrefix={`transport-cancel-${booking.id}`}
                initialPhone={currentUser?.phone || booking.ownerPhone || ''}
                onSubmit={cancel}
              />
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
