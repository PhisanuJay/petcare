import { useMemo, useState } from 'react';
import { HOTEL_PERKS } from '../../data/homeContent.js';
import { useHotelPricing } from '../../../features/pet-owner/useHotelPricing.js';

const SPECIES_TABS = [
  { id: 'dog', label: 'ห้องสุนัข', icon: 'bi-heart' },
  { id: 'cat', label: 'ห้องแมว', icon: 'bi-emoji-smile' },
];

function speciesOf(room) {
  if (room.species === 'dog' || room.species === 'cat') return room.species;
  const id = String(room.value || room.name || '').toLowerCase();
  if (id.startsWith('cat') || id.includes('แมว')) return 'cat';
  return 'dog';
}

export default function HotelSection({ go }) {
  const { rooms, loading, error } = useHotelPricing();
  const [species, setSpecies] = useState('dog');

  const visibleRooms = useMemo(
    () => rooms.filter((room) => speciesOf(room) === species),
    [rooms, species],
  );

  return (
    <section id="hotel" className="pc-section hotel-section">
      <div className="container">
        <div className="title-wrap">
          <span className="chip bg-white">โรงแรมสัตว์</span>
          <h2>ไปเที่ยวได้สบายใจ ให้น้องพักกับเรา</h2>
          <p className="mb-0">
            ห้องพักสะอาด แอร์เย็น มีคุณหมอดูแล 24 ชั่วโมง และเปิดดูน้องผ่าน CCTV ได้ตลอด
          </p>
        </div>

        <div className="hotel-species-tabs" role="tablist" aria-label="เลือกประเภทห้อง">
          {SPECIES_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={species === tab.id}
              className={`hotel-species-tab ${species === tab.id ? 'is-active' : ''}`}
              onClick={() => setSpecies(tab.id)}
            >
              <i className={`bi ${tab.icon}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? <p className="hotel-pricing-note" role="status">กำลังโหลดราคาห้องพัก</p> : null}
        {error ? <p className="hotel-pricing-error" role="alert">{error}</p> : null}

        <div className="hotel-room-grid">
          {visibleRooms.map((room) => {
            const features = (room.features ?? []).slice(0, 3);
            return (
              <article
                key={room.value || room.name}
                className={`hotel-card ${room.featured ? 'featured' : ''}`}
              >
                {room.featured ? <span className="ribbon">ยอดนิยม</span> : null}
                <div className="hotel-card__media">
                  <img className="room-photo" src={room.image} alt={room.name} loading="lazy" />
                  {room.sizeCode ? (
                    <span className="hotel-card__size">{room.sizeCode}</span>
                  ) : null}
                </div>
                <div className="hotel-card__body">
                  <div className="hotel-card__title-row">
                    <h3 className="mitr">{room.name}</h3>
                    <div className="price">
                      ฿{Number(room.price || 0).toLocaleString()}
                      <span> / คืน</span>
                    </div>
                  </div>
                  {room.sizeHint ? <p className="hotel-card__hint">{room.sizeHint}</p> : null}
                  <ul>
                    {features.map((feature) => (
                      <li key={feature}>
                        <i className="bi bi-check-circle-fill" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="/pet-owner/cat-hotel"
                    className={`btn ${room.featured ? 'btn-sky' : 'btn-soft'} w-100`}
                    onClick={go('/pet-owner/cat-hotel')}
                  >
                    จองห้องนี้
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && visibleRooms.length === 0 ? (
          <p className="hotel-pricing-note text-center">ยังไม่มีห้องในหมวดนี้</p>
        ) : null}

        <div className="hotel-perk-grid">
          {HOTEL_PERKS.map((perk) => (
            <div className="hotel-perk" key={perk.title}>
              <span className="hotel-perk__icon" aria-hidden="true">
                <i className={`bi ${perk.icon}`} />
              </span>
              <div>
                <div className="fw-medium">{perk.title}</div>
                <div className="small text-muted">{perk.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
