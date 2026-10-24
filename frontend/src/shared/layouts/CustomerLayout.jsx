import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CustomerNavbar from './CustomerNavbar.jsx';
import CustomerFooter from './CustomerFooter.jsx';

function useScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    // Wait one frame so the target section exists after navigation.
    const id = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, hash]);
}

export default function CustomerLayout() {
  useScrollToHash();
  return (
    <div className="pc-site">
      <CustomerNavbar />
      <main>
        <Outlet />
      </main>
      <CustomerFooter />
    </div>
  );
}
