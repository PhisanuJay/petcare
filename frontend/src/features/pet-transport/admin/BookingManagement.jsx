import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatBaht } from '../pricing.js';
import { useTransport } from '../useTransport.js';

export default function BookingManagement() {
  const { bookings } = useTransport();

  return (
    <>
      <h1>Booking Management</h1>
      <p className="tp-lead">ตรวจสอบ Zone / ยืนยันราคา / Assign คนขับ</p>
      <div className="tp-list">
        {bookings.map((b) => (
          <Link key={b.id} className="tp-list-item" to={`/admin/transport/bookings/${b.id}`}>
            <div>
              <strong>{b.petName}</strong> · {b.ownerName}
              <div className="tp-list-item__meta">
                {b.serviceType === 'round_trip' ? 'ไป–กลับ' : 'เที่ยวเดียว'} · Zone {b.zoneId} ·{' '}
                {formatBaht(b.quote?.total)}
              </div>
            </div>
            <StatusBadge label={b.statusMeta.label} tone={b.statusMeta.tone} />
          </Link>
        ))}
        {!bookings.length && <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ยังไม่มี booking</p></div>}
      </div>
    </>
  );
}
