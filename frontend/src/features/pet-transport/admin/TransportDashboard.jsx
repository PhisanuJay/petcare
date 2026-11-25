import { Link } from 'react-router-dom';
import { useTransport } from '../useTransport.js';

function baht(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}

function compactBaht(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH', { notation: 'compact', maximumFractionDigits: 1 })}`;
}

function bookingTotal(booking) {
  const total = Number(booking.finalQuote?.total ?? booking.quote?.total);
  return Number.isFinite(total) ? total : 0;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function TransportDashboard() {
  const { bookings, issues, trips, loading, error } = useTransport();
  const awaitingAssign = bookings.filter(
    (booking) =>
      booking.paymentStatus === 'paid'
      && !['cancelled', 'cancel_requested', 'completed'].includes(booking.status)
      && (booking.trips || []).some((trip) => !trip.driverId),
  ).length;
  const cancelReq = bookings.filter((booking) => booking.status === 'cancel_requested').length;
  const activeTrips = trips.filter((trip) => trip.status !== 'completed' && trip.driverId).length;
  const openIssues = issues.filter((issue) => issue.status === 'open');
  const paidBookings = bookings.filter(
    (booking) => booking.paymentStatus === 'paid' && booking.status !== 'cancelled',
  );
  const received = paidBookings.reduce((sum, booking) => sum + bookingTotal(booking), 0);
  const unpaidAmount = bookings
    .filter((booking) =>
      booking.paymentStatus !== 'paid'
      && booking.status !== 'cancelled'
      && booking.status !== 'completed'
      && booking.quote,
    )
    .reduce((sum, booking) => sum + bookingTotal(booking), 0);

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = monthKey(date);
    const amount = paidBookings
      .filter((booking) => {
        const paidAt = booking.updatedAt || booking.createdAt;
        return paidAt && monthKey(new Date(paidAt)) === key;
      })
      .reduce((sum, booking) => sum + bookingTotal(booking), 0);
    return {
      key,
      label: new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(date),
      amount,
    };
  });
  const maxMonthAmount = Math.max(0, ...months.map((month) => month.amount));

  const tasks = [
    {
      label: 'รอมอบหมายคนขับหลังชำระแล้ว',
      count: awaitingAssign,
      href: '/admin/transport/bookings?tab=awaiting_assign',
    },
    { label: 'คำขอยกเลิก', count: cancelReq, href: '/admin/transport/cancellations' },
    {
      label: 'ปัญหาจากคนขับ',
      count: openIssues.length,
      href: openIssues[0]?.bookingId
        ? `/admin/transport/bookings/${openIssues[0].bookingId}`
        : '/admin/transport/bookings',
    },
  ];

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__mast">
        <div>
          <p>งานรับส่งสัตว์</p>
          <h1>รายรับและการจอง</h1>
          <span>รายรับนับจากงานที่ฝ่ายบัญชียืนยันชำระแล้ว</span>
        </div>
        <Link className="admin-dashboard__secondary" to="/admin/transport/bookings">รายการจอง</Link>
      </header>

      {error ? <div className="admin-dashboard__error" role="alert">{error}</div> : null}

      <section className="admin-dashboard__stats" aria-label="สรุปรายรับและงาน">
        <article className="admin-dashboard__stat admin-dashboard__stat--primary">
          <span>ยอดรับชำระแล้ว</span>
          <strong>{loading ? '—' : baht(received)}</strong>
          <small>{loading ? 'กำลังโหลดข้อมูล' : `${paidBookings.length} รายการ`}</small>
        </article>
        <article className="admin-dashboard__stat">
          <span>มูลค่างานที่ยังไม่รับชำระ</span>
          <strong>{loading ? '—' : baht(unpaidAmount)}</strong>
          <small>คำนวณจากยอดประเมินล่าสุด</small>
        </article>
        <article className="admin-dashboard__stat">
          <span>ทริปที่กำลังดำเนินการ</span>
          <strong>{loading ? '—' : activeTrips}</strong>
          <small>มีคนขับรับงานแล้ว</small>
        </article>
      </section>

      <div className="admin-dashboard__grid">
        <section className="admin-dashboard__panel admin-dashboard__revenue" aria-labelledby="admin-revenue-title">
          <header>
            <div>
              <h2 id="admin-revenue-title">รายรับรายเดือน</h2>
              <p>ยอดชำระแล้ว แบ่งตามเดือนที่ยืนยันชำระ</p>
            </div>
            <strong>{loading ? '—' : baht(received)}</strong>
          </header>
          <div className="admin-revenue-chart" aria-label="กราฟรายรับ 6 เดือนล่าสุด">
            {months.map((month) => {
              const height = maxMonthAmount > 0
                ? Math.max(4, (month.amount / maxMonthAmount) * 100)
                : 0;
              return (
                <div className="admin-revenue-chart__column" key={month.key}>
                  <span>{month.amount > 0 ? compactBaht(month.amount) : ''}</span>
                  <div className="admin-revenue-chart__track">
                    <i style={{ height: `${height}%` }} />
                  </div>
                  <small>{month.label}</small>
                </div>
              );
            })}
          </div>
          {!loading && paidBookings.length === 0 ? (
            <p className="admin-dashboard__empty">ยังไม่มีรายการที่ยืนยันชำระในช่วงนี้</p>
          ) : null}
        </section>

        <section className="admin-dashboard__panel admin-dashboard__tasks" aria-labelledby="admin-tasks-title">
          <header>
            <div>
              <h2 id="admin-tasks-title">งานที่ต้องติดตาม</h2>
              <p>ไปยังรายการเพื่อดำเนินการต่อ</p>
            </div>
          </header>
          <div className="admin-dashboard__task-list">
            {tasks.map((task) => (
              <Link className="admin-dashboard__task" to={task.href} key={task.label}>
                <span>{task.label}</span>
                <strong>{loading ? '—' : task.count}</strong>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
