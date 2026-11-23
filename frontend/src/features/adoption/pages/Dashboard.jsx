import { useEffect, useState } from 'react';
import {
  adoptionStaffFetch,
  readAdoptionResponse,
  updateAdoptionAnimalStatus,
} from '../api.js';

export default function AdoptionDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingAnimal, setUpdatingAnimal] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function loadDashboard() {
      try {
        const [overviewResponse, animalsResponse] = await Promise.all([
          adoptionStaffFetch('/overview', { signal: controller.signal }),
          adoptionStaffFetch('/animals', { signal: controller.signal }),
        ]);
        const [overviewResult, animalsResult] = await Promise.all([
          readAdoptionResponse(overviewResponse, 'โหลดภาพรวมไม่สำเร็จ'),
          readAdoptionResponse(animalsResponse, 'โหลดรายการสัตว์ไม่สำเร็จ'),
        ]);
        setOverview(overviewResult);
        setAnimals(animalsResult.animals.filter((animal) => animal.status === 'available'));
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadDashboard();
    return () => controller.abort();
  }, []);

  async function markAsAdopted(animal) {
    if (!window.confirm(`ยืนยันเปลี่ยนสถานะ ${animal.name} เป็น “มีบ้านแล้ว” หรือไม่?`)) return;

    setUpdatingAnimal(animal.id);
    setError('');
    try {
      await updateAdoptionAnimalStatus(animal.id, 'adopted');
      setAnimals((current) => current.filter((item) => item.id !== animal.id));

      try {
        const response = await adoptionStaffFetch('/overview');
        const result = await readAdoptionResponse(response, 'โหลดภาพรวมไม่สำเร็จ');
        setOverview(result);
      } catch (refreshError) {
        setError(`เปลี่ยนสถานะสัตว์แล้ว แต่โหลดภาพรวมใหม่ไม่สำเร็จ: ${refreshError.message}`);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingAnimal('');
    }
  }

  return (
    <section>
      <div className="adoption-staff-page-title">
        <h1>ภาพรวมการหาบ้าน</h1>
        <p>จัดการคำร้องและติดตามสถานะน้องๆ</p>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && <p role="status">กำลังโหลดข้อมูล...</p>}
      {overview && (
        <div className="adoption-staff-stats">
          <div className="adoption-staff-stat">
            <span>คำร้องรอพิจารณา</span>
            <strong>{overview.pendingRequests}</strong>
          </div>
          <div className="adoption-staff-stat">
            <span>สัตว์ที่ยังหาบ้าน</span>
            <strong>{overview.availableAnimals}</strong>
          </div>
          <div className="adoption-staff-stat">
            <span>สัตว์ที่มีบ้านแล้ว</span>
            <strong>{overview.adoptedAnimals}</strong>
          </div>
          <div className="adoption-staff-stat">
            <span>คำร้องทั้งหมด</span>
            <strong>{overview.totalRequests}</strong>
          </div>
        </div>
      )}
      <div className="adoption-staff-section-heading">
        <h2>รายการสัตว์ที่กำลังหาบ้านอยู่</h2>
      </div>
      {!loading && !error && animals.length === 0 && (
        <div className="adoption-staff-panel">ขณะนี้ไม่มีสัตว์ที่กำลังหาบ้าน</div>
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
              <p className="adoption-staff-muted mb-2">
                {animal.species} · {animal.age} · {animal.color} · จังหวัด {animal.address || animal.location}
              </p>
              <span className="adoption-staff-status available">ยังหาบ้านอยู่</span>
            </div>
            <button
              className="btn btn-soft ms-auto"
              type="button"
              onClick={() => markAsAdopted(animal)}
              disabled={updatingAnimal === animal.id}
            >
              {updatingAnimal === animal.id ? 'กำลังบันทึก...' : 'เปลี่ยนเป็นมีบ้านแล้ว'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
