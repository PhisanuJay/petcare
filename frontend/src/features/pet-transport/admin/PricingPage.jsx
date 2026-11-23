import { useMemo, useState } from 'react';
import { fareMatrixPreview, formatBaht } from '../pricing.js';
import { useTransport } from '../useTransport.js';

export default function PricingPage() {
  const { zones, updateZones } = useTransport();
  const [rows, setRows] = useState(zones.map((z) => ({ ...z, price: z.price ?? '' })));
  const [msg, setMsg] = useState('');

  const previewZones = useMemo(
    () => rows.map((r) => ({ ...r, price: r.price === '' ? null : Number(r.price) })),
    [rows],
  );
  const matrix = fareMatrixPreview(previewZones);

  function setPrice(id, price) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, price } : r)));
  }

  function save() {
    updateZones(
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        price: Number(r.price),
      })),
    );
    setMsg('บันทึกตารางราคา Zone แล้ว');
  }

  return (
    <>
      <h1>Pricing (Zone แขวงจตุจักร)</h1>
      <p className="tp-lead">
        กำหนดราคาฐาน Zone 1 / Zone 2 — ไปส่ง/รับกลับคิดเที่ยวเดียว · ไป–กลับคิดรวม 2 เที่ยว ไม่มีส่วนลด
      </p>
      {msg && <div className="tp-alert tp-alert--ok">{msg}</div>}

      <div className="tp-card tp-form">
        {rows.map((z) => (
          <div key={z.id} className="field row-2" style={{ alignItems: 'end' }}>
            <div>
              <label>{z.label}</label>
              <div className="tp-muted">
                {z.id === '1' ? 'แขวงจตุจักร, แขวงจอมพล' : 'แขวงลาดยาว, แขวงจันทรเกษม'}
              </div>
            </div>
            <div>
              <label htmlFor={`p-${z.id}`}>บาท / เที่ยว (ฐาน)</label>
              <input
                id={`p-${z.id}`}
                type="number"
                min="0"
                value={z.price ?? ''}
                onChange={(e) => setPrice(z.id, e.target.value)}
              />
            </div>
          </div>
        ))}
        <div className="tp-actions">
          <button type="button" className="btn btn-sky" onClick={save}>บันทึก</button>
        </div>
      </div>

      <div className="tp-card" style={{ marginTop: '1rem' }}>
        <h3>ตารางค่ารถรับ–ส่ง (ตัวอย่างจากราคาที่ตั้ง)</h3>
        <table className="tp-table">
          <thead>
            <tr>
              <th>จุดรับ</th>
              <th>จุดส่ง</th>
              <th>ราคาเที่ยวเดียว</th>
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
        <p className="tp-muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          กฎ: Zone 1→1 ใช้ราคา Zone 1 · เส้นทางที่มี Zone 2 ใช้ราคา Zone 2 · ไป–กลับ = รวม 2 เที่ยว
        </p>
      </div>
    </>
  );
}
