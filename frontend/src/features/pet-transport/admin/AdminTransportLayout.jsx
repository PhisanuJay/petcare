import { Outlet } from 'react-router-dom';
import TransportSubnav from '../components/TransportSubnav.jsx';
import '../transport.css';

const NAV = [
  { to: '/admin/transport', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
  { to: '/admin/transport/bookings', label: 'Bookings', icon: 'bi-journal-text' },
  { to: '/admin/transport/drivers', label: 'คนขับ', icon: 'bi-person-badge' },
  { to: '/admin/transport/payments', label: 'Payment', icon: 'bi-cash-coin' },
  { to: '/admin/transport/cancellations', label: 'ยกเลิก', icon: 'bi-x-circle' },
  { to: '/admin/transport/pricing', label: 'Pricing', icon: 'bi-tag' },
  { to: '/admin/transport/hotels', label: 'Pet Hotel', icon: 'bi-building' },
];

export default function AdminTransportLayout() {
  return (
    <section className="tp-page">
      <TransportSubnav title="Admin · Pet Transport" items={NAV} />
      <Outlet />
    </section>
  );
}
