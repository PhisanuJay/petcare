import { Link } from 'react-router-dom';

/**
 * Landing index for the skeleton — links into each role module from Page 17.
 */
export default function HomePage() {
  return (
    <section>
      <h1>PetCare</h1>
      <p>
        Frontend แยกตามบทบาท — คู่กับ <code>backend/src/modules/</code>
      </p>
      <ul>
        <li>
          <Link to="/pet-owner">Pet Owner (มะแอ่ว)</Link>
        </li>
        <li>
          <Link to="/veterinarian">Veterinarian (มะแอ่ว)</Link>
        </li>
        <li>
          <Link to="/medical-assistant">Medical Assistant (เอิร์ท)</Link>
        </li>
        <li>
          <Link to="/pet-profile">Pet Profile (เอิร์ท, ปร่ย)</Link>
        </li>
        <li>
          <Link to="/pet-hotel">Pet Hotel (ฟ่าง, เจ)</Link>
        </li>
        <li>
          <Link to="/pet-transport">Pet Transport (โมเดล)</Link>
        </li>
        <li>
          <Link to="/adoption">Adoption (ปร่ย)</Link>
        </li>
        <li>
          <Link to="/admin">Admin (เจ)</Link>
        </li>
        <li>
          <Link to="/super-admin">Super Admin (ฟ่าง)</Link>
        </li>
      </ul>
    </section>
  );
}
