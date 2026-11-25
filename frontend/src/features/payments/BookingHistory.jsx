import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { HOTEL_STATUS_LABEL, useHotelBookings } from '../pet-owner/useHotelBookings.js';
import { BOOKING_STATUS } from '../pet-owner/bookingOptions.js';
import { useBookings } from '../pet-owner/useBookings.js';
import { useTransport } from '../pet-transport/useTransport.js';
import { bookingStatusMeta } from '../pet-transport/constants.js';
import CancellationSummary from '../cancellations/CancellationSummary.jsx';
import {
  cancellationFor,
  useCancellationRequests,
} from '../cancellations/store.js';
import { PAY_KIND, PAY_KIND_LABEL, PAY_STATUS, PAY_STATUS_LABEL, paymentFor, usePayments } from './store.js';
import './payment.css';

const TABS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: PAY_KIND.hotel, label: 'โรงแรม' },
  { id: PAY_KIND.transport, label: 'รับส่ง' },
  { id: PAY_KIND.clinic, label: 'จองคิวคลินิก' },
];

function when(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function payState(payment) {
  if (!payment) return { text: 'ยังไม่เข้าสู่การชำระ', tone: 'is-wait' };
  if (payment.status === PAY_STATUS.approved) return { text: PAY_STATUS_LABEL.approved, tone: 'is-ok' };
  if (payment.status === PAY_STATUS.cancelled) return { text: PAY_STATUS_LABEL.cancelled, tone: 'is-wait' };
  if (payment.status === PAY_STATUS.rejected) return { text: `ยังไม่อนุมัติ${payment.note ? ` · ${payment.note}` : ''}`, tone: 'is-wait' };
  return { text: 'ยังไม่อนุมัติ', tone: 'is-wait' };
}

export function useBookingHistory(ownerId) {
  const { all } = usePayments(ownerId);
  const cancellations = useCancellationRequests(ownerId);
  const { bookings: hotels } = useHotelBookings();
  const { bookings: trips } = useTransport();
  const { bookings: clinics, loading: clinicsLoading, error: clinicsError, reload: reloadClinics } = useBookings();
  const rows = useMemo(() => {
    const payments = all.filter((row) => row.ownerId === ownerId);
    const rows = payments.map((payment) => ({
      id: payment.id,
      kind: payment.kind,
      title: payment.title,
      detail: payment.detail,
      when: payment.createdAt,
      pay: payState(payment),
      cancellation: cancellationFor(payment.kind, payment.refId, cancellations),
      href: payment.kind === PAY_KIND.hotel && payment.refId
        ? `/pet-owner/cat-hotel/bookings/${payment.refId}`
        : `/pet-owner/pay/${payment.id}`,
    }));
    hotels.forEach((booking) => {
      if (paymentFor(PAY_KIND.hotel, booking.id, ownerId)) return;
      rows.push({
        id: booking.id,
        kind: PAY_KIND.hotel,
        title: booking.petName,
        detail: HOTEL_STATUS_LABEL[booking.status] || '',
        when: booking.createdAt,
        pay: { text: 'การจองก่อนมีมัดจำ', tone: 'is-ok' },
        cancellation: cancellationFor(PAY_KIND.hotel, booking.id, cancellations),
        href: `/pet-owner/cat-hotel/bookings/${booking.id}`,
      });
    });
    trips.filter((booking) => booking.ownerId === ownerId).forEach((booking) => {
      if (paymentFor(PAY_KIND.transport, booking.id, ownerId)) return;
      const meta = bookingStatusMeta(booking.status);
      rows.push({
        id: booking.id,
        kind: PAY_KIND.transport,
        title: booking.petName,
        detail: meta?.label || booking.status,
        when: booking.createdAt,
        pay: { text: booking.paymentStatus === 'paid' ? 'อนุมัติแล้ว' : 'ยังไม่อนุมัติ', tone: booking.paymentStatus === 'paid' ? 'is-ok' : 'is-wait' },
        cancellation: cancellationFor(PAY_KIND.transport, booking.id, cancellations),
        href: `/pet-owner/transport/${booking.id}`,
      });
    });
    clinics.forEach((booking) => {
      if (paymentFor(PAY_KIND.clinic, booking.id, ownerId)) return;
      const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
      rows.push({
        id: booking.id,
        kind: PAY_KIND.clinic,
        title: booking.petName || 'นัดหมายคลินิก',
        detail: `${booking.serviceLabel || booking.service || 'นัดคลินิก'} · ${booking.time || ''} น. · ${status.label}`,
        when: booking.date || booking.createdAt,
        pay: { text: 'ไม่ต้องชำระมัดจำ', tone: '' },
        cancellation: cancellationFor(PAY_KIND.clinic, booking.id, cancellations),
        href: '/pet-owner/booking',
      });
    });
    return rows.sort((a, b) => String(b.when).localeCompare(String(a.when)));
  }, [all, hotels, trips, clinics, cancellations, ownerId]);

  return { rows, clinicsLoading, clinicsError, reloadClinics };
}

export default function BookingHistory({ embedded = false }) {
  const { currentUser } = useAuth();
  const { rows, clinicsLoading, clinicsError, reloadClinics } = useBookingHistory(currentUser?.id);
  const [tab, setTab] = useState('all');
  const visible = tab === 'all' ? rows : rows.filter((row) => row.kind === tab);
  const clinicTabSelected = tab === 'all' || tab === PAY_KIND.clinic;
  const waitingForClinics = clinicsLoading && clinicTabSelected;
  const clinicLoadFailed = Boolean(clinicsError) && clinicTabSelected;

  return (
    <section className={embedded ? 'hist-embed' : 'hist-page page-wrap'} aria-label="ประวัติการจอง">
      <div className={embedded ? '' : 'container'}>
        {embedded ? null : (
          <header className="hist-mast">
            <p>บัญชีนี้</p>
            <h1>ประวัติการจอง</h1>
          </header>
        )}
        <div className="hist-tabs" role="tablist">
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'is-on' : ''} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {waitingForClinics && <p role="status">กำลังโหลดนัดหมายคลินิก...</p>}
        {clinicLoadFailed && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>โหลดนัดหมายคลินิกไม่สำเร็จ: {clinicsError}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reloadClinics}>ลองใหม่</button>
          </div>
        )}
        {visible.length === 0 && !waitingForClinics && !clinicLoadFailed ? (
          <div className="hist-empty">
            <p>ยังไม่มีรายการในหมวดนี้</p>
          </div>
        ) : visible.length > 0 ? (
          <div className="hist-list">
            {visible.map((row) => (
              <article key={`${row.kind}-${row.id}`} className="hist-card">
                <header>
                  <div>
                    <span className="hist-chip">{PAY_KIND_LABEL[row.kind]}</span>
                    <strong>{row.title}</strong>
                    <p>{row.detail}{row.when ? ` · ${when(row.when)}` : ''}</p>
                  </div>
                  <span className={`hist-status ${row.pay.tone}`}>{row.pay.text}</span>
                </header>
                <CancellationSummary request={row.cancellation} />
                <Link to={row.href}>เปิดรายการ</Link>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
