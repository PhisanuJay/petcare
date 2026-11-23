import { Link } from 'react-router-dom';
import { useTransport } from '../useTransport.js';

export default function TransportDashboard() {
  const { bookings, issues, trips } = useTransport();
  const pendingPrice = bookings.filter((b) => b.status === 'submitted').length;
  const awaitingPay = bookings.filter((b) => b.paymentStatus === 'owner_confirmed').length;
  const cancelReq = bookings.filter((b) => b.status === 'cancel_requested').length;
  const activeTrips = trips.filter((t) => t.status !== 'completed' && t.driverId).length;

  return (
    <>
      <h1>Dashboard</h1>
      <p className="tp-lead">ภาพรวมงานรับ–ส่งสัตว์เลี้ยง</p>
      <div className="tp-stats">
        <div className="tp-stat"><strong>{pendingPrice}</strong><span>รอตรวจราคา</span></div>
        <div className="tp-stat"><strong>{awaitingPay}</strong><span>รอตรวจชำระเงิน</span></div>
        <div className="tp-stat"><strong>{cancelReq}</strong><span>คำขอยกเลิก</span></div>
        <div className="tp-stat"><strong>{activeTrips}</strong><span>ทริปที่กำลังทำ</span></div>
        <div className="tp-stat"><strong>{issues.filter((i) => i.status === 'open').length}</strong><span>ปัญหาจากคนขับ</span></div>
      </div>
      <div className="tp-actions">
        <Link className="btn btn-sky" to="/admin/transport/bookings">จัดการ Booking</Link>
        <Link className="btn btn-soft" to="/admin/transport/payments">ตรวจชำระเงิน</Link>
      </div>
    </>
  );
}
