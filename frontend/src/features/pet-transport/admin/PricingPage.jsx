import { useEffect, useMemo, useState } from 'react';
import { HOTEL_ROOMS } from '../../pet-owner/hotelOptions.js';
import { useHotelPricing } from '../../pet-owner/useHotelPricing.js';
import { fareMatrixPreview, formatBaht } from '../pricing.js';
import { SERVICE_SUBDISTRICTS } from '../constants.js';
import { useTransport } from '../useTransport.js';
import './pricing.css';

function priceRows(items) {
  return items.map((item) => ({ ...item, price: item.price ?? '' }));
}

function validPrice(value, minimum = 0) {
  const price = Number(value);
  return value !== ''
    && Number.isSafeInteger(price)
    && price >= minimum
    && price <= 1000000;
}

export default function PricingPage() {
  const {
    zones,
    hotelRoomPrices,
    updateZones,
    updateHotelRoomPrices,
    loading,
    error: loadError,
  } = useTransport();
  const { refresh: refreshHotelPricing } = useHotelPricing();
  const [zoneRows, setZoneRows] = useState(() => priceRows(zones));
  const [roomRows, setRoomRows] = useState(() => priceRows(hotelRoomPrices));
  const [saving, setSaving] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    setZoneRows(priceRows(zones));
  }, [zones]);

  useEffect(() => {
    setRoomRows(priceRows(hotelRoomPrices));
  }, [hotelRoomPrices]);

  const previewZones = useMemo(
    () => zoneRows.map((row) => ({
      ...row,
      price: row.price === '' ? null : Number(row.price),
    })),
    [zoneRows],
  );
  const matrix = fareMatrixPreview(previewZones);

  function setZonePrice(id, price) {
    setZoneRows((current) => current.map((row) => (row.id === id ? { ...row, price } : row)));
    setFeedback({ type: '', message: '' });
  }

  function setRoomPrice(id, price) {
    setRoomRows((current) => current.map((row) => (row.id === id ? { ...row, price } : row)));
    setFeedback({ type: '', message: '' });
  }

  async function saveZones(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });
    if (!zoneRows.length || zoneRows.some((row) => !validPrice(row.price))) {
      setFeedback({ type: 'error', message: 'กรุณากรอกราคาทุกโซนเป็นจำนวนเต็มตั้งแต่ 0 ถึง 1,000,000 บาท' });
      return;
    }

    setSaving('zones');
    try {
      await updateZones(zoneRows.map(({ id, label, price }) => ({
        id,
        label,
        price: Number(price),
      })));
      setFeedback({ type: 'success', message: 'บันทึกราคารับ–ส่งแล้ว' });
    } catch (saveError) {
      setFeedback({ type: 'error', message: saveError.message || 'บันทึกราคารับ–ส่งไม่สำเร็จ' });
    } finally {
      setSaving('');
    }
  }

  async function saveHotelPrices(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });
    if (!roomRows.length || roomRows.some((row) => !validPrice(row.price, 1))) {
      setFeedback({ type: 'error', message: 'กรุณากรอกราคาห้องพักทุกประเภทเป็นจำนวนเต็มตั้งแต่ 1 ถึง 1,000,000 บาท' });
      return;
    }

    setSaving('hotel');
    try {
      await updateHotelRoomPrices(roomRows.map(({ id, price }) => ({
        id,
        price: Number(price),
      })));
      try {
        await refreshHotelPricing();
      } catch (refreshError) {
        setFeedback({
          type: 'error',
          message: `บันทึกราคาแล้ว แต่โหลดราคาล่าสุดไม่สำเร็จ: ${refreshError.message}`,
        });
        return;
      }
      setFeedback({ type: 'success', message: 'บันทึกราคาห้องพักแล้ว มีผลกับการจองใหม่' });
    } catch (saveError) {
      setFeedback({ type: 'error', message: saveError.message || 'บันทึกราคาห้องพักไม่สำเร็จ' });
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="tp-pricing">
      <header className="tp-pricing__head">
        <p>การรับส่งสัตว์และที่พัก</p>
        <h1>ตั้งค่าราคา</h1>
        <span>จัดการค่าเดินทางและราคาห้องพัก อัตราใหม่ใช้กับการจองใหม่เท่านั้น</span>
      </header>

      {loadError ? <div className="tp-alert tp-alert--danger" role="alert">{loadError}</div> : null}
      {feedback.message ? (
        <div
          className={`tp-alert ${feedback.type === 'error' ? 'tp-alert--danger' : 'tp-alert--ok'}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="tp-pricing__section" aria-labelledby="tp-pricing-zones">
        <header className="tp-pricing__section-head">
          <div>
            <h2 id="tp-pricing-zones">ค่ารถรับ–ส่ง</h2>
            <p>ราคาฐานต่อเที่ยวตามโซน</p>
          </div>
          <span>{zoneRows.length} โซน</span>
        </header>
        {loading && zoneRows.length === 0 ? <p role="status">กำลังโหลดราคา...</p> : null}
        <form onSubmit={saveZones}>
          <div className="tp-pricing__zone-grid">
            {zoneRows.map((zone) => (
              <article className="tp-pricing__zone-card" key={zone.id}>
                <div className="tp-pricing__zone-copy">
                  <span>Zone {zone.id}</span>
                  <p>
                    {SERVICE_SUBDISTRICTS
                      .filter((subdistrict) => subdistrict.zoneId === zone.id)
                      .map((subdistrict) => subdistrict.label)
                      .join(' · ')}
                  </p>
                </div>
                <label className="tp-pricing__price-field" htmlFor={`zone-price-${zone.id}`}>
                  <span>ราคาต่อเที่ยว</span>
                  <span className="tp-pricing__input-wrap">
                    <b>฿</b>
                    <input
                      id={`zone-price-${zone.id}`}
                      type="number"
                      min="0"
                      max="1000000"
                      step="1"
                      inputMode="numeric"
                      required
                      value={zone.price}
                      onChange={(event) => setZonePrice(zone.id, event.target.value)}
                    />
                    <small>บาท</small>
                  </span>
                </label>
              </article>
            ))}
          </div>
          <footer className="tp-pricing__form-foot">
            <p>ไป–กลับคิดรวมราคาของทั้งสองเที่ยว</p>
            <button type="submit" className="btn btn-sky" disabled={saving !== '' || loading || Boolean(loadError)}>
              {saving === 'zones' ? 'กำลังบันทึก...' : 'บันทึกราคารถ'}
            </button>
          </footer>
        </form>
      </section>

      <section className="tp-pricing__section" aria-labelledby="tp-pricing-hotel">
        <header className="tp-pricing__section-head">
          <div>
            <h2 id="tp-pricing-hotel">ราคาห้องพักโรงแรม</h2>
            <p>กำหนดราคาต่อกรง ต่อคืน สำหรับแต่ละประเภทห้อง</p>
          </div>
          <span>{roomRows.length} ประเภท</span>
        </header>
        {loading && roomRows.length === 0 ? <p role="status">กำลังโหลดราคา...</p> : null}
        <form onSubmit={saveHotelPrices}>
          <div className="tp-pricing__room-grid">
            {roomRows.map((room) => {
              const details = HOTEL_ROOMS.find((item) => item.value === room.id);
              return (
                <article className="tp-pricing__room-card" key={room.id}>
                  <div className="tp-pricing__room-title">
                    <span><i className={`bi ${details?.icon || 'bi-house-door'}`} aria-hidden="true" /></span>
                    <div>
                      <h3>{details?.label || room.label}</h3>
                      <p>ราคาต่อกรง / คืน</p>
                    </div>
                  </div>
                  <label className="tp-pricing__price-field" htmlFor={`hotel-price-${room.id}`}>
                    <span>ราคา</span>
                    <span className="tp-pricing__input-wrap">
                      <b>฿</b>
                      <input
                        id={`hotel-price-${room.id}`}
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                        inputMode="numeric"
                        required
                        value={room.price}
                        onChange={(event) => setRoomPrice(room.id, event.target.value)}
                      />
                      <small>/ คืน</small>
                    </span>
                  </label>
                </article>
              );
            })}
          </div>
          <footer className="tp-pricing__form-foot">
            <p>ใบจองเดิมจะคงราคาที่บันทึกไว้</p>
            <button type="submit" className="btn btn-sky" disabled={saving !== '' || loading || Boolean(loadError)}>
              {saving === 'hotel' ? 'กำลังบันทึก...' : 'บันทึกราคาโรงแรม'}
            </button>
          </footer>
        </form>
      </section>

      <section className="tp-pricing__section tp-pricing__matrix" aria-labelledby="tp-pricing-matrix">
        <header className="tp-pricing__section-head">
          <div>
            <h2 id="tp-pricing-matrix">ตัวอย่างค่าเดินทาง</h2>
            <p>ค่าเที่ยวเดียวตามโซนรับและโซนส่ง</p>
          </div>
        </header>
        <div className="tp-table-wrap">
          <table className="tp-table">
            <thead>
              <tr>
                <th scope="col">จุดรับ</th>
                <th scope="col">จุดส่ง</th>
                <th scope="col">ราคาเที่ยวเดียว</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={`${row.from}-${row.to}`}>
                  <td>Zone {row.from}</td>
                  <td>Zone {row.to}</td>
                  <td>{formatBaht(row.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tp-pricing__note">
          Zone 1 → Zone 1 ใช้ราคา Zone 1 · เส้นทางที่มี Zone 2 ใช้ราคา Zone 2
        </p>
      </section>
    </div>
  );
}
