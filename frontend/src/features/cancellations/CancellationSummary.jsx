import { CANCELLATION_STATUS, CANCELLATION_STATUS_LABEL } from './store.js';
import './cancellations.css';

function baht(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}

export default function CancellationSummary({ request }) {
  if (!request) return null;

  return (
    <div className="cancel-summary" role="status">
      <strong>{CANCELLATION_STATUS_LABEL[request.status] || 'กำลังดำเนินการ'}</strong>
      <p>เหตุผลที่ส่ง: {request.reason}</p>
      {request.status === CANCELLATION_STATUS.awaitingRefund
        || request.status === CANCELLATION_STATUS.refunded ? (
          <p>ยอดคืนตามรายการชำระที่อนุมัติแล้ว: {request.refundAmount == null ? 'กำลังตรวจสอบ' : baht(request.refundAmount)}</p>
        ) : null}
      {request.adminNote ? <p>หมายเหตุจากแอดมิน: {request.adminNote}</p> : null}
      {request.accountantNote ? <p>หมายเหตุจากฝ่ายบัญชี: {request.accountantNote}</p> : null}
      {request.refundReceipt ? (
        <a href={request.refundReceipt} target="_blank" rel="noreferrer">
          ดูหลักฐานการคืนเงิน
        </a>
      ) : null}
    </div>
  );
}
