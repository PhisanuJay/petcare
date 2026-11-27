import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../../auth/roles.js';
import { fetchUsers } from '../api.js';

export default function UsersPage() {
  const { authToken } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');

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
    () => Object.keys(data?.byRole || {}).sort((a, b) => (ROLE_LABELS[a] || a).localeCompare(ROLE_LABELS[b] || b, 'th')),
    [data],
  );

  const filtered = useMemo(() => {
    const rows = data?.users || [];
    const needle = appliedQuery.trim().toLowerCase();
    return rows.filter((u) => {
      if (role !== 'all' && u.role !== role) return false;
      if (status === 'active' && !u.active) return false;
      if (status === 'inactive' && u.active) return false;
      if (!needle) return true;
      return [u.name, u.email, u.phone, ROLE_LABELS[u.role] || u.role].some((v) =>
        String(v || '').toLowerCase().includes(needle),
      );
    });
  }, [data, appliedQuery, role, status]);

  function runSearch(event) {
    event?.preventDefault?.();
    setAppliedQuery(query.trim());
  }

  function clearSearch() {
    setQuery('');
    setAppliedQuery('');
  }

  function clearAll() {
    clearSearch();
    setRole('all');
    setStatus('all');
  }

  const hasFilters = role !== 'all' || status !== 'all' || Boolean(appliedQuery);
  const total = data?.total ?? 0;

  return (
    <>
      <div className="sa-dash__intro">
        <div>
          <p className="sa-dash__eyebrow">บัญชีทั้งหมด</p>
          <h1>ผู้ใช้ในระบบ</h1>
          <p className="sa-dash__lede"></p>
        </div>
      </div>

      {error ? <div className="sa-error">{error}</div> : null}

      <div className="sa-toolbar">
        <div className="sa-stat-row" role="group" aria-label="กรองตามบทบาท">
          <button
            type="button"
            className={`sa-chip sa-chip--btn${role === 'all' ? ' is-active' : ''}`}
            onClick={() => setRole('all')}
          >
            ทั้งหมด
            {' '}
            <strong>{total}</strong>
          </button>
          {roles.map((r) => (
            <button
              type="button"
              key={r}
              className={`sa-chip sa-chip--btn${role === r ? ' is-active' : ''}`}
              onClick={() => setRole(r)}
            >
              {ROLE_LABELS[r] || r}
              {' '}
              <strong>{data?.byRole?.[r] || 0}</strong>
            </button>
          ))}
        </div>

        <form className="sa-toolbar__search" onSubmit={runSearch}>
          <input
            type="search"
            placeholder="ค้นหาชื่อ / อีเมล / เบอร์โทร"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="ค้นหาผู้ใช้"
          />
          {appliedQuery ? (
            <button type="button" className="sa-toolbar__btn" onClick={clearSearch}>
              ล้าง
            </button>
          ) : null}
          <button type="submit" className="sa-toolbar__btn sa-toolbar__btn--primary">
            ค้นหา
          </button>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="กรองสถานะ">
            <option value="all">ทุกสถานะ</option>
            <option value="active">ใช้งาน</option>
            <option value="inactive">ปิด</option>
          </select>
        </form>
      </div>

      <div className="sa-toolbar__meta">
        <span className="sa-muted">
          {loading ? 'กำลังโหลด…' : `แสดง ${filtered.length} จาก ${total} บัญชี`}
          {appliedQuery ? ` · ค้นหา “${appliedQuery}”` : ''}
          {role !== 'all' ? ` · ${ROLE_LABELS[role] || role}` : ''}
          {status === 'active' ? ' · ใช้งาน' : ''}
          {status === 'inactive' ? ' · ปิด' : ''}
        </span>
        {hasFilters ? (
          <button type="button" className="sa-toolbar__link" onClick={clearAll}>
            ล้างตัวกรองทั้งหมด
          </button>
        ) : null}
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
            {loading ? (
              <tr>
                <td colSpan={5} className="sa-muted">กำลังโหลดข้อมูล…</td>
              </tr>
            ) : null}
            {!loading && filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role] || u.role}</td>
                <td>{u.phone || '—'}</td>
                <td>
                  <span className={`sa-status${u.active ? ' is-on' : ' is-off'}`}>
                    {u.active ? 'ใช้งาน' : 'ปิด'}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="sa-muted">ไม่พบผู้ใช้ตามเงื่อนไข</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
