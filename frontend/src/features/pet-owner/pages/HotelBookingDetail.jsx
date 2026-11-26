import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ownerRequest } from '../api.js';
import { PAY_KIND, PAY_STATUS, usePayments } from '../../payments/store.js';
import { useBookings } from '../useBookings.js';
import { todayString } from '../bookingOptions.js';
import { HOTEL_STATUS, useHotelBookings, HOTEL_STATUS_LABEL, stayNights } from '../useHotelBookings.js';
import { usePets } from '../usePets.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import CancellationRequestForm from '../../cancellations/CancellationRequestForm.jsx';
import CancellationSummary from '../../cancellations/CancellationSummary.jsx';
import {
  CANCELLATION_STATUS,
  cancellationFor,
  createCancellationRequest,
  hasOpenCancellation,
  useCancellationRequests,
} from '../../cancellations/store.js';
import '../hotel.css';

import { roomLabelThai, roomTypeTitleTh } from '../hotelRooms.js';

const STAY_STEPS = [
  { id: 'waiting', label: 'รอนำมาฝาก' },
  { id: 'checked_in', label: 'กำลังเข้าพัก' },
  { id: 'checked_out', label: 'รับกลับแล้ว' },
];

function baht(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}

function formatDay(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatCreatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function petNamesFromLines(lines, pets) {
  const ids = new Set();
  for (const line of lines || []) {
    for (const id of line.petIds || []) ids.add(id);
  }
  const names = [...ids].map((id) => pets.find((p) => p.id === id)?.name).filter(Boolean);
  return names.length ? names.join(', ') : null;
}

function mapApiStayToBooking(apiStay, ownerId, pets) {
  const lines = apiStay.lines || [];
  return {
    id: apiStay.id,
    ownerId: apiStay.ownerId || ownerId,
    checkIn: apiStay.checkIn,
    checkOut: apiStay.checkOut,
    status: apiStay.status,
    total: apiStay.total ?? apiStay.totalPrice,
    subtotal: apiStay.subtotal,
    discount: apiStay.discount,
    nights: apiStay.nights ?? stayNights(apiStay.checkIn, apiStay.checkOut),
    createdAt: apiStay.createdAt,
    lines,
    note: apiStay.note,
    petName: petNamesFromLines(lines, pets),
    petIds: [...new Set(lines.flatMap((l) => l.petIds || []))],
    linkedBookings: [],
  };
}

function stayProgressStatus(status) {
  if (status === 'pending' || status === 'confirmed') return HOTEL_STATUS.waiting;
  return status;
}

function paymentMeta(payment) {
  if (!payment) return { label: 'ยังไม่มีข้อมูลชำระเงิน', tone: 'warn' };
  if (payment.status === PAY_STATUS.approved) return { label: 'ชำระเงินแล้ว', tone: 'ok' };
  if (payment.status === PAY_STATUS.review) return { label: 'รอตรวจสอบสลิป', tone: 'info' };
  if (payment.status === PAY_STATUS.rejected) return { label: 'สลิปไม่ผ่านการตรวจ', tone: 'warn' };
  return { label: 'รอแนบสลิป', tone: 'warn' };
}

export default function HotelBookingDetailPage() {
  const { bookingId } = useParams();
  const { currentUser } = useAuth();
  const { bookings } = useHotelBookings();
  const { pets } = usePets();
  const { all: payments } = usePayments(currentUser?.id);
  const cancellations = useCancellationRequests(currentUser?.id);
  const { bookings: transportBookings } = useTransport();
  const { bookings: clinicBookings } = useBookings();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [apiStay, setApiStay] = useState(null);
  const legacyBooking = bookings.find((item) => item.id === bookingId);

  useEffect(() => {
    if (legacyBooking || !currentUser?.id || !bookingId) return undefined;
    let gone = false;
    ownerRequest(currentUser.id, `/cat-hotel/stays/${bookingId}`)
      .then((stay) => {
        if (!gone) setApiStay(stay);
      })
      .catch(() => {
        if (!gone) setApiStay(null);
      });
    return () => {
      gone = true;
    };
  }, [legacyBooking, bookingId, currentUser?.id]);

  const booking = legacyBooking || (apiStay
    ? mapApiStayToBooking(apiStay, currentUser?.id, pets)
  : null);
  const payment = payments.find((item) =>
    item.kind === PAY_KIND.hotel && item.refId === bookingId && item.ownerId === currentUser?.id);

  if (!booking || booking.ownerId !== currentUser?.id) {
    return (
      <div className="stay-page page-wrap">
        <div className="container">
          <div className="stay-empty">
            <p className="stay-kicker">ไม่พบการจอง</p>
            <Link className="btn btn-sky" to="/pet-owner/cat-hotel/bookings">กลับไปใบจอง</Link>
          </div>
        </div>
      </div>
    );
  }

  const pay = paymentMeta(payment);
  const cancellation = cancellationFor(PAY_KIND.hotel, booking.id, cancellations);
  const activeStep = booking.status === HOTEL_STATUS.cancelled
    ? -1
    : STAY_STEPS.findIndex((step) => step.id === stayProgressStatus(booking.status));
  const canCancel = booking.status === HOTEL_STATUS.waiting
    && booking.checkIn >= todayString()
    && !hasOpenCancellation(PAY_KIND.hotel, booking.id, cancellations);
  const linkedBookings = Array.isArray(booking.linkedBookings) ? booking.linkedBookings : [];
  const petId = booking.petIds?.[0] || booking.petId || '';
  const linkedRows = linkedBookings.map((linked) => {
    if (linked.kind === 'transport') {
      const related = transportBookings.find((item) => item.id === linked.id);
      return {
        kind: linked.kind,
        id: linked.id,
        title: related?.petName ? `รับ–ส่ง · ${related.petName}` : linked.label || 'รับ–ส่งสัตว์เลี้ยง',
        detail: related
          ? [
            related.statusMeta?.label || related.status,
            related.paymentStatus === 'paid'
              ? 'ชำระแล้ว'
              : related.paymentStatus === 'owner_confirmed'
                ? 'รอตรวจสอบ'
                : 'ยังไม่ชำระ',
          ]
            .filter(Boolean)
            .join(' · ')
          : 'เปิดดูรายละเอียดรับ–ส่ง',
        href: `/pet-owner/transport/${linked.id}`,
      };
    }
    const related = clinicBookings.find((item) => item.id === linked.id);
    return {
      kind: linked.kind,
      id: linked.id,
      title: related?.serviceName || linked.label || 'นัดหมายคลินิก',
      detail: [related?.petName, related?.date, related?.time, related?.status]
        .filter(Boolean)
        .join(' · ') || 'เปิดรายการนัดคลินิก',
      href: '/pet-owner/booking',
    };
  });
  const paymentToneClass = `stay-detail-status ${pay.tone}`;

  async function submitCancellation(details) {
    await createCancellationRequest({
      ...details,
      kind: PAY_KIND.hotel,
      source: 'local_hotel',
      refId: booking.id,
      ownerId: booking.ownerId,
      ownerName: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim(),
      ownerEmail: currentUser?.email || '',
      petName: booking.petName,
      title: 'จองโรงแรม',
      bookingDate: booking.checkIn,
    });
    setShowCancelForm(false);
  }

  return (
    <div className="stay-page page-wrap">
      <div className="container">
        <Link className="stay-back" to="/pet-owner/cat-hotel/bookings">กลับไปใบจอง</Link>
        <header className="stay-detail-head">
          <div>
            <p className="stay-kicker">โรงแรมสัตว์เลี้ยง · {booking.id.slice(-6).toUpperCase()}</p>
            <h1>รายละเอียดการจอง</h1>
            <p>
              {[
                booking.petName,
                formatCreatedAt(booking.createdAt) ? `สร้างรายการเมื่อ ${formatCreatedAt(booking.createdAt)}` : null,
              ].filter(Boolean).join(' · ') || 'รายการจองโรงแรม'}
            </p>
          </div>
          <span className={`stay-status ${booking.status}`}>
            {HOTEL_STATUS_LABEL[booking.status] || booking.status}
          </span>
        </header>

        {booking.status !== HOTEL_STATUS.cancelled ? (
          <section className="stay-detail-progress" aria-label="สถานะการเข้าพัก">
            {STAY_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`stay-detail-progress-step${index === activeStep ? ' is-current' : ''}${index < activeStep ? ' is-complete' : ''}`}
                aria-current={index === activeStep ? 'step' : undefined}
              >
                <span>{index < activeStep ? '✓' : index + 1}</span>
                <strong>{step.label}</strong>
              </div>
            ))}
          </section>
        ) : null}
        <CancellationSummary request={cancellation} />

        <div className="stay-detail-grid">
          <section className="stay-detail-card">
            <h2>ข้อมูลการเข้าพัก</h2>
            {Array.isArray(booking.lines) && booking.lines.length > 0 ? (
              <ul className="stay-detail-rooms">
                {booking.lines.map((line) => {
                  const linePets = (line.petIds || [])
                    .map((id) => pets.find((p) => p.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <li key={line.id || `${line.roomTypeId}-${line.units}`}>
                      <div className="stay-detail-rooms__main">
                        <strong>{roomTypeTitleTh(line.roomTypeId)}</strong>
                        <span>{line.units} ห้อง</span>
                      </div>
                      {linePets ? <span className="stay-detail-rooms__pets">สัตว์: {linePets}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <dl className="stay-folio-line">
              {!booking.lines?.length ? (
                <div><dt>ห้องพัก</dt><dd>{roomLabelThai(booking.roomName)}</dd></div>
              ) : null}
              <div><dt>สัตว์เลี้ยง</dt><dd>{booking.petName || '—'}</dd></div>
              {!booking.lines ? (
                <div><dt>จำนวนกรง</dt><dd>{booking.cages || '—'} กรง</dd></div>
              ) : null}
              <div><dt>วันเข้าพัก</dt><dd>{formatDay(booking.checkIn)}</dd></div>
              <div><dt>วันรับกลับ</dt><dd>{formatDay(booking.checkOut)}</dd></div>
              <div><dt>จำนวนคืน</dt><dd>{booking.nights || '—'} คืน</dd></div>
            </dl>
            {booking.cageNote && <p className="stay-note">{booking.cageNote}</p>}
          </section>

          <section className="stay-detail-card">
            <h2>สรุปค่าใช้จ่าย</h2>
            <dl className="stay-folio-line">
              <div><dt>ยอดค่าห้อง</dt><dd>{baht(booking.subtotal)}</dd></div>
              <div><dt>ส่วนลด</dt><dd>{booking.discount ? `-${baht(booking.discount)}` : '—'}</dd></div>
              <div><dt>ยอดรวม</dt><dd>{baht(booking.total)}</dd></div>
            </dl>
            <span className={paymentToneClass}>{pay.label}</span>
            {payment?.slip && (
              <div className="stay-detail-slip">
                <p>สลิปที่แนบ</p>
                <img src={payment.slip} alt="สลิปการชำระเงิน" />
              </div>
            )}
            {payment && payment.status !== PAY_STATUS.approved && (
              <Link className="btn btn-sky mt-3" to={`/pet-owner/pay/${payment.id}`}>
                {payment.status === PAY_STATUS.review ? 'ดูสลิปที่ส่ง' : 'จัดการชำระเงิน'}
              </Link>
            )}
          </section>
        </div>

        {canCancel ? (
          <section className="stay-detail-card">
            <h2>ขอยกเลิกการจอง</h2>
            <p>แอดมินจะพิจารณาคำขอก่อนส่งต่อให้ฝ่ายบัญชี</p>
            {showCancelForm ? (
              <CancellationRequestForm
                idPrefix={`hotel-cancel-${booking.id}`}
                initialPhone={currentUser?.phone || ''}
                onSubmit={submitCancellation}
                onCancel={() => setShowCancelForm(false)}
              />
            ) : (
              <button type="button" className="btn btn-soft-danger mt-2" onClick={() => setShowCancelForm(true)}>
                ขอยกเลิกการจอง
              </button>
            )}
          </section>
        ) : null}

        {booking.status !== HOTEL_STATUS.cancelled
          && cancellation?.status !== CANCELLATION_STATUS.pendingAdmin
          && cancellation?.status !== CANCELLATION_STATUS.awaitingRefund ? (
            <section className="stay-detail-card stay-detail-services">
              <div>
                <h2>เพิ่มบริการ</h2>
                <p>แต่ละบริการจะสร้างใบจองแยก และเชื่อมกลับมายังรายการโรงแรมนี้</p>
              </div>
              <div className="stay-detail-actions">
                <Link
                  className="btn btn-sky"
                  to={`/pet-owner/transport?hotelBookingId=${encodeURIComponent(booking.id)}&petId=${encodeURIComponent(petId)}`}
                >
                  <i className="bi bi-truck me-1" /> เพิ่มรับ–ส่ง
                </Link>
                <Link
                  className="btn btn-soft"
                  to={`/pet-owner/booking?hotelBookingId=${encodeURIComponent(booking.id)}&petId=${encodeURIComponent(petId)}`}
                >
                  <i className="bi bi-hospital me-1" /> จองคลินิก
                </Link>
              </div>
            </section>
          ) : null}

        <section className="stay-detail-card">
          <h2>บริการที่เชื่อมกับการจองนี้</h2>
          {linkedRows.length === 0 ? (
            <p className="stay-note">ยังไม่มีบริการอื่นที่เชื่อมไว้</p>
          ) : (
            <div className="stay-detail-linked">
              {linkedRows.map((item) => (
                <article key={`${item.kind}-${item.id}`} className="stay-detail-linked-item">
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <Link to={item.href}>ดูรายการ</Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
