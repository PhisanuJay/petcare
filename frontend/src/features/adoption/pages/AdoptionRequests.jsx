import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adoptionStaffFetch, readAdoptionResponse } from '../api.js';
import { useAdoptionBasePath } from '../useAdoptionBasePath.js';

const STATUS_LABELS = {
  pending: 'รอพิจารณา',
  submitted: 'ส่งคำขอแล้ว',
  reviewing: 'กำลังตรวจสอบ',
  interview: 'นัดพูดคุย',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
  completed: 'รับน้องแล้ว',
  closed: 'ปิดคำร้อง',
  cancelled: 'ยกเลิกแล้ว',
};

const FILTER_BUCKETS = {
  pending: new Set(['pending', 'submitted', 'reviewing', 'interview']),
  approved: new Set(['approved', 'completed']),
  rejected: new Set(['rejected']),
  closed: new Set(['closed', 'cancelled']),
};

function matchesFilter(status, filter) {
  if (filter === 'all') return true;
  const bucket = FILTER_BUCKETS[filter];
  return bucket ? bucket.has(status) : status === filter;
}

export default function AdoptionRequestsPage() {
  const base = useAdoptionBasePath();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function loadRequests() {
      try {
        const response = await adoptionStaffFetch('/applications', { signal: controller.signal });
        const result = await readAdoptionResponse(response, 'โหลดคำขอไม่สำเร็จ');
        const list = Array.isArray(result.applications) ? result.applications : [];
        setRequests(list);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadRequests();
    return () => controller.abort();
  }, []);

  const filteredRequests = useMemo(
    () => requests.filter((request) => matchesFilter(request.status, filter)),
    [filter, requests],
  );

  return (
    <section>
      <div className="adoption-staff-page-title d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h1>คำร้องขอรับเลี้ยง</h1>
          <p>ตรวจสอบข้อมูลผู้สมัครและพิจารณาคำร้อง</p>
        </div>
        <label className="d-flex align-items-center gap-2">
          <span>แสดง</span>
          <select className="form-select" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="pending">รอดำเนินการ</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="rejected">ไม่อนุมัติ</option>
            <option value="closed">ปิด/ยกเลิก</option>
            <option value="all">ทั้งหมด</option>
          </select>
        </label>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && <p role="status">กำลังโหลดคำร้อง...</p>}
      {!loading && !error && filteredRequests.length === 0 && (
        <div className="adoption-staff-panel">ไม่พบคำร้องในหมวดนี้</div>
      )}
      <div className="adoption-staff-list">
        {filteredRequests.map((request) => (
          <article className="adoption-staff-card" key={request.id}>
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div>
                <h2>{request.firstName} {request.lastName}</h2>
                <p className="adoption-staff-muted mb-1">สนใจรับเลี้ยง: {request.animalName || 'ไม่พบข้อมูลสัตว์'}</p>
                <p className="adoption-staff-muted mb-0">
                  ส่งคำร้องเมื่อ {new Date(request.createdAt).toLocaleString('th-TH')}
                </p>
              </div>
              <span className={`adoption-staff-status ${request.status}`}>
                {STATUS_LABELS[request.status] || request.status}
              </span>
            </div>
            <Link className="btn btn-soft btn-sm mt-3" to={`${base}/requests/${request.id}`}>
              ดูรายละเอียดคำร้อง
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}