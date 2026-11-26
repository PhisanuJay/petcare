import { useEffect, useState } from 'react';
import { adoptionStaffFetch, moderateAdoptionAnimal, readAdoptionResponse, updateAdoptionAnimalStatus } from '../api.js';
import { adoptionListingPhoto } from './findHomeDialogs.jsx';

function listingLabel(animal) {
  const key = animal.listingStatus || animal.status;
  if (key === 'pending_review') return { text: 'รอตรวจสอบ', className: 'pending' };
  if (key === 'rejected') return { text: 'ไม่อนุมัติ', className: 'rejected' };
  if (key === 'adopted' || key === 'adopted') return { text: 'มีบ้านแล้ว', className: 'adopted' };
  if (key === 'has_interest') return { text: 'มีผู้สนใจ', className: 'available' };
  return { text: 'กำลังประกาศ', className: 'available' };
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

  async function runModeration(animal, action) {
    const note = action === 'reject'
      ? window.prompt('เหตุผลที่ไม่อนุมัติ (ถ้ามี)', '') || ''
      : '';
    if (!window.confirm(
      action === 'approve'
        ? `อนุมัติประกาศของ ${animal.name}?`
        : `ปฏิเสธประกาศของ ${animal.name}?`,
    )) return;

    setUpdating(animal.id);
    setError('');
    try {
      const result = await moderateAdoptionAnimal(animal.id, action, note);
      setAnimals((current) =>
        current.map((item) => item.id === result.animal.id ? result.animal : item),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdating('');
    }
  }

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
        <h1>จัดการประกาศหาบ้าน</h1>
        <p>ตรวจสอบประกาศใหม่ อนุมัติเผยแพร่ หรือปิดเมื่อน้องมีบ้านแล้ว</p>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && <p role="status">กำลังโหลดข้อมูล...</p>}
      {!loading && !error && animals.length === 0 && (
        <div className="adoption-staff-panel">ยังไม่มีข้อมูลสัตว์</div>
      )}
      <div className="adoption-staff-list">
        {animals.map((animal) => {
          const chip = listingLabel(animal);
          const listing = animal.listingStatus || animal.status;
          return (
            <article className="adoption-staff-card d-flex flex-wrap align-items-center gap-3" key={animal.id}>
              <img
                className="adoption-staff-animal-photo"
                src={adoptionListingPhoto(animal)}
                alt={`รูป${animal.name}`}
                loading="lazy"
                decoding="async"
              />
              <div className="flex-grow-1">
                <h2>{animal.name}</h2>
                <p className="adoption-staff-muted mb-2">
                  {animal.species} · {animal.age} · จังหวัด {animal.address || animal.location}
                </p>
                <span className={`adoption-staff-status ${chip.className}`}>{chip.text}</span>
              </div>
              <div className="d-flex flex-wrap gap-2">
                {listing === 'pending_review' && (
                  <>
                    <button
                      className="btn btn-sky btn-sm"
                      type="button"
                      onClick={() => runModeration(animal, 'approve')}
                      disabled={updating === animal.id}
                    >
                      อนุมัติประกาศ
                    </button>
                    <button
                      className="btn btn-soft-danger btn-sm"
                      type="button"
                      onClick={() => runModeration(animal, 'reject')}
                      disabled={updating === animal.id}
                    >
                      ไม่อนุมัติ
                    </button>
                  </>
                )}
                {(listing === 'published' || listing === 'has_interest' || animal.status === 'available') && (
                  <button
                    className="btn btn-sky btn-sm"
                    type="button"
                    onClick={() => toggleStatus(animal)}
                    disabled={updating === animal.id}
                  >
                    ทำเครื่องหมายว่ามีบ้านแล้ว
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}