import HotelCctvApp from './hotel-cctv/src/App.jsx';
import './hotel-cctv/src/styles.css';

/**
 * Pet Hotel CCTV = Super Admin module (ฟ่าง / Xsup404).
 * Mounted at /super-admin/* from App.jsx — no nested Router.
 * Styles are scoped under `.hotel-cctv` so they do not leak into the main site.
 */
export default function HotelCctvMount() {
  return (
    <div className="hotel-cctv">
      <HotelCctvApp />
    </div>
  );
}
