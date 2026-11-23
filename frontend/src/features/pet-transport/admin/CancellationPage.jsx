import { useState } from 'react';
import { useTransport } from '../useTransport.js';

export default function CancellationPage() {
  const { bookings, resolveCancel, issues, drivers } = useTransport();
  const requests = bookings.filter((b) => b.status === 'cancel_requested');
  const [notes, setNotes] = useState({});

  return (
    <>
      <h1>Cancellation / Reschedule</h1>
      <p className="tp-lead">อนุมัติหรือปฏิเสธคำขอยกเลิก + ดูปัญหาจากคนขับ</p>

      <h3>คำขอยกเลิกจาก Owner</h3>
      <div className="tp-list" style={{ marginBottom: '1.25rem' }}>
        {requests.map((b) => (
          <div key={b.id} className="tp-card">
            <strong>{b.petName}</strong> · {b.ownerName}
            <p className="tp-muted">เหตุผล: {b.cancelRequest?.reason}</p>
            <div className="tp-form">
              <div className="field">
                <label htmlFor={`n-${b.id}`}>หมายเหตุ Admin</label>
                <input
                  id={`n-${b.id}`}
                  value={notes[b.id] || ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [b.id]: e.target.value }))}
                />
              </div>
            </div>
            <div className="tp-actions">
              <button type="button" className="tp-btn tp-btn--danger" onClick={() => resolveCancel(b.id, true, notes[b.id])}>
                อนุมัติยกเลิก
              </button>
              <button type="button" className="tp-btn tp-btn--ghost" onClick={() => resolveCancel(b.id, false, notes[b.id])}>
                ปฏิเสธ
              </button>
            </div>
          </div>
        ))}
        {!requests.length && <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ไม่มีคำขอยกเลิก</p></div>}
      </div>

      <h3>ปัญหาจากคนขับ</h3>
      <div className="tp-list">
        {issues.map((issue) => (
          <div key={issue.id} className="tp-list-item">
            <div>
              <strong>{drivers.find((d) => d.id === issue.driverId)?.name || issue.driverId}</strong>
              <div className="tp-list-item__meta">เหตุผล: {issue.reasonId}</div>
              <div className="tp-list-item__meta">{issue.message}</div>
            </div>
            <span className="tp-badge tp-badge--warn">{issue.status}</span>
          </div>
        ))}
        {!issues.length && <div className="tp-card"><p className="tp-muted" style={{ margin: 0 }}>ยังไม่มีรายงานปัญหา</p></div>}
      </div>
    </>
  );
}
