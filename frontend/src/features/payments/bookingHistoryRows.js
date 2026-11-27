import { HOTEL_STATUS_LABEL } from '../pet-owner/useHotelBookings.js';
import { BOOKING_STATUS } from '../pet-owner/bookingOptions.js';
import { formatStayHubDetail } from '../pet-owner/useHotelStays.js';
import { bookingStatusMeta } from '../pet-transport/constants.js';
import { PAY_KIND, PAY_KIND_LABEL, PAY_STATUS, paymentFor, paymentForRef } from './store.js';

function hasPaymentOnRecord(kind, refId, ownerId) {
  const payment = paymentForRef(kind, refId, ownerId) || paymentFor(kind, refId, ownerId);
  return Boolean(payment && payment.status !== PAY_STATUS.cancelled);
}

export function refKey(kind, refId) {
  return `${kind}:${refId}`;
}

function hrefForKind(kind, refId) {
  if (kind === PAY_KIND.hotel && refId) return `/pet-owner/cat-hotel/bookings/${refId}`;
  if (kind === PAY_KIND.transport && refId) return `/pet-owner/transport/${refId}`;
  if (kind === PAY_KIND.clinic) return '/pet-owner/booking';
  return '/pet-owner/history';
}

function hotelStatusLabel(status) {
  return HOTEL_STATUS_LABEL[status]
    || HOTEL_STATUS_LABEL[status === 'pending' || status === 'confirmed' ? 'waiting' : status]
    || status
    || '';
}

function clinicTitle(booking) {
  return booking?.petName || 'นัดหมายคลินิก';
}

function clinicDetail(booking) {
  if (!booking) return '';
  const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
  const parts = [
    booking.serviceLabel || booking.service || 'นัดคลินิก',
    booking.time ? `${booking.time} น.` : '',
    status.label,
  ].filter(Boolean);
  return parts.join(' · ');
}

function transportTitle(booking) {
  return booking?.petName || 'รับ–ส่งสัตว์เลี้ยง';
}

function transportDetail(booking) {
  if (!booking) return '';
  const meta = bookingStatusMeta(booking.status);
  return meta?.label || booking.status || '';
}

function hubLineTitle(line, lookups) {
  const kind = line.kind;
  const refId = line.refId;
  if (kind === PAY_KIND.clinic) {
    const b = lookups.clinicById.get(refId);
    return b ? clinicTitle(b) : line.label?.split(':')[0]?.trim() || line.label || 'นัดคลินิก';
  }
  if (kind === PAY_KIND.hotel) {
    const stay = lookups.stayById.get(refId);
    const legacy = lookups.legacyHotelById.get(refId);
    if (legacy?.petName) return legacy.petName;
    if (stay) return 'ฝากโรงแรม';
    return line.label || 'โรงแรมสัตว์';
  }
  if (kind === PAY_KIND.transport) {
    const b = lookups.transportById.get(refId);
    return b ? transportTitle(b) : line.label || 'รับ–ส่ง';
  }
  return line.label || 'บริการ';
}

function hubLineDetail(line, lookups) {
  const kind = line.kind;
  const refId = line.refId;
  if (kind === PAY_KIND.clinic) {
    const b = lookups.clinicById.get(refId);
    if (b) return clinicDetail(b);
    return line.label || '';
  }
  if (kind === PAY_KIND.hotel) {
    const stay = lookups.stayById.get(refId);
    if (stay) return `${formatStayHubDetail(stay)} · ${hotelStatusLabel(stay.status)}`;
    const legacy = lookups.legacyHotelById.get(refId);
    if (legacy) return `${HOTEL_STATUS_LABEL[legacy.status] || ''}`.trim();
    return line.detail || line.label || '';
  }
  if (kind === PAY_KIND.transport) {
    const b = lookups.transportById.get(refId);
    if (b) return transportDetail(b);
    return line.detail || line.label || '';
  }
  return line.detail || line.label || '';
}

/**
 * @param {object} options
 * @param {string} ownerId
 * @param {object[]} payments
 * @param {Function} payStateFn (payment|null) => {text,tone}
 * @param {Function} resolvePay (kind, refId, booking?) => {text,tone}
 * @param {{ forKind: (kind, refId) => object|null }} cancellations
 */
