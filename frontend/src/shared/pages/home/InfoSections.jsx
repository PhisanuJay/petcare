import { PROMOS, REVIEWS, SERVICES, STATS, VETS, WHY } from '../../data/homeContent.js';

export function AboutSection() {
  return (
    <section id="about" className="pc-section pt-4">
      <div className="container">
        <div className="about-card">
          <div className="row align-items-center g-4">
            <div className="col-lg-5">
              <span className="chip mb-2">เกี่ยวกับเรา</span>
              <h2 className="fw-semibold">บ้านหลังที่สองของน้องๆ</h2>
              <p className="text-muted mb-0">
                PetCare ดูแลสัตว์เลี้ยงมากว่า 12 ปี เราเชื่อว่าการรักษาที่ดีเริ่มจากความอ่อนโยน ห้องตรวจแยกหมา-แมว
                ลดความเครียด และคุณหมอพร้อมอธิบายทุกขั้นตอนให้เจ้าของเข้าใจ
              </p>
            </div>
            <div className="col-lg-7">
              <div className="row g-3">
                {STATS.map((s) => (
                  <div className="col-6 col-md-3" key={s.label}>
                    <div className="stat">
                      <div className="num">{s.num}</div>
                      <div className="small">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ServicesSection() {
  return (
    <section id="services" className="pc-section pt-0">
      <div className="container">
        <div className="title-wrap">
          <span className="chip">บริการของเรา</span>
          <h2>น้องต้องการอะไร เรามีให้</h2>
        </div>
        <div className="row g-2">
          {SERVICES.map((s) => (
            <div className="col-6 col-md-4 col-lg-2" key={s.title}>
              <div className="svc">
                <div className="circle" style={{ background: s.bg, color: s.fg }}>
                  <i className={`bi ${s.icon}`} />
                </div>
                <div className="mitr">{s.title}</div>
                <div className="small text-muted">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhySection() {
  return (
    <section className="pc-section">
      <div className="container">
        <div className="title-wrap">
          <span className="chip">ทำไมต้อง PetCare</span>
          <h2>4 เหตุผลที่เจ้าของไว้ใจเรา</h2>
        </div>
        <div className="row g-3">
          {WHY.map((w, i) => (
            <div className="col-md-6 col-lg-3" key={w.title}>
              <div className="why">
                <div className="n">{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <div className="mitr">{w.title}</div>
                  <div className="small text-muted">{w.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function VetsSection() {
  return (
    <section id="vets" className="pc-section" style={{ background: 'var(--baby)' }}>
      <div className="container">
        <div className="title-wrap">
          <span className="chip bg-white">ทีมคุณหมอ</span>
          <h2>พบกับคุณหมอของเรา</h2>
        </div>
        <div className="row g-4">
          {VETS.map((v) => (
            <div className="col-6 col-lg-3" key={v.name}>
              <div className="vet">
                <img src={v.img} alt={v.name} />
                <div className="mitr mt-3">{v.name}</div>
                <span className="spec">{v.spec}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PromoSection({ go }) {
  return (
    <section id="promo" className="pc-section">
      <div className="container">
        <div className="title-wrap">
          <span className="chip">โปรโมชั่น</span>
          <h2>คูปองน่ารัก สำหรับน้องๆ</h2>
        </div>
        <div className="row g-4">
          {PROMOS.map((p) => (
            <div className="col-md-4" key={p.title}>
              <div className="coupon">
                <div className="left" style={{ background: p.bg }}>
                  <div className="big">{p.big}</div>
                  <div className="small">{p.small}</div>
                </div>
                <div className="right">
                  <div className="mitr">{p.title}</div>
                  <div className="small text-muted mb-2">{p.desc}</div>
                  <a href="/profile" className="btn btn-soft btn-sm" onClick={go('/profile')}>
                    {p.cta}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ReviewsSection() {
  return (
    <section className="pc-section pt-0">
      <div className="container">
        <div className="title-wrap">
          <span className="chip">รีวิว</span>
          <h2>เจ้าของน้องๆ ว่ายังไงบ้าง</h2>
        </div>
        <div className="row g-4">
          {REVIEWS.map((r) => (
            <div className="col-md-4" key={r.name}>
              <div className="bubble">
                <div className="stars mb-2">{'★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)}</div>
                {r.text}
                <div className="reviewer">
                  <span className="av" style={{ background: r.bg }}>{r.emoji}</span>
                  <div>
                    <div className="fw-medium">{r.name}</div>
                    <div className="small text-muted">{r.pet}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ContactSection() {
  return (
    <section id="contact" className="pc-section pt-0">
      <div className="container">
        <div className="contact-wrap">
          <div className="row g-0">
            <div className="col-lg-5">
              <div className="contact-info">
                <h3 className="mb-4">มาเยี่ยมเราได้นะ</h3>
                <div className="row-i">
                  <i className="bi bi-geo-alt-fill" />
                  <span>99/9 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900</span>
                </div>
                <div className="row-i">
                  <i className="bi bi-telephone-fill" />
                  <span>02-123-4567</span>
                </div>
                <div className="row-i">
                  <i className="bi bi-line" />
                  <span>@petcareclinic</span>
                </div>
                <hr className="border-light" />
                <table className="hours w-100 small">
                  <tbody>
                    <tr>
                      <td>จันทร์ - ศุกร์</td>
                      <td className="text-end">08:00 - 22:00</td>
                    </tr>
                    <tr>
                      <td>เสาร์ - อาทิตย์</td>
                      <td className="text-end">09:00 - 21:00</td>
                    </tr>
                    <tr>
                      <td className="fw-semibold">ฉุกเฉิน / โรงแรมสัตว์</td>
                      <td className="text-end fw-semibold">24 ชั่วโมง</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-lg-7">
              <div className="map-wrap">
                <div className="map-fallback">
                  <i className="bi bi-geo-alt-fill" />
                  <div>
                    PetCare Animal Clinic
                    <br />
                    <small>จตุจักร กรุงเทพฯ</small>
                  </div>
                </div>
                <iframe
                  className="map-frame"
                  title="แผนที่ PetCare"
                  src="https://maps.google.com/maps?q=Chatuchak%20Bangkok&z=14&output=embed"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
