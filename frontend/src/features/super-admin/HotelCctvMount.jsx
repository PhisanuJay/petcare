import HotelCctvApp from './hotel-cctv/src/App.jsx';
import './hotel-cctv/src/styles.css';

/**
 * Pet Hotel CCTV = Super Admin module (ฟ่าง / Xsup404).
 * Mounted at /super-admin/* from App.jsx — no nested Router.
 */
export default function HotelCctvMount() {
  return <HotelCctvApp />;
}
