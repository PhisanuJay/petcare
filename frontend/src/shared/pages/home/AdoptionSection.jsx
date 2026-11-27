import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ADOPTION_API_URL } from '../../../features/adoption/api.js';
import { ADOPT_STEPS } from '../../data/homeContent.js';
import { adoptionListingPhoto } from '../../../features/adoption/pages/findHomeDialogs.jsx';

export default function AdoptionSection() {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`${ADOPTION_API_URL}/animals`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'โหลดไม่สำเร็จ');
        setAnimals((result.animals || []).slice(0, 4));
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'เชื่อมต่อไม่ได้');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <section id="adopt" className="pc-section">
      <div className="container">
        <div className="title-wrap">
          <span className="chip">หาบ้านให้น้อง</span>
          <h2>น้องๆ เหล่านี้กำลังรอครอบครัวใหม่</h2>
          <p className="mb-0">ทุกตัวผ่านการตรวจสุขภาพจากคุณหมอแล้ว พร้อมไปอยู่บ้านที่อบอุ่น</p>
        </div>

        {loading && <p className="text-muted">กำลังโหลดรายชื่อน้อง...</p>}
        {error && <p className="text-danger small">{error}</p>}

        <div className="row g-4">
          {!loading && !animals.length && !error && (
            <div className="col-12">
              <p className="text-muted mb-0">ยังไม่มีรายชื่อสัตว์รอรับเลี้ยงในระบบ — ดูรายการล่าสุดได้ที่หน้าหาบ้านให้น้อง</p>
            </div>
          )}
          {animals.map((a) => (
            <div className="col-sm-6 col-lg-3" key={a.id || a.name}>
              <div className="adopt-card">
                <div className="pic has-photo" style={{ background: a.cardColor || a.bg || '#e7f1ff' }}>
                  <img
                    className="adopt-card-photo"
                    src={adoptionListingPhoto(a)}
                    alt={`รูป${a.name}`}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="sex" title={a.sex === 'male' ? 'เพศผู้' : 'เพศเมีย'}>
                    <i
                      className={`bi ${a.sex === 'male' ? 'bi-gender-male text-primary' : 'bi-gender-female text-danger'}`}
                    />
                  </span>
                </div>
                <div className="body">
                  <div className="d-flex justify-content-between align-items-baseline">
                    <div className="mitr fs-5">{a.name}</div>
                    <span className="small text-muted">{a.age}</span>
                  </div>
                  <div className="small text-muted mb-2">{a.breed || a.species}</div>
                  {a.personality && (
                    <div className="small mb-2">
                      <i className="bi bi-chat-heart text-sky me-1" />
                      {a.personality}
                    </div>
                  )}
                  <div className="mb-3">
                    {(a.tags || []).map((t) => (
                      <span className="tag ok" key={t}>
                        <i className="bi bi-check2 me-1" />
                        {t}
                      </span>
                    ))}
                  </div>
                  <Link to="/find-home" className="btn btn-soft btn-sm mt-auto">
                    <i className="bi bi-heart me-1" />
                    ดูรายละเอียด
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="row g-3 mt-4">
          {ADOPT_STEPS.map((step) => (
            <div className="col-md-4" key={step.title}>
              <div className="stat h-100 text-start p-3">
                <i className={`bi ${step.icon} fs-4 text-sky`} />
                <div className="mitr mt-2">{step.title}</div>
                <div className="small text-muted">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}