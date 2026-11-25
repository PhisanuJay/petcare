import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PAY_KIND, PAY_STATUS, usePayments } from '../../payments/store.js';
import { useBookings } from '../useBookings.js';
import { todayString } from '../bookingOptions.js';
import { HOTEL_STATUS, useHotelBookings, HOTEL_STATUS_LABEL } from '../useHotelBookings.js';
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

const ROOM_LABELS = {
  Standard: 'ห้องมาตรฐาน',
  Deluxe: 'ห้องพิเศษ',
  Suite: 'ห้องสวีท',
};

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

function paymentMeta(payment) {
  if (!payment) return { label: 'ยังไม่มีข้อมูลชำระเงิน', tone: 'warn' };
  if (payment.status === PAY_STATUS.approved) return { label: 'ชำระมัดจำแล้ว', tone: 'ok' };
  if (payment.status === PAY_STATUS.review) return { label: 'รอตรวจสอบสลิป', tone: 'info' };
  if (payment.status === PAY_STATUS.rejected) return { label: 'สลิปไม่ผ่านการตรวจ', tone: 'warn' };
  return { label: 'รอแนบสลิป', tone: 'warn' };
}

export default function HotelBookingDetailPage() {
  const { bookingId } = useParams();
  const { currentUser } = useAuth();
  const { bookings } = useHotelBookings();
  const { all: payments } = usePayments(currentUser?.id);
  const cancellations = useCancellationRequests(currentUser?.id);
  const { bookings: transportBookings } = useTransport();
  const { bookings: clinicBookings } = useBookings();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const booking = bookings.find((item) => item.id === bookingId);
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
    : STAY_STEPS.findIndex((step) => step.id === booking.status);
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
            <p>{booking.petName} · สร้างรายการเมื่อ {new Date(booking.createdAt).toLocaleString('th-TH')}</p>
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
            <dl className="stay-folio-line">
              <div><dt>ห้องพัก</dt><dd>{ROOM_LABELS[booking.roomName] || booking.roomName}</dd></div>
              <div><dt>สัตว์เลี้ยง</dt><dd>{booking.petName}</dd></div>
              <div><dt>จำนวนกรง</dt><dd>{booking.cages || '—'} กรง</dd></div>
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
              <div><dt>มัดจำ 30%</dt><dd>{baht(payment?.deposit ?? Math.round(booking.total * 0.3))}</dd></div>
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
