import { useState } from 'react';
import { useTransport } from '../useTransport.js';

export default function HotelsPage() {
  const { hotels, addHotel, removeHotel } = useTransport();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!name.trim() || !address.trim()) return setErr('กรอกชื่อและที่อยู่');
    try {
      await addHotel({ name, address });
      setName('');
      setAddress('');
    } catch (error) {
      setErr(error.message);
    }
  }

  return (
    <>
      <h1>จัดการ Pet Hotel</h1>
      <p className="tp-lead">Admin เพิ่มรายการโรงแรมสัตว์สำหรับจุดรับ–ส่ง (คลินิกดึงจาก Clinic Profile)</p>
      {err && <div className="tp-alert tp-alert--danger">{err}</div>}

      <form className="tp-card tp-form" onSubmit={submit}>
        <div className="row-2">
          <div className="field">
            <label htmlFor="hname">ชื่อโรงแรม</label>
            <input id="hname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="haddr">ที่อยู่</label>
            <input id="haddr" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn btn-sky">เพิ่ม</button>
      </form>

      <div className="tp-list" style={{ marginTop: '1rem' }}>
        {hotels.map((h) => (
          <div key={h.id} className="tp-list-item">
            <div>
              <strong>{h.name}</strong>
              <div className="tp-list-item__meta">{h.address}</div>
            </div>
            <button type="button" className="btn btn-soft" onClick={() => removeHotel(h.id)}>ลบ</button>
          </div>
        ))}
      </div>
    </>
  );
}
