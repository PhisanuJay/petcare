import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/AuthContext.jsx';

function NeedLoginModal({ next, onClose }) {
  const query = `?next=${encodeURIComponent(next)}`;
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content border-0 p-4 text-center" style={{ borderRadius: 30 }}>
            <div style={{ fontSize: '3rem' }}>🐾</div>
            <h5 className="mitr">เข้าสู่ระบบก่อนนะ</h5>
            <p className="text-muted small">สมัครสมาชิกฟรี จองคิว จองโรงแรม และขอรับเลี้ยงน้องได้ทันที แถมรับแต้มสะสม</p>
            <div className="d-flex justify-content-center gap-2">
              <Link className="btn btn-soft" to={`/login${query}`}>เข้าสู่ระบบ</Link>
              <Link className="btn btn-sky" to={`/register${query}`}>สมัครสมาชิก</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

/**
 * Returns a click handler that navigates members to `to`
 * and shows the login prompt for guests.
 */
export function useMemberLink() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);

  const go = useCallback(
    (to) => (e) => {
      e?.preventDefault();
      if (currentUser) navigate(to);
      else setPending(to);
    },
    [currentUser, navigate],
  );

  const modal = pending ? <NeedLoginModal next={pending} onClose={() => setPending(null)} /> : null;
  return { go, modal };
}
