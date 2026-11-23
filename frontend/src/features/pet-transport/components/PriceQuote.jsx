import { formatBaht } from '../pricing.js';

export default function PriceQuote({ quote, title = 'ราคาประเมิน' }) {
  if (!quote) {
    return (
      <div className="tp-quote">
        <div className="tp-quote__title">{title}</div>
        <p className="tp-muted" style={{ margin: 0 }}>เลือกแขวงจุดรับและจุดส่งเพื่อดูราคา</p>
      </div>
    );
  }

  return (
    <div className="tp-quote">
      <div className="tp-quote__title">{title}</div>
      {quote.fromZoneId && quote.toZoneId && (
        <div className="tp-quote__row">
          <span>Zone รับ → ส่ง</span>
          <strong>Zone {quote.fromZoneId} → Zone {quote.toZoneId}</strong>
        </div>
      )}
      <div className="tp-quote__row">
        <span>คิดตาม</span>
        <strong>Zone {quote.fareZoneId || quote.zoneId}</strong>
      </div>
      <div className="tp-quote__row">
        <span>จำนวนเที่ยว</span>
        <strong>{quote.trips}</strong>
      </div>
      <div className="tp-quote__row">
        <span>ราคา/เที่ยว</span>
        <strong>{formatBaht(quote.perTrip)}</strong>
      </div>
      {quote.discount > 0 && (
        <div className="tp-quote__row">
          <span>ส่วนลดไป–กลับ 10%</span>
          <strong>-{formatBaht(quote.discount)}</strong>
        </div>
      )}
      <div className="tp-quote__row tp-quote__total">
        <span>รวม</span>
        <strong>{formatBaht(quote.total)}</strong>
      </div>
      {quote.needsAdminReview && (
        <p className="tp-muted">รอ Admin พิจารณาราคา</p>
      )}
    </div>
  );
}
