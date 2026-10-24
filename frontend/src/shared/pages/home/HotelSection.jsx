import { HOTEL_PERKS, HOTEL_ROOMS } from '../../data/homeContent.js';

export default function HotelSection({ go }) {
  return (
    <section id="hotel" className="pc-section" style={{ background: 'linear-gradient(180deg, var(--cloud), #e4f1ff)' }}>
      <div className="container">
        <div className="title-wrap">
          <span className="chip bg-white">โรงแรมสัตว์</span>
          <h2>ไปเที่ยวได้สบายใจ ให้น้องพักกับเรา</h2>
          <p className="mb-0">ห้องพักสะอาด แอร์เย็น มีคุณหมอดูแล 24 ชั่วโมง และเปิดดูน้องผ่าน CCTV ได้ตลอด</p>
        </div>

        <div className="row g-4 mb-4">
          {HOTEL_ROOMS.map((room) => (
            <div className="col-md-4" key={room.name}>
              <div className={`hotel-card ${room.featured ? 'featured' : ''}`}>
                {room.featured && <span className="ribbon">ยอดนิยม</span>}
                <div className="room-ic" style={{ background: room.bg, color: room.fg }}>
                  <i className={`bi ${room.icon}`} />
                </div>
                <div className="mitr fs-5">{room.name}</div>
                <div className="price">
                  ฿{room.price.toLocaleString()}
                  <span className="fs-6 text-muted"> / คืน</span>
                </div>
                <ul>
                  {room.features.map((f) => (
                    <li key={f}>
                      <i className="bi bi-check-circle-fill" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="/pet-owner/cat-hotel"
                  className={`btn ${room.featured ? 'btn-sky' : 'btn-soft'} w-100`}
                  onClick={go('/pet-owner/cat-hotel')}
                >
                  จองห้อง {room.name}
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="row g-3">
          {HOTEL_PERKS.map((perk) => (
            <div className="col-6 col-lg-3" key={perk.title}>
              <div className="hotel-perk">
                <i className={`bi ${perk.icon}`} />
                <div>
                  <div className="fw-medium small">{perk.title}</div>
                  <div className="small text-muted">{perk.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
