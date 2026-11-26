import { queryAll } from '../../db/mssql.js';
import { listAllBookings } from '../pet-owner/bookingStore.js';
import { ensurePetTransportReady } from '../pet-transport/routes.js';
import {
  listApplicationsForStaff,
  staffOverviewCounts,
} from '../adoption/adoptionRepository.js';

const ACTIVE_HOTEL = new Set(['waiting', 'checked_in', 'pending', 'confirmed']);
const TRIP_RUNNING = new Set([
  'en_route_pickup',
  'arrived_pickup',
  'picked_up',
  'in_transit',
  'arrived_dropoff',
]);

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function emptyClinic() {
  return {
    todayTotal: 0,
    byStatus: {
      pending: 0,
      confirmed: 0,
      completed: 0,
      no_show: 0,
      cancel_requested: 0,
      cancelled: 0,
      rejected: 0,
    },
  };
}

async function clinicKpis(today) {
  const clinic = emptyClinic();
  try {
    const bookings = await listAllBookings();
    for (const b of bookings) {
      if (b.date !== today) continue;
      clinic.todayTotal += 1;
      const key = clinic.byStatus[b.status] != null ? b.status : null;
      if (key) clinic.byStatus[key] += 1;
    }
  } catch {
    /* bookings.json may be missing on fresh install */
  }
  return clinic;
}

async function transportKpis() {
  await ensurePetTransportReady();
  const bookings = await queryAll(
    'SELECT id, status, payment_status FROM dbo.bookings',
  );
  const trips = await queryAll('SELECT id, status FROM dbo.trips');

  let awaitingPayment = 0;
  let slipPending = 0;
  let paid = 0;
  let cancelRequested = 0;
  for (const row of bookings) {
    if (row.status === 'cancel_requested') cancelRequested += 1;
    if (row.payment_status === 'unpaid' || row.status === 'awaiting_payment' || row.status === 'submitted') {
      if (row.payment_status === 'unpaid') awaitingPayment += 1;
    }
    if (row.payment_status === 'owner_confirmed') slipPending += 1;
    if (row.payment_status === 'paid' && row.status !== 'cancelled') paid += 1;
  }

  let tripsRunning = 0;
  let tripsCompleted = 0;
  for (const t of trips) {
    if (TRIP_RUNNING.has(t.status)) tripsRunning += 1;
    if (t.status === 'completed') tripsCompleted += 1;
  }

  return {
    bookingsTotal: bookings.length,
    awaitingPayment,
    slipPending,
    paid,
    cancelRequested,
    tripsRunning,
    tripsCompleted,
  };
}

async function hotelKpis() {
  await ensurePetTransportReady();
  const rows = await queryAll('SELECT id, status, check_in, check_out, total_price FROM dbo.hotel_stays');
  const active = rows.filter((r) => ACTIVE_HOTEL.has(r.status));
  return {
    total: rows.length,
    active: active.length,
    byStatus: active.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {}),
  };
}

async function accountingKpis() {
  await ensurePetTransportReady();
  const since = daysAgoIso(7);
  const rows = await queryAll('SELECT status, data, created_at FROM dbo.payments');
  let slipPending = 0;
  let approvedRecent = 0;
  let approvedRecentTotal = 0;

  for (const row of rows) {
    let data = {};
    try {
      data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
    } catch {
      data = {};
    }
    const status = row.status || data.status;
    if (status === 'pending_review') slipPending += 1;
    if (status === 'approved') {
      const created = row.created_at || data.createdAt || '';
      if (created >= since) {
        approvedRecent += 1;
        approvedRecentTotal += Number(data.total || data.deposit || 0) || 0;
      }
    }
  }

  // สลิปรอตรวจจากรับส่ง (owner_confirmed)
  const transportSlips = await queryAll(
    `SELECT COUNT(*) AS c FROM dbo.bookings WHERE payment_status = N'owner_confirmed'`,
  );
  const transportSlipPending = Number(transportSlips[0]?.c || 0);

  return {
    paymentSlipPending: slipPending,
    transportSlipPending,
    slipPendingTotal: slipPending + transportSlipPending,
    approvedLast7Days: approvedRecent,
    approvedLast7DaysTotal: approvedRecentTotal,
  };
}

