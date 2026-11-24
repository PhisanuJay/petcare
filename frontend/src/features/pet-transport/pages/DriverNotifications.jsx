import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useTransport } from '../useTransport.js';
import '../transport.css';

const TYPE_META = {
  assigned: { label: 'งานใหม่', tone: 'info' },
  time_changed: { label: 'เปลี่ยนเวลา', tone: 'warn' },
  cancelled: { label: 'ยกเลิก', tone: 'danger' },
  upcoming: { label: 'ใกล้ถึงเวลา', tone: 'ok' },
};

function relativeTime(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DriverNotificationsPage() {
  const { currentUser } = useAuth();
  const {
    driverNotifications,
    driverUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    ensureUpcomingReminders,
  } = useTransport();

  useEffect(() => {
    if (currentUser?.id) ensureUpcomingReminders(currentUser.id);
  }, [currentUser?.id, ensureUpcomingReminders]);

  const items = driverNotifications(currentUser?.id);
  const unread = driverUnreadCount(currentUser?.id);

  return (
    <section className="driver-page dv-light">
      <header className="dv-hero" style={{ marginBottom: '0.5rem' }}>
        <div>
          <h1>การแจ้งเตือน</h1>
          <p>งานใหม่ · เปลี่ยนเวลา · ยกเลิก · ใกล้ถึงเวลา</p>
        </div>
        {unread > 0 ? (
          <button
            type="button"
            className="dv-btn dv-btn--ghost"
            onClick={() => markAllNotificationsRead(currentUser.id)}
          >
            อ่านทั้งหมด ({unread})
          </button>
        ) : null}
      </header>

      <div className="driver-notify-list">
        {items.map((item) => {
          const meta = TYPE_META[item.type] || { label: item.type, tone: 'info' };
          return (
            <article
              key={item.id}
              className={`driver-notify ${item.read ? 'is-read' : 'is-unread'} is-${meta.tone}`}
            >
              <div className="driver-notify__top">
                <span className={`driver-notify__tag is-${meta.tone}`}>{meta.label}</span>
                <time>{relativeTime(item.createdAt)}</time>
              </div>
              <strong>{item.title}</strong>
              {item.body ? <p>{item.body}</p> : null}
              <div className="driver-notify__actions">
                {item.tripId ? (
                  <Link
                    className="tp-btn tp-btn--ghost"
                    to={`/pet-transport/jobs/${item.tripId}`}
                    onClick={() => markNotificationRead(item.id)}
                  >
                    ดูงาน
                  </Link>
                ) : null}
                {!item.read ? (
                  <button
                    type="button"
                    className="tp-btn tp-btn--ghost"
                    onClick={() => markNotificationRead(item.id)}
                  >
                    ทำเครื่องหมายว่าอ่านแล้ว
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
        {!items.length ? (
          <div className="driver-empty">
            ยังไม่มีการแจ้งเตือน
            <small>เมื่อ Admin มอบหมายงาน เปลี่ยนเวลา หรือยกเลิก จะขึ้นที่นี่</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
