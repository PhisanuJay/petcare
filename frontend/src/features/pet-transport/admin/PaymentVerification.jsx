import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatBaht } from '../pricing.js';
import { useTransport } from '../useTransport.js';
import '../transport.css';
import { shortBookingId } from './adminBookingUtils.js';

export default function PaymentVerification() {
  const { bookings, adminMarkPaid } = useTransport();
  const [error, setError] = useState('');
  const pending = bookings.filter(
    (booking) =>
      booking.paymentStatus !== 'paid'
      && (
        booking.paymentStatus === 'owner_confirmed'
        || ['awaiting_payment', 'driver_assigned', 'price_confirmed', 'submitted'].includes(booking.status)
      ),
  );
  const waitingConfirm = pending.filter((booking) => booking.paymentStatus === 'owner_confirmed');
  const unpaid = pending.filter((booking) => booking.paymentStatus !== 'owner_confirmed');
  const paid = bookings.filter((booking) => booking.paymentStatus === 'paid');

  async function confirmPayment(bookingId) {
    setError('');
    try {
      await adminMarkPaid(bookingId);
    } catch (requestError) {
      setError(requestError.message || 'ยืนยันการชำระเงินไม่สำเร็จ');
    }
  }

  return (
    <section className="tp-page">
      <h1>ตรวจชำระเงิน</h1>
      <p className="tp-lead">ฝ่ายการเงิน — ตรวจสอบและยืนยันการชำระ เพื่อให้คนขับเริ่มงานได้</p>
      {error && <div className="tp-alert tp-alert--danger" role="alert">{error}</div>}

      <h3>Owner แจ้งชำระแล้ว · รอตรวจสอบ ({waitingConfirm.length})</h3>
      <div className="tp-list" style={{ marginBottom: '1.25rem' }}>
        {waitingConfirm.map((booking) => (
          <div key={booking.id} className="tp-list-item">
            <div>
              <strong>{booking.petName}</strong> · {booking.ownerName}
              <div className="tp-list-item__meta">
                <code className="tp-code">{shortBookingId(booking.id)}</code>
                {' · '}{formatBaht(booking.quote?.total)}
                {booking.paymentNote ? ` — ${booking.paymentNote}` : ''}
              </div>
            </div>
            <div className="tp-actions" style={{ marginTop: 0 }}>
              <button type="button" className="btn btn-sky" onClick={() => confirmPayment(booking.id)}>
                ยืนยันชำระแล้ว
              </button>
              <Link className="btn btn-soft" to={`/admin/transport/bookings/${booking.id}`}>รายละเอียด</Link>
            </div>
          </div>
        ))}
        {!waitingConfirm.length && (
          <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ยังไม่มีรายการรอตรวจ</p></div>
        )}
      </div>

      <h3>ยังไม่แจ้งชำระ ({unpaid.length})</h3>
      <div className="tp-list" style={{ marginBottom: '1.25rem' }}>
        {unpaid.map((booking) => (
          <div key={booking.id} className="tp-list-item">
            <div>
              <strong>{booking.petName}</strong> · {booking.ownerName}
              <div className="tp-list-item__meta">
                <code className="tp-code">{shortBookingId(booking.id)}</code>
                {' · '}{formatBaht(booking.quote?.total)} · รอ Owner ชำระ
              </div>
            </div>
            <StatusBadge label="ยังไม่ชำระ" tone="warn" />
          </div>
        ))}
        {!unpaid.length && (
          <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ไม่มีรายการค้างชำระ</p></div>
        )}
      </div>

      <h3>ชำระแล้วล่าสุด</h3>
      <div className="tp-list">
        {paid.slice(0, 8).map((booking) => (
          <div key={booking.id} className="tp-list-item">
            <div>
              <strong>{booking.petName}</strong>
              <div className="tp-list-item__meta">
                <code className="tp-code">{shortBookingId(booking.id)}</code>
                {' · '}{formatBaht(booking.quote?.total)}
              </div>
            </div>
            <StatusBadge label="Paid" tone="ok" />
          </div>
        ))}
        {!paid.length && (
          <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ยังไม่มีรายการที่ชำระแล้ว</p></div>
        )}
      </div>
    </section>
  );
}
