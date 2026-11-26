import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { PAY_KIND, PAY_KIND_LABEL, PAY_STATUS, reviewPayment, usePayments } from '../payments/store.js';
import { useTransport } from '../pet-transport/useTransport.js';
import { fileToResizedDataUrl } from '../../shared/utils/storage.js';
import {
  CANCELLATION_STATUS,
  completeCancellationRefund,
  useCancellationRequests,
} from '../cancellations/store.js';
import '../payments/payment.css';

const KINDS = Object.values(PAY_KIND);

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function baht(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}

function dayKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDay(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
  }
  return formatWhen(value);
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function shortId(id) {
  return String(id || '').slice(0, 8).toUpperCase();
}

function transportAmount(booking) {
  const amount = Number(booking.finalQuote?.total ?? booking.quote?.total ?? booking.estimatedQuote?.total);
  return Number.isFinite(amount) ? amount : 0;
}

export default function AccountingPage() {
  const { currentUser, logout } = useAuth();
  const { all, pending } = usePayments('accountant');
  const cancellations = useCancellationRequests('accountant');
  const {
    bookings: transportBookings,
    approveTransportPayment,
    rejectTransportPayment,
    loading: transportLoading,
    error: transportError,
  } = useTransport();
  const [tab, setTab] = useState('desk');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState('all');
  const [note, setNote] = useState({});
  const [reviewError, setReviewError] = useState('');
  const [reviewNotice, setReviewNotice] = useState('');
  const [reviewing, setReviewing] = useState({});
  const [refundSlips, setRefundSlips] = useState({});
  const [refundNotes, setRefundNotes] = useState({});
  const [refundError, setRefundError] = useState('');
  const [refundNotice, setRefundNotice] = useState('');
  const [refunding, setRefunding] = useState({});
  const printedAt = formatWhen(new Date().toISOString());
  const pendingRefunds = cancellations.filter(
    (item) => item.status === CANCELLATION_STATUS.awaitingRefund,
  );

  const pendingTransport = transportBookings.filter(
    (booking) => booking.paymentStatus === 'owner_confirmed'
      && booking.paymentSlip
      && booking.status !== 'cancelled',
  );
  const pendingTransportIds = new Set(pendingTransport.map((booking) => booking.id));
  const pendingPayments = pending.filter(
    (row) => row.kind !== PAY_KIND.transport || !pendingTransportIds.has(row.refId),
  );
  const pendingCount = pendingPayments.length + pendingTransport.length;
  const approved = all.filter((row) => row.status === PAY_STATUS.approved);
  const paidTransport = transportBookings.filter(
    (booking) => booking.paymentStatus === 'paid' && booking.status !== 'cancelled',
  );
  const paidTransportIds = new Set(paidTransport.map((booking) => booking.id));
  const approvedPayments = approved.filter(
    (row) => row.kind !== PAY_KIND.transport || !paidTransportIds.has(row.refId),
  );
  const approvedCount = approvedPayments.length + paidTransport.length;
  const approvedTotal = approvedPayments.reduce((sum, row) => sum + Number(row.deposit || 0), 0)
    + paidTransport.reduce((sum, booking) => sum + transportAmount(booking), 0);
  const incomeByKind = KINDS.map((id) => {
    const rows = approvedPayments.filter((row) => row.kind === id);
    const transportRows = id === PAY_KIND.transport ? paidTransport : [];
    return {
      id,
      count: rows.length + transportRows.length,
      sum: rows.reduce((total, row) => total + Number(row.deposit || 0), 0)
        + transportRows.reduce((total, booking) => total + transportAmount(booking), 0),
    };
  });
  const maxIncomeByKind = Math.max(0, ...incomeByKind.map((item) => item.sum));
  const reviewQueue = [
    ...pendingPayments.map((row) => ({
      id: `payment-${row.id}`,
      kind: row.kind,
      title: row.title || PAY_KIND_LABEL[row.kind],
      owner: row.ownerName || row.email || 'ไม่ระบุเจ้าของ',
      amount: Number(row.deposit || 0),
      at: row.submittedAt || row.createdAt,
    })),
    ...pendingTransport.map((booking) => ({
      id: `transport-${booking.id}`,
      kind: PAY_KIND.transport,
      title: booking.petName || 'รับส่งสัตว์เลี้ยง',
      owner: booking.ownerName || 'ไม่ระบุเจ้าของ',
      amount: transportAmount(booking),
      at: booking.updatedAt || booking.createdAt,
    })),
  ]
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, 5);
  const inRange = useMemo(() => all.filter((row) => {
    const key = dayKey(row.reviewedAt || row.submittedAt || row.createdAt);
    if (from && key < from) return false;
    if (to && key > to) return false;
    if (kind !== 'all' && row.kind !== kind) return false;
    return row.status === PAY_STATUS.approved || row.status === PAY_STATUS.review;
  }), [all, from, to, kind]);
  const approvedInRange = inRange.filter((row) => row.status === PAY_STATUS.approved);
  const income = approvedInRange.reduce((sum, row) => sum + Number(row.deposit || 0), 0);
  const kinds = kind === 'all' ? KINDS : [kind];
  const reportKinds = kinds.map((id) => {
    const rows = approvedInRange.filter((row) => row.kind === id);
    return {
      id,
      count: rows.length,
      sum: rows.reduce((total, row) => total + Number(row.deposit || 0), 0),
    };
  });
  const rangeLabel = `${from ? formatDay(from) : 'เริ่มต้น'} – ${to ? formatDay(to) : 'ปัจจุบัน'}`;

  async function decide(id, decision) {
    setReviewError('');
    setReviewNotice('');
    try {
      await reviewPayment(id, decision, note[id] || '');
    } catch (error) {
      setReviewError(error.message || 'ตรวจสอบสลิปไม่สำเร็จ');
    }
  }

  async function decideTransport(booking, decision) {
    setReviewError('');
    setReviewNotice('');
    setReviewing((current) => ({ ...current, [booking.id]: true }));
    try {
      if (decision === PAY_STATUS.approved) {
        await approveTransportPayment(booking.id);
        setReviewNotice(`อนุมัติการชำระเงินของ ${booking.petName || shortId(booking.id)} แล้ว`);
      } else {
        await rejectTransportPayment(booking.id, note[booking.id] || '');
        setReviewNotice(`ไม่อนุมัติสลิปของ ${booking.petName || shortId(booking.id)} แล้ว`);
      }
    } catch (error) {
      setReviewError(error.message || 'ตรวจสอบสลิปไม่สำเร็จ');
    } finally {
      setReviewing((current) => ({ ...current, [booking.id]: false }));
    }
  }

  async function onRefundFile(event, id) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setRefundError('');
    try {
      const slip = await fileToResizedDataUrl(file, 960, 0.82);
      setRefundSlips((current) => ({ ...current, [id]: slip }));
    } catch (error) {
      setRefundError(error.message || 'อ่านรูปหลักฐานไม่สำเร็จ');
    }
  }

  async function finishRefund(request) {
    setRefundError('');
    setRefundNotice('');
    setRefunding((current) => ({ ...current, [request.id]: true }));
    try {
      const refundAmount = Number(request.refundAmount) || 0;
      await completeCancellationRefund(request.id, {
        receipt: refundSlips[request.id] || '',
        accountantNote: refundNotes[request.id] || (
          refundAmount === 0 ? 'ไม่มีเงินที่ฝ่ายบัญชียืนยันแล้วให้คืน' : ''
        ),
      });
      setRefundNotice(refundAmount > 0
        ? `บันทึกการคืนเงินของ ${request.ownerName || request.petName} แล้ว`
        : `ปิดรายการของ ${request.ownerName || request.petName} โดยไม่ต้องโอนคืนแล้ว`);
    } catch (error) {
      setRefundError(error.message || 'บันทึกการคืนเงินไม่สำเร็จ');
    } finally {
      setRefunding((current) => ({ ...current, [request.id]: false }));
    }
  }

  return (
    <div className="acct-page page-wrap">
      <div className="acct-shell">
        <aside className="acct-side">
          <div className="acct-brand">
            <span><i className="bi bi-balloon-heart-fill" /></span>
            PetCare
          </div>
          <nav className="acct-nav" aria-label="เมนูฝ่ายบัญชี">
            <button type="button" className={tab === 'desk' ? 'is-on' : ''} onClick={() => setTab('desk')}>ภาพรวม</button>
            <button type="button" className={tab === 'slips' ? 'is-on' : ''} onClick={() => setTab('slips')}>
              ตรวจสลิป
              {pendingCount ? <b>{pendingCount}</b> : null}
            </button>
            <button type="button" className={tab === 'refunds' ? 'is-on' : ''} onClick={() => setTab('refunds')}>
              คืนเงิน
              {pendingRefunds.length ? <b>{pendingRefunds.length}</b> : null}
            </button>
            <button type="button" className={tab === 'report' ? 'is-on' : ''} onClick={() => setTab('report')}>รายงาน</button>
          </nav>
          <div className="acct-user">
            <span className="acct-avatar" aria-hidden="true">{(currentUser?.firstName || 'บ').trim().slice(0, 1)}</span>
            <span className="acct-user-copy">
              <strong>{`${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'ฝ่ายบัญชี'}</strong>
              <small>Accountant</small>
            </span>
            <button type="button" onClick={logout} aria-label="ออกจากระบบ">
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        </aside>

        <main className="acct-main">
          {tab === 'desk' ? (
            <>
              <header className="acct-mast acct-overview-mast">
                <p>ฝ่ายบัญชี</p>
                <h1>ภาพรวมรายรับ</h1>
                <p>ยอดชำระที่ฝ่ายบัญชียืนยันแล้ว แยกตามประเภทบริการ</p>
              </header>
              {transportError ? <div className="acct-alert acct-alert--error" role="alert">{transportError}</div> : null}
              <div className="acct-stats acct-overview-stats">
                <div className="acct-stat acct-stat--featured">
                  <span>ยอดรับชำระแล้ว</span>
                  <strong>{transportLoading ? '—' : baht(approvedTotal)}</strong>
                  <small>{transportLoading ? 'กำลังโหลดข้อมูล' : `${approvedCount} รายการที่ผ่านการตรวจ`}</small>
                </div>
                <div className="acct-stat">
                  <span>รอตรวจสลิป</span>
                  <strong>{transportLoading ? '—' : pendingCount}</strong>
                  <small>รายการที่ต้องตรวจสอบ</small>
                </div>
                <div className="acct-stat">
                  <span>ประเภทบริการ</span>
                  <strong>{incomeByKind.filter((item) => item.sum > 0).length}</strong>
                  <small>มีรายรับที่ยืนยันแล้ว</small>
                </div>
              </div>
              <div className="acct-dashboard-grid">
                <section className="acct-card acct-income-card" aria-labelledby="acct-income-title">
                  <header className="acct-dashboard-card-head">
                    <div>
                      <h2 id="acct-income-title">รายรับแยกตามประเภท</h2>
                      <p>รวมยอดที่อนุมัติแล้ว</p>
                    </div>
                    <strong>{transportLoading ? '—' : baht(approvedTotal)}</strong>
                  </header>
                  <div className="acct-income-list">
                    {incomeByKind.map((item) => {
                      const width = maxIncomeByKind > 0 ? (item.sum / maxIncomeByKind) * 100 : 0;
                      return (
                        <div className="acct-income-item" key={item.id}>
                          <div className="acct-income-item__head">
                            <span>{PAY_KIND_LABEL[item.id]}<small>{item.count} รายการ</small></span>
                            <strong>{baht(item.sum)}</strong>
                          </div>
                          <div className="acct-income-bar" aria-hidden="true">
                            <span style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!transportLoading && approvedCount === 0 ? (
                    <p className="acct-dashboard-empty">ยังไม่มีรายการที่ผ่านการตรวจสอบ</p>
                  ) : null}
                </section>

                <section className="acct-card acct-review-queue" aria-labelledby="acct-review-title">
                  <header className="acct-dashboard-card-head">
                    <div>
                      <h2 id="acct-review-title">สลิปรอตรวจ</h2>
                      <p>{pendingCount} รายการ</p>
                    </div>
                    <button type="button" className="acct-text-action" onClick={() => setTab('slips')}>เปิดคิว</button>
                  </header>
                  {transportLoading ? <p className="acct-dashboard-empty">กำลังโหลดรายการ...</p> : null}
                  {!transportLoading && reviewQueue.length === 0 ? (
                    <p className="acct-dashboard-empty">ไม่มีสลิปรอตรวจ</p>
                  ) : null}
                  <div className="acct-review-list">
                    {reviewQueue.map((item) => (
                      <div className="acct-review-row" key={item.id}>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{PAY_KIND_LABEL[item.kind]} · {item.owner}</small>
                        </span>
                        <b>{baht(item.amount)}</b>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : null}

          {tab === 'slips' ? (
            <>
              <header className="acct-mast">
                <h1>ตรวจสลิป</h1>
                <p>ตรวจยอดในสลิปกับยอดชำระ แล้วกดอนุมัติหรือไม่อนุมัติ</p>
              </header>
              {reviewError ? <div className="acct-alert acct-alert--error" role="alert">{reviewError}</div> : null}
              {reviewNotice ? <div className="acct-alert acct-alert--success" role="status">{reviewNotice}</div> : null}
              {transportError ? <div className="acct-alert acct-alert--error" role="alert">{transportError}</div> : null}
              {transportLoading ? <div className="acct-card"><p>กำลังโหลดรายการรับ–ส่ง…</p></div> : null}
              {pendingCount === 0 && !transportLoading && !transportError ? <div className="acct-card"><p>ไม่มีสลิปรอตรวจ</p></div> : null}
              <div className="acct-slip-list">
                {pending.map((row) => {
                  const full = row.total == null ? null : Number(row.total);
                  return (
                    <article key={row.id} className="acct-slip-card">
                      <div className="acct-slip-frame">
                        {row.slip ? <img src={row.slip} alt={`สลิป ${row.title}`} /> : <p>ไม่มีรูป</p>}
                      </div>
                      <div className="acct-slip-meta">
                        <b>{shortId(row.id)}</b>
                        <span>{formatWhen(row.submittedAt || row.createdAt)}</span>
                      </div>
                      <p className="acct-slip-who">{row.ownerName || row.email}</p>
                      <p>{PAY_KIND_LABEL[row.kind]} · {row.title}</p>
                      <p>{row.detail}</p>
                      {full != null ? (
                        <div className="acct-line"><span>ยอดเต็ม</span><b>{baht(full)}</b></div>
                      ) : null}
                      <div className="acct-due">
                        <span>ยอดที่ต้องตรงกับสลิป</span>
                        <strong>{baht(row.deposit)}</strong>
                      </div>
                      <label className="form-label" htmlFor={`note-${row.id}`}>หมายเหตุถ้าไม่ผ่าน</label>
                      <input
                        id={`note-${row.id}`}
                        className="form-control"
                        value={note[row.id] || ''}
                        onChange={(event) => setNote((current) => ({ ...current, [row.id]: event.target.value }))}
                      />
                      <div className="acct-actions">
                        <button type="button" className="btn btn-sky" onClick={() => decide(row.id, PAY_STATUS.approved)}>อนุมัติ</button>
                        <button type="button" className="btn btn-soft" onClick={() => decide(row.id, PAY_STATUS.rejected)}>ไม่อนุมัติ</button>
                      </div>
                    </article>
                  );
                })}
                {pendingTransport.map((booking) => (
                  <article key={booking.id} className="acct-slip-card">
                    <div className="acct-slip-frame">
                      <a href={booking.paymentSlip} target="_blank" rel="noreferrer" aria-label="เปิดดูสลิปการชำระเงิน">
                        <img src={booking.paymentSlip} alt={`สลิป ${booking.petName || 'รับส่งสัตว์เลี้ยง'}`} />
                      </a>
                    </div>
                    <div className="acct-slip-meta">
                      <b>{shortId(booking.id)}</b>
                      <span>{formatWhen(booking.createdAt)}</span>
                    </div>
                    <p className="acct-slip-who">{booking.ownerName || 'ไม่ระบุเจ้าของ'} · {booking.petName || 'ไม่ระบุสัตว์เลี้ยง'}</p>
                    <p>{PAY_KIND_LABEL[PAY_KIND.transport]} · จองรับ–ส่งสัตว์เลี้ยง</p>
                    <div className="acct-due">
                      <span>ยอดที่ต้องตรงกับสลิป</span>
                      <strong>{baht(booking.quote?.total)}</strong>
                    </div>
                    <label className="form-label" htmlFor={`transport-note-${booking.id}`}>หมายเหตุถ้าไม่ผ่าน</label>
                    <input
                      id={`transport-note-${booking.id}`}
                      className="form-control"
                      maxLength={500}
                      value={note[booking.id] || ''}
                      onChange={(event) => setNote((current) => ({ ...current, [booking.id]: event.target.value }))}
                    />
                    <div className="acct-actions">
                      <button
                        type="button"
                        className="btn btn-sky"
                        disabled={reviewing[booking.id]}
                        onClick={() => decideTransport(booking, PAY_STATUS.approved)}
                      >
                        อนุมัติ
                      </button>
                      <button
                        type="button"
                        className="btn btn-soft"
                        disabled={reviewing[booking.id]}
                        onClick={() => decideTransport(booking, PAY_STATUS.rejected)}
                      >
                        ไม่อนุมัติ
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {tab === 'refunds' ? (
            <>
              <header className="acct-mast">
                <h1>คืนเงินให้ลูกค้า</h1>
                <p>ดำเนินการตามคำขอที่แอดมินอนุมัติ แนบหลักฐานหลังโอนเงิน</p>
              </header>
              {refundError ? <div className="acct-alert acct-alert--error" role="alert">{refundError}</div> : null}
              {refundNotice ? <div className="acct-alert acct-alert--success" role="status">{refundNotice}</div> : null}
              {pendingRefunds.length === 0 ? (
                <div className="acct-card"><p>ไม่มีรายการรอคืนเงิน</p></div>
              ) : (
                <div className="acct-refund-list">
                  {pendingRefunds.map((request) => {
                    const amount = Number(request.refundAmount) || 0;
                    return (
                      <article className="acct-refund-card" key={request.id}>
                        <header>
                          <div>
                            <span className="acct-chip">{PAY_KIND_LABEL[request.kind]}</span>
                            <h2>{request.title || request.petName || 'รายการจอง'}</h2>
                            <p>{request.petName || 'ไม่ระบุสัตว์เลี้ยง'} · {request.ownerName || 'ไม่ระบุชื่อลูกค้า'}</p>
                          </div>
                          <strong className="acct-refund-amount">{baht(amount)}</strong>
                        </header>
                        <p className="acct-refund-reason">เหตุผล: {request.reason}</p>
                        {request.adminNote ? <p className="acct-refund-reason">หมายเหตุแอดมิน: {request.adminNote}</p> : null}
                        <dl>
                          <div><dt>ธนาคาร</dt><dd>{request.bankName}</dd></div>
                          <div><dt>เลขบัญชี</dt><dd>{request.bankAccount}</dd></div>
                          <div><dt>เบอร์ติดต่อ</dt><dd>{request.contactPhone}</dd></div>
                        </dl>
                        {amount > 0 ? (
                          <>
                            <label className="pay-file">
                              <input type="file" accept="image/*" onChange={(event) => onRefundFile(event, request.id)} />
                              <span>{refundSlips[request.id] ? 'เปลี่ยนรูปหลักฐาน' : 'แนบสลิปการโอนคืน'}</span>
                            </label>
                            {refundSlips[request.id] ? (
                              <img className="pay-slip" src={refundSlips[request.id]} alt="ตัวอย่างหลักฐานการคืนเงิน" />
                            ) : null}
                          </>
                        ) : (
                          <p className="acct-refund-no-payment">
                            ไม่มีรายการชำระที่บัญชียืนยันแล้ว แต่ต้องปิดคำขอในคิวนี้
                          </p>
                        )}
                        <label className="form-label" htmlFor={`refund-note-${request.id}`}>หมายเหตุถึงลูกค้า</label>
                        <input
                          id={`refund-note-${request.id}`}
                          className="form-control"
                          maxLength={500}
                          value={refundNotes[request.id] || ''}
                          onChange={(event) => setRefundNotes((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))}
                        />
                        <div className="acct-actions">
                          <button
                            type="button"
                            className="btn btn-sky"
                            disabled={refunding[request.id] || (amount > 0 && !refundSlips[request.id])}
                            onClick={() => finishRefund(request)}
                          >
                            {amount > 0 ? 'ยืนยันโอนและส่งหลักฐาน' : 'ยืนยันว่าไม่มีเงินต้องคืน'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}

          {tab === 'report' ? (
            <>
              <div className="acct-filters no-print">
                <label>ตั้งแต่วัน<input type="date" className="form-control" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
                <label>ถึงวัน<input type="date" className="form-control" value={to} onChange={(event) => setTo(event.target.value)} /></label>
                <label>หมวด
                  <select className="form-control" value={kind} onChange={(event) => setKind(event.target.value)}>
                    <option value="all">ทั้งหมด</option>
                    {KINDS.map((id) => <option key={id} value={id}>{PAY_KIND_LABEL[id]}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn-sky" onClick={() => window.print()}>บันทึก PDF</button>
              </div>
              <section className="acct-card acct-report">
                <header className="acct-report-head">
                  <div className="acct-brand">
                    <span><i className="bi bi-balloon-heart-fill" /></span>
                    PetCare
                  </div>
                  <div>
                    <h2>รายงานรายรับรายจ่าย</h2>
                    <p>{rangeLabel}</p>
                    <p>ออกเอกสารเมื่อ {printedAt}</p>
                  </div>
                </header>
                <div className="acct-sum3">
                  <div><span>รายรับจากสลิป</span><strong className="is-in">{money(income)}</strong></div>
                  <div><span>รายจ่าย</span><strong className="is-out">{money(0)}</strong></div>
                  <div><span>คงเหลือสุทธิ</span><strong>{money(income)}</strong></div>
                </div>
                <h3>สรุปตามหมวด</h3>
                <table className="acct-table">
                  <thead>
                    <tr>
                      <th>ประเภท</th>
                      <th>หมวด</th>
                      <th>จำนวนรายการ</th>
                      <th>ยอดรวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportKinds.map((item) => (
                      <tr key={item.id}>
                        <td>รายรับ</td>
                        <td>{PAY_KIND_LABEL[item.id]}</td>
                        <td>{item.count}</td>
                        <td>{money(item.sum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3>รายละเอียด</h3>
                <table className="acct-table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>หมวด</th>
                      <th>รายการ</th>
                      <th>ลูกค้า</th>
                      <th>รายรับ</th>
                      <th>รายจ่าย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inRange.map((row) => {
                      const received = row.status === PAY_STATUS.approved ? Number(row.deposit || 0) : 0;
                      return (
                        <tr key={row.id}>
                          <td>{formatWhen(row.reviewedAt || row.submittedAt || row.createdAt)}</td>
                          <td>{PAY_KIND_LABEL[row.kind]}</td>
                          <td>{row.title}{row.status === PAY_STATUS.review ? ' · รอตรวจ' : ''}</td>
                          <td>{row.ownerName || row.email}</td>
                          <td>{money(received)}</td>
                          <td>{money(0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={4}>รวม</th>
                      <th>{money(income)}</th>
                      <th>{money(0)}</th>
                    </tr>
                  </tfoot>
                </table>
                {inRange.length === 0 ? <p>ไม่มีรายการในช่วงนี้</p> : null}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
