import { useMemo, useState } from 'react';
import BarList from '../components/BarList.jsx';
import DataState from '../components/DataState.jsx';
import {
  DISPLAY_WEEKDAY_ORDER,
  STATUS_LABELS,
  STATUS_ORDER,
  WEEKDAYS_TH,
  addDays,
  daysBetweenInclusive,
  formatDurationMinutes,
  formatThaiDate,
  formatThaiDateTime,
  monthStartKey,
  todayKey,
} from '../data/format.js';
import { useCaResource } from '../data/useCaResource.js';

const MAX_REPORT_DAYS = 366;

/**
 * Clinic Admin Reports & Analytics Page
 * Role: clinic_admin
 */
export default function Reports() {
  const today = todayKey();
  const [activePreset, setActivePreset] = useState('30d');
  const [from, setFrom] = useState(() => addDays(today, -29));
  const [to, setTo] = useState(() => today);

  const rangeValidationError = useMemo(() => {
    if (!from || !to) return 'กรุณาระบุวันที่เริ่มต้นและวันสิ้นสุด';
    if (from > to) return 'วันเริ่มต้นต้องไม่หลังวันสิ้นสุด';
    if (daysBetweenInclusive(from, to) > MAX_REPORT_DAYS) {
      return `เลือกช่วงเวลาได้ไม่เกิน ${MAX_REPORT_DAYS} วัน`;
    }
    return '';
  }, [from, to]);

  const queryUrl = rangeValidationError
    ? null
    : `/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const { data, loading, error, reload } = useCaResource(queryUrl);

  function applyPreset(preset) {
    const end = todayKey();
    setActivePreset(preset);
    if (preset === '7d') {
      setFrom(addDays(end, -6));
      setTo(end);
    } else if (preset === '30d') {
      setFrom(addDays(end, -29));
      setTo(end);
    } else if (preset === '90d') {
      setFrom(addDays(end, -89));
      setTo(end);
    } else if (preset === 'month') {
      setFrom(monthStartKey(end));
      setTo(end);
    }
  }

  const totalBookings = useMemo(() => {
    if (!data?.byStatus) return 0;
    return STATUS_ORDER.reduce((sum, key) => sum + (data.byStatus[key] ?? 0), 0);
  }, [data]);

  const statusItems = useMemo(() => {
    if (!data?.byStatus) return [];
    return STATUS_ORDER.map((code) => ({
      key: code,
      label: STATUS_LABELS[code],
      value: data.byStatus[code] ?? 0,
    }));
  }, [data]);

  const serviceItems = useMemo(
    () =>
      (data?.services ?? []).map((svc) => ({
        key: svc.code,
        label: svc.label,
        value: svc.count ?? 0,
      })),
    [data],
  );

  const peakHourItems = useMemo(() => {
    const entries = Object.entries(data?.peakHours ?? {}).filter(([, count]) => count > 0);
    entries.sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([hh, count]) => ({
      key: hh,
      label: `${hh}:00–${hh}:59`,
      value: count,
    }));
  }, [data]);

  const peakWeekdayItems = useMemo(() => {
    if (!data?.peakWeekdays) return [];
    return DISPLAY_WEEKDAY_ORDER.map((day) => ({
      key: String(day),
      label: WEEKDAYS_TH[day],
      value: data.peakWeekdays[String(day)] ?? 0,
    }));
  }, [data]);

  const vetRows = useMemo(() => {
    const list = (data?.vetWorkload ?? []).map((v) => ({
      ...v,
      total: (v.confirmed ?? 0) + (v.completed ?? 0) + (v.no_show ?? 0),
    }));
    list.sort((a, b) => b.total - a.total);
    return list;
  }, [data]);

  const loadedRange = data?.range;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="mitr">รายงานสถิติคลินิก</h1>
          <p>
            {loadedRange
              ? `ช่วงวันที่ ${formatThaiDate(loadedRange.from)} – ${formatThaiDate(loadedRange.to)}`
              : 'เลือกช่วงวันที่เพื่อดูรายงาน'}
            {data?.generatedAt && (
              <span className="ms-2">· ข้อมูล ณ {formatThaiDateTime(data.generatedAt)}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-soft btn-sm ca-no-print"
          onClick={() => window.print()}
        >
          <i className="bi bi-printer me-1" aria-hidden="true" />
          พิมพ์รายงาน
        </button>
      </div>

      {/* Print-only header */}
      <div className="ca-print-only mb-3">
        <div className="mitr fs-5">รายงานสถิติคลินิก PetCare</div>
        <div className="small text-muted">
          {loadedRange
            ? `ช่วงวันที่ ${formatThaiDate(loadedRange.from)} – ${formatThaiDate(loadedRange.to)}`
            : ''}
          {data?.generatedAt ? ` · ข้อมูล ณ ${formatThaiDateTime(data.generatedAt)}` : ''}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="card-soft mb-4 ca-no-print">
        <div className="ca-filter-bar justify-content-between">
          <div className="pill-tabs ca-scroll-tabs" role="group" aria-label="ช่วงเวลายอดนิยม">
            {[
              { key: '7d', label: '7 วัน' },
              { key: '30d', label: '30 วัน' },
              { key: '90d', label: '90 วัน' },
              { key: 'month', label: 'เดือนนี้' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                className={activePreset === p.key ? 'active' : ''}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="d-flex flex-wrap align-items-end gap-2">
            <div>
              <label className="form-label mb-1 small" htmlFor="ca-report-from">
                ตั้งแต่วันที่
              </label>
              <input
                id="ca-report-from"
                type="date"
                className="form-control form-control-sm"
                value={from}
                onChange={(e) => {
                  setActivePreset('custom');
                  setFrom(e.target.value);
                }}
              />
            </div>
            <div>
              <label className="form-label mb-1 small" htmlFor="ca-report-to">
                ถึงวันที่
              </label>
              <input
                id="ca-report-to"
                type="date"
                className="form-control form-control-sm"
                value={to}
                onChange={(e) => {
                  setActivePreset('custom');
                  setTo(e.target.value);
                }}
              />
            </div>
          </div>
        </div>

        {rangeValidationError && (
          <div className="alert-soft danger mt-3 mb-0" role="alert">
            <i className="bi bi-exclamation-circle" aria-hidden="true" />
            <span>{rangeValidationError}</span>
          </div>
        )}
      </div>

      <DataState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)}>
          {data && (
            <div className="d-grid gap-4">
              {/* Summary Stat Cards */}
              <div className="ca-stat-grid">
                <div className="stat">
                  <div className="ca-stat-icon">
                    <i className="bi bi-calendar2-week" aria-hidden="true" />
                  </div>
                  <div className="num">{totalBookings}</div>
                  <div className="small text-muted">นัดทั้งหมดในช่วง</div>
                </div>

                <div className="stat">
                  <div className="ca-stat-icon">
                    <i className="bi bi-person-x" aria-hidden="true" />
                  </div>
                  <div className="num">{((data.noShowRate ?? 0) * 100).toFixed(1)}%</div>
                  <div className="small text-muted">อัตราไม่มาตามนัด</div>
                  <div className="small text-muted">คิดจาก เสร็จสิ้น + ไม่มา</div>
                </div>

                <div className="stat">
                  <div className="ca-stat-icon">
                    <i className="bi bi-stopwatch" aria-hidden="true" />
                  </div>
                  {data.maResponse?.count > 0 ? (
                    <>
                      <div className="num fs-4">
                        {formatDurationMinutes(data.maResponse.avgMinutes)}
                      </div>
                      <div className="small text-muted">เวลาตอบคำขอของผู้ช่วยฯ</div>
                      <div className="small text-muted">
                        มัธยฐาน {formatDurationMinutes(data.maResponse.medianMinutes)} (
                        {data.maResponse.count} รายการ)
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="num fs-5">ยังไม่มีข้อมูล</div>
                      <div className="small text-muted">เวลาตอบคำขอของผู้ช่วยฯ</div>
                    </>
                  )}
                </div>

              </div>

              {/* Bar Charts */}
              <div className="row g-4">
                <div className="col-lg-6">
                  <div className="card-soft h-100">
                    <div className="section-label">
                      <i className="bi bi-pie-chart" aria-hidden="true" />
                      <span>นัดตามสถานะ</span>
                    </div>
                    <BarList items={statusItems} valueFormatter={(v) => `${v} นัด`} />
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="card-soft h-100">
                    <div className="section-label">
                      <i className="bi bi-stars" aria-hidden="true" />
                      <span>บริการยอดนิยม</span>
                    </div>
                    <BarList items={serviceItems} valueFormatter={(v) => `${v} ครั้ง`} />
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="card-soft h-100">
                    <div className="section-label">
                      <i className="bi bi-clock-history" aria-hidden="true" />
                      <span>ช่วงเวลาที่มีคนจองมาก</span>
                    </div>
                    <BarList
                      items={peakHourItems}
                      emptyText="ไม่มีการจองในช่วงนี้"
                      valueFormatter={(v) => `${v} นัด`}
                    />
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="card-soft h-100">
                    <div className="section-label">
                      <i className="bi bi-calendar3" aria-hidden="true" />
                      <span>วันที่มีคนจองมาก</span>
                    </div>
                    <BarList items={peakWeekdayItems} valueFormatter={(v) => `${v} นัด`} />
                  </div>
                </div>
              </div>

              {/* Reject Reasons */}
              <div className="card-soft">
                <div className="section-label">
                  <i className="bi bi-x-circle" aria-hidden="true" />
                  <span>เหตุผลที่ปฏิเสธ</span>
                </div>
                {!data.rejectReasons || data.rejectReasons.length === 0 ? (
                  <p className="text-muted mb-0">ไม่มีการปฏิเสธในช่วงนี้</p>
                ) : (
                  <div className="table-responsive">
                    <table className="ca-table">
                      <thead>
                        <tr>
                          <th>เหตุผล</th>
                          <th className="text-end">จำนวน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rejectReasons.map((item) => (
                          <tr key={item.reason}>
                            <td>{item.reason}</td>
                            <td className="text-end fw-medium">{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Vet Workload & MA Activity */}
              <div className="row g-4">
                <div className="col-lg-6">
                  <div className="card-soft h-100">
                    <div className="section-label">
                      <i className="bi bi-heart-pulse" aria-hidden="true" />
                      <span>ภาระงานหมอ</span>
                    </div>
                    {vetRows.length === 0 ? (
                      <p className="text-muted mb-0">ยังไม่มีข้อมูลภาระงานหมอ</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="ca-table">
                          <thead>
                            <tr>
                              <th>ชื่อ</th>
                              <th className="text-end">ยืนยันแล้ว</th>
                              <th className="text-end">เสร็จสิ้น</th>
                              <th className="text-end">ไม่มาตามนัด</th>
                              <th className="text-end">รวม</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vetRows.map((vet, idx) => (
                              <tr key={vet.vetId ?? `${vet.name}-${idx}`}>
                                <td className="fw-medium">{vet.name}</td>
                                <td className="text-end">{vet.confirmed ?? 0}</td>
                                <td className="text-end">{vet.completed ?? 0}</td>
                                <td className="text-end">{vet.no_show ?? 0}</td>
                                <td className="text-end fw-semibold text-sky">{vet.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="card-soft h-100">
                    <div className="section-label">
                      <i className="bi bi-clipboard2-check" aria-hidden="true" />
                      <span>กิจกรรมผู้ช่วยฯ</span>
                    </div>
                    {!data.maActivity || data.maActivity.length === 0 ? (
                      <p className="text-muted mb-0">ยังไม่มีข้อมูลกิจกรรมผู้ช่วยฯ</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="ca-table">
                          <thead>
                            <tr>
                              <th>ชื่อ</th>
                              <th className="text-end">ตอบคำขอ</th>
                              <th className="text-end">เช็คอิน</th>
                              <th className="text-end">ติดต่อลูกค้า</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.maActivity.map((ma, idx) => (
                              <tr key={ma.staffId ?? `${ma.name}-${idx}`}>
                                <td className="fw-medium">{ma.name}</td>
                                <td className="text-end">{ma.handled ?? 0}</td>
                                <td className="text-end">{ma.checkedIn ?? 0}</td>
                                <td className="text-end">{ma.contacted ?? 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DataState>
    </div>
  );
}
