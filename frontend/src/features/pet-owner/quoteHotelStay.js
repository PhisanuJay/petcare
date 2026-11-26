import { HOTEL_STAY_PROMO } from '../../shared/data/homeContent.js';
import { stayNights } from './useHotelBookings.js';

export function quoteHotelStay({ checkIn, checkOut, lines, catalogById }) {
  const nights = stayNights(checkIn, checkOut);
  if (!nights || !lines?.length) return null;
  let subtotal = 0;
  const pricedLines = lines.map((line) => {
    const type = catalogById.get(line.roomTypeId);
    if (!type) return null;
    const units = Math.max(1, Number(line.units) || 1);
    const lineSubtotal = type.price * nights * units;
    subtotal += lineSubtotal;
    return { ...line, pricePerNight: type.price, lineSubtotal, units };
  });
  if (pricedLines.some((row) => !row)) return null;
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