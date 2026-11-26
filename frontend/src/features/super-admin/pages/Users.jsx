import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../../auth/roles.js';
import { fetchUsers } from '../api.js';

export default function UsersPage() {
  const { authToken } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUsers(authToken)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'โหลดผู้ใช้ไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const roles = useMemo(
    () => Object.keys(data?.byRole || {}).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const rows = data?.users || [];
    const needle = q.trim().toLowerCase();
    return rows.filter((u) => {
      if (role !== 'all' && u.role !== role) return false;
      if (!needle) return true;
      return [u.name, u.email, u.phone, u.role].some((v) => String(v || '').toLowerCase().includes(needle));
    });
  }, [data, q, role]);

  return (
    <>
      <div className="sa-dash__intro">
        <div>
          <p className="sa-dash__eyebrow">บัญชีทั้งหมด</p>
          <h1>ผู้ใช้ในระบบ</h1>
          <p className="sa-dash__lede">ดึงจาก dbo.users แบบเรียลไทม์ — ไม่แสดงรหัสผ่าน</p>
        </div>
      </div>

      {error ? <div className="sa-error">{error}</div> : null}

      <div className="sa-toolbar">
        <div className="sa-stat-row">
          <span className="sa-chip">
            ทั้งหมด
            {' '}
            <strong>{data?.total ?? (loading ? '…' : 0)}</strong>
          </span>
          {roles.map((r) => (
            <span key={r} className="sa-chip">
              {ROLE_LABELS[r] || r}
              {' '}
              <strong>{data?.byRole?.[r] || 0}</strong>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder="ค้นหาชื่อ / อีเมล"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">ทุกบทบาท</option>
            {roles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>อีเมล</th>
              <th>บทบาท</th>
              <th>โทร</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role] || u.role}</td>
                <td>{u.phone || '—'}</td>
                <td>{u.active ? 'ใช้งาน' : 'ปิด'}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="sa-muted">ไม่พบผู้ใช้</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
