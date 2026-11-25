import { Router } from 'express';
import { readJSON, findById, addItem, updateById, deleteById } from '../utils/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateId, logActivity, countBookedUnits } from '../utils/helpers.js';

const router = Router();

const enrichCostume = (costume) => {
  const universities = readJSON('universities.json');
  const faculties = readJSON('faculties.json');
  const sizes = readJSON('sizes.json');
  return {
    ...costume,
    university: universities.find((u) => u.id === costume.universityId),
    faculty: faculties.find((f) => f.id === costume.facultyId),
    size: sizes.find((s) => s.id === costume.sizeId),
  };
};

router.get('/', (req, res) => {
  let costumes = readJSON('costumes.json');
  const { universityId, facultyId, sizeId, degreeLevel } = req.query;
  if (universityId) costumes = costumes.filter((c) => c.universityId === universityId);
  if (facultyId) costumes = costumes.filter((c) => c.facultyId === facultyId);
  if (sizeId) costumes = costumes.filter((c) => c.sizeId === sizeId);
  if (degreeLevel) costumes = costumes.filter((c) => c.degreeLevel === degreeLevel);
  res.json(costumes.map(enrichCostume));
});

router.get('/:id/availability', (req, res) => {
  const { startDate, endDate, degreeLevel } = req.query;
  const costume = findById('costumes.json', req.params.id);
  if (!costume) return res.status(404).json({ error: 'ไม่พบชุดครุย' });
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'กรุณาเลือกวันเริ่มเช่าและวันคืนชุด' });
  }
  if (new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ error: 'วันคืนชุดต้องไม่ก่อนวันเริ่มเช่า' });
  }

  const degree = degreeLevel || 'bachelor';
  if (!['bachelor', 'master', 'doctoral'].includes(degree)) {
    return res.status(400).json({ error: 'ระดับปริญญาไม่ถูกต้อง' });
  }

  const inventory = readJSON('inventory.json', []);
  const bookings = readJSON('bookings.json', []);
  const sizes = readJSON('sizes.json');

  const options = sizes.map((size) => {
    const inv = inventory.find((i) => (
      i.costumeId === costume.id
      && i.sizeId === size.id
      && i.degreeLevel === degree
    ));
    const total = inv?.quantity || 0;
    const booked = countBookedUnits(bookings, {
      costumeId: costume.id,
      sizeId: size.id,
      degreeLevel: degree,
      startDate,
      endDate,
    });
    const available = Math.max(0, total - booked);
    return {
      sizeId: size.id,
      label: size.label,
      description: size.description,
      heightMin: size.heightMin,
      heightMax: size.heightMax,
      total,
      booked,
      available,
      inStock: available > 0,
    };
  });

  res.json({
    costumeId: costume.id,
    startDate,
    endDate,
    degreeLevel: degree,
    options,
    availableCount: options.filter((o) => o.inStock).length,
  });
});

router.get('/:id', (req, res) => {
  const costume = findById('costumes.json', req.params.id);
  if (!costume) return res.status(404).json({ error: 'ไม่พบชุดครุย' });
  res.json(enrichCostume(costume));
});

router.post('/', authenticate, authorize('admin'), (req, res) => {
  const costume = {
    id: generateId(),
    ...req.body,
    images: req.body.images || [],
    createdAt: new Date().toISOString(),
  };
  addItem('costumes.json', costume);
  logActivity('create_costume', `เพิ่มชุดครุย ${costume.name}`, req.user.id);
  res.status(201).json(enrichCostume(costume));
});

router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const updated = updateById('costumes.json', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'ไม่พบชุดครุย' });
  logActivity('update_costume', `แก้ไขชุดครุย ${updated.name}`, req.user.id);
  res.json(enrichCostume(updated));
});

router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const costume = findById('costumes.json', req.params.id);
  if (!costume) return res.status(404).json({ error: 'ไม่พบชุดครุย' });
  deleteById('costumes.json', req.params.id);
  logActivity('delete_costume', `ลบชุดครุย ${costume.name}`, req.user.id);
  res.json({ message: 'ลบสำเร็จ' });
});

export default router;