export function buildBookingHistoryRows({
  ownerId,
  payments,
  payStateFn,
  resolvePay,
  cancellations,
  clinics,
  stays,
  legacyHotels,
  transports,
}) {
  const clinicById = new Map(clinics.map((b) => [b.id, b]));
  const stayById = new Map(stays.map((s) => [s.id, s]));
  const legacyHotelById = new Map(legacyHotels.map((b) => [b.id, b]));
  const transportById = new Map(transports.map((b) => [b.id, b]));
  const lookups = { clinicById, stayById, legacyHotelById, transportById };

  const covered = new Set();
  const rows = [];

  payments.forEach((payment) => {
    if (payment.kind === PAY_KIND.hub && Array.isArray(payment.lines) && payment.lines.length) {
      const lineCount = payment.lines.length;
      rows.push({
        id: payment.id,
        kind: PAY_KIND.hub,
        hubOnly: true,
        title: payment.title || 'จองรวม Hub',
        detail: payment.detail || `${lineCount} บริการ · ยอด ฿${Number(payment.total || 0).toLocaleString('th-TH')}`,
        when: payment.createdAt,
        pay: payStateFn(payment),
        cancellation: cancellations.forKind(PAY_KIND.hub, payment.refId),
        href: `/pet-owner/pay/${payment.id}`,
        chip: PAY_KIND_LABEL.hub,
      });

      payment.lines.forEach((line) => {
        if (!line?.refId || !line?.kind) return;
        covered.add(refKey(line.kind, line.refId));
        rows.push({
          id: line.refId,
          kind: line.kind,
          hubOnly: false,
          fromHub: true,
          hubPaymentId: payment.id,
          title: hubLineTitle(line, lookups),
          detail: hubLineDetail(line, lookups),
          when: payment.createdAt,
          pay: payStateFn(payment),
          cancellation: cancellations.forKind(line.kind, line.refId),
          href: hrefForKind(line.kind, line.refId),
          chip: PAY_KIND_LABEL[line.kind] || line.kind,
        });
      });
      return;
    }

    if (payment.kind === PAY_KIND.hub) {
      rows.push({
        id: payment.id,
        kind: PAY_KIND.hub,
        hubOnly: true,
        title: payment.title || 'จองรวม Hub',
        detail: payment.detail || '',
        when: payment.createdAt,
        pay: payStateFn(payment),
        cancellation: cancellations.forKind(PAY_KIND.hub, payment.refId),
        href: `/pet-owner/pay/${payment.id}`,
        chip: PAY_KIND_LABEL.hub,
      });
      return;
    }

    covered.add(refKey(payment.kind, payment.refId));

    if (payment.kind === PAY_KIND.hotel) {
      const stay = stayById.get(payment.refId);
      const legacy = legacyHotelById.get(payment.refId);
      rows.push({
        id: payment.refId || payment.id,
        kind: PAY_KIND.hotel,
        hubOnly: false,
        title: legacy?.petName || 'ฝากโรงแรม',
        detail: stay
          ? `${formatStayHubDetail(stay)} · ${hotelStatusLabel(stay.status)}`
          : (legacy ? HOTEL_STATUS_LABEL[legacy.status] : payment.detail),
        when: payment.createdAt,
        pay: payStateFn(payment),
        cancellation: cancellations.forKind(PAY_KIND.hotel, payment.refId),
        href: payment.refId
          ? `/pet-owner/cat-hotel/bookings/${payment.refId}`
          : `/pet-owner/pay/${payment.id}`,
        chip: PAY_KIND_LABEL.hotel,
      });
      return;
    }

    if (payment.kind === PAY_KIND.clinic) {
      const b = clinicById.get(payment.refId);
      rows.push({
        id: payment.refId || payment.id,
        kind: PAY_KIND.clinic,
        hubOnly: false,
        title: b ? clinicTitle(b) : (payment.title || 'นัดคลินิก'),
        detail: b ? clinicDetail(b) : payment.detail,
        when: b?.date || payment.createdAt,
        pay: payStateFn(payment),
        cancellation: cancellations.forKind(PAY_KIND.clinic, payment.refId),
        href: '/pet-owner/booking',
        chip: PAY_KIND_LABEL.clinic,
      });
      return;
    }

    if (payment.kind === PAY_KIND.transport) {
      const b = transportById.get(payment.refId);
      rows.push({
        id: payment.refId || payment.id,
        kind: PAY_KIND.transport,
        hubOnly: false,
        title: b ? transportTitle(b) : (payment.title || 'รับ–ส่ง'),
        detail: b ? transportDetail(b) : payment.detail,
        when: payment.createdAt,
        pay: payStateFn(payment),
        cancellation: cancellations.forKind(PAY_KIND.transport, payment.refId),
        href: payment.refId
          ? `/pet-owner/transport/${payment.refId}`
          : `/pet-owner/pay/${payment.id}`,
        chip: PAY_KIND_LABEL.transport,
      });
      return;
    }

    rows.push({
      id: payment.id,
      kind: payment.kind,
      hubOnly: false,
      title: payment.title,
      detail: payment.detail,
      when: payment.createdAt,
      pay: payStateFn(payment),
      cancellation: cancellations.forKind(payment.kind, payment.refId),
      href: `/pet-owner/pay/${payment.id}`,
      chip: PAY_KIND_LABEL[payment.kind] || payment.kind,
    });
  });

  const isCovered = (kind, id) => covered.has(refKey(kind, id))
    || Boolean(paymentForRef(kind, id, ownerId))
    || Boolean(paymentFor(kind, id, ownerId));

  stays.forEach((stay) => {
    if (!hasPaymentOnRecord(PAY_KIND.hotel, stay.id, ownerId)) return;
    if (isCovered(PAY_KIND.hotel, stay.id)) return;
    covered.add(refKey(PAY_KIND.hotel, stay.id));
    rows.push({
      id: stay.id,
      kind: PAY_KIND.hotel,
      hubOnly: false,
      title: 'ฝากโรงแรม',
      detail: `${formatStayHubDetail(stay)} · ${hotelStatusLabel(stay.status)}`,
      when: stay.createdAt || stay.checkIn,
      pay: resolvePay(PAY_KIND.hotel, stay.id, stay),
      cancellation: cancellations.forKind(PAY_KIND.hotel, stay.id),
      href: `/pet-owner/cat-hotel/bookings/${stay.id}`,
      chip: PAY_KIND_LABEL.hotel,
    });
  });

  legacyHotels.forEach((booking) => {
    if (!hasPaymentOnRecord(PAY_KIND.hotel, booking.id, ownerId)) return;
    if (stayById.has(booking.id) || isCovered(PAY_KIND.hotel, booking.id)) return;
    covered.add(refKey(PAY_KIND.hotel, booking.id));
    rows.push({
      id: booking.id,
      kind: PAY_KIND.hotel,
      hubOnly: false,
      title: booking.petName || 'ฝากโรงแรม',
      detail: HOTEL_STATUS_LABEL[booking.status] || '',
      when: booking.createdAt,
      pay: resolvePay(PAY_KIND.hotel, booking.id, booking),
      cancellation: cancellations.forKind(PAY_KIND.hotel, booking.id),
      href: `/pet-owner/cat-hotel/bookings/${booking.id}`,
      chip: PAY_KIND_LABEL.hotel,
    });
  });

  transports.forEach((booking) => {
    if (booking.ownerId !== ownerId) return;
    const transportPaid = booking.paymentStatus === 'paid'
      || booking.paymentStatus === 'owner_confirmed';
    if (!hasPaymentOnRecord(PAY_KIND.transport, booking.id, ownerId) && !transportPaid) return;
    if (isCovered(PAY_KIND.transport, booking.id)) return;
    covered.add(refKey(PAY_KIND.transport, booking.id));
    const meta = bookingStatusMeta(booking.status);
    rows.push({
      id: booking.id,
      kind: PAY_KIND.transport,
      hubOnly: false,
      title: transportTitle(booking),
      detail: meta?.label || booking.status,
      when: booking.createdAt,
      pay: resolvePay(PAY_KIND.transport, booking.id, booking),
      cancellation: cancellations.forKind(PAY_KIND.transport, booking.id),
      href: `/pet-owner/transport/${booking.id}`,
      chip: PAY_KIND_LABEL.transport,
    });
  });

  clinics.forEach((booking) => {
    if (!hasPaymentOnRecord(PAY_KIND.clinic, booking.id, ownerId)) return;
    if (isCovered(PAY_KIND.clinic, booking.id)) return;
    covered.add(refKey(PAY_KIND.clinic, booking.id));
    rows.push({
      id: booking.id,
      kind: PAY_KIND.clinic,
      hubOnly: false,
      title: clinicTitle(booking),
      detail: clinicDetail(booking),
      when: booking.date || booking.createdAt,
      pay: resolvePay(PAY_KIND.clinic, booking.id, booking),
      cancellation: cancellations.forKind(PAY_KIND.clinic, booking.id),
      href: '/pet-owner/booking',
      chip: PAY_KIND_LABEL.clinic,
    });
  });

  return rows.sort((a, b) => String(b.when).localeCompare(String(a.when)));
}

export function filterHistoryTab(rows, tab) {
  if (tab === 'all') return rows;
  if (tab === PAY_KIND.hub) return rows.filter((row) => row.hubOnly);
  return rows.filter((row) => row.kind === tab && !row.hubOnly);
}