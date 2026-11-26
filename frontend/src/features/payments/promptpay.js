/** One receiving account for every PetCare booking. Demo PromptPay, same idea as a shop QR. */
export const PAY_ACCOUNT = {
  promptpay: '0812345678',
  name: 'PetCare Animal Clinic',
  bank: 'พร้อมเพย์',
};

/** Legacy field name on payment records; amount due equals full total (no partial deposit). */
export function depositOf(total) {
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount);
}

function field(id, value) {
  const text = String(value);
  return `${id}${String(text.length).padStart(2, '0')}${text}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** EMV PromptPay payload with a fixed amount, so a banking app opens the deposit. */
export function promptPayPayload(phone, amount) {
  let target = String(phone || '').replace(/\D/g, '');
  if (target.startsWith('0')) target = `66${target.slice(1)}`;
  target = target.padStart(13, '0');
  const merchant = field('00', 'A000000677010111') + field('01', target);
  const body = [
    field('00', '01'),
    field('01', '12'),
    field('29', merchant),
    field('53', '764'),
    field('54', Number(amount).toFixed(2)),
    field('58', 'TH'),
    field('59', 'PETCARE'),
    field('60', 'BANGKOK'),
  ].join('');
  const ready = `${body}6304`;
  return ready + crc16(ready);
}
