import { Link } from 'react-router-dom';
import BarList from '../components/BarList.jsx';
import DataState from '../components/DataState.jsx';
import { formatThaiDate, todayKey } from '../data/format.js';
import { useCaResource } from '../data/useCaResource.js';

/** สถานะที่แอดมินควรเห็นบนภาพรวม — ไม่โชว์คิวยืนยันเป็นจุดเด่น */
const OVERVIEW_STATUS = [
  { key: 'confirmed', label: 'กำลังมา (ยืนยันแล้ว)' },
  { key: 'completed', label: 'เสร็จสิ้น' },
  { key: 'no_show', label: 'ไม่มาตามนัด' },
  { key: 'closed', label: 'ยกเลิก / ปฏิเสธ', keys: ['cancelled', 'rejected'] },
];

const QUICK_LINKS = [
  {
    to: '/clinic-admin/schedule',
    icon: 'bi-calendar-week',
    title: 'ตารางเวรและวันหยุด',
    desc: 'เวรหมอ วันลา และวันปิดคลินิก',
  },
  {
    to: '/clinic-admin/services',
    icon: 'bi-tag',
    title: 'บริการและราคา',
    desc: 'เปิดจองออนไลน์และตั้งราคา',
  },
  {
    to: '/clinic-admin/reports',
    icon: 'bi-bar-chart-line',
    title: 'รายงาน',
    desc: 'สรุปนัดหมายและภาระงาน',
  },
];

/**
 * Clinic Admin Overview — แผงควบคุมตั้งระบบ / ดูวันนี้ (ไม่ใช่คิวยืนยัน)
 */
