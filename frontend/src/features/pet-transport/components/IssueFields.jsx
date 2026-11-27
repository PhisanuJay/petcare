import { useState } from 'react';
import { ISSUE_REASONS } from '../constants.js';

export default function IssueFields({ onSubmit, onClose }) {
  const [reason, setReason] = useState(ISSUE_REASONS[0].id);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    if (!message.trim()) {
      setError('กรอกรายละเอียดปัญหา');
      return;
    }
    onSubmit(reason, message.trim());
  }

  return (
    <form className="driver-issue" onSubmit={submit}>
      <div className="field">
        <label htmlFor="issue-reason">เหตุผล</label>
        <select id="issue-reason" value={reason} onChange={(event) => setReason(event.target.value)}>
          {ISSUE_REASONS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="issue-message">รายละเอียด</label>
        <textarea id="issue-message" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
      </div>
      {error ? <p className="driver-issue__error">{error}</p> : null}
      <div className="driver-issue__actions">
        <button type="submit" className="tp-btn">ส่งให้แอดมิน</button>
        <button type="button" className="tp-btn tp-btn--ghost" onClick={onClose}>ปิด</button>
      </div>
    </form>
  );
}
