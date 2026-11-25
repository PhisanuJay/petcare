import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { fileToResizedDataUrl } from '../../shared/utils/storage.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { PAY_ACCOUNT, promptPayPayload } from './promptpay.js';
import { PAY_KIND, PAY_KIND_LABEL, PAY_STATUS, getPayment, submitSlip, usePayments } from './store.js';
import './payment.css';

function baht(value) {
  return `฿${Number(value).toLocaleString('th-TH')}`;
}

export default function PaymentPage() {
  const { paymentId } = useParams();
  const { currentUser } = useAuth();
  const { all } = usePayments();
  const payment = all.find((row) => row.id === paymentId) || getPayment(paymentId);
  const [qr, setQr] = useState('');
  const [slip, setSlip] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!payment || payment.kind === PAY_KIND.transport) return undefined;
    let gone = false;
    QRCode.toDataURL(promptPayPayload(PAY_ACCOUNT.promptpay, payment.deposit), {
      margin: 1,
      width: 280,
      color: { dark: '#17324d', light: '#ffffff' },
    }).then((url) => {
      if (!gone) setQr(url);
    }).catch(() => {
      if (!gone) setQr('');
    });
    return () => {
      gone = true;
    };
  }, [payment]);

  if (
    payment?.ownerId === currentUser?.id
    && payment.kind === PAY_KIND.transport
    && payment.refId
  ) {
    return <Navigate to={`/pet-owner/transport/${payment.refId}`} replace />;
  }

  if (!payment || payment.ownerId !== currentUser?.id) {
    return (
      <div className="pay-page page-wrap">
        <div className="container">
          <div className="pay-card">
            <h1>ไม่พบรายการชำระเงิน</h1>
            <Link to="/pet-owner/history">กลับไปประวัติการจอง</Link>
          </div>
        </div>
      </div>
    );
  }

  const locked = payment.status === PAY_STATUS.approved || payment.status === PAY_STATUS.review;
  const preview = slip || payment.slip;

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      setSlip(await fileToResizedDataUrl(file, 960, 0.82));
    } catch (err) {
      setError(err.message);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      submitSlip(payment.id, currentUser.id, slip || payment.slip);
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(PAY_ACCOUNT.promptpay);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pay-page page-wrap">
      <div className="container">
        <header className="pay-mast">
          <p>ชำระมัดจำ</p>
          <h1>{payment.title || PAY_KIND_LABEL[payment.kind]}</h1>
          <span>{PAY_KIND_LABEL[payment.kind]}</span>
        </header>
        <div className="pay-layout">
          <section className="pay-card">
            <h2>รายละเอียดการจอง</h2>
            <p className="pay-detail">{payment.detail}</p>
            <dl>
              <div><dt>ยอดเต็ม</dt><dd>{payment.total == null ? 'รอประเมิน' : baht(payment.total)}</dd></div>
              <div><dt>มัดจำ 30%</dt><dd>{baht(payment.deposit)}</dd></div>
              <div><dt>ส่วนที่เหลือ</dt><dd>{payment.total == null ? 'ชำระภายหลัง' : baht(Math.max(0, payment.total - payment.deposit))}</dd></div>
            </dl>
            <p className="pay-note">มัดจำใช้ล็อกคิว ส่วนที่เหลือชำระเมื่อใช้บริการ สลิปต้องตรงกับยอดมัดจำ ฝ่ายบัญชีเป็นคนอนุมัติ</p>
          </section>
          <section className="pay-card">
            {payment.status === PAY_STATUS.approved ? (
              <div className="pay-done">
                <h2>อนุมัติแล้ว</h2>
                <p>ฝ่ายบัญชีตรวจสลิปเรียบร้อย การจองนี้ใช้ได้</p>
                <Link className="btn btn-sky" to="/pet-owner/history">ดูประวัติการจอง</Link>
              </div>
            ) : null}
            {payment.status === PAY_STATUS.review ? (
              <div className="pay-done">
                <h2>ส่งสลิปแล้ว</h2>
                <p>สถานะตอนนี้คือ ยังไม่อนุมัติ จนกว่าฝ่ายบัญชีจะตรวจยอด</p>
                {payment.slip ? <img src={payment.slip} alt="สลิปที่ส่งแล้ว" /> : null}
                <Link className="btn btn-soft" to="/pet-owner/history">ไปหน้าประวัติ</Link>
              </div>
            ) : null}
            {!locked || payment.status === PAY_STATUS.rejected ? (
              <form onSubmit={onSubmit}>
                <h2>สแกนมัดจำ</h2>
                {payment.status === PAY_STATUS.rejected ? (
                  <p className="pay-warn">สลิปยังไม่ผ่าน{payment.note ? ` · ${payment.note}` : ''} แนบสลิปใหม่ได้</p>
                ) : null}
                <div className="pay-qr">
                  {qr ? <img src={qr} alt={`QR มัดจำ ${baht(payment.deposit)}`} /> : <p>กำลังสร้าง QR</p>}
                </div>
                <p className="pay-account">
                  <span>{PAY_ACCOUNT.bank} · {PAY_ACCOUNT.name}</span>
                  <strong>{PAY_ACCOUNT.promptpay}</strong>
                  <button type="button" onClick={copyAccount}>{copied ? 'คัดลอกแล้ว' : 'คัดลอกเลข'}</button>
                </p>
                <label className="pay-file">
                  <input type="file" accept="image/*" onChange={onFile} />
                  <span>{preview ? 'เปลี่ยนรูปสลิป' : 'แนบสลิปการโอน'}</span>
                </label>
                {preview ? <img className="pay-slip" src={preview} alt="ตัวอย่างสลิป" /> : null}
                {error ? <p className="pay-warn">{error}</p> : null}
                <button className="btn btn-sky" type="submit" disabled={!preview}>ยืนยันการชำระ</button>
              </form>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
