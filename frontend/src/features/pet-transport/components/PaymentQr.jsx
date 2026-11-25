import { formatBaht } from '../pricing.js';

/** Demo PromptPay / payment QR for MVP (no payment gateway). */
const PROMPTPAY_ID = '0810001111';
const ACCOUNT_NAME = 'PetCare Transport';

function buildPayload({ bookingId, amount }) {
  const baht = amount == null || Number.isNaN(Number(amount)) ? '' : Number(amount).toFixed(2);
  return [
    'PetCare PromptPay',
    `บัญชี: ${ACCOUNT_NAME}`,
    `พร้อมเพย์: ${PROMPTPAY_ID}`,
    baht ? `ยอด: ${baht} บาท` : null,
    bookingId ? `อ้างอิง: ${bookingId}` : null,
  ].filter(Boolean).join('\n');
}

export default function PaymentQr({ bookingId, amount, visible }) {
  if (!visible) return null;
  const payload = buildPayload({ bookingId, amount });
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&ecc=M&margin=8&data=${encodeURIComponent(payload)}`;

  return (
    <div className="tp-pay-qr">
      <div className="tp-pay-qr__frame">
        <img src={src} alt="QR ชำระเงิน PetCare" width={220} height={220} />
      </div>
      <div className="tp-pay-qr__meta">
        <strong>{formatBaht(amount)}</strong>
        <div className="tp-muted">พร้อมเพย์ {PROMPTPAY_ID}</div>
        <div className="tp-muted">{ACCOUNT_NAME}</div>
        <p className="tp-muted" style={{ marginBottom: 0 }}>
          สแกนด้วยแอปธนาคาร แล้วกดยืนยันว่าชำระแล้วด้านล่าง
        </p>
      </div>
    </div>
  );
}
