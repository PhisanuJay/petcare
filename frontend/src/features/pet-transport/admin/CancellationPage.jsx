import { useState } from 'react';
import { ISSUE_REASONS } from '../constants.js';
import { useTransport } from '../useTransport.js';
import { useAllHotelBookings, HOTEL_STATUS } from '../../pet-owner/useHotelBookings.js';
import { resolveClinicCancellation, resolveHotelReservationCancellation } from '../../pet-owner/api.js';
import { PAY_KIND, PAY_STATUS, cancelPendingPayment, usePayments } from '../../payments/store.js';
import {
  CANCELLATION_STATUS,
  CANCELLATION_STATUS_LABEL,
  resolveCancellationRequest,
  useCancellationRequests,
} from '../../cancellations/store.js';

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function issueReasonLabel(reasonId) {
  return ISSUE_REASONS.find((reason) => reason.id === reasonId)?.label || 'อื่น ๆ';
}

export default function CancellationPage() {
  const { bookings, resolveCancel, issues, drivers } = useTransport();
  const { setStatus: setHotelStatus } = useAllHotelBookings();
  const { all: payments } = usePayments('clinic_admin');
  const cancellations = useCancellationRequests('clinic_admin');
  const requests = cancellations.filter(
    (request) => request.status === CANCELLATION_STATUS.pendingAdmin,
  );
  const [notes, setNotes] = useState({});
  const [resolving, setResolving] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function decide(request, approve) {
    setError('');
    setNotice('');
    setResolving((current) => ({ ...current, [request.id]: true }));
    try {
      const transportBooking = bookings.find(
        (booking) => booking.id === request.refId && request.source === 'transport',
      );
      const payment = payments.find(
        (row) => row.kind === request.kind && row.refId === request.refId,
      );
      const refundAmount = request.kind === PAY_KIND.hotel && payment?.status === PAY_STATUS.approved
        ? Number(payment.deposit || 0)
        : request.kind === PAY_KIND.transport && transportBooking?.paymentStatus === 'paid'
          ? Number(
            transportBooking.finalQuote?.total
            ?? transportBooking.quote?.total
            ?? transportBooking.estimatedQuote?.total
            ?? 0,
          )
          : 0;

      if (request.source === 'transport') {
        await resolveCancel(request.refId, request.id, approve, notes[request.id] || '');
      } else if (request.source === 'clinic') {
        await resolveClinicCancellation(request.refId, request.id, approve, notes[request.id] || '');
      } else if (request.source === 'hotel_reservation') {
        await resolveHotelReservationCancellation(request.refId, request.id, approve, notes[request.id] || '');
      } else if (request.source === 'local_hotel' && approve) {
        setHotelStatus(request.refId, HOTEL_STATUS.cancelled);
      }

      await resolveCancellationRequest(request.id, {
        approve,
        adminNote: notes[request.id] || '',
        refundAmount,
      });
      if (approve) await cancelPendingPayment(request.kind, request.refId);
      setNotice(approve
        ? 'อนุมัติคำขอแล้ว ส่งรายการให้ฝ่ายบัญชีดำเนินการคืนเงิน'
        : 'ไม่อนุมัติคำขอยกเลิกแล้ว');
    } catch (resolveError) {
      setError(resolveError.message || 'บันทึกผลการพิจารณาไม่สำเร็จ');
    } finally {
      setResolving((current) => ({ ...current, [request.id]: false }));
    }
  }

  return (
    <div className="tp-cancellation">
      <header className="tp-cancellation__mast">
        <p>งานรับส่งสัตว์</p>
        <h1>คำขอยกเลิกและรายงานปัญหา</h1>
        <span>พิจารณาคำขอยกเลิกโรงแรม รับส่ง และนัดคลินิก พร้อมติดตามรายงานจากคนขับ</span>
      </header>

      <div className="tp-cancellation__grid">
        <section className="tp-cancellation__section" aria-labelledby="tp-cancellation-title">
          <header className="tp-cancellation__section-head">
            <div>
              <h2 id="tp-cancellation-title">คำขอยกเลิกจากเจ้าของ</h2>
              <p>คำขอที่อนุมัติจะเข้าสู่คิวคืนเงินของฝ่ายบัญชี</p>
            </div>
            <span className="tp-cancellation__count">{requests.length} คำขอ</span>
          </header>

          {error ? <div className="tp-alert tp-alert--danger" role="alert">{error}</div> : null}
          {notice ? <div className="tp-alert tp-alert--ok" role="status">{notice}</div> : null}
          {requests.length ? (
            <div className="tp-cancellation__requests">
              {requests.map((request) => (
                <article className="tp-cancellation__request" key={request.id}>
                  <header className="tp-cancellation__request-head">
                    <div className="tp-cancellation__identity">
                      <span className="tp-cancellation__mark" aria-hidden="true">
                        <i className="bi bi-heart-pulse" />
                      </span>
                      <span>
                        <strong>{request.petName || 'ไม่ระบุชื่อสัตว์'}</strong>
                        <small>{request.title || request.kind} · เจ้าของ {request.ownerName || 'ไม่ระบุชื่อ'}</small>
                      </span>
                    </div>
                    <span className="tp-cancellation__status">
                      <i aria-hidden="true" />
                      {CANCELLATION_STATUS_LABEL[request.status]}
                    </span>
                  </header>

                  <div className="tp-cancellation__reason">
                    <span>เหตุผลที่ขอยกเลิก</span>
                    <p>{request.reason || 'ไม่ได้ระบุเหตุผล'}</p>
                    {formatWhen(request.createdAt) ? (
                      <small>{formatWhen(request.createdAt)}</small>
                    ) : null}
                  </div>

                  <dl className="tp-cancellation__refund-data">
                    <div><dt>ธนาคาร</dt><dd>{request.bankName}</dd></div>
                    <div><dt>เลขบัญชี</dt><dd>{request.bankAccount}</dd></div>
                    <div><dt>เบอร์ติดต่อ</dt><dd>{request.contactPhone}</dd></div>
                  </dl>

                  <div className="tp-cancellation__decision">
                    <label htmlFor={`cancel-note-${request.id}`}>หมายเหตุการพิจารณา</label>
                    <input
                      id={`cancel-note-${request.id}`}
                      value={notes[request.id] || ''}
                      onChange={(event) => setNotes((current) => ({
                        ...current,
                        [request.id]: event.target.value,
                      }))}
                      placeholder="เพิ่มหมายเหตุ (ถ้ามี)"
                    />
                    <div className="tp-cancellation__actions">
                      <button
                        type="button"
                        className="btn btn-soft-danger"
                        disabled={resolving[request.id]}
                        onClick={() => decide(request, true)}
                      >
                        อนุมัติยกเลิก
                      </button>
                      <button
                        type="button"
                        className="btn btn-soft"
                        disabled={resolving[request.id]}
                        onClick={() => decide(request, false)}
                      >
                        ปฏิเสธคำขอ
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="tp-cancellation__empty" role="status">
              <span className="tp-cancellation__empty-mark" aria-hidden="true">
                <i className="bi bi-check2" />
              </span>
              <span>
                <strong>ไม่มีคำขอยกเลิก</strong>
                <small>คำขอใหม่จากเจ้าของจะแสดงที่นี่</small>
              </span>
            </div>
          )}
        </section>

        <section className="tp-cancellation__section" aria-labelledby="tp-issues-title">
          <header className="tp-cancellation__section-head">
            <div>
              <h2 id="tp-issues-title">ปัญหาจากคนขับ</h2>
              <p>รายงานที่ส่งเข้ามาระหว่างให้บริการ</p>
            </div>
            <span className="tp-cancellation__count">{issues.length} รายงาน</span>
          </header>

          {issues.length ? (
            <div className="tp-cancellation__issues">
              {issues.map((issue) => {
                const driver = drivers.find((item) => item.id === issue.driverId);
                return (
                  <article className="tp-cancellation__issue" key={issue.id}>
                    <header>
                      <div>
                        <strong>{driver?.name || driver?.email || issue.driverId || 'คนขับ'}</strong>
                        {formatWhen(issue.createdAt) ? <small>{formatWhen(issue.createdAt)}</small> : null}
                      </div>
                      <span className="tp-cancellation__status tp-cancellation__status--issue">
                        <i aria-hidden="true" />
                        ต้องติดตาม
                      </span>
                    </header>
                    <p className="tp-cancellation__issue-reason">{issueReasonLabel(issue.reasonId)}</p>
                    {issue.message ? <p className="tp-cancellation__issue-message">{issue.message}</p> : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="tp-cancellation__empty tp-cancellation__empty--compact" role="status">
              <span className="tp-cancellation__empty-mark" aria-hidden="true">
                <i className="bi bi-chat-square-text" />
              </span>
              <span>
                <strong>ยังไม่มีรายงานปัญหา</strong>
                <small>รายงานจากคนขับจะแสดงในส่วนนี้</small>
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