export default function Overview() {
  const { data, loading, error, reload } = useCaResource('/overview');
  const displayDate = formatThaiDate(data?.date || todayKey(), { withWeekday: true });

  const byStatus = data?.byStatus ?? {};
  const statusItems = OVERVIEW_STATUS.map((item) => ({
    key: item.key,
    label: item.label,
    value: item.keys
      ? item.keys.reduce((sum, code) => sum + (byStatus[code] ?? 0), 0)
      : (byStatus[item.key] ?? 0),
  }));

  const vetsOnDuty = data?.vetsOnDutyToday ?? [];
  const upcomingClosures = data?.upcomingClosures ?? [];
  const staffReady = data?.staffReady ?? { veterinarians: 0, assistants: 0, total: 0 };
  const onlineServices = data?.onlineServices ?? 0;
  const closuresWithImpact = upcomingClosures.filter((c) => (c.affectedBookings ?? 0) > 0);

  const alerts = [];
  if (data && vetsOnDuty.length === 0) {
    alerts.push({
      key: 'no-vet',
      tone: 'warn',
      text: 'วันนี้ไม่มีหมอเข้าเวร',
      to: '/clinic-admin/schedule',
      action: 'ไปตารางเวร',
    });
  }
  if (closuresWithImpact.length > 0) {
    alerts.push({
      key: 'closure-impact',
      tone: 'warn',
      text: `มีวันปิดคลินิกที่กระทบนัด ${closuresWithImpact.length} วัน`,
      to: '/clinic-admin/schedule',
      action: 'ดูวันปิด',
    });
  }
  if (data && onlineServices === 0) {
    alerts.push({
      key: 'no-online',
      tone: 'warn',
      text: 'ยังไม่มีบริการที่เปิดจองออนไลน์',
      to: '/clinic-admin/services',
      action: 'ไปบริการ',
    });
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="mitr">ภาพรวมคลินิก</h1>
          <p>{displayDate}</p>
        </div>
        <button
          type="button"
          className="btn btn-soft btn-sm ca-no-print"
          disabled={loading}
          onClick={reload}
        >
          {loading ? (
            <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
          ) : (
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
          )}
          รีเฟรช
        </button>
      </div>

      <DataState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)}>
        {data && (
          <div className="d-grid gap-4">
            <div className="ca-stat-grid">
              <div className="stat">
                <div className="ca-stat-icon">
                  <i className="bi bi-calendar2-check" aria-hidden="true" />
                </div>
                <div className="num">{data.todayTotal ?? 0}</div>
                <div className="small text-muted">นัดวันนี้</div>
              </div>

              <div className="stat">
                <div className="ca-stat-icon">
                  <i className="bi bi-check2-circle" aria-hidden="true" />
                </div>
                <div className="num">{data.confirmedToday ?? byStatus.confirmed ?? 0}</div>
                <div className="small text-muted">ยืนยันแล้ววันนี้</div>
              </div>

              <div className="stat">
                <div className="ca-stat-icon">
                  <i className="bi bi-heart-pulse" aria-hidden="true" />
                </div>
                <div className="num">{vetsOnDuty.length}</div>
                <div className="small text-muted">หมอเข้าเวรวันนี้</div>
              </div>

              <Link to="/clinic-admin/services" className="stat ca-stat-link">
                <div className="ca-stat-icon">
                  <i className="bi bi-globe2" aria-hidden="true" />
                </div>
                <div className="num">{onlineServices}</div>
                <div className="small text-muted">บริการเปิดจองออนไลน์</div>
              </Link>
            </div>

            {alerts.length > 0 ? (
              <div className="ca-alert-stack" aria-label="เตือนปฏิบัติการ">
                {alerts.map((alert) => (
                  <div key={alert.key} className={`alert-soft ${alert.tone} ca-ops-alert`}>
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-exclamation-circle" aria-hidden="true" />
                      <span>{alert.text}</span>
                    </div>
                    <Link to={alert.to} className="btn btn-soft btn-sm">
                      {alert.action}
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="row g-4">
              <div className="col-lg-6">
                <div className="card-soft h-100">
                  <div className="section-label">
                    <i className="bi bi-bar-chart" aria-hidden="true" />
                    <span>นัดวันนี้ตามสถานะ</span>
                  </div>
                  <BarList items={statusItems} valueFormatter={(v) => `${v} นัด`} />
                  {data.todayTotal === 0 && (
                    <p className="small text-muted mb-0 mt-3">ยังไม่มีนัดหมายสำหรับวันนี้</p>
                  )}
                </div>
              </div>

              <div className="col-lg-6">
                <div className="card-soft h-100">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="section-label mb-0">
                      <i className="bi bi-person-badge" aria-hidden="true" />
                      <span>หมอที่เข้าเวรวันนี้</span>
                    </div>
                    <Link to="/clinic-admin/schedule" className="small text-sky">
                      จัดการตารางเวร
                    </Link>
                  </div>

                  {vetsOnDuty.length === 0 ? (
                    <p className="small text-muted mb-3">ยังไม่มีหมอเข้าเวร — ตั้งเวรที่ตารางเวร</p>
                  ) : (
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {vetsOnDuty.map((vet) => (
                        <span key={vet.id} className="chip">
                          <i className="bi bi-check-circle me-1" aria-hidden="true" />
                          {vet.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="ca-staff-ready">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <div>
                        <div className="fw-medium">เจ้าหน้าที่พร้อมงาน</div>
                        <div className="small text-muted">
                          สัตวแพทย์ {staffReady.veterinarians ?? 0} คน
                        </div>
                      </div>
                      <Link to="/clinic-admin/staff" className="btn btn-soft btn-sm">
                        จัดการเจ้าหน้าที่
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-soft">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="section-label mb-0">
                  <i className="bi bi-calendar-x" aria-hidden="true" />
                  <span>วันปิดคลินิกใน 3 วันข้างหน้า</span>
                </div>
                <Link to="/clinic-admin/schedule" className="small text-sky">
                  จัดการวันปิดคลินิก
                </Link>
              </div>

              {upcomingClosures.length === 0 ? (
                <div className="empty-box py-3">
                  <i className="bi bi-calendar-check" aria-hidden="true" />
                  <p className="mb-0">ไม่มีวันปิดคลินิกใน 3 วันข้างหน้า</p>
                </div>
              ) : (
                <div className="d-grid gap-2">
                  {upcomingClosures.map((closure) => (
                    <div key={closure.date} className="ca-list-item">
                      <div>
                        <div className="fw-medium">
                          {formatThaiDate(closure.date, { withWeekday: true })}
                        </div>
                        <div className="small text-muted">{closure.reason || 'ปิดทำการ'}</div>
                      </div>
                      {closure.affectedBookings > 0 && (
                        <span className="tag warn">
                          มีนัด {closure.affectedBookings} รายการ ควรโทรเลื่อน
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-soft">
              <div className="section-label">
                <i className="bi bi-lightning-charge" aria-hidden="true" />
                <span>ทางลัด</span>
              </div>
              <div className="row g-3">
                {QUICK_LINKS.map((item) => (
                  <div key={item.to} className="col-md-4">
                    <Link to={item.to} className="ca-quick-link h-100">
                      <span className="ca-brand-icon">
                        <i className={`bi ${item.icon}`} aria-hidden="true" />
                      </span>
                      <div>
                        <div className="fw-medium">{item.title}</div>
                        <div className="small text-muted">{item.desc}</div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
