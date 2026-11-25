import { Outlet } from 'react-router-dom';
import '../transport.css';

export default function AdminTransportLayout() {
  return (
    <section className="tp-page tp-page--admin">
      <Outlet />
    </section>
  );
}
