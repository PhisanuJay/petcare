import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fileToResizedDataUrl } from '../../../shared/utils/storage.js';
import { PAY_ACCOUNT, promptPayPayload } from '../../payments/promptpay.js';
import {
  createPayment,
  PAY_KIND,
  paymentFor,
  PAY_STATUS,
  submitSlip,
  usePayments,
} from '../../payments/store.js';
import { HUB_CATEGORY_LABEL, parseClinicHubLabel } from '../hubCart.js';

const HUB_CATEGORY_ICON = {
  clinic: 'bi-hospital',
  hotel: 'bi-building',
  transport: 'bi-truck',
};

const HUB_ALL_CATEGORIES = ['clinic', 'hotel', 'transport'];

const PAY_KIND_FOR_LINE = {
  clinic: PAY_KIND.clinic,
  hotel: PAY_KIND.hotel,
  transport: PAY_KIND.transport,
};

function baht(value) {
  return `฿${Number(value).toLocaleString('th-TH')}`;
}

function clinicPetsForLine(line) {
  if (Array.isArray(line.clinicPets) && line.clinicPets.length) return line.clinicPets;
  if (line.category === 'clinic') return parseClinicHubLabel(line.label);
  return [];
}

export default function HubCheckout({
  lines,
  sessionId,
  onBack,
  onPaid,
  onEditLine,
  onAddCategory,
}) {
  const { currentUser } = useAuth();
  const { all: payments } = usePayments(currentUser?.id);
  const [qr, setQr] = useState('');
  const [slip, setSlip] = useState('');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0),
    [lines],
  );
  const missingCategories = useMemo(
    () => HUB_ALL_CATEGORIES.filter((id) => !lines.some((line) => line.category === id)),
    [lines],
  );
  const hubComplete = missingCategories.length === 0;

  const existingPayment = payments.find(
    (row) => row.kind === PAY_KIND.hub && row.refId === sessionId,
  ) || paymentFor(PAY_KIND.hub, sessionId, currentUser?.id);
  const paymentLocked = existingPayment?.status === PAY_STATUS.approved;

  useEffect(() => {
    if (paymentLocked || total <= 0) {
      setQr('');
      return undefined;
    }
    let gone = false;
    QRCode.toDataURL(promptPayPayload(PAY_ACCOUNT.promptpay, total), {
      margin: 1,
      width: 240,
      color: { dark: '#17324d', light: '#ffffff' },
    })
      .then((url) => {
        if (!gone) setQr(url);
      })
      .catch(() => {
        if (!gone) setQr('');
      });
    return () => {
      gone = true;
    };
  }, [total, paymentLocked]);

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

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(PAY_ACCOUNT.promptpay);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function onPaySubmit(event) {
    event.preventDefault();
    if (!currentUser?.id || !sessionId || !lines.length) return;
    if (!slip) {
      setError('กรุณาแนบสลิปการโอน');
      return;
    }
    setError('');
    setPaying(true);
    try {
      const ownerName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
      const payLines = lines.map((line) => ({
        kind: PAY_KIND_FOR_LINE[line.category] || line.category,
        refId: line.refId,
        label: line.label,
        total: line.total,
      }));
      let payment = paymentFor(PAY_KIND.hub, sessionId, currentUser.id);
      if (payment?.status === PAY_STATUS.approved) {
        onPaid?.();
        return;
      }
      if (!payment || payment.status === PAY_STATUS.rejected || Number(payment.total) !== total) {
        payment = await createPayment({
          kind: PAY_KIND.hub,
          refId: sessionId,
          ownerId: currentUser.id,
          ownerName,
          email: currentUser.email || '',
          title: 'จองรวม Hub',
          detail: lines.map((line) => `${HUB_CATEGORY_LABEL[line.category] || line.category}: ${line.label}`).join(' · '),
          total,
          lines: payLines,
        });
      }
      await submitSlip(payment.id, currentUser.id, slip);
      onPaid?.();
    } catch (err) {
      setError(err.message || 'ไม่สามารถส่งสลิปได้');
    } finally {
      setPaying(false);
    }
  }

  return (
    <section className="booking-hub__checkout" aria-label="สรุปรายการจอง">
      <nav className="booking-hub__checkout-toolbar" aria-label="นำทางสรุปรายการ">
        <button type="button" className="btn btn-soft booking-hub__checkout-back" onClick={onBack}>
          <i className="bi bi-chevron-left" aria-hidden />
          กลับ
        </button>
      </nav>

      <header className="booking-hub__checkout-head">
        <div className="booking-hub__checkout-head-row">
          <h2 className="booking-hub__checkout-title">สรุปรายการจอง</h2>
          <span className="booking-hub__checkout-badge">
            {lines.length} รายการ
          </span>
        </div>
        <p className="booking-hub__checkout-lead text-muted small mb-0">
          ตรวจสอบรายละเอียดก่อนชำระเต็มจำนวน — กด «แก้ไข»ที่แต่ละรายการ
          {hubComplete ? '' : ' หรือเพิ่มบริการที่ยังไม่มีด้านล่าง'}
        </p>
      </header>

      <ul className="booking-hub__checkout-list">
        {lines.map((line) => {
          const kind = HUB_CATEGORY_LABEL[line.category] || line.category;
          const icon = HUB_CATEGORY_ICON[line.category] || 'bi-calendar-check';
          const clinicPets = clinicPetsForLine(line);
          const multiClinicPets = clinicPets.length > 1;
          return (
            <li
              key={line.id}
              className={`booking-hub__checkout-item booking-hub__checkout-item--${line.category}`}
            >
              <div className="booking-hub__checkout-item__icon" aria-hidden>
                <i className={`bi ${icon}`} />
              </div>
              <div className="booking-hub__checkout-item__body">
                <span className="booking-hub__checkout-item__kind">{kind}</span>
                {line.category === 'clinic' && clinicPets.length > 0 ? (
                  <>
                    {multiClinicPets ? (
                      <p className="booking-hub__checkout-item__pet-count">
                        <i className="bi bi-people-fill" aria-hidden />
                        นำสัตว์เข้ารับบริการ {clinicPets.length} ตัว
                      </p>
                    ) : null}
                    <div className="booking-hub__checkout-pets">
                      {clinicPets.map((pet) => (
                        <div
                          key={pet.name}
                          className="booking-hub__checkout-pet"
                        >
                          <strong className="booking-hub__checkout-pet__name">{pet.name}</strong>
                          {pet.services.length > 0 ? (
                            <ul className="booking-hub__checkout-item__services">
                              {pet.services.map((svc) => (
                                <li key={`${pet.name}-${svc}`}>{svc}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <strong className="booking-hub__checkout-item__title">{line.label}</strong>
                )}
                {line.detail ? (
                  <p className="booking-hub__checkout-item__detail">{line.detail}</p>
                ) : null}
              </div>
              <div className="booking-hub__checkout-item__aside">
                <div className="booking-hub__checkout-item__price">
                  <span className="booking-hub__checkout-item__price-label">ยอด</span>
                  <strong>{baht(line.total)}</strong>
                </div>
                {onEditLine ? (
                  <button
                    type="button"
                    className="btn btn-soft btn-sm booking-hub__checkout-item__edit"
                    onClick={() => onEditLine(line)}
                  >
                    <i className="bi bi-pencil-square" aria-hidden />
                    แก้ไข
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="booking-hub__checkout-total" aria-live="polite">
        <span>ยอดชำระรวม (เต็มจำนวน)</span>
        <strong>{baht(total)}</strong>
      </div>

      {!hubComplete && onAddCategory && missingCategories.length > 0 ? (
        <div className="booking-hub__checkout-add-missing" role="group" aria-label="เพิ่มบริการที่ยังไม่มี">
          <span className="booking-hub__checkout-add-missing__label">ยังไม่มีในรายการ</span>
          <div className="booking-hub__checkout-add-missing__buttons">
            {missingCategories.map((category) => (
              <button
                key={category}
                type="button"
                className="btn btn-soft"
                onClick={() => onAddCategory(category)}
              >
                <i className={`bi ${HUB_CATEGORY_ICON[category] || 'bi-plus-lg'} me-1`} aria-hidden />
                เพิ่ม{HUB_CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {paymentLocked ? (
        <div className="booking-hub__checkout-pay-done">
          <p>ชำระเงินแล้ว — สามารถใช้บริการตามรายการจองได้ทันที</p>
          <button type="button" className="btn btn-sky" onClick={() => onPaid?.()}>
            ไปประวัติการจอง
          </button>
        </div>
      ) : (
        <form id="hub-checkout-pay-form" className="booking-hub__checkout-pay" onSubmit={onPaySubmit}>
          <h3 className="booking-hub__checkout-pay-title">ชำระเงินทันที</h3>
          <p className="booking-hub__checkout-pay-lead text-muted small">
            โอนยอดเต็มจำนวนตาม QR แล้วแนบสลิป — สลิปต้องตรงกับยอดรวมด้านบน
          </p>
          <div className="booking-hub__checkout-qr">
            {qr ? <img src={qr} alt={`QR ชำระ ${baht(total)}`} /> : <p className="small text-muted mb-0">กำลังสร้าง QR</p>}
          </div>
          <p className="booking-hub__checkout-account">
            <span>{PAY_ACCOUNT.bank} · {PAY_ACCOUNT.name}</span>
            <strong>{PAY_ACCOUNT.promptpay}</strong>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={copyAccount}>
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกเลข'}
            </button>
          </p>
          <label className="booking-hub__checkout-slip btn btn-soft mb-2">
            <input type="file" accept="image/*" onChange={onFile} />
            <i className="bi bi-paperclip me-1" aria-hidden />
            {slip ? 'เปลี่ยนรูปสลิป' : 'แนบสลิปการโอน'}
          </label>
          {slip ? <img className="booking-hub__checkout-slip-preview" src={slip} alt="ตัวอย่างสลิป" /> : null}
          {error ? <p className="text-danger small mb-2">{error}</p> : null}
        </form>
      )}

      <div className="booking-hub__checkout-actions">
        <Link to="/pet-owner/history" className="btn btn-soft">
          <i className="bi bi-clock-history me-1" aria-hidden />
          ประวัติการจอง
        </Link>
        {!paymentLocked ? (
          <button
            type="submit"
            form="hub-checkout-pay-form"
            className="btn btn-sky"
            disabled={!lines.length || !slip || paying}
          >
            {paying ? 'กำลังส่งสลิป...' : 'จองเลย'}
          </button>
        ) : null}
      </div>
    </section>
  );
}