import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adoptionStaffFetch, readAdoptionResponse } from '../api.js';
import { adoptionListingPhoto } from './findHomeDialogs.jsx';

export default function AdoptionHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await adoptionStaffFetch('/adoptions/history', { signal: controller.signal });
        const result = await readAdoptionResponse(response, 'โหลดประวัติรับเลี้ยงไม่สำเร็จ');
        setItems(Array.isArray(result.items) ? result.items : []);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  return (
    <section>
      <div className="adoption-staff-page-title">
        <h1>ประวัติการรับเลี้ยง</h1>
        <p>น้องที่มีบ้านแล้วและผู้รับเลี้ยงที่อนุมัติ</p>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && <p role="status">กำลังโหลดประวัติ...</p>}
      {!loading && !error && items.length === 0 && (
        <div className="adoption-staff-panel">ยังไม่มีประวัติการรับเลี้ยง</div>
      )}
      <div className="adoption-staff-list">
        {items.map((item) => {
          const animal = item.animal || {};
          const when = item.approvedAt || item.completedAt;
          return (
            <article className="adoption-staff-card d-flex flex-wrap align-items-center gap-3" key={animal.id}>
              <img
                className="adoption-staff-animal-photo"
                src={adoptionListingPhoto(animal)}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <div className="flex-grow-1">
                <h2>{animal.name || 'ไม่ระบุชื่อ'}</h2>
                <p className="adoption-staff-muted mb-1">
                  ผู้รับเลี้ยง: {item.adopterName || '—'}
                </p>
                {when && (
                  <p className="adoption-staff-muted mb-0">
                    อนุมัติเมื่อ {new Date(when).toLocaleString('th-TH')}
                  </p>
                )}
              </div>
              <Link className="btn btn-soft btn-sm" to="/adoption/requests">
                ดูคำขอที่เกี่ยวข้อง
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}