import { useState } from 'react';
import { useTransport } from '../useTransport.js';

export default function PricingPage() {
  const { zones, updateZones } = useTransport();
  const [rows, setRows] = useState(zones.map((z) => ({ ...z, price: z.price ?? '' })));
  const [msg, setMsg] = useState('');

  function setPrice(id, price) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, price } : r)));
  }

  function save() {
    updateZones(
      rows.map((r) => ({
        ...r,
        price: r.id === 'OUT' ? (r.price === '' ? null : Number(r.price)) : Number(r.price),
      })),
    );
    setMsg('บันทึกตารางราคาแล้ว');
  }

  return (
    <>
      <h1>Pricing (Zone)</h1>
      <p className="tp-lead">กำหนดราคาต่อเที่ยวตาม Zone — ไป–กลับลด 10% อัตโนมัติ</p>
      {msg && <div className="tp-alert tp-alert--ok">{msg}</div>}
      <div className="tp-card tp-form">
        {rows.map((z) => (
          <div key={z.id} className="field row-2" style={{ alignItems: 'end' }}>
            <div>
              <label>{z.label}</label>
              <div className="tp-muted">
                {z.maxKm === Infinity ? `> ${z.minKm} กม.` : `${z.minKm}–${z.maxKm} กม.`}
              </div>
            </div>
            <div>
              <label htmlFor={`p-${z.id}`}>บาท / เที่ยว</label>
              <input
                id={`p-${z.id}`}
                type="number"
                min="0"
                value={z.price ?? ''}
                onChange={(e) => setPrice(z.id, e.target.value)}
                placeholder={z.id === 'OUT' ? 'Admin พิจารณา' : ''}
              />
            </div>
          </div>
        ))}
        <div className="tp-actions">
          <button type="button" className="tp-btn" onClick={save}>บันทึก</button>
        </div>
      </div>
    </>
  );
}
