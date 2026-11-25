import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import StatusBadge from '../../pet-transport/components/StatusBadge.jsx';
import TransportSubnav from '../../pet-transport/components/TransportSubnav.jsx';
import { formatBaht } from '../../pet-transport/pricing.js';
import { useTransport } from '../../pet-transport/useTransport.js';
import CancellationSummary from '../../cancellations/CancellationSummary.jsx';
import { cancellationFor, useCancellationRequests } from '../../cancellations/store.js';
import { PAY_KIND } from '../../payments/store.js';
import '../../pet-transport/transport.css';

const OWNER_NAV = [
  { to: '/pet-owner/transport', label: 'จองรับ–ส่ง', icon: 'bi-plus-circle', end: true },
  { to: '/pet-owner/transport/history', label: 'ประวัติการจอง', icon: 'bi-clock-history' },
];

export default function TransportHistoryPage() {
  const { currentUser } = useAuth();
  const { bookings } = useTransport();
  const cancellations = useCancellationRequests(currentUser?.id);
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
                <Link className="btn btn-sky" to="/pet-owner/transport">จองรับ–ส่ง</Link>
              </div>
            </div>
          )}

          <div className="tp-list">
            {mine.map((b) => {
              const cancellation = cancellationFor(PAY_KIND.transport, b.id, cancellations);
              const paymentStatus = b.paymentStatus === 'paid'
                ? { label: 'ชำระแล้ว', tone: 'ok' }
                : b.paymentStatus === 'owner_confirmed'
                  ? { label: 'รอตรวจสอบการชำระ', tone: 'info' }
                  : { label: 'ยังไม่ชำระเงิน', tone: 'warn' };
              return (
                <div key={b.id} className="tp-list-item">
                  <Link className="tp-list-item__link" to={`/pet-owner/transport/${b.id}`}>
                    <strong>{b.petName}</strong>
                    <div className="tp-list-item__meta">
                      {{
                        outbound: 'ไปส่ง',
                        inbound: 'รับกลับ',
                        round_trip: 'ไป–กลับ',
                        one_way: 'ไปส่ง',
                      }[b.serviceType] || b.serviceType}
                      {' · '}
                      Zone {b.fromZoneId || '?'}→{b.toZoneId || '?'}
                      {' · '}
                      {formatBaht(b.quote?.total)}
                    </div>
                    <div className="tp-list-item__meta">
                      {new Date(b.createdAt).toLocaleString('th-TH')}
                    </div>
                  </Link>
                  <div className="d-flex flex-column align-items-end gap-2">
                    <StatusBadge label={b.statusMeta.label} tone={b.statusMeta.tone} />
                    <StatusBadge label={paymentStatus.label} tone={paymentStatus.tone} />
                  </div>
                  {cancellation ? <CancellationSummary request={cancellation} /> : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
