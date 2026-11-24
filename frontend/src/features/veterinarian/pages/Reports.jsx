import { useState } from 'react';
import VetLayout from '../components/VetLayout.jsx';
import DayChart from '../components/DayChart.jsx';
import { useReport } from '../useReports.js';
import { BOOKING_STATUS, todayString } from '../../pet-owner/bookingOptions.js';
import { formatDate, speciesOf } from '../../pet-owner/petUtils.js';

/**
 * Reports — Role: Veterinarian (มะแอ่ว)
 * Summary of the clinic's work for a chosen period: appointments (per day, per service, per status),
 * what the clinic recorded (treatments, vaccinations, parasite treatment) and the patients seen.
 * Data comes from /api/veterinarian/reports. Every chart also has a table view.
 */

const pad = (n) => String(n).padStart(2, '0');
const toDateString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function addDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}

const PRESETS = [
  { value: '7', label: '7 วันล่าสุด', range: () => [addDays(todayString(), -6), todayString()] },
  { value: '30', label: '30 วันล่าสุด', range: () => [addDays(todayString(), -29), todayString()] },
  { value: '90', label: '90 วันล่าสุด', range: () => [addDays(todayString(), -89), todayString()] },
  {
    value: 'month',
    label: 'เดือนนี้',
    range: () => {
      const now = new Date();
      return [toDateString(new Date(now.getFullYear(), now.getMonth(), 1)), todayString()];
    },
  },
];

const percent = (value) => (value === null || value === undefined ? '-' : `${Math.round(value * 100)}%`);
const shortDate = (dateString) => {
  const [, m, d] = dateString.split('-');
  return `${Number(d)}/${Number(m)}`;
};

/** Columns for the per-day chart: daily, or weekly when the period is long (keeps the bars readable). */
function toColumns(byDay) {
  if (byDay.length <= 45) {
    return byDay.map((x) => ({ key: x.date, label: shortDate(x.date), title: formatDate(x.date), count: x.count }));
  }
  const weeks = [];
  for (let i = 0; i < byDay.length; i += 7) {
    const slice = byDay.slice(i, i + 7);
    const first = slice[0].date;
    const last = slice[slice.length - 1].date;
    weeks.push({
      key: first,
      label: shortDate(first),
      title: `${formatDate(first)} - ${formatDate(last)}`,
      count: slice.reduce((sum, x) => sum + x.count, 0),
    });
  }
  return weeks;
}

function Stat({ value, label, hint }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="stat h-100">
        <div className="num">{value}</div>
        <div className="small">{label}</div>
        {hint && <div className="small text-muted">{hint}</div>}
      </div>
    </div>
  );
}

function Card({ icon, title, note, children }) {
  return (
    <div className="card-soft h-100">
      <div className="section-label">
        <i className={`bi ${icon}`} />
        {title}
      </div>
      {note && <div className="small text-muted mb-2">{note}</div>}
      {children}
    </div>
  );
}

/** One horizontal bar per row, biggest first, on a shared scale. */
function BarList({ rows, empty = 'ไม่มีข้อมูลในช่วงนี้' }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0 || rows.every((r) => r.count === 0)) return <div className="small text-muted py-2">{empty}</div>;
  return (
    <div>
      {rows.map((r) => (
        <div className="viz-bar-row" key={r.key}>
          <span>{r.label}</span>
          <div className="viz-bar-track" aria-hidden="true">
            <div className="viz-bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="fw-medium text-end">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ head, rows }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm small mb-0">
        <thead>
          <tr className="text-muted">
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportBody({ report }) {
  const { appointments: a, records: r, patients: p } = report;
  const columns = toColumns(a.byDay);

  const statusRows = Object.entries(a.byStatus).map(([status, count]) => ({
    key: status,
    label: BOOKING_STATUS[status]?.label ?? status,
    count,
  }));
  const serviceRows = a.byService.map((s) => ({ key: s.service, label: s.label, count: s.count }));
  const workRows = [
    { key: 'treatments', label: 'ตรวจ / รักษา', count: r.treatments },
    { key: 'vaccinations', label: 'ฉีดวัคซีน', count: r.vaccinations },
    { key: 'parasites', label: 'ให้ยาถ่ายพยาธิ / เห็บหมัด', count: r.parasites },
  ];
  const vaccineRows = r.topVaccines.map((v) => ({ key: v.name || '-', label: v.name || '(ไม่ระบุชื่อ)', count: v.count }));
  const speciesRows = p.seenBySpecies.map((s) => ({ key: s.species, label: speciesOf(s.species).label, count: s.count }));

  return (
    <>
      <div className="row g-3 mb-4">
        <Stat value={a.total} label="นัดหมายทั้งหมด" />
        <Stat value={percent(a.completionRate)} label="ตรวจเสร็จสิ้น" hint={`จากนัดที่ดำเนินการแล้ว (${a.byStatus.completed} นัด)`} />
        <Stat value={percent(a.noShowRate)} label="ไม่มาตามนัด" hint={`${a.byStatus.no_show} นัด`} />
        <Stat value={p.seen} label="คนไข้ที่ได้รับการตรวจ" hint={`ลงทะเบียนใหม่ ${p.newInRange} ตัว`} />
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12">
          <Card icon="bi-calendar2-week" title="นัดหมายต่อวัน" note={a.byDay.length > 45 ? 'รวมเป็นรายสัปดาห์ (แท่งละ 7 วัน)' : undefined}>
            <DayChart columns={columns} />
          </Card>
        </div>

        <div className="col-lg-6">
          <Card icon="bi-clipboard2-pulse" title="นัดหมายตามบริการ">
            <BarList rows={serviceRows} />
          </Card>
        </div>
        <div className="col-lg-6">
          <Card icon="bi-flag" title="นัดหมายตามสถานะ">
            <BarList rows={statusRows} empty="ไม่มีนัดหมายในช่วงนี้" />
          </Card>
        </div>

        <div className="col-lg-6">
          <Card icon="bi-journal-medical" title="งานที่คลินิกบันทึก" note="นับเฉพาะรายการที่คลินิกบันทึก ตามวันที่ตรวจหรือให้บริการ">
            <BarList rows={workRows} />
          </Card>
        </div>
        <div className="col-lg-6">
          <Card icon="bi-capsule" title="วัคซีนที่ฉีดมากที่สุด">
            <BarList rows={vaccineRows} empty="ยังไม่มีการบันทึกวัคซีนในช่วงนี้" />
          </Card>
        </div>

        <div className="col-lg-6">
          <Card icon="bi-heart" title="คนไข้ที่ตรวจแล้ว แยกตามชนิดสัตว์" note="นับสัตว์ที่มีนัดสถานะ “เสร็จสิ้น” ในช่วงนี้">
            <BarList rows={speciesRows} />
          </Card>
        </div>
        <div className="col-lg-6">
          <Card icon="bi-people" title="คนไข้ทั้งหมดในระบบ">
            <div className="stat">
              <div className="num">{p.registered}</div>
              <div className="small">สัตว์เลี้ยงที่ลงทะเบียน</div>
            </div>
          </Card>
        </div>
      </div>

      <details className="card-soft">
        <summary className="fw-medium" style={{ cursor: 'pointer' }}>
          <i className="bi bi-table me-1" />
          ดูข้อมูลเป็นตาราง
        </summary>
        <div className="row g-4 mt-1">
          <div className="col-lg-6">
            <div className="small fw-medium mb-1">นัดหมาย{a.byDay.length > 45 ? 'รายสัปดาห์' : 'รายวัน'}</div>
            <DataTable head={['ช่วง', 'จำนวนนัด']} rows={columns.map((c) => [c.title, c.count])} />
          </div>
          <div className="col-lg-6">
            <div className="small fw-medium mb-1">ตามบริการ</div>
            <DataTable head={['บริการ', 'จำนวนนัด']} rows={serviceRows.map((s) => [s.label, s.count])} />
            <div className="small fw-medium mt-3 mb-1">ตามสถานะ</div>
            <DataTable head={['สถานะ', 'จำนวนนัด']} rows={statusRows.map((s) => [s.label, s.count])} />
            <div className="small fw-medium mt-3 mb-1">งานที่คลินิกบันทึก</div>
            <DataTable head={['รายการ', 'จำนวน']} rows={workRows.map((s) => [s.label, s.count])} />
          </div>
        </div>
      </details>
    </>
  );
}

export default function ReportsPage() {
  const [preset, setPreset] = useState('30');
  const [custom, setCustom] = useState({ from: addDays(todayString(), -29), to: todayString() });
  const [from, to] = preset === 'custom' ? [custom.from, custom.to] : PRESETS.find((x) => x.value === preset).range();
  const invalid = !from || !to || from > to;
  const { report, error, loading, reload } = useReport(invalid ? addDays(todayString(), -29) : from, invalid ? todayString() : to);

  return (
    <VetLayout>
      <div className="page-wrap">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>รายงาน</h1>
              <p>สรุปงานของคลินิก ช่วง {formatDate(from)} - {formatDate(to)}</p>
            </div>
          </div>

          <div className="card-soft mb-4">
            <div className="d-flex flex-wrap align-items-center gap-2">
              {PRESETS.map((x) => (
                <button
                  type="button"
                  key={x.value}
                  className={`btn btn-sm ${preset === x.value ? 'btn-sky' : 'btn-soft'}`}
                  onClick={() => setPreset(x.value)}
                >
                  {x.label}
                </button>
              ))}
              <button
                type="button"
                className={`btn btn-sm ${preset === 'custom' ? 'btn-sky' : 'btn-soft'}`}
                onClick={() => setPreset('custom')}
              >
                กำหนดเอง
              </button>
              {preset === 'custom' && (
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <input
                    type="date"
                    className="form-control"
                    style={{ maxWidth: 170 }}
                    aria-label="ตั้งแต่วันที่"
                    value={custom.from}
                    max={custom.to || undefined}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  />
                  <span>ถึง</span>
                  <input
                    type="date"
                    className="form-control"
                    style={{ maxWidth: 170 }}
                    aria-label="ถึงวันที่"
                    value={custom.to}
                    min={custom.from || undefined}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  />
                </div>
              )}
            </div>
            {invalid && <div className="small text-danger mt-2">กรุณาเลือกช่วงวันที่ให้ถูกต้อง (วันเริ่มต้นต้องไม่หลังวันสิ้นสุด)</div>}
            {preset === 'custom' && !invalid && <div className="small text-muted mt-2">เลือกได้ไม่เกิน 366 วัน</div>}
          </div>

          {error && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
              <span>{error}</span>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={reload}>ลองใหม่</button>
            </div>
          )}

          {invalid ? null : loading ? (
            <div className="card-soft empty-box">กำลังโหลดข้อมูล...</div>
          ) : (
            report && <ReportBody report={report} />
          )}
        </div>
      </div>
    </VetLayout>
  );
}
