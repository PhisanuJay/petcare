import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adoptionStaffFetch, readAdoptionResponse } from '../api.js';

const STATUS_LABELS = {
  pending: 'รอพิจารณา',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
  closed: 'ปิดคำร้อง',
};

function Detail({ label, children }) {
  return (
    <div className="adoption-staff-detail">
      <span>{label}</span>
      <strong>{children || 'ไม่ระบุ'}</strong>
    </div>
  );
}

export default function RequestDetailPage() {
  const { requestId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function loadRequest() {
      try {
        const response = await adoptionStaffFetch(
          `/requests/${encodeURIComponent(requestId)}`,
          { signal: controller.signal },
        );
        const result = await readAdoptionResponse(response, 'โหลดรายละเอียดคำร้องไม่สำเร็จ');
        setData(result);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadRequest();
    return () => controller.abort();
  }, [requestId]);

  async function decide(status) {
    const isApproval = status === 'approved';
    const message = isApproval
      ? `ยืนยันอนุมัติคำร้องรับ ${data.animal?.name || 'สัตว์เลี้ยง'} หรือไม่? สถานะน้องจะเปลี่ยนเป็นมีบ้านแล้ว`
      : 'ยืนยันไม่อนุมัติคำร้องนี้หรือไม่?';
    if (!window.confirm(message)) return;

    setUpdating(true);
    setError('');
    try {
      const response = await adoptionStaffFetch(
        `/requests/${encodeURIComponent(requestId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
      const result = await readAdoptionResponse(response, 'บันทึกผลพิจารณาไม่สำเร็จ');
      setData(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <p role="status">กำลังโหลดรายละเอียดคำร้อง...</p>;
  if (error && !data) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!data) return null;

  const { request, animal } = data;
  return (
    <section>
      <div className="adoption-staff-page-title">
        <Link to="/adoption/requests">← กลับไปหน้าคำร้อง</Link>
        <h1 className="mt-2">คำร้องของ {request.firstName} {request.lastName}</h1>
        <p>
          น้องที่สนใจ: {animal?.name || 'ไม่พบข้อมูลสัตว์'} ·{' '}
          <span className={`adoption-staff-status ${request.status}`}>
            {STATUS_LABELS[request.status] || request.status}
          </span>
        </p>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="adoption-staff-panel mb-3">
        <h2 className="h5 mb-3">ข้อมูลผู้สมัคร</h2>
        <div className="adoption-staff-detail-grid">
          <Detail label="ชื่อ-นามสกุล">{request.firstName} {request.lastName}</Detail>
          <Detail label="อายุ">{request.age} ปี</Detail>
          <Detail label="อาชีพ">{request.occupation}</Detail>
          <Detail label="เบอร์โทรศัพท์">{request.phone}</Detail>
          <Detail label="เงินเดือน">{Number(request.salary).toLocaleString('th-TH')} บาท/เดือน</Detail>
          <Detail label="ประเภทที่พัก">{request.housingType}</Detail>
          <Detail label="มีแมวอยู่แล้ว">
            {request.hasCats ? `มี ${request.catCount} ตัว` : 'ไม่มี'}
          </Detail>
          <Detail label="วันที่ยื่นคำร้อง">
            {new Date(request.createdAt).toLocaleString('th-TH')}
          </Detail>
        </div>
      </div>

      <div className="adoption-staff-panel mb-3">
        <h2 className="h5 mb-3">รูปสภาพบ้าน</h2>
        <img className="adoption-staff-document-photo" src={request.homePhoto} alt="รูปสภาพบ้านผู้สมัคร" />
      </div>

      <div className="adoption-staff-panel mb-3">
        <h2 className="h5 mb-3">Statement เงินเดือน</h2>
        <img className="adoption-staff-document-photo" src={request.salaryStatementPhoto} alt="รูป Statement เงินเดือนผู้สมัคร" />
      </div>

      {request.resolutionNote && (
        <div className="alert alert-info" role="status">{request.resolutionNote}</div>
      )}
      {request.status === 'pending' && (
        <div className="adoption-staff-actions">
          <button
            className="btn btn-sky"
            type="button"
            onClick={() => decide('approved')}
            disabled={updating}
          >
            {updating ? 'กำลังบันทึก...' : 'อนุมัติรับเลี้ยง'}
          </button>
          <button
            className="btn btn-soft-danger"
            type="button"
            onClick={() => decide('rejected')}
            disabled={updating}
          >
            ไม่อนุมัติ
          </button>
        </div>
      )}
    </section>
  );
}
