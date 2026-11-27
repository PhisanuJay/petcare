import { Link } from 'react-router-dom';
import { useTransport } from '../useTransport.js';
import '../admin-dashboard.css';

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
      hint: 'จองที่ชำระแล้วแต่ยังไม่มีคนขับ',
      icon: 'bi-person-plus',
      count: awaitingAssign,
      href: '/admin/transport/bookings?tab=awaiting_assign',
      tone: awaitingAssign > 0 ? 'warn' : 'ok',
    },
    {
      label: 'คำขอยกเลิก',
      hint: 'รอพิจารณาจากแอดมินโรงแรม',
      icon: 'bi-x-circle',
      count: cancelReq,
      href: '/admin/transport/cancellations',
      tone: cancelReq > 0 ? 'danger' : 'ok',
    },
    {
      label: 'ปัญหาจากคนขับ',
      hint: 'เคสที่ยังเปิดอยู่',
      icon: 'bi-exclamation-triangle',
      count: openIssues.length,
      href: openIssues[0]?.bookingId
        ? `/admin/transport/bookings/${openIssues[0].bookingId}`
        : '/admin/transport/bookings',
      tone: openIssues.length > 0 ? 'warn' : 'ok',
    },
  ];

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__toolbar">
        <p className="admin-dashboard__lead">
          รายรับนับจากงานที่ฝ่ายบัญชียืนยันชำระแล้ว · ใช้การ์ดด้านล่างติดตามงานค้าง
        </p>
        <div className="admin-dashboard__actions">
          <Link className="admin-dashboard__btn" to="/admin/transport/bookings">
            <i className="bi bi-journal-text" aria-hidden="true" />
            รายการจอง
          </Link>
          <Link className="admin-dashboard__btn admin-dashboard__btn--primary" to="/admin/transport/bookings?tab=awaiting_assign">
            <i className="bi bi-person-check" aria-hidden="true" />
            มอบหมายคนขับ
          </Link>
        </div>
      </header>

      {error ? <div className="admin-dashboard__error" role="alert">{error}</div> : null}

      <section className="admin-dashboard__stats" aria-label="สรุปรายรับและงาน">
        <article className="admin-dashboard__stat admin-dashboard__stat--primary">
          <div className="admin-dashboard__stat-icon" aria-hidden="true">
            <i className="bi bi-cash-coin" />
          </div>
          <div className="admin-dashboard__stat-copy">
            <span>ยอดรับชำระแล้ว</span>
            <strong>{loading ? '—' : baht(received)}</strong>
            <small>{loading ? 'กำลังโหลดข้อมูล' : `${paidBookings.length} รายการ`}</small>
          </div>
        </article>
        <article className="admin-dashboard__stat">
          <div className="admin-dashboard__stat-icon" aria-hidden="true">
            <i className="bi bi-truck" />
          </div>
          <div className="admin-dashboard__stat-copy">
            <span>ทริปที่กำลังดำเนินการ</span>
            <strong>{loading ? '—' : activeTrips}</strong>
            <small>มีคนขับรับงานแล้ว</small>
          </div>
        </article>
      </section>

      <div className="admin-dashboard__grid">
        <section className="admin-dashboard__panel admin-dashboard__revenue" aria-labelledby="admin-revenue-title">
          <header>
            <div>
              <h2 id="admin-revenue-title">รายรับรายเดือน</h2>
              <p>ยอดชำระแล้ว 6 เดือนล่าสุด</p>
            </div>
            <strong>{loading ? '—' : baht(received)}</strong>
          </header>
          <div className="admin-revenue-chart" aria-label="กราฟรายรับ 6 เดือนล่าสุด">
            {months.map((month) => {
              const height = maxMonthAmount > 0
                ? Math.max(8, (month.amount / maxMonthAmount) * 100)
                : 0;
              return (
                <div className="admin-revenue-chart__column" key={month.key}>
                  <span>{month.amount > 0 ? compactBaht(month.amount) : '—'}</span>
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
              <p>กดเพื่อไปดำเนินการต่อ</p>
            </div>
          </header>
          <div className="admin-dashboard__task-list">
            {tasks.map((task) => (
              <Link
                className={`admin-dashboard__task admin-dashboard__task--${task.tone}`}
                to={task.href}
                key={task.label}
              >
                <span className="admin-dashboard__task-icon" aria-hidden="true">
                  <i className={`bi ${task.icon}`} />
                </span>
                <span className="admin-dashboard__task-copy">
                  <strong>{task.label}</strong>
                  <small>{task.hint}</small>
                </span>
                <b>{loading ? '—' : task.count}</b>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
