import { Router } from 'express';
import { readJSON } from '../utils/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

const PAID_REVENUE_STATUSES = [
  'approved', 'preparing', 'ready_to_ship', 'ready_for_pickup',
  'out_for_delivery', 'delivered', 'picked_up', 'return_submitted',
  'returned', 'deposit_refunded',
];

const RENTED_STATUSES = ['delivered', 'picked_up'];

const RESERVED_STATUSES = [
  'approved', 'preparing', 'ready_to_ship', 'ready_for_pickup', 'out_for_delivery',
];

const NEAR_RETURN_STATUSES = ['delivered', 'picked_up', 'out_for_delivery'];

router.get('/revenue', authenticate, authorize('admin', 'staff'), (req, res) => {
  const bookings = readJSON('bookings.json');
  const { from, to } = req.query;
  let filtered = bookings.filter((b) => PAID_REVENUE_STATUSES.includes(b.status));
  if (from) filtered = filtered.filter((b) => b.createdAt >= from);
  if (to) filtered = filtered.filter((b) => b.createdAt <= to);

  const totalRevenue = filtered.reduce((sum, b) => sum + (b.rentalPrice || 0), 0);
  const totalDeposits = filtered.reduce((sum, b) => sum + (b.deposit || 0), 0);
  const totalPenalties = filtered.reduce((sum, b) => sum + (b.penaltyAmount || 0), 0);

  const byMonth = {};
  filtered.forEach((b) => {
    const month = b.createdAt.substring(0, 7);
    byMonth[month] = (byMonth[month] || 0) + (b.rentalPrice || 0);
  });

  const byDay = {};
  filtered.forEach((b) => {
    const day = b.createdAt.substring(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });

  res.json({ totalRevenue, totalDeposits, totalPenalties, count: filtered.length, byMonth, byDay });
});

router.get('/stock', authenticate, authorize('admin', 'staff'), (req, res) => {
  const costumes = readJSON('costumes.json');
  const universities = readJSON('universities.json');
  const faculties = readJSON('faculties.json');

  const byUniversity = universities.map((uni) => ({
    university: uni,
    totalStock: costumes.filter((c) => c.universityId === uni.id).reduce((s, c) => s + c.stock, 0),
    costumes: costumes.filter((c) => c.universityId === uni.id),
  }));

  const byFaculty = faculties.map((fac) => ({
    faculty: fac,
    totalStock: costumes.filter((c) => c.facultyId === fac.id).reduce((s, c) => s + c.stock, 0),
  }));

  res.json({ totalStock: costumes.reduce((s, c) => s + c.stock, 0), byUniversity, byFaculty });
});

const DEGREE_SHORT = { bachelor: 'ป.ตรี', master: 'ป.โท', doctoral: 'ป.เอก' };
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const formatOrderId = (booking) => {
  const d = new Date(booking.createdAt);
  const y = d.getFullYear() + 543;
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = booking.id.replace(/-/g, '').slice(-3).toUpperCase();
  return `#ORD-${y}${md}-${seq}`;
};

const daysUntil = (dateStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
};

router.get('/dashboard', authenticate, authorize('admin'), (req, res) => {
  const bookings = readJSON('bookings.json');
  const costumes = readJSON('costumes.json');
  const users = readJSON('users.json');
  const universities = readJSON('universities.json');
  const notifications = readJSON('notifications.json');
  const today = new Date().toISOString().substring(0, 10);
  const year = new Date().getFullYear();

  const todayBookings = bookings.filter((b) => b.createdAt.startsWith(today));
  const pendingApproval = bookings.filter((b) => b.status === 'payment_verified');
  const todayPaidBookings = todayBookings.filter((b) => PAID_REVENUE_STATUSES.includes(b.status));
  const todayRevenue = todayPaidBookings.reduce((s, b) => s + (b.rentalPrice || 0), 0);
  const totalRevenue = bookings
    .filter((b) => PAID_REVENUE_STATUSES.includes(b.status))
    .reduce((s, b) => s + (b.rentalPrice || 0), 0);
  const totalMembers = users.filter((u) => u.role === 'customer').length || users.length;
  const nearReturnBookings = bookings.filter((b) => {
    if (!NEAR_RETURN_STATUSES.includes(b.status)) return false;
    const days = daysUntil(b.endDate);
    return days >= 0 && days <= 3;
  });

  const opsQueue = {
    readyToShip: bookings.filter((b) => ['ready_to_ship', 'ready_for_pickup'].includes(b.status)).length,
    outForDelivery: bookings.filter((b) => b.status === 'out_for_delivery').length,
    returnSubmitted: bookings.filter((b) => b.status === 'return_submitted').length,
    awaitingRefund: bookings.filter((b) => b.status === 'returned').length,
  };

  const monthlyRevenue = THAI_MONTHS.map((label, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    const amount = bookings
      .filter((b) => PAID_REVENUE_STATUSES.includes(b.status) && b.createdAt.startsWith(key))
      .reduce((s, b) => s + (b.rentalPrice || 0), 0);
    return { month: i + 1, label, key, amount, buddhistYear: year + 543 };
  }).filter((_, i) => i <= new Date().getMonth());

  // สถานะชุดครุย — ใช้ stock จากจัดการชุด เป็นฐาน รวมกับสถานะการจองจริง
  const totalPool = costumes.reduce((s, c) => s + (c.stock || 0), 0);
  const rented = bookings.filter((b) => RENTED_STATUSES.includes(b.status)).length;
  const cleaning = bookings.filter((b) => b.status === 'returned' && !(b.penaltyAmount > 0)).length;
  const repair = bookings.filter((b) => b.status === 'returned' && (b.penaltyAmount || 0) > 0).length;
  const reserved = bookings.filter((b) => RESERVED_STATUSES.includes(b.status)).length;
  const available = Math.max(0, totalPool - rented - cleaning - repair - reserved);
  const gownTotal = available + rented + cleaning + repair || 1;
  const gownStatus = [
    { key: 'available', label: 'พร้อมให้ใช้', count: available, color: '#22C55E' },
    { key: 'rented', label: 'กำลังเช่า', count: rented, color: '#F59E0B' },
    { key: 'cleaning', label: 'ซักทำความสะอาด', count: cleaning, color: '#3B82F6' },
    { key: 'repair', label: 'ซ่อมแซม', count: repair, color: '#EF4444' },
  ].map((item) => ({
    ...item,
    percent: Math.round((item.count / gownTotal) * 100),
  }));

  const enrichRecent = (b) => {
    const costume = costumes.find((c) => c.id === b.costumeId);
    const user = users.find((u) => u.id === b.userId);
    const university = universities.find((u) => u.id === costume?.universityId);
    return {
      id: b.id,
      orderId: formatOrderId(b),
      status: b.status,
      totalPrice: b.totalPrice,
      endDate: b.endDate,
      createdAt: b.createdAt,
      customerName: user?.name || '—',
      universityName: university?.name || '—',
      degreeShort: DEGREE_SHORT[b.degreeLevel] || b.degreeLevel,
    };
  };

  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map(enrichRecent);

  const recentNotifications = [...notifications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)
    .map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt,
      timeLabel: new Date(n.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    }));

  res.json({
    totalRevenue,
    todayRevenue,
    todayPaidCount: todayPaidBookings.length,
    todayRentals: todayBookings.length,
    totalStock: available,
    stockCapacity: totalPool,
    pendingApproval: pendingApproval.length,
    totalMembers,
    nearReturnDeadline: nearReturnBookings.length,
    opsQueue,
    monthlyRevenue,
    gownStatus,
    gownTotal: available + rented + cleaning + repair,
    recentBookings,
    recentNotifications,
  });
});

router.get('/activity-log', authenticate, authorize('admin'), (req, res) => {
  const logs = readJSON('activityLog.json').reverse();
  res.json(logs);
});

export default router;
