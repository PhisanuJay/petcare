import { Router } from 'express';
import { readJSON, addItem, findById, updateById, deleteById, writeJSON } from '../utils/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  generateId,
  calculateRentalPrice,
  countBookedUnits,
  logActivity,
  createNotification,
  notifyStaff,
  normalizeDeliveryAddress,
  validateDeliveryAddress,
} from '../utils/helpers.js';

const router = Router();

const DEGREE_LABELS = {
  bachelor: 'ปริญญาตรี',
  master: 'ปริญญาโท',
  doctoral: 'ปริญญาเอก',
};

const enrichCartItem = (item) => {
  const costumes = readJSON('costumes.json');
  const sizes = readJSON('sizes.json');
  const universities = readJSON('universities.json');
  const faculties = readJSON('faculties.json');
  const costume = costumes.find((c) => c.id === item.costumeId);
  const size = sizes.find((s) => s.id === item.sizeId);

  let pricing = null;
  if (costume && item.startDate && item.endDate) {
    pricing = calculateRentalPrice(costume, item.startDate, item.endDate);
  }

  return {
    ...item,
    size,
    degreeLabel: DEGREE_LABELS[item.degreeLevel] || item.degreeLevel,
    pricing,
    costume: costume
      ? {
          ...costume,
          university: universities.find((u) => u.id === costume.universityId),
          faculty: faculties.find((f) => f.id === costume.facultyId),
        }
      : null,
  };
};

const validateCartPayload = ({ costumeId, startDate, endDate, sizeId, degreeLevel }, userId, excludeCartId = null) => {
  const costume = findById('costumes.json', costumeId);
  if (!costume) return { error: 'ไม่พบชุดครุย', status: 404 };
  if (!startDate || !endDate) return { error: 'กรุณาเลือกวันจอง', status: 400 };
  if (new Date(endDate) < new Date(startDate)) {
    return { error: 'วันคืนชุดต้องไม่ก่อนวันเริ่มเช่า', status: 400 };
  }
  if (!sizeId) return { error: 'กรุณาเลือกไซส์', status: 400 };
  if (!degreeLevel || !['bachelor', 'master', 'doctoral'].includes(degreeLevel)) {
    return { error: 'ระดับปริญญาไม่ถูกต้อง', status: 400 };
  }

  const size = findById('sizes.json', sizeId);
  if (!size) return { error: 'ไซส์ไม่ถูกต้อง', status: 400 };

  const inventory = readJSON('inventory.json', []);
  const inv = inventory.find((i) => (
    i.costumeId === costumeId
    && i.sizeId === sizeId
    && i.degreeLevel === degreeLevel
  ));
  const totalQty = inv?.quantity || 0;
  const bookings = readJSON('bookings.json', []);
  const booked = countBookedUnits(bookings, {
    costumeId,
    sizeId,
    degreeLevel,
    startDate,
    endDate,
  });

  // Count same slots already held in this user's cart (and others don't block reservation, just warn availability)
  const cart = readJSON('cart.json', []);
  const cartHeld = cart.filter((c) => (
    c.id !== excludeCartId
    && c.costumeId === costumeId
    && c.sizeId === sizeId
    && c.degreeLevel === degreeLevel
    && !(new Date(c.endDate) < new Date(startDate) || new Date(c.startDate) > new Date(endDate))
  )).length;

  const available = totalQty - booked - cartHeld;
  if (available <= 0) {
    return {
      error: `ไซส์ ${size.label} ระดับ${DEGREE_LABELS[degreeLevel]} ในช่วงวันนี้ถูกจองครบแล้ว`,
      status: 400,
    };
  }

  // Prevent exact duplicate in same user's cart
  const duplicate = cart.find((c) => (
    c.userId === userId
    && c.id !== excludeCartId
    && c.costumeId === costumeId
    && c.sizeId === sizeId
    && c.degreeLevel === degreeLevel
    && c.startDate === startDate
    && c.endDate === endDate
  ));
  if (duplicate) {
    return { error: 'รายการนี้มีอยู่ในตะกร้าแล้ว', status: 400 };
  }

  return { costume, size };
};

