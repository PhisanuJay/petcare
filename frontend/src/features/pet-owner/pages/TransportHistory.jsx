import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import StatusBadge from '../../pet-transport/components/StatusBadge.jsx';
import TransportSubnav from '../../pet-transport/components/TransportSubnav.jsx';
import { formatBaht } from '../../pet-transport/pricing.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import '../../pet-transport/transport.css';

const OWNER_NAV = [
  { to: '/pet-owner/transport', label: 'จองรับ–ส่ง', icon: 'bi-plus-circle', end: true },
  { to: '/pet-owner/transport/history', label: 'ประวัติการจอง', icon: 'bi-clock-history' },
];

export default function TransportHistoryPage() {
  const { currentUser } = useAuth();
  const { bookings } = useTransport();
  const mine = bookings.filter((b) => b.ownerId === currentUser?.id);

  return (
    <div className="page-wrap">
      <div className="container">
        <section className="tp-page">
          <div className="tp-page-head">
            <h1>ประวัติการจองรับ–ส่ง</h1>
            <p className="tp-lead">ติดตามสถานะการจองและการชำระเงิน</p>
          </div>
          <TransportSubnav items={OWNER_NAV} />

          {!mine.length && (
            <div className="tp-card">
              <p className="tp-muted" style={{ margin: 0 }}>ยังไม่มีการจอง</p>
              <div className="tp-actions">
                <Link className="tp-btn" to="/pet-owner/transport">จองรับ–ส่ง</Link>
              </div>
            </div>
          )}

          <div className="tp-list">
            {mine.map((b) => (
              <Link key={b.id} className="tp-list-item" to={`/pet-owner/transport/${b.id}`}>
                <div>
                  <strong>{b.petName}</strong>
                  <div className="tp-list-item__meta">
                    {b.serviceType === 'round_trip' ? 'ไป–กลับ' : 'เที่ยวเดียว'} · Zone {b.zoneId} ·{' '}
                    {formatBaht(b.quote?.total)}
                  </div>
                  <div className="tp-list-item__meta">
                    {new Date(b.createdAt).toLocaleString('th-TH')}
                  </div>
                </div>
                <StatusBadge label={b.statusMeta.label} tone={b.statusMeta.tone} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
