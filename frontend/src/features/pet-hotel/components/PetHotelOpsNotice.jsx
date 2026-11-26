import { Link } from 'react-router-dom';

/** Shared notice for Pet Hotel staff placeholder routes — points to the live owner + CCTV flows. */
export default function PetHotelOpsNotice({ title, subtitle }) {
  return (
    <section className="page-wrap">
      <div className="container">
        <div className="alert alert-info mb-4" role="status">
          การจองและฝากจริงทำผ่านระบบเจ้าของสัตว์ (ฝากโรงแรม) และกล้อง CCTV อยู่ที่ Super Admin
        </div>
        <h1>{title}</h1>
        {subtitle ? <p className="text-muted">{subtitle}</p> : null}
        <div className="d-flex flex-wrap gap-2 mt-3">
          <Link className="btn btn-sky" to="/pet-owner/cat-hotel/book">เปิดจองฝาก (ฝั่งเจ้าของ)</Link>
          <Link className="btn btn-soft" to="/super-admin">Super Admin / CCTV</Link>
          <Link className="btn btn-soft" to="/pet-hotel">กลับภาพรวม</Link>
        </div>
      </div>
    </section>
  );
}