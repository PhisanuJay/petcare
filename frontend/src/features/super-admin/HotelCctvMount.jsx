import { useLocation } from 'react-router-dom';
import HotelCctvApp from './hotel-cctv/src/App.jsx';
import './hotel-cctv/src/styles.css';

/**
 * Pet Hotel CCTV — mounted at /super-admin/cctv/*
 * Under Super Admin StaffWorkspace: embedded mode (no second sidebar).
 */
export default function HotelCctvMount() {
  const { pathname } = useLocation();
  const embedded = pathname.startsWith('/super-admin/cctv');

  return (
    <div className={`hotel-cctv${embedded ? ' hotel-cctv--embedded' : ''}`}>
      <HotelCctvApp />
    </div>
  );
}
