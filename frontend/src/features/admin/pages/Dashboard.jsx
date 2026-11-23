import { Link } from 'react-router-dom';

/**
 * Admin Dashboard — links into Pet Transport MVP and other modules.
 */
export default function AdminDashboardPage() {
  return (
    <section>
      <h1>Admin Dashboard</h1>
      <p>Role: Admin</p>
      <ul>
        <li>
          <Link to="/admin/transport">Pet Transport — จัดการรับ–ส่งสัตว์เลี้ยง</Link>
        </li>
        <li>
          <Link to="/admin/users">Users</Link>
        </li>
        <li>
          <Link to="/admin/bookings">Bookings (ทั่วไป)</Link>
        </li>
        <li>
          <Link to="/admin/reports">Reports</Link>
        </li>
      </ul>
    </section>
  );
}
