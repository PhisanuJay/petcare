import { Link, Outlet } from 'react-router-dom';

/**
 * Minimal shell for the skeleton.
 * Role navigation is listed so each section is linkable without mixing code.
 */
export default function AppShell() {
  return (
    <div>
      <header>
        <nav aria-label="Role modules">
          <ul>
            <li>
              <Link to="/">PetCare Home</Link>
            </li>
            <li>
              <Link to="/pet-owner">Pet Owner</Link>
            </li>
            <li>
              <Link to="/veterinarian">Veterinarian</Link>
            </li>
            <li>
              <Link to="/medical-assistant">Medical Assistant</Link>
            </li>
            <li>
              <Link to="/pet-profile">Pet Profile</Link>
            </li>
            <li>
              <Link to="/pet-hotel">Pet Hotel</Link>
            </li>
            <li>
              <Link to="/pet-transport">Pet Transport</Link>
            </li>
            <li>
              <Link to="/adoption">Adoption</Link>
            </li>
            <li>
              <Link to="/admin">Admin</Link>
            </li>
            <li>
              <Link to="/super-admin">Super Admin</Link>
            </li>
          </ul>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
