import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { usePets } from '../pet-owner/usePets.js';
import { CLINIC_SERVICES, useClinicBookings } from '../pet-owner/useClinicBookings.js';
import './payment.css';

export default function ClinicBookPage() {
  const { currentUser } = useAuth();
  const { pets } = usePets();
  const { createBooking } = useClinicBookings();
  const navigate = useNavigate();
  const [serviceId, setServiceId] = useState(CLINIC_SERVICES[0].id);
  const [petId, setPetId] = useState('');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const service = useMemo(
    () => CLINIC_SERVICES.find((item) => item.id === serviceId),
    [serviceId],
  );

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    const pet = pets.find((item) => item.id === petId);
    try {
      const booking = createBooking({
        serviceId,
        petName: pet?.name || '',
        when,
        note,
      });
      navigate('/pet-owner/history');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="pay-page page-wrap">
      <div className="container" style={{ maxWidth: 720 }}>
        <header className="pay-mast">
          <p>คลินิก</p>
          <h1>จองคิว</h1>
        </header>
        <form className="pay-card" onSubmit={onSubmit}>
          <h2>เลือกบริการ</h2>
          <div className="hist-tabs" role="radiogroup" aria-label="บริการคลินิก">
            {CLINIC_SERVICES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === serviceId ? 'is-on' : ''}
                onClick={() => setServiceId(item.id)}
              >
                {item.name} · ฿{item.price}
              </button>
            ))}
          </div>
          <label className="form-label" htmlFor="clinic-pet">สัตว์เลี้ยง</label>
          <select id="clinic-pet" className="form-control" value={petId} onChange={(event) => setPetId(event.target.value)}>
            <option value="">เลือกน้อง</option>
            {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
          </select>
          <label className="form-label" htmlFor="clinic-when">วันนัด</label>
          <input id="clinic-when" className="form-control" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
          <label className="form-label" htmlFor="clinic-note">บันทึกถึงคลินิก</label>
          <input id="clinic-note" className="form-control" value={note} onChange={(event) => setNote(event.target.value)} />
          {error ? <p className="pay-warn">{error}</p> : null}
          <p className="pay-note">ยืนยันแล้วดูสถานะได้ที่ประวัติการจอง ชำระค่าบริการเมื่อมาที่คลินิก</p>
          <button className="btn btn-sky" type="submit">ยืนยันการจอง</button>
        </form>
      </div>
    </div>
  );
}
