import { formatBaht } from '../pricing.js';
import { isRoundTrip, serviceTypeMeta } from '../constants.js';
import zonesMapUrl from '../assets/service-zones-map.jpg';

/** Zone map image only (separate from price summary). */
export function ServiceZonesMap() {
  return (
    <img
      className="tp-quote__map tp-quote__map--solo"
      src={zonesMapUrl}
      alt="พื้นที่ให้บริการเขตจตุจักร Zone 1 ฿100 · Zone 2 ฿150"
      width={1024}
      height={682}
      decoding="async"
      loading="eager"
    />
  );
}

export default function PriceQuote({ quote, title = 'สรุปค่าบริการ (ก่อนยืนยัน)' }) {
  if (!quote) {
    return (
      <div className="tp-quote">
        {title ? <div className="tp-quote__title">{title}</div> : null}
        <p className="tp-muted" style={{ margin: 0 }}>เลือกจุดรับและจุดส่งเพื่อดูราคา</p>
      </div>
    );
  }

  const meta = serviceTypeMeta(quote.serviceType);
  const round = isRoundTrip(quote.serviceType);
  const inboundOnly = quote.serviceType === 'inbound';
  const lines = Array.isArray(quote.lines) && quote.lines.length
    ? quote.lines
    : null;

  return (
    <div className="tp-quote">
      {title ? <div className="tp-quote__title">{title}</div> : null}
      {meta && (
        <div className="tp-quote__row">
          <span>ประเภท</span>
          <strong>{meta.label}</strong>
        </div>
      )}
      {quote.fromZoneId && quote.toZoneId && (
        <div className="tp-quote__row">
          <span>{round ? 'เที่ยวไป' : 'Zone รับ → ส่ง'}</span>
          <strong>
            Zone {quote.fromZoneId} → Zone {quote.toZoneId}
            {round && quote.outboundPerTrip != null ? ` · ${formatBaht(quote.outboundPerTrip)}` : ''}
          </strong>
        </div>
      )}
      {round && quote.returnFromZoneId && quote.returnToZoneId && (
        <div className="tp-quote__row">
          <span>เที่ยวกลับ</span>
          <strong>
            Zone {quote.returnFromZoneId} → Zone {quote.returnToZoneId}
            {quote.returnPerTrip != null ? ` · ${formatBaht(quote.returnPerTrip)}` : ''}
          </strong>
        </div>
      )}
      <div className="tp-quote__row">
        <span>จำนวนเที่ยวรถ</span>
        <strong>{quote.trips}</strong>
      </div>

      {lines ? lines.map((line) => (
        <div key={`${line.type}-${line.label}`} className="tp-quote__row">
          <span>{line.label}</span>
          <strong>{formatBaht(line.amount)}</strong>
        </div>
      )) : (
        <div className="tp-quote__row">
          <span>ค่ารถรับ–ส่ง</span>
          <strong>{formatBaht(quote.transportTotal ?? quote.total)}</strong>
        </div>
      )}

      {inboundOnly && (
        <p className="tp-muted" style={{ marginBottom: 0 }}>รับกลับคิดเฉพาะค่ารถ</p>
      )}

      <div className="tp-quote__row tp-quote__total">
        <span>รวมทั้งสิ้น</span>
        <strong>{formatBaht(quote.total)}</strong>
      </div>
      {round && (
        <p className="tp-muted" style={{ marginBottom: 0 }}>ไป–กลับคิดราคารถรวมทั้ง 2 เที่ยว ไม่มีส่วนลด</p>
      )}
      {quote.needsAdminReview && (
        <p className="tp-muted">รอ Admin พิจารณาราคา</p>
      )}
    </div>
  );
}
