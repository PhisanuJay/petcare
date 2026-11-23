import { useEffect, useState } from 'react';
import { adoptionStaffFetch, readAdoptionResponse, updateAdoptionAnimalStatus } from '../api.js';

function animalStatusLabel(status) {
  return status === 'adopted' ? 'มีบ้านแล้ว' : 'ยังหาบ้านอยู่';
}

export default function AnimalsPage() {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState('');
  const [error, setError] = useState('');

  async function loadAnimals(signal) {
    setError('');
    try {
      const response = await adoptionStaffFetch('/animals', { signal });
      const result = await readAdoptionResponse(response, 'โหลดข้อมูลสัตว์ไม่สำเร็จ');
      setAnimals(result.animals);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadAnimals(controller.signal);
    return () => controller.abort();
  }, []);

  async function toggleStatus(animal) {
    const status = animal.status === 'adopted' ? 'available' : 'adopted';
    const confirmation = status === 'adopted'
      ? `ยืนยันเปลี่ยนสถานะ ${animal.name} เป็น “มีบ้านแล้ว” หรือไม่?`
      : `ยืนยันเปิดรับบ้านให้ ${animal.name} อีกครั้งหรือไม่?`;
    if (!window.confirm(confirmation)) return;

    setUpdating(animal.id);
    setError('');
    try {
      const result = await updateAdoptionAnimalStatus(animal.id, status);
      setAnimals((current) =>
        current.map((item) => item.id === result.animal.id ? result.animal : item),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdating('');
    }
  }

  return (
    <section>
      <div className="adoption-staff-page-title">
        <h1>จัดการสถานะสัตว์</h1>
        <p>เปลี่ยนสถานะระหว่าง “ยังหาบ้านอยู่” และ “มีบ้านแล้ว”</p>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && <p role="status">กำลังโหลดข้อมูล...</p>}
      {!loading && !error && animals.length === 0 && (
        <div className="adoption-staff-panel">ยังไม่มีข้อมูลสัตว์</div>
      )}
      <div className="adoption-staff-list">
        {animals.map((animal) => (
          <article className="adoption-staff-card d-flex flex-wrap align-items-center gap-3" key={animal.id}>
            {animal.photo ? (
              <img className="adoption-staff-animal-photo" src={animal.photo} alt={`รูป${animal.name}`} />
            ) : (
              <div className="adoption-staff-animal-photo adoption-staff-animal-placeholder" aria-hidden="true">
                {animal.emoji || '🐾'}
              </div>
            )}
            <div className="flex-grow-1">
              <h2>{animal.name}</h2>
              <p className="adoption-staff-muted mb-2">{animal.species} · {animal.age} · จังหวัด {animal.address || animal.location}</p>
              <span className={`adoption-staff-status ${animal.status}`}>
                {animalStatusLabel(animal.status)}
              </span>
            </div>
            <button
              className={`btn ${animal.status === 'adopted' ? 'btn-soft' : 'btn-sky'}`}
              type="button"
              onClick={() => toggleStatus(animal)}
              disabled={updating === animal.id}
            >
              {updating === animal.id
                ? 'กำลังบันทึก...'
                : animal.status === 'adopted'
                  ? 'เปิดรับบ้านอีกครั้ง'
                  : 'ทำเครื่องหมายว่ามีบ้านแล้ว'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
