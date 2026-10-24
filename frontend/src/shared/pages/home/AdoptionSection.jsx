import { ADOPT_ANIMALS, ADOPT_STEPS } from '../../data/homeContent.js';

export default function AdoptionSection({ go }) {
  return (
    <section id="adopt" className="pc-section">
      <div className="container">
        <div className="title-wrap">
          <span className="chip">หาบ้านให้น้อง</span>
          <h2>น้องๆ เหล่านี้กำลังรอครอบครัวใหม่</h2>
          <p className="mb-0">ทุกตัวผ่านการตรวจสุขภาพจากคุณหมอแล้ว พร้อมไปอยู่บ้านที่อบอุ่น</p>
        </div>

        <div className="row g-4">
          {ADOPT_ANIMALS.map((a) => (
            <div className="col-sm-6 col-lg-3" key={a.name}>
              <div className="adopt-card">
                <div className="pic" style={{ background: a.bg }}>
                  <span>{a.emoji}</span>
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
                  <div className="small text-muted mb-2">{a.breed}</div>
                  <div className="small mb-2">
                    <i className="bi bi-chat-heart text-sky me-1" />
                    {a.personality}
                  </div>
                  <div className="mb-3">
                    {a.tags.map((t) => (
                      <span className="tag ok" key={t}>
                        <i className="bi bi-check2 me-1" />
                        {t}
                      </span>
                    ))}
                  </div>
                  <a
                    href="/pet-owner/adoption"
                    className="btn btn-soft btn-sm mt-auto"
                    onClick={go('/pet-owner/adoption')}
                  >
                    <i className="bi bi-heart me-1" />
                    ขอรับเลี้ยง
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card-soft mt-4">
          <div className="row align-items-center g-3">
            <div className="col-lg-2">
              <div className="mitr fs-5">ขั้นตอนรับเลี้ยง</div>
              <div className="small text-muted">ง่ายๆ 4 ขั้นตอน</div>
            </div>
            {ADOPT_STEPS.map((s, i) => (
              <div className="col-6 col-lg-2" key={s.title}>
                <div className="d-flex align-items-center gap-2">
                  <span className="avatar" title={`ขั้นที่ ${i + 1}`}>
                    <i className={`bi ${s.icon}`} />
                  </span>
                  <span className="small">
                    {i + 1}. {s.title}
                  </span>
                </div>
              </div>
            ))}
            <div className="col-lg-2 text-lg-end">
              <a href="/pet-owner/adoption" className="btn btn-sky btn-sm text-nowrap" onClick={go('/pet-owner/adoption')}>
                ดูน้องทั้งหมด
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
