import heroImg from '../../../assets/hero-blue.jpg';

const PERKS = [
  { icon: 'bi-calendar-heart', text: 'จองคิวคุณหมอออนไลน์ได้ 24 ชม.' },
  { icon: 'bi-journal-medical', text: 'เก็บประวัติสุขภาพ วัคซีน ครบในที่เดียว' },
  { icon: 'bi-house-heart', text: 'จองโรงแรมสัตว์ ดูน้องผ่าน CCTV' },
  { icon: 'bi-stars', text: 'สะสมแต้มแลกส่วนลด' },
];

export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="page-wrap">
      <div className="container" style={{ maxWidth: 1020 }}>
        <div className="auth-wrap">
          <div className="row g-0">
            <div className="col-lg-5 d-none d-lg-block">
              <div className="auth-side">
                <div>
                  <span className="chip bg-white">สมาชิก PetCare</span>
                  <h3 className="mt-3 mb-0">ดูแลน้องได้ง่ายขึ้น</h3>
                </div>
                <img src={heroImg} alt="น้องหมาและน้องแมว" />
                <div>
                  {PERKS.map((p) => (
                    <div className="auth-perk" key={p.text}>
                      <i className={`bi ${p.icon}`} />
                      {p.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-lg-7">
              <div className="auth-form">
                <h2 className="fw-semibold mb-1">{title}</h2>
                <p className="text-muted mb-4">{subtitle}</p>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Only allow in-app redirect targets. */
export function safeNext(next, fallback = '/') {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
