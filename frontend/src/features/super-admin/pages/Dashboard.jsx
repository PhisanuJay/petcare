import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fetchOverview } from '../api.js';

const KIND_LABEL = {
  clinic: 'คลินิก',
  transport: 'รับส่ง',
  adoption: 'หาบ้าน',
};

const STATUS_TH = {
  pending: 'รอ',
  confirmed: 'ยืนยัน',
  completed: 'เสร็จ',
  no_show: 'ไม่มา',
  cancel_requested: 'ขอยกเลิก',
  cancelled: 'ยกเลิก',
  rejected: 'ปฏิเสธ',
  submitted: 'ส่งแล้ว',
  awaiting_payment: 'รอชำระ',
  paid: 'ชำระแล้ว',
  in_transit: 'กำลังวิ่ง',
  assigned: 'มอบหมาย',
  reviewing: 'กำลังพิจารณา',
  submitted_app: 'ส่งคำร้อง',
};

function toneForAttention(key, value) {
  if (!value) return 'is-ok';
  if (key === 'tripsRunning') return 'is-info';
  if (key === 'slipPending' || key === 'cancelRequested') return 'is-danger';
  return 'is-warn';
}

function formatThaiDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status) {
  return STATUS_TH[status] || status || '—';
}

export default function SuperAdminDashboardPage() {
  const { authToken } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchOverview(authToken)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'โหลดภาพรวมไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const attentionItems = useMemo(() => {
    const a = data?.attention || {};
    return [
      { key: 'slipPending', label: 'สลิปรอตรวจ', value: a.slipPending || 0, hint: 'บัญชี + รับส่ง' },
      { key: 'clinicPending', label: 'นัดรอยืนยัน', value: a.clinicPending || 0, hint: 'คลินิกวันนี้' },
      { key: 'tripsRunning', label: 'ทริปกำลังวิ่ง', value: a.tripsRunning || 0, hint: 'รับส่งสด' },
      { key: 'adoptionPending', label: 'คำร้องรอพิจารณา', value: a.adoptionPending || 0, hint: 'หาบ้าน' },
      { key: 'cancelRequested', label: 'คำขอยกเลิก', value: a.cancelRequested || 0, hint: 'คลินิก + รับส่ง' },
    ];
  }, [data]);

  const needsAction = attentionItems.reduce((sum, item) => sum + (item.value > 0 ? 1 : 0), 0);

  return (
    <div className="sa-dash">
      <header className="sa-dash__intro">
        <div>
          <p className="sa-dash__eyebrow">แผงควบคุมระบบ</p>
          <h1>ต้องจัดการอะไรวันนี้</h1>
          <p className="sa-dash__lede">
            สรุปจากข้อมูลจริงทั้ง PetCare
            {data?.today ? ` · ${formatThaiDate(data.today)}` : ''}
            {needsAction ? ` · มี ${needsAction} จุดที่ควรดู` : ' · ทุกอย่างสงบ'}
          </p>
        </div>
        <div className="sa-dash__intro-actions">
          <Link className="sa-btn sa-btn--ghost" to="/super-admin/reports">รายงานเต็ม</Link>
          <Link className="sa-btn sa-btn--primary" to="/super-admin/cctv">เปิด CCTV</Link>
        </div>
      </header>

      {error ? <div className="sa-error">{error}</div> : null}
      {loading && !data ? <p className="sa-muted">กำลังโหลดแผงควบคุม…</p> : null}

      {data ? (
        <>
          <section className="sa-attention" aria-label="รายการที่ต้องจัดการ">
            {attentionItems.map((item) => (
              <article
                key={item.key}
                className={`sa-attention__card ${toneForAttention(item.key, item.value)}`}
              >
                <span className="sa-attention__label">{item.label}</span>
                <strong className="sa-attention__value">{item.value}</strong>
                <span className="sa-attention__hint">{item.hint}</span>
              </article>
            ))}
          </section>

          <section className="sa-kpi" aria-label="สรุปโมดูล">
            <Link className="sa-kpi__card" to="/super-admin/reports">
              <span className="sa-kpi__icon" aria-hidden="true"><i className="bi bi-heart-pulse" /></span>
              <div>
                <span className="sa-kpi__label">คลินิกวันนี้</span>
                <strong>{data.clinic?.todayTotal ?? 0}</strong>
                <small>นัดทั้งหมด · ยืนยัน {data.clinic?.byStatus?.confirmed ?? 0}</small>
              </div>
            </Link>
            <Link className="sa-kpi__card" to="/super-admin/reports">
              <span className="sa-kpi__icon" aria-hidden="true"><i className="bi bi-truck" /></span>
              <div>
                <span className="sa-kpi__label">รับส่ง</span>
                <strong>{data.transport?.bookingsTotal ?? 0}</strong>
                <small>รอชำระ {data.transport?.awaitingPayment ?? 0} · ชำระแล้ว {data.transport?.paid ?? 0}</small>
              </div>
            </Link>
            <Link className="sa-kpi__card" to="/super-admin/reports">
              <span className="sa-kpi__icon" aria-hidden="true"><i className="bi bi-building" /></span>
              <div>
                <span className="sa-kpi__label">โรงแรม active</span>
                <strong>{data.hotel?.active ?? 0}</strong>
                <small>จากทั้งหมด {data.hotel?.total ?? 0} stays</small>
              </div>
            </Link>
            <Link className="sa-kpi__card" to="/super-admin/reports">
              <span className="sa-kpi__icon" aria-hidden="true"><i className="bi bi-cash-coin" /></span>
              <div>
                <span className="sa-kpi__label">บัญชี 7 วัน</span>
                <strong>{Number(data.accounting?.approvedLast7DaysTotal || 0).toLocaleString('th-TH')}</strong>
                <small>{data.accounting?.approvedLast7Days ?? 0} รายการที่อนุมัติ</small>
              </div>
            </Link>
          </section>

          <section className="sa-split">
            <div className="sa-panel">
              <div className="sa-panel__head">
                <h2>กิจกรรมล่าสุด</h2>
                <Link to="/super-admin/reports">ดูรายงาน</Link>
              </div>
              <ul className="sa-feed">
                {(data.activity || []).map((row) => (
                  <li key={row.id} className="sa-feed__item">
                    <span className={`sa-feed__kind is-${row.kind}`}>{KIND_LABEL[row.kind] || row.kind}</span>
                    <div className="sa-feed__body">
                      <strong>{row.title}</strong>
                      <span>{row.subtitle}</span>
                    </div>
                    <div className="sa-feed__meta">
                      <em>{statusLabel(row.status)}</em>
                      <span>{row.meta}</span>
                    </div>
                  </li>
                ))}
                {!data.activity?.length ? (
                  <li className="sa-feed__empty">ยังไม่มีกิจกรรมล่าสุด</li>
                ) : null}
              </ul>
            </div>

            <aside className="sa-side">
              <div className="sa-panel">
                <div className="sa-panel__head">
                  <h2>ทางลัดระบบ</h2>
                </div>
                <div className="sa-shortcuts">
                  <Link to="/super-admin/users" className="sa-shortcut">
                    <i className="bi bi-people" aria-hidden="true" />
                    <span>
                      <strong>ผู้ใช้ทั้งระบบ</strong>
                      <small>บัญชีทุกบทบาทใน dbo.users</small>
                    </span>
                  </Link>
                  <Link to="/super-admin/reports" className="sa-shortcut">
                    <i className="bi bi-bar-chart-line" aria-hidden="true" />
                    <span>
                      <strong>รายงานละเอียด</strong>
                      <small>สถานะย่อยคลินิก · รับส่ง · โรงแรม</small>
                    </span>
                  </Link>
                  <Link to="/super-admin/cctv" className="sa-shortcut">
                    <i className="bi bi-camera-video" aria-hidden="true" />
                    <span>
                      <strong>โรงแรม CCTV</strong>
                      <small>กล้อง · สิทธิ์ดูสด · ห้องพัก</small>
                    </span>
                  </Link>
                </div>
              </div>

              <div className="sa-panel sa-panel--soft">
                <div className="sa-panel__head">
                  <h2>หาบ้าน</h2>
                </div>
                <div className="sa-mini-stats">
                  <div>
                    <strong>{data.adoption?.pendingRequests ?? 0}</strong>
                    <span>รอพิจารณา</span>
                  </div>
                  <div>
                    <strong>{data.adoption?.availableAnimals ?? 0}</strong>
                    <span>เปิดรับบ้าน</span>
                  </div>
                  <div>
                    <strong>{data.adoption?.adoptedAnimals ?? 0}</strong>
                    <span>รับเลี้ยงแล้ว</span>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}
