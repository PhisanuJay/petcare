import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePets } from '../usePets.js';
import { SEX_OPTIONS, ageText, careReminders, labelOf, reminderText, speciesOf } from '../petUtils.js';
import PetPhoto from '../components/PetPhoto.jsx';

/**
 * My Pets — Role: Pet Owner (มะแอ่ว)
 * Pets are stored in localStorage per logged-in user until the backend is ready.
 */
export default function MyPetsPage() {
  const { pets } = usePets();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = q
    ? pets.filter((p) =>
        [p.name, p.breed, speciesOf(p.species).label].some((v) => v?.toLowerCase().includes(q)),
      )
    : pets;

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>สัตว์เลี้ยงของฉัน</h1>
            <p>เก็บประวัติสุขภาพ วัคซีน และการรักษาของน้องๆ ไว้ในที่เดียว</p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            {pets.length > 0 && (
              <div className="input-group" style={{ maxWidth: 260 }}>
                <span className="input-group-text"><i className="bi bi-search" /></span>
                <input
                  className="form-control"
                  placeholder="ค้นหาชื่อ / สายพันธุ์"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
            <Link to="/pet-owner/my-pets/new" className="btn btn-sky">
              <i className="bi bi-plus-lg me-1" />
              เพิ่มสัตว์เลี้ยง
            </Link>
          </div>
        </div>

        <div className="row g-4">
          {shown.map((pet) => {
            const next = careReminders([pet])[0];
            return (
              <div className="col-sm-6 col-lg-4 col-xl-3" key={pet.id}>
                <Link to={`/pet-owner/my-pets/${pet.id}`} className="pet-card text-center align-items-center">
                  <PetPhoto pet={pet} />
                  <div className="mitr fs-5 mt-2">{pet.name}</div>
                  <div className="small text-muted mb-2">
                    {speciesOf(pet.species).label}
                    {pet.breed ? ` · ${pet.breed}` : ''}
                  </div>
                  <div className="mb-2">
                    <span className="tag">{ageText(pet.birthDate)}</span>
                    {pet.sex !== 'unknown' && <span className="tag">{labelOf(SEX_OPTIONS, pet.sex)}</span>}
                    {pet.weight && <span className="tag">{pet.weight} กก.</span>}
                  </div>
                  {next ? (
                    <span className={`tag ${next.status === 'overdue' ? 'danger' : next.status === 'soon' ? 'warn' : 'sky'} mt-auto`}>
                      <i className="bi bi-calendar-event me-1" />
                      {next.title} · {reminderText(next)}
                    </span>
                  ) : (
                    <span className="tag mt-auto">ยังไม่มีนัดครั้งถัดไป</span>
                  )}
                </Link>
              </div>
            );
          })}

          {!q && (
            <div className="col-sm-6 col-lg-4 col-xl-3">
              <Link to="/pet-owner/my-pets/new" className="add-card">
                <i className="bi bi-plus-circle-dotted" />
                <div className="mitr mt-2">เพิ่มสัตว์เลี้ยง</div>
                <div className="small text-muted">บันทึกประวัติน้องตัวใหม่</div>
              </Link>
            </div>
          )}
        </div>

        {q && shown.length === 0 && (
          <div className="empty-box">
            <i className="bi bi-search" />
            ไม่พบสัตว์เลี้ยงที่ตรงกับ “{query}”
          </div>
        )}
      </div>
    </div>
  );
}
