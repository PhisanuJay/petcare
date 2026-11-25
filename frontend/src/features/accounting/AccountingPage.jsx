import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { PAY_KIND, PAY_KIND_LABEL, PAY_STATUS, reviewPayment, usePayments } from '../payments/store.js';
import '../payments/payment.css';

const KINDS = Object.values(PAY_KIND);

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function baht(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}

function dayKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDay(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day));
  }
  return formatWhen(value);
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function shortId(id) {
  return String(id || '').slice(0, 8).toUpperCase();
}

export default function AccountingPage() {
  const { currentUser, logout } = useAuth();
  const { all, pending } = usePayments();
  const [tab, setTab] = useState('desk');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState('all');
  const [note, setNote] = useState({});
  const printedAt = formatWhen(new Date().toISOString());

  const approved = all.filter((row) => row.status === PAY_STATUS.approved);
  const inRange = useMemo(() => all.filter((row) => {
    const key = dayKey(row.reviewedAt || row.submittedAt || row.createdAt);
    if (from && key < from) return false;
    if (to && key > to) return false;
    if (kind !== 'all' && row.kind !== kind) return false;
    return row.status === PAY_STATUS.approved || row.status === PAY_STATUS.review;
  }), [all, from, to, kind]);
  const approvedInRange = inRange.filter((row) => row.status === PAY_STATUS.approved);
  const income = approvedInRange.reduce((sum, row) => sum + Number(row.deposit || 0), 0);
  const kinds = kind === 'all' ? KINDS : [kind];
  const byKind = kinds.map((id) => {
    const rows = approved.filter((row) => row.kind === id);
    return {
      id,
      count: rows.length,
      sum: rows.reduce((total, row) => total + Number(row.deposit || 0), 0),
    };
  });
  const reportKinds = kinds.map((id) => {
    const rows = approvedInRange.filter((row) => row.kind === id);
    return {
      id,
      count: rows.length,
      sum: rows.reduce((total, row) => total + Number(row.deposit || 0), 0),
    };
  });
  const rangeLabel = `${from ? formatDay(from) : 'เริ่มต้น'} – ${to ? formatDay(to) : 'ปัจจุบัน'}`;

  function decide(id, decision) {
    reviewPayment(id, decision, note[id] || '');
  }

  return (
    <div className="acct-page page-wrap">
      <div className="acct-shell">
        <aside className="acct-side">
          <div className="acct-brand">
            <span><i className="bi bi-balloon-heart-fill" /></span>
            PetCare
          </div>
          <nav className="acct-nav" aria-label="เมนูฝ่ายบัญชี">
            <button type="button" className={tab === 'desk' ? 'is-on' : ''} onClick={() => setTab('desk')}>ภาพรวม</button>
            <button type="button" className={tab === 'slips' ? 'is-on' : ''} onClick={() => setTab('slips')}>
              ตรวจสลิป
              {pending.length ? <b>{pending.length}</b> : null}
            </button>
            <button type="button" className={tab === 'report' ? 'is-on' : ''} onClick={() => setTab('report')}>รายงาน</button>
          </nav>
          <div className="acct-user">
            <span className="acct-avatar" aria-hidden="true">{(currentUser?.firstName || 'บ').trim().slice(0, 1)}</span>
            <span className="acct-user-copy">
              <strong>{`${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'ฝ่ายบัญชี'}</strong>
              <small>Accountant</small>
            </span>
            <button type="button" onClick={logout} aria-label="ออกจากระบบ">
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        </aside>

        <main className="acct-main">
          {tab === 'desk' ? (
            <>
              <header className="acct-mast">
                <h1>ภาพรวมการเงิน</h1>
                <p>สรุปมัดจำที่อนุมัติแล้ว แยกตามประเภทการจอง</p>
              </header>
              <div className="acct-stats">
                <div className="acct-stat"><span>รอตรวจสลิป</span><strong>{pending.length}</strong></div>
                <div className="acct-stat"><span>อนุมัติแล้ว</span><strong>{approved.length}</strong></div>
                <div className="acct-stat"><span>มัดจำที่รับแล้ว</span><strong>{baht(approved.reduce((sum, row) => sum + Number(row.deposit || 0), 0))}</strong></div>
              </div>
              <div className="acct-stats acct-kind-stats">
                {byKind.map((item) => (
                  <div className="acct-stat" key={item.id}>
                    <span>{PAY_KIND_LABEL[item.id]}</span>
                    <strong>{baht(item.sum)}</strong>
                    <small>{item.count} รายการ</small>
                  </div>
                ))}
              </div>
              <section className="acct-card">
                <h2>รายการล่าสุด</h2>
                {all.slice(0, 6).map((row) => (
                  <div key={row.id} className="acct-row">
                    <span>{PAY_KIND_LABEL[row.kind]} · {row.title}</span>
                    <span>{baht(row.deposit)} · {row.status === PAY_STATUS.approved ? 'อนุมัติแล้ว' : 'ยังไม่อนุมัติ'}</span>
                  </div>
                ))}
                {all.length === 0 ? <p>ยังไม่มีรายการชำระ</p> : null}
              </section>
            </>
          ) : null}

          {tab === 'slips' ? (
            <>
              <header className="acct-mast">
                <h1>ตรวจสลิป</h1>
                <p>ตรวจยอดในสลิปกับยอดมัดจำ แล้วกดอนุมัติหรือไม่อนุมัติ</p>
              </header>
              {pending.length === 0 ? <div className="acct-card"><p>ไม่มีสลิปรอตรวจ</p></div> : null}
              <div className="acct-slip-list">
                {pending.map((row) => {
                  const full = row.total == null ? null : Number(row.total);
                  return (
                    <article key={row.id} className="acct-slip-card">
                      <div className="acct-slip-frame">
                        {row.slip ? <img src={row.slip} alt={`สลิป ${row.title}`} /> : <p>ไม่มีรูป</p>}
                      </div>
                      <div className="acct-slip-meta">
                        <b>{shortId(row.id)}</b>
                        <span>{formatWhen(row.submittedAt || row.createdAt)}</span>
                      </div>
                      <p className="acct-slip-who">{row.ownerName || row.email}</p>
                      <p>{PAY_KIND_LABEL[row.kind]} · {row.title}</p>
                      <p>{row.detail}</p>
                      {full != null ? (
                        <div className="acct-line"><span>ยอดเต็ม</span><b>{baht(full)}</b></div>
                      ) : null}
                      <div className="acct-due">
                        <span>ยอดที่ต้องตรงกับสลิป</span>
                        <strong>{baht(row.deposit)}</strong>
                      </div>
                      <label className="form-label" htmlFor={`note-${row.id}`}>หมายเหตุถ้าไม่ผ่าน</label>
                      <input
                        id={`note-${row.id}`}
                        className="form-control"
                        value={note[row.id] || ''}
                        onChange={(event) => setNote((current) => ({ ...current, [row.id]: event.target.value }))}
                      />
                      <div className="acct-actions">
                        <button type="button" className="btn btn-sky" onClick={() => decide(row.id, PAY_STATUS.approved)}>อนุมัติ</button>
                        <button type="button" className="btn btn-soft" onClick={() => decide(row.id, PAY_STATUS.rejected)}>ไม่อนุมัติ</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}

          {tab === 'report' ? (
            <>
              <div className="acct-filters no-print">
                <label>ตั้งแต่วัน<input type="date" className="form-control" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
                <label>ถึงวัน<input type="date" className="form-control" value={to} onChange={(event) => setTo(event.target.value)} /></label>
                <label>หมวด
                  <select className="form-control" value={kind} onChange={(event) => setKind(event.target.value)}>
                    <option value="all">ทั้งหมด</option>
                    {KINDS.map((id) => <option key={id} value={id}>{PAY_KIND_LABEL[id]}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn-sky" onClick={() => window.print()}>บันทึก PDF</button>
              </div>
              <section className="acct-card acct-report">
                <header className="acct-report-head">
                  <div className="acct-brand">
                    <span><i className="bi bi-balloon-heart-fill" /></span>
                    PetCare
                  </div>
                  <div>
                    <h2>รายงานรายรับรายจ่าย</h2>
                    <p>{rangeLabel}</p>
                    <p>ออกเอกสารเมื่อ {printedAt}</p>
                  </div>
                </header>
                <div className="acct-sum3">
                  <div><span>รายรับมัดจำ</span><strong className="is-in">{money(income)}</strong></div>
                  <div><span>รายจ่าย</span><strong className="is-out">{money(0)}</strong></div>
                  <div><span>คงเหลือสุทธิ</span><strong>{money(income)}</strong></div>
                </div>
                <h3>สรุปตามหมวด</h3>
                <table className="acct-table">
                  <thead>
                    <tr>
                      <th>ประเภท</th>
                      <th>หมวด</th>
                      <th>จำนวนรายการ</th>
                      <th>ยอดรวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportKinds.map((item) => (
                      <tr key={item.id}>
                        <td>รายรับ</td>
                        <td>{PAY_KIND_LABEL[item.id]}</td>
                        <td>{item.count}</td>
                        <td>{money(item.sum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3>รายละเอียด</h3>
                <table className="acct-table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>หมวด</th>
                      <th>รายการ</th>
                      <th>ลูกค้า</th>
                      <th>รายรับ</th>
                      <th>รายจ่าย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inRange.map((row) => {
                      const received = row.status === PAY_STATUS.approved ? Number(row.deposit || 0) : 0;
                      return (
                        <tr key={row.id}>
                          <td>{formatWhen(row.reviewedAt || row.submittedAt || row.createdAt)}</td>
                          <td>{PAY_KIND_LABEL[row.kind]}</td>
                          <td>{row.title}{row.status === PAY_STATUS.review ? ' · รอตรวจ' : ''}</td>
                          <td>{row.ownerName || row.email}</td>
                          <td>{money(received)}</td>
                          <td>{money(0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={4}>รวม</th>
                      <th>{money(income)}</th>
                      <th>{money(0)}</th>
                    </tr>
                  </tfoot>
                </table>
                {inRange.length === 0 ? <p>ไม่มีรายการในช่วงนี้</p> : null}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