async function recentActivity(today) {
  const items = [];

  try {
    const bookings = await listAllBookings();
    bookings
      .filter((b) => b.date >= localTodayOffset(-2))
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .slice(0, 8)
      .forEach((b) => {
        items.push({
          id: `clinic-${b.id}`,
          kind: 'clinic',
          title: b.petName || 'นัดคลินิก',
          subtitle: `${b.serviceLabel || b.service || 'บริการ'} · ${b.time || ''}`,
          meta: b.date === today ? 'วันนี้' : b.date,
          status: b.status,
          at: `${b.date}T${b.time || '00:00'}:00`,
        });
      });
  } catch {
    /* ignore */
  }

  await ensurePetTransportReady();
  const transportRows = await queryAll(
    `SELECT TOP 8 id, pet_name, status, payment_status, created_at, owner_name
     FROM dbo.bookings ORDER BY created_at DESC`,
  );
  for (const r of transportRows) {
    items.push({
      id: `tp-${r.id}`,
      kind: 'transport',
      title: r.pet_name || 'รับส่ง',
      subtitle: `${r.owner_name || 'ลูกค้า'} · ${r.payment_status || r.status}`,
      meta: (r.created_at || '').slice(0, 16).replace('T', ' '),
      status: r.status,
      at: r.created_at || '',
    });
  }

  try {
    const apps = await listApplicationsForStaff();
    apps.slice(0, 5).forEach((app) => {
      items.push({
        id: `adopt-${app.id}`,
        kind: 'adoption',
        title: app.fullName || 'คำร้องหาบ้าน',
        subtitle: `สถานะ ${app.status}`,
        meta: (app.createdAt || '').slice(0, 16).replace('T', ' '),
        status: app.status,
        at: app.createdAt || '',
      });
    });
  } catch {
    /* ignore */
  }

  return items
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 12);
}

export async function buildOverview() {
  const today = localToday();
  const [clinic, transport, hotel, accounting, adoption, activity] = await Promise.all([
    clinicKpis(today),
    transportKpis(),
    hotelKpis(),
    accountingKpis(),
    staffOverviewCounts().catch(() => ({
      pendingListings: 0,
      availableAnimals: 0,
      adoptedAnimals: 0,
      pendingRequests: 0,
      totalRequests: 0,
    })),
    recentActivity(today),
  ]);

  const attention = {
    slipPending: accounting.slipPendingTotal,
    clinicPending: clinic.byStatus.pending || 0,
    tripsRunning: transport.tripsRunning || 0,
    adoptionPending: adoption.pendingRequests || 0,
    cancelRequested: (transport.cancelRequested || 0) + (clinic.byStatus.cancel_requested || 0),
  };

  return {
    generatedAt: new Date().toISOString(),
    today,
    clinic,
    transport,
    hotel,
    accounting,
    adoption,
    attention,
    activity,
  };
}

export async function buildReports() {
  const overview = await buildOverview();
  const today = overview.today;
  const sinceDate = localTodayOffset(-3);
  let clinicRecent = [];
  try {
    const all = await listAllBookings();
    clinicRecent = all
      .filter((b) => b.date >= sinceDate)
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .slice(0, 40)
      .map((b) => ({
        id: b.id,
        date: b.date,
        time: b.time,
        status: b.status,
        service: b.serviceLabel || b.service,
        petName: b.petName,
        vetName: b.vetName || '',
        ownerName: b.ownerName || '',
      }));
  } catch {
    clinicRecent = [];
  }

  await ensurePetTransportReady();
  const transportRecent = (await queryAll(
    `SELECT TOP 30 id, pet_name, status, payment_status, created_at, owner_name
     FROM dbo.bookings ORDER BY created_at DESC`,
  )).map((r) => ({
    id: r.id,
    petName: r.pet_name,
    status: r.status,
    paymentStatus: r.payment_status,
    createdAt: r.created_at,
    ownerName: r.owner_name || '',
  }));

  const hotelRecent = (await queryAll(
    `SELECT TOP 20 id, check_in, check_out, status, total_price, owner_email, created_at
     FROM dbo.hotel_stays ORDER BY created_at DESC`,
  )).map((r) => ({
    id: r.id,
    checkIn: r.check_in,
    checkOut: r.check_out,
    status: r.status,
    total: Number(r.total_price || 0),
    ownerEmail: r.owner_email || '',
    createdAt: r.created_at,
  }));

  return {
    overview,
    clinicRecent,
    transportRecent,
    hotelRecent,
    today,
  };
}

function localTodayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
