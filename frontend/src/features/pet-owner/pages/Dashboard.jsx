import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { usePets } from '../usePets.js';
import { useBookings } from '../useBookings.js';
import { BOOKING_STATUS, OWNER_CANCELLABLE, todayString } from '../bookingOptions.js';
import { ageText, careReminders, formatDate, reminderText, speciesOf } from '../petUtils.js';
import PetPhoto from '../components/PetPhoto.jsx';

/**
 * Pet Owner Dashboard — Role: Pet Owner (มะแอ่ว)
 * Summary of the owner's pets, upcoming appointments and vaccine / parasite reminders.
 */

const QUICK_LINKS = [
  { to: '/pet-owner/my-pets/new', icon: 'bi-plus-circle', label: 'เพิ่มสัตว์เลี้ยง' },
  { to: '/pet-owner/booking', icon: 'bi-calendar-check', label: 'จองนัดหมาย' },
  { to: '/pet-owner/medical', icon: 'bi-clipboard2-pulse', label: 'ประวัติสุขภาพ' },
  { to: '/pet-owner/services', icon: 'bi-grid', label: 'บริการทั้งหมด' },
];

const SMALL_PHOTO = { width: 48, height: 48, fontSize: '1.4rem', borderWidth: 2 };

function Stat({ value, label, tone }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="stat">
        <div className={`num ${tone ?? ''}`}>{value}</div>
        <div className="small">{label}</div>
      </div>
    </div>
  );
}

export default function PetOwnerDashboardPage() {
  const { currentUser } = useAuth();
  const { pets, loading, error, reload } = usePets();
  const bookingState = useBookings();

  const reminders = careReminders(pets).filter((r) => r.status !== 'later');
  const overdue = reminders.filter((r) => r.status === 'overdue');
  const today = todayString();
  const upcomingBookings = bookingState.bookings.filter(
    (b) => OWNER_CANCELLABLE.includes(b.status) && b.date >= today,
  );

  return (
    <div className="page-wrap">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>สวัสดี คุณ{currentUser?.firstName ?? ''}</h1>
            <p>ภาพรวมสุขภาพและนัดหมายของสัตว์เลี้ยงของคุณ</p>
          </div>
          <Link to="/pet-owner/my-pets" className="btn btn-sky">
            <i className="bi bi-heart me-1" />
            สัตว์เลี้ยงของฉัน
          </Link>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
          </div>
        )}

        {loading ? (
          <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            <div className="row g-3 mb-4">
              <Stat value={pets.length} label="สัตว์เลี้ยง" />
              <Stat value={upcomingBookings.length} label="นัดหมายที่กำลังจะถึง" />
              <Stat value={reminders.length} label="วัคซีน/ยาใกล้ถึงกำหนด" />
              <Stat value={overdue.length} label="เลยกำหนด" tone={overdue.length ? 'text-danger' : ''} />
            </div>

            <div className="row g-4">
              <div className="col-lg-7">
                <div className="card-soft mb-4">
                  <div className="d-flex align-items-start justify-content-between">
                    <div className="section-label">
                      <i className="bi bi-calendar2-check" />
                      นัดหมายที่กำลังจะถึง ({upcomingBookings.length})
                    </div>
                    <Link to="/pet-owner/booking" className="small text-decoration-none">จองนัด / ดูทั้งหมด</Link>
                  </div>
                  {bookingState.error && <div className="small text-danger mb-2">{bookingState.error}</div>}
                  {bookingState.loading ? (
                    <div className="empty-box py-3">กำลังโหลด...</div>
                  ) : upcomingBookings.length === 0 ? (
                    <div className="empty-box py-3">
                      <i className="bi bi-calendar-x" />
                      ยังไม่มีนัดหมายที่กำลังจะถึง
                    </div>
                  ) : (
                    <ul className="list-unstyled mb-0">
                      {upcomingBookings.slice(0, 5).map((b) => {
                        const status = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.pending;
                        return (
                          <li key={b.id} className="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom">
                            <span className="fw-medium" style={{ minWidth: 150 }}>
                              {formatDate(b.date)} · {b.time} น.
                            </span>
                            <span>{b.petName}</span>
                            <span className="tag">{b.serviceLabel}</span>
                            <span className={`tag ${status.tone}`}>{status.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {upcomingBookings.length > 5 && (
                    <Link to="/pet-owner/booking" className="small text-decoration-none d-block mt-2">
                      ดูทั้งหมด ({upcomingBookings.length})
                    </Link>
                  )}
                </div>

                <div className="card-soft">
                  <div className="section-label">
                    <i className="bi bi-bell" />
                    วัคซีนและยาที่ต้องทำ
                  </div>
                  {reminders.length === 0 ? (
                    <div className="empty-box py-3">
                      <i className="bi bi-check2-circle" />
                      {pets.length === 0
                        ? 'เพิ่มสัตว์เลี้ยงเพื่อเริ่มติดตามวัคซีนและนัดหมาย'
                        : 'ไม่มีนัดที่ใกล้ถึงหรือเลยกำหนด'}
                    </div>
                  ) : (
                    <ul className="list-unstyled mb-0">
                      {reminders.map((r, i) => {
                        const cls = r.status === 'overdue' ? 'danger' : 'warn';
                        return (
                          <li key={`${r.pet.id}-${r.kind}-${r.date}-${i}`} className="d-flex align-items-center gap-3 py-2 border-bottom">
                            <PetPhoto pet={r.pet} style={SMALL_PHOTO} />
                            <div className="flex-grow-1">
                              <Link to={`/pet-owner/my-pets/${r.pet.id}`} className="mitr text-decoration-none">
                                {r.pet.name}
                              </Link>
                              <div className="small text-muted">
                                {r.title} · {formatDate(r.date)}
                              </div>
                            </div>
                            <span className={`tag ${cls}`}>{reminderText(r)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="col-lg-5">
                <div className="card-soft mb-4">
                  <div className="section-label">
                    <i className="bi bi-lightning-charge" />
                    ทางลัด
                  </div>
                  <div className="row g-2">
                    {QUICK_LINKS.map((l) => (
                      <div className="col-6" key={l.to}>
                        <Link to={l.to} className="btn btn-outline-secondary w-100 py-3">
                          <i className={`bi ${l.icon} d-block fs-4 mb-1`} />
                          {l.label}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-soft">
                  <div className="section-label">
                    <i className="bi bi-heart" />
                    น้องๆ ของฉัน
                  </div>
                  {pets.length === 0 ? (
                    <div className="empty-box py-3">
                      <i className="bi bi-heart" />
                      ยังไม่มีสัตว์เลี้ยง
                    </div>
                  ) : (
                    <ul className="list-unstyled mb-0">
                      {pets.slice(0, 5).map((p) => (
                        <li key={p.id} className="py-2 border-bottom">
                          <Link to={`/pet-owner/my-pets/${p.id}`} className="d-flex align-items-center gap-3 text-decoration-none">
                            <PetPhoto pet={p} style={SMALL_PHOTO} />
                            <div>
                              <div className="mitr">{p.name}</div>
                              <div className="small text-muted">
                                {speciesOf(p.species).label}
                                {p.breed ? ` · ${p.breed}` : ''} · {ageText(p.birthDate)}
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {pets.length > 5 && (
                    <Link to="/pet-owner/my-pets" className="small text-decoration-none d-block mt-2">
                      ดูทั้งหมด ({pets.length})
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
