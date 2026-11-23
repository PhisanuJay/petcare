import { Link } from 'react-router-dom';

/**
 * Admin Dashboard — transport-first after role login.
 */
export default function AdminDashboardPage() {
  return (
    <section className="tp-page">
      <h1>Admin Dashboard</h1>
      <p className="tp-lead">จัดการบริการรับ–ส่งและบัญชีคนขับ</p>
      <ul>
        <li>
          <Link to="/admin/transport">Pet Transport Dashboard</Link>
        </li>
        <li>
          <Link to="/admin/transport/drivers">จัดการคนขับ</Link>
        </li>
        <li>
          <Link to="/admin/transport/bookings">Booking Management</Link>
        </li>
      </ul>
    </section>
  );
}
