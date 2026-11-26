import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useBookings } from '../pet-owner/useBookings.js';
import { useHotelStays } from '../pet-owner/useHotelStays.js';
import { useTransport } from '../pet-transport/useTransport.js';
import CancellationSummary from '../cancellations/CancellationSummary.jsx';
import {
  cancellationFor,
  useCancellationRequests,
} from '../cancellations/store.js';
import {
  PAY_KIND,
  PAY_STATUS,
  PAY_STATUS_LABEL,
  paymentFor,
  paymentForRef,
  reloadOwnerPayments,
  usePayments,
} from './store.js';
import { buildBookingHistoryRows, filterHistoryTab } from './bookingHistoryRows.js';
import './payment.css';

const TABS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: PAY_KIND.hub, label: 'จองรวม' },
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

/** ประวัติแสดงเฉพาะ flow ที่ชำระก่อนจอง — ไม่แสดง «รอชำระเงิน» */
const HISTORY_PAID_OK = { text: PAY_STATUS_LABEL.approved, tone: 'is-ok' };

function payState(payment) {
  if (!payment) return HISTORY_PAID_OK;
  if (payment.status === PAY_STATUS.approved || payment.status === PAY_STATUS.review) {
    return HISTORY_PAID_OK;
  }
  if (payment.status === PAY_STATUS.awaiting) return HISTORY_PAID_OK;
  if (payment.status === PAY_STATUS.cancelled) {
    return { text: PAY_STATUS_LABEL.cancelled, tone: 'is-wait' };
  }
  if (payment.status === PAY_STATUS.rejected) {
    return {
      text: `ชำระไม่สำเร็จ${payment.note ? ` · ${payment.note}` : ''}`,
      tone: 'is-wait',
    };
  }
  return HISTORY_PAID_OK;
}

export function useBookingHistory(ownerId) {
  const { all, loadError: paymentsError } = usePayments(ownerId);
  const cancellations = useCancellationRequests(ownerId);
  const { stays, loading: staysLoading, error: staysError, reload: reloadStays } = useHotelStays();
  const { bookings: trips, loading: transportLoading, error: transportError } = useTransport();
  const { bookings: clinics, loading: clinicsLoading, error: clinicsError, reload: reloadClinics } = useBookings();

  const payStateFn = useCallback((payment) => payState(payment), []);

  const resolvePay = useCallback((kind, refId, _booking) => {
    const payment = paymentForRef(kind, refId, ownerId) || paymentFor(kind, refId, ownerId);
    return payState(payment);
  }, [ownerId]);

  const cancellationBridge = useMemo(() => ({
    forKind: (kind, refId) => cancellationFor(kind, refId, cancellations),
  }), [cancellations]);

  const rows = useMemo(() => {
    if (!ownerId) return [];
    const payments = all.filter((row) => row.ownerId === ownerId);
    return buildBookingHistoryRows({
      ownerId,
      payments,
      payStateFn,
      resolvePay,
      cancellations: cancellationBridge,
      clinics,
      stays,
      legacyHotels: [],
      transports: trips.filter((b) => b.ownerId === ownerId),
    });
  }, [
    all,
    ownerId,
    trips,
    clinics,
    stays,
    payStateFn,
    resolvePay,
    cancellationBridge,
  ]);

  const reloadPayments = useCallback(() => {
    if (ownerId) reloadOwnerPayments(ownerId);
  }, [ownerId]);

  return {
    rows,
    clinicsLoading,
    clinicsError,
    reloadClinics,
    staysLoading,
    staysError,
    reloadStays,
    transportLoading,
    transportError,
    paymentsError,
    reloadPayments,
  };
}

export default function BookingHistory({ embedded = false }) {
  const { currentUser } = useAuth();
  const {
    rows,
    clinicsLoading,
    clinicsError,
    reloadClinics,
    staysLoading,
    staysError,
    reloadStays,
    transportLoading,
    transportError,
    paymentsError,
    reloadPayments,
  } = useBookingHistory(currentUser?.id);
  const [tab, setTab] = useState('all');
  const visible = filterHistoryTab(rows, tab);
  const clinicTabSelected = tab === 'all' || tab === PAY_KIND.clinic;
  const hotelTabSelected = tab === 'all' || tab === PAY_KIND.hotel;
  const transportTabSelected = tab === 'all' || tab === PAY_KIND.transport;

  const waitingForClinics = clinicsLoading && clinicTabSelected;
  const waitingForStays = staysLoading && hotelTabSelected;
  const waitingForTransport = transportLoading && transportTabSelected;
  const anyLoading = waitingForClinics || waitingForStays || waitingForTransport;

  const clinicLoadFailed = Boolean(clinicsError) && clinicTabSelected;
  const staysLoadFailed = Boolean(staysError) && hotelTabSelected;
  const transportLoadFailed = Boolean(transportError) && transportTabSelected;
  const paymentsLoadFailed = Boolean(paymentsError);
  const anyLoadFailed = clinicLoadFailed || staysLoadFailed || transportLoadFailed || paymentsLoadFailed;

  function retryAll() {
    reloadClinics();
    reloadStays();
    reloadPayments();
  }

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
        {anyLoading && <p role="status">กำลังโหลดข้อมูลการจอง...</p>}
        {clinicLoadFailed && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>โหลดนัดหมายคลินิกไม่สำเร็จ: {clinicsError}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reloadClinics}>ลองใหม่</button>
          </div>
        )}
        {staysLoadFailed && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>โหลดการจองโรงแรมไม่สำเร็จ: {staysError}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reloadStays}>ลองใหม่</button>
          </div>
        )}
        {transportLoadFailed && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>โหลดรับ–ส่งไม่สำเร็จ: {transportError}</span>
          </div>
        )}
        {paymentsLoadFailed && (
          <div className="alert alert-warning d-flex align-items-center justify-content-between" role="alert">
            <span>โหลดรายการชำระเงินไม่สำเร็จ: {paymentsError}</span>
            <button type="button" className="btn btn-sm btn-outline-warning" onClick={reloadPayments}>ลองใหม่</button>
          </div>
        )}
        {visible.length === 0 && !anyLoading && !anyLoadFailed ? (
          <div className="hist-empty">
            <p>ยังไม่มีรายการในหมวดนี้</p>
          </div>
        ) : visible.length === 0 && !anyLoading && anyLoadFailed ? (
          <div className="hist-empty">
            <p>โหลดข้อมูลไม่ครบ — กดลองใหม่เพื่อดูรายการ</p>
            <button type="button" className="btn btn-soft btn-sm mt-2" onClick={retryAll}>โหลดใหม่ทั้งหมด</button>
          </div>
        ) : visible.length > 0 ? (
          <div className="hist-list">
            {visible.map((row) => (
              <article
                key={`${row.kind}-${row.id}${row.hubOnly ? '-hub' : ''}${row.hubPaymentId || ''}`}
                className="hist-card"
              >
                <header>
                  <div>
                    <span className="hist-chips">
                      <span className="hist-chip">{row.chip || row.kind}</span>
                      {row.fromHub ? <span className="hist-chip hist-chip-hub">จองรวม</span> : null}
                    </span>
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