/** Mirrors frontend HOTEL_STAY_PROMO */
export const HOTEL_STAY_PROMO = {
  minNights: 3,
  percent: 10,
  until: '2026-12-31',
};

export function stayNights(checkIn, checkOut) {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const nights = Math.round((end - start) / 86400000);
  return nights > 0 ? nights : null;
}

export function quoteStayLines({ checkIn, checkOut, lines, catalogById }) {
  const nights = stayNights(checkIn, checkOut);
  if (!nights || !Array.isArray(lines) || !lines.length) return null;
  let subtotal = 0;
  const pricedLines = lines.map((line) => {
    const type = catalogById.get(line.roomTypeId);
    if (!type) throw new Error('ประเภทห้องไม่ถูกต้อง');
    const units = Math.max(1, Number(line.units) || 1);
    const lineSubtotal = type.price * nights * units;
    subtotal += lineSubtotal;
    return {
      roomTypeId: line.roomTypeId,
      units,
      pricePerNight: type.price,
      lineSubtotal,
      petIds: line.petIds || [],
    };
  });
  const promoApplied = nights >= HOTEL_STAY_PROMO.minNights && checkIn <= HOTEL_STAY_PROMO.until;
  const discount = promoApplied ? Math.round((subtotal * HOTEL_STAY_PROMO.percent) / 100) : 0;
  return {
    nights,
    subtotal,
    discount,
    total: subtotal - discount,
    promoApplied,
    lines: pricedLines,
  };
}