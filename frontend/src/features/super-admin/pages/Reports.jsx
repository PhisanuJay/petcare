import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fetchReports } from '../api.js';

function RecentTable({ title, columns, rows, empty }) {
  return (
    <section className="sa-card">
      <h2>{title}</h2>
      <div className="sa-table-wrap" style={{ border: 0, borderRadius: 10 }}>
        <table className="sa-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="sa-muted">{empty}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ReportsPage() {
  const { authToken } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReports(authToken)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'โหลดรายงานไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const ov = data?.overview;

  return (
    <>
      <div className="sa-dash__intro">
        <div>
          <p className="sa-dash__eyebrow">รายละเอียดสถานะ</p>
          <h1>รายงานสรุป</h1>
          <p className="sa-dash__lede">
            สรุปจากข้อมูลจริงช่วงล่าสุด
            {data?.today ? ` · อ้างอิง ${data.today}` : ''}
          </p>
        </div>
      </div>

      {error ? <div className="sa-error">{error}</div> : null}
      {loading && !data ? <p className="sa-muted">กำลังโหลด…</p> : null}

      {ov ? (
        <div className="sa-grid">
          <div className="sa-card">
            <h2>คลินิกวันนี้</h2>
            <div className="sa-metric">
              <strong>{ov.clinic?.todayTotal ?? 0}</strong>
              <span>นัด</span>
            </div>
          </div>
          <div className="sa-card">
            <h2>รับส่ง</h2>
            <div className="sa-metric">
              <strong>{ov.transport?.slipPending ?? 0}</strong>
              <span>สลิปรอตรวจ · ทริปวิ่ง {ov.transport?.tripsRunning ?? 0}</span>
            </div>
          </div>
          <div className="sa-card">
            <h2>โรงแรม active</h2>
            <div className="sa-metric">
              <strong>{ov.hotel?.active ?? 0}</strong>
              <span>จากทั้งหมด {ov.hotel?.total ?? 0}</span>
            </div>
          </div>
          <div className="sa-card">
            <h2>บัญชี 7 วัน</h2>
            <div className="sa-metric">
              <strong>{Number(ov.accounting?.approvedLast7DaysTotal || 0).toLocaleString('th-TH')}</strong>
              <span>{ov.accounting?.approvedLast7Days ?? 0} รายการที่อนุมัติ</span>
            </div>
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          <RecentTable
            title="นัดคลินิกล่าสุด"
            empty="ยังไม่มีนัดในช่วงนี้"
            rows={data.clinicRecent || []}
            columns={[
              { key: 'date', label: 'วัน' },
              { key: 'time', label: 'เวลา' },
              { key: 'petName', label: 'สัตว์' },
              { key: 'service', label: 'บริการ' },
              { key: 'status', label: 'สถานะ' },
              { key: 'vetName', label: 'หมอ' },
            ]}
          />
          <RecentTable
            title="จองรับส่งล่าสุด"
            empty="ยังไม่มีการจอง"
            rows={data.transportRecent || []}
            columns={[
              { key: 'createdAt', label: 'สร้างเมื่อ', render: (r) => (r.createdAt || '').slice(0, 16).replace('T', ' ') },
              { key: 'petName', label: 'สัตว์' },
              { key: 'ownerName', label: 'เจ้าของ' },
              { key: 'status', label: 'สถานะ' },
              { key: 'paymentStatus', label: 'ชำระ' },
            ]}
          />
          <RecentTable
            title="โรงแรมล่าสุด"
            empty="ยังไม่มีที่พัก"
            rows={data.hotelRecent || []}
            columns={[
              { key: 'checkIn', label: 'เข้า' },
              { key: 'checkOut', label: 'ออก' },
              { key: 'status', label: 'สถานะ' },
              { key: 'total', label: 'ยอด', render: (r) => Number(r.total || 0).toLocaleString('th-TH') },
              { key: 'ownerEmail', label: 'อีเมล' },
            ]}
          />
        </>
      ) : null}
    </>
  );
}
