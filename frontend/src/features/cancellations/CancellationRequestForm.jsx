import { useState } from 'react';
import './cancellations.css';

const BANKS = [
  'ธนาคารกรุงเทพ',
  'ธนาคารกรุงไทย',
  'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารกสิกรไทย',
  'ธนาคารเกียรตินาคินภัทร',
  'ธนาคารซีไอเอ็มบีไทย',
  'ธนาคารทหารไทยธนชาต',
  'ธนาคารทิสโก้',
  'ธนาคารไทยพาณิชย์',
  'ธนาคารยูโอบี',
  'ธนาคารออมสิน',
  'ธนาคารอาคารสงเคราะห์',
  'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร',
  'ธนาคารอิสลามแห่งประเทศไทย',
  'ธนาคารแลนด์ แอนด์ เฮ้าส์',
];

export default function CancellationRequestForm({ idPrefix, initialPhone = '', onSubmit, onCancel }) {
  const [reason, setReason] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [contactPhone, setContactPhone] = useState(initialPhone);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit({ reason, bankAccount, bankName, contactPhone });
    } catch (submitError) {
      setError(submitError.message || 'ส่งคำขอยกเลิกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="cancel-request-form" onSubmit={submit}>
      <label htmlFor={`${idPrefix}-reason`}>สาเหตุการขอยกเลิก</label>
      <textarea
        id={`${idPrefix}-reason`}
        rows={3}
        maxLength={500}
        required
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="อธิบายเหตุผลที่ต้องการยกเลิก"
      />
      <div className="cancel-request-form__grid">
        <div>
          <label htmlFor={`${idPrefix}-account`}>เลขบัญชีสำหรับรับเงินคืน</label>
          <input
            id={`${idPrefix}-account`}
            autoComplete="off"
            inputMode="numeric"
            maxLength={19}
            required
            value={bankAccount}
            onChange={(event) => setBankAccount(event.target.value)}
            placeholder="กรอกเลขบัญชี"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-bank`}>ธนาคาร</label>
          <select
            id={`${idPrefix}-bank`}
            required
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
          >
            <option value="">เลือกธนาคาร</option>
            {BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-phone`}>เบอร์ติดต่อ</label>
          <input
            id={`${idPrefix}-phone`}
            autoComplete="tel"
            inputMode="tel"
            maxLength={12}
            required
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="0XXXXXXXXX"
          />
        </div>
      </div>
      {error ? <p className="cancel-request-form__error" role="alert">{error}</p> : null}
      <div className="cancel-request-form__actions">
        {onCancel ? (
          <button type="button" className="btn btn-soft" onClick={onCancel} disabled={saving}>
            กลับ
          </button>
        ) : null}
        <button type="submit" className="btn btn-soft-danger" disabled={saving}>
          {saving ? 'กำลังส่งคำขอ...' : 'ส่งคำขอยกเลิก'}
        </button>
      </div>
    </form>
  );
}
