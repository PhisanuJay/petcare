<<<<<<< HEAD
import StatusBadge from '../components/StatusBadge.jsx';
import { formatBaht } from '../pricing.js';
import { useTransport } from '../useTransport.js';
import '../transport.css';
import { shortBookingId } from './adminBookingUtils.js';
=======
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatBaht } from '../pricing.js';
import { useTransport } from '../useTransport.js';
>>>>>>> origin/Admin-transport

export default function PaymentVerification() {
  const { bookings, adminMarkPaid } = useTransport();
  const pending = bookings.filter(
    (b) =>
      b.paymentStatus !== 'paid'
      && (
        b.paymentStatus === 'owner_confirmed'
<<<<<<< HEAD
        || ['awaiting_payment', 'driver_assigned', 'price_confirmed', 'submitted'].includes(b.status)
      ),
  );
  const waitingConfirm = pending.filter((b) => b.paymentStatus === 'owner_confirmed');
  const unpaid = pending.filter((b) => b.paymentStatus !== 'owner_confirmed');
  const paid = bookings.filter((b) => b.paymentStatus === 'paid');

  return (
    <section className="tp-page">
      <h1>ตรวจชำระเงิน</h1>
      <p className="tp-lead">ฝ่ายการเงิน — ตรวจสอบและยืนยันการชำระ เพื่อให้คนขับเริ่มงานได้</p>

      <h3>Owner แจ้งชำระแล้ว · รอตรวจสอบ ({waitingConfirm.length})</h3>
      <div className="tp-list" style={{ marginBottom: '1.25rem' }}>
        {waitingConfirm.map((b) => (
=======
        || ['awaiting_payment', 'driver_assigned', 'price_confirmed'].includes(b.status)
      ),
  );
  const paid = bookings.filter((b) => b.paymentStatus === 'paid');

  return (
    <>
      <h1>ยืนยันการชำระเงิน</h1>
      <p className="tp-lead">กดยืนยันชำระแล้ว เพื่อให้คนขับเริ่มอัปเดตสถานะงานได้</p>

      <h3>รอตรวจสอบ</h3>
      <div className="tp-list" style={{ marginBottom: '1.25rem' }}>
        {pending.map((b) => (
>>>>>>> origin/Admin-transport
          <div key={b.id} className="tp-list-item">
            <div>
              <strong>{b.petName}</strong> · {b.ownerName}
              <div className="tp-list-item__meta">
<<<<<<< HEAD
                <code className="tp-code">{shortBookingId(b.id)}</code>
                {' · '}
                {formatBaht(b.quote?.total)}
=======
                {formatBaht(b.quote?.total)} · {b.paymentStatus === 'owner_confirmed' ? 'Owner แจ้งชำระแล้ว' : 'รอ Admin ยืนยันชำระ'}
>>>>>>> origin/Admin-transport
                {b.paymentNote ? ` — ${b.paymentNote}` : ''}
              </div>
            </div>
            <div className="tp-actions" style={{ marginTop: 0 }}>
<<<<<<< HEAD
              <button type="button" className="btn btn-sky" onClick={() => adminMarkPaid(b.id)}>
                ยืนยันชำระแล้ว
              </button>
            </div>
          </div>
        ))}
        {!waitingConfirm.length && (
          <div className="tp-card">
            <p className="tp-muted" style={{ margin: 0 }}>ยังไม่มีรายการรอตรวจ</p>
          </div>
        )}
      </div>

      <h3>ยังไม่แจ้งชำระ ({unpaid.length})</h3>
      <div className="tp-list" style={{ marginBottom: '1.25rem' }}>
        {unpaid.map((b) => (
          <div key={b.id} className="tp-list-item">
            <div>
              <strong>{b.petName}</strong> · {b.ownerName}
              <div className="tp-list-item__meta">
                <code className="tp-code">{shortBookingId(b.id)}</code>
                {' · '}
                {formatBaht(b.quote?.total)} · รอ Owner ชำระ
              </div>
            </div>
            <StatusBadge label="ยังไม่ชำระ" tone="warn" />
          </div>
        ))}
        {!unpaid.length && (
          <div className="tp-card">
            <p className="tp-muted" style={{ margin: 0 }}>ไม่มีรายการค้างชำระ</p>
          </div>
        )}
=======
              <button
                type="button"
                className="btn btn-sky"
                onClick={() => {
                  adminMarkPaid(b.id).catch(() => {});
                }}
              >
                ยืนยันชำระแล้ว
              </button>
              <Link className="btn btn-soft" to={`/admin/transport/bookings/${b.id}`}>รายละเอียด</Link>
            </div>
          </div>
        ))}
        {!pending.length && <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ไม่มีรายการรอตรวจ</p></div>}
>>>>>>> origin/Admin-transport
      </div>

      <h3>ชำระแล้วล่าสุด</h3>
      <div className="tp-list">
        {paid.slice(0, 8).map((b) => (
          <div key={b.id} className="tp-list-item">
            <div>
              <strong>{b.petName}</strong>
<<<<<<< HEAD
              <div className="tp-list-item__meta">
                <code className="tp-code">{shortBookingId(b.id)}</code>
                {' · '}
                {formatBaht(b.quote?.total)}
              </div>
=======
              <div className="tp-list-item__meta">{formatBaht(b.quote?.total)}</div>
>>>>>>> origin/Admin-transport
            </div>
            <StatusBadge label="Paid" tone="ok" />
          </div>
        ))}
<<<<<<< HEAD
        {!paid.length && (
          <div className="tp-card">
            <p className="tp-muted" style={{ margin: 0 }}>ยังไม่มีรายการที่ชำระแล้ว</p>
          </div>
        )}
      </div>
    </section>
=======
      </div>
    </>
>>>>>>> origin/Admin-transport
  );
}
