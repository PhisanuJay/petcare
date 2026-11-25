import { HOTEL_STATUS, HOTEL_STATUS_LABEL, useAllHotelBookings } from './useHotelBookings.js';

const ROOM_THAI = {
  Standard: 'ห้องมาตรฐาน',
  Deluxe: 'ห้องพิเศษ',
  Suite: 'ห้องสวีท',
};

function formatDay(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

/** Hotel desk updates stay status. The customer page only reads it. */
export default function HotelStayDesk() {
  const { bookings, setStatus } = useAllHotelBookings();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>ใบจองเข้าพัก</h1>
          <p className="muted">กดรับเข้าพักเมื่อน้องถึงโรงแรม และรับกลับเมื่อเจ้าของมารับ สถานะไปโชว์ในหน้าลูกค้าเอง</p>
        </div>
      </div>
      {bookings.length === 0 ? <p className="muted">ยังไม่มีใบจอง</p> : (
        <section className="panel stay-desk">
          {bookings.map((booking) => (
            <article key={booking.id} className="stay-desk-row">
              <div>
                <strong>{booking.petName}</strong>
                <p>
                  {ROOM_THAI[booking.roomName] || 'ไม่ระบุแพ็กเกจ'}
                  {booking.cages ? ` · ${booking.cages} กรง` : ''}
                  {' · '}
                  {formatDay(booking.checkIn)} – {formatDay(booking.checkOut)}
                </p>
                <p>{booking.email}</p>
              </div>
              <span>{HOTEL_STATUS_LABEL[booking.status] || booking.status}</span>
              {booking.status === HOTEL_STATUS.waiting ? (
                <button className="button" type="button" onClick={() => setStatus(booking.id, HOTEL_STATUS.checkedIn)}>
                  รับเข้าพัก
                </button>
              ) : null}
              {booking.status === HOTEL_STATUS.checkedIn ? (
                <button className="button" type="button" onClick={() => setStatus(booking.id, HOTEL_STATUS.checkedOut)}>
                  รับกลับ
                </button>
              ) : null}
              {booking.status === HOTEL_STATUS.checkedOut ? <span className="muted">ปิดใบแล้ว</span> : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
