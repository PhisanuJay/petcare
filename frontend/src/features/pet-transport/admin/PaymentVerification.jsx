import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatBaht } from '../pricing.js';
import { useTransport } from '../useTransport.js';

export default function PaymentVerification() {
  const { bookings, adminMarkPaid } = useTransport();
  const pending = bookings.filter((b) => b.paymentStatus === 'owner_confirmed');
  const paid = bookings.filter((b) => b.paymentStatus === 'paid');

  return (
    <>
      <h1>Payment Verification</h1>
      <p className="tp-lead">Owner ยืนยันว่าชำระแล้ว — Admin ตรวจแล้ว Mark as Paid</p>

      <h3>รอตรวจสอบ</h3>
      <div className="tp-list" style={{ marginBottom: '1.25rem' }}>
        {pending.map((b) => (
          <div key={b.id} className="tp-list-item">
            <div>
              <strong>{b.petName}</strong> · {b.ownerName}
              <div className="tp-list-item__meta">{formatBaht(b.quote?.total)} · {b.paymentNote || 'ไม่มีหมายเหตุ'}</div>
            </div>
            <div className="tp-actions" style={{ marginTop: 0 }}>
              <button type="button" className="btn btn-sky" onClick={() => adminMarkPaid(b.id)}>
                Mark as Paid
              </button>
              <Link className="btn btn-soft" to={`/admin/transport/bookings/${b.id}`}>รายละเอียด</Link>
            </div>
          </div>
        ))}
        {!pending.length && <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ไม่มีรายการรอตรวจ</p></div>}
      </div>

      <h3>ชำระแล้วล่าสุด</h3>
      <div className="tp-list">
        {paid.slice(0, 8).map((b) => (
          <div key={b.id} className="tp-list-item">
            <div>
              <strong>{b.petName}</strong>
              <div className="tp-list-item__meta">{formatBaht(b.quote?.total)}</div>
            </div>
            <StatusBadge label="Paid" tone="ok" />
          </div>
        ))}
      </div>
    </>
  );
}
