import { Link } from 'react-router-dom';
import BarList from '../components/BarList.jsx';
import DataState from '../components/DataState.jsx';
import { STATUS_LABELS, STATUS_ORDER, formatThaiDate, todayKey } from '../data/format.js';
import { useCaResource } from '../data/useCaResource.js';

const QUICK_LINKS = [
  {
    to: '/clinic-admin/staff',
    icon: 'bi-people',
    title: 'จัดการเจ้าหน้าที่',
    desc: 'เพิ่ม แก้ไข ปิดใช้งาน และตั้งรหัสผ่าน',
  },
  {
    to: '/clinic-admin/schedule',
    icon: 'bi-calendar-week',
    title: 'ตารางเวรและวันหยุด',
    desc: 'เวรสัตวแพทย์ วันลา และวันปิดคลินิก',
  },
  {
    to: '/clinic-admin/settings',
    icon: 'bi-sliders',
    title: 'ตั้งค่าคลินิก',
    desc: 'เวลาทำการและบริการที่เปิดจองออนไลน์',
  },
  {
    to: '/clinic-admin/reports',
    icon: 'bi-bar-chart-line',
    title: 'รายงานสถิติ',
    desc: 'สรุปนัดหมาย ภาระงาน และเวลาตอบรับ',
  },
];

/**
 * Clinic Admin Overview Dashboard
 * Role: clinic_admin
 */
export default function Overview() {
  const { data, loading, error, reload } = useCaResource('/overview');
  const displayDate = formatThaiDate(data?.date || todayKey(), { withWeekday: true });

  const statusItems = STATUS_ORDER.map((code) => ({
    key: code,
    label: STATUS_LABELS[code],
    value: data?.byStatus?.[code] ?? 0,
  }));

  const vetsOnDuty = data?.vetsOnDutyToday ?? [];
  const upcomingClosures = data?.upcomingClosures ?? [];
  const hasOver24h = (data?.pendingOver24h ?? 0) > 0;

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
                  <i className="bi bi-hourglass-split" aria-hidden="true" />
                </div>
                <div className="num">{data.pendingTotal ?? 0}</div>
                <div className="small text-muted">รอยืนยันทั้งหมด</div>
              </div>

              <div className={`stat${hasOver24h ? ' ca-stat-warn' : ''}`}>
                <div className="ca-stat-icon">
                  <i className="bi bi-exclamation-triangle" aria-hidden="true" />
                </div>
                <div className="num">{data.pendingOver24h ?? 0}</div>
                <div className="small text-muted">รอเกิน 24 ชม.</div>
                {hasOver24h && <span className="tag warn mt-1">ต้องเร่งตรวจสอบ</span>}
              </div>

              <div className="stat">
                <div className="ca-stat-icon">
                  <i className="bi bi-heart-pulse" aria-hidden="true" />
                </div>
                <div className="num">{vetsOnDuty.length}</div>
                <div className="small text-muted">หมอเข้าเวรวันนี้</div>
              </div>
            </div>

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
                    <div className="alert-soft warn justify-content-between flex-wrap">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-exclamation-circle" aria-hidden="true" />
                        <span>วันนี้ไม่มีหมอเข้าเวร</span>
                      </div>
                      <Link to="/clinic-admin/schedule" className="btn btn-soft btn-sm">
                        ไปหน้าตารางเวร
                      </Link>
                    </div>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {vetsOnDuty.map((vet) => (
                        <span key={vet.id} className="chip">
                          <i className="bi bi-check-circle me-1" aria-hidden="true" />
                          {vet.name}
                        </span>
                      ))}
                    </div>
                  )}
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
                          มีนัด {closure.affectedBookings} รายการ ผู้ช่วยฯ ต้องโทรเลื่อน
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
                <span>เมนูด่วน</span>
              </div>
              <div className="row g-3">
                {QUICK_LINKS.map((item) => (
                  <div key={item.to} className="col-sm-6 col-xl-3">
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
