import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/AuthContext.jsx';
import { ROLES, normalizeRole } from '../../../features/auth/roles.js';

function NeedLoginModal({ next, onClose }) {
  const query = `?next=${encodeURIComponent(next)}`;
  return (
    <>
      <div className="modal d-block need-login" tabIndex={-1} role="dialog" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content border-0 text-center">
            <img src="/pets/default-pet.jpg" alt="" width={96} height={96} className="rounded-circle mb-2" style={{ objectFit: 'cover' }} />
            <h5 className="mitr">เข้าสู่ระบบก่อนนะ</h5>
            <p className="text-muted small">ใช้บัญชีเจ้าของสัตว์เพื่อจองคิว จองโรงแรม และขอรับเลี้ยง</p>
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

function OwnerOnlyModal({ onClose }) {
  return (
    <>
      <div className="modal d-block need-login" tabIndex={-1} role="dialog" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content border-0 text-center">
            <h5 className="mitr">จองบริการได้เฉพาะเจ้าของสัตว์</h5>
            <p className="text-muted small mb-3">
              บัญชีที่ใช้อยู่เป็นพนักงาน/แอดมิน — ออกจากระบบแล้วเข้าด้วยบัญชีเจ้าของสัตว์
              (เช่น owner@petcare.local)
            </p>
            <div className="d-flex justify-content-center gap-2">
              <button type="button" className="btn btn-soft" onClick={onClose}>ปิด</button>
              <Link className="btn btn-sky" to="/login?next=/pet-owner/booking" onClick={onClose}>
                ไปหน้าเข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function isPetOwnerPath(to) {
  return String(to || '').startsWith('/pet-owner');
}

/**
 * จอง/หน้าเจ้าของสัตว์: ต้องเป็น owner
 * แขก → โมดัลล็อกอิน · role อื่น → บอกให้ใช้บัญชีเจ้าของสัตว์
 */
export function useMemberLink() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);
  const [wrongRole, setWrongRole] = useState(false);
  const role = normalizeRole(currentUser?.role);
  const isOwner = Boolean(currentUser) && role === ROLES.owner;

  const go = useCallback(
    (to) => (e) => {
      e?.preventDefault();
      if (!isPetOwnerPath(to)) {
        navigate(to);
        return;
      }
      if (isOwner) {
        navigate(to);
        return;
      }
      if (currentUser) {
        setWrongRole(true);
        return;
      }
      setPending(to);
    },
    [currentUser, isOwner, navigate],
  );

  const modal = wrongRole
    ? <OwnerOnlyModal onClose={() => setWrongRole(false)} />
    : pending
      ? <NeedLoginModal next={pending} onClose={() => setPending(null)} />
      : null;

  return { go, modal, isOwner };
}