const createBookingFromCartItem = (item, userId, bookings) => {
  const costume = findById('costumes.json', item.costumeId);
  if (!costume) throw new Error('ไม่พบชุดครุย');

  const size = findById('sizes.json', item.sizeId);
  if (!size) throw new Error('ไซส์ไม่ถูกต้อง');

  const inventory = readJSON('inventory.json', []);
  const inv = inventory.find((i) => (
    i.costumeId === item.costumeId
    && i.sizeId === item.sizeId
    && i.degreeLevel === item.degreeLevel
  ));
  const totalQty = inv?.quantity || 0;
  const booked = countBookedUnits(bookings, {
    costumeId: item.costumeId,
    sizeId: item.sizeId,
    degreeLevel: item.degreeLevel,
    startDate: item.startDate,
    endDate: item.endDate,
  });
  if (totalQty - booked <= 0) {
    throw new Error(`ไซส์ ${size.label} ของ ${costume.name} เต็มในช่วงวันที่เลือก`);
  }

  const pricing = calculateRentalPrice(costume, item.startDate, item.endDate);
  return {
    id: generateId(),
    userId,
    costumeId: item.costumeId,
    sizeId: item.sizeId,
    degreeLevel: item.degreeLevel,
    startDate: item.startDate,
    endDate: item.endDate,
    status: 'payment_pending',
    rentalPrice: pricing.rentalPrice,
    deposit: pricing.deposit,
    totalPrice: pricing.total,
    days: pricing.days,
    rejectReason: null,
    prepChecklist: { gown: false, cap: false, sash: false, accessories: false },
    pickupConfirmedAt: null,
    returnImages: [],
    penaltyAmount: 0,
    penaltyReason: null,
    refundAmount: null,
    deliveryAddress: item.deliveryAddress || null,
    messenger: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

router.get('/', authenticate, authorize('customer'), (req, res) => {
  const items = readJSON('cart.json', [])
    .filter((c) => c.userId === req.user.id)
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    .map(enrichCartItem)
    .filter((c) => c.costume);
  res.json(items);
});

router.get('/count', authenticate, authorize('customer'), (req, res) => {
  const count = readJSON('cart.json', []).filter((c) => c.userId === req.user.id).length;
  res.json({ count });
});

router.post('/', authenticate, authorize('customer'), (req, res) => {
  const { costumeId, startDate, endDate, sizeId, degreeLevel } = req.body;
  const result = validateCartPayload(
    { costumeId, startDate, endDate, sizeId, degreeLevel },
    req.user.id
  );
  if (result.error) return res.status(result.status).json({ error: result.error });

  const item = addItem('cart.json', {
    id: generateId(),
    userId: req.user.id,
    costumeId,
    startDate,
    endDate,
    sizeId,
    degreeLevel,
    addedAt: new Date().toISOString(),
  });
  res.status(201).json(enrichCartItem(item));
});

router.patch('/:id', authenticate, authorize('customer'), (req, res) => {
  const existing = findById('cart.json', req.params.id);
  if (!existing || existing.userId !== req.user.id) {
    return res.status(404).json({ error: 'ไม่พบรายการในตะกร้า' });
  }

  const payload = {
    costumeId: existing.costumeId,
    startDate: req.body.startDate ?? existing.startDate,
    endDate: req.body.endDate ?? existing.endDate,
    sizeId: req.body.sizeId ?? existing.sizeId,
    degreeLevel: req.body.degreeLevel ?? existing.degreeLevel,
  };
  const result = validateCartPayload(payload, req.user.id, existing.id);
  if (result.error) return res.status(result.status).json({ error: result.error });

  const updated = updateById('cart.json', existing.id, payload);
  res.json(enrichCartItem(updated));
});

router.delete('/:id', authenticate, authorize('customer'), (req, res) => {
  const existing = findById('cart.json', req.params.id);
  if (!existing || existing.userId !== req.user.id) {
    return res.status(404).json({ error: 'ไม่พบรายการในตะกร้า' });
  }
  deleteById('cart.json', req.params.id);
  res.json({ message: 'ลบออกจากตะกร้าแล้ว' });
});

router.delete('/', authenticate, authorize('customer'), (req, res) => {
  const cart = readJSON('cart.json', []);
  writeJSON('cart.json', cart.filter((c) => c.userId !== req.user.id));
  res.json({ message: 'ล้างตะกร้าแล้ว' });
});

router.post('/checkout', authenticate, authorize('customer'), (req, res) => {
  const cart = readJSON('cart.json', []);
  const myItems = cart.filter((c) => c.userId === req.user.id);
  if (myItems.length === 0) {
    return res.status(400).json({ error: 'ตะกร้าว่าง กรุณาเพิ่มชุดครุยก่อน' });
  }

  const deliveryAddress = normalizeDeliveryAddress(req.body.deliveryAddress);
  const addrError = validateDeliveryAddress(deliveryAddress);
  if (addrError) {
    return res.status(400).json({ error: addrError });
  }

  const bookings = readJSON('bookings.json', []);
  const created = [];
  const errors = [];

  for (const item of myItems) {
    try {
      const booking = createBookingFromCartItem(
        { ...item, deliveryAddress },
        req.user.id,
        [...bookings, ...created]
      );
      created.push(booking);
    } catch (err) {
      errors.push({
        cartId: item.id,
        costumeId: item.costumeId,
        error: err.message,
      });
    }
  }

  if (created.length === 0) {
    return res.status(400).json({
      error: errors[0]?.error || 'ไม่สามารถสร้างการจองได้',
      errors,
    });
  }

  writeJSON('bookings.json', [...bookings, ...created]);

  // Remove cart items that were successfully booked
  const remaining = cart.filter((c) => {
    if (c.userId !== req.user.id) return true;
    const wasBooked = created.some((b) => (
      b.costumeId === c.costumeId
      && b.sizeId === c.sizeId
      && b.startDate === c.startDate
      && b.endDate === c.endDate
      && b.degreeLevel === c.degreeLevel
    ));
    return !wasBooked;
  });
  writeJSON('cart.json', remaining);

  for (const booking of created) {
    createNotification(
      req.user.id,
      'booking_success',
      'การจองของคุณสำเร็จแล้ว กรุณาชำระเงินภายใน 24 ชั่วโมง'
    );
    logActivity('booking_created_from_cart', `จองจากตะกร้า ${booking.id}`, req.user.id);
  }
  if (created.length > 0) {
    notifyStaff('new_booking', `มีจองใหม่จากตะกร้า ${created.length} รายการ — รอชำระเงิน`);
  }

  res.status(201).json({
    bookings: created,
    errors,
    message: errors.length
      ? `สร้างการจองได้ ${created.length} รายการ มีบางรายการที่ไม่สำเร็จ`
      : `สร้างการจองสำเร็จ ${created.length} รายการ`,
  });
});

export default router;
