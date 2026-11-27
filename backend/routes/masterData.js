import { Router } from 'express';
import { readJSON, addItem, updateById, deleteById, findById } from '../utils/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateId, logActivity } from '../utils/helpers.js';

const router = Router();

const crudRoutes = (filename, label) => {
  const r = Router();

  r.get('/', (req, res) => {
    let items = readJSON(filename);
    if (req.query.universityId) {
      items = items.filter((i) => i.universityId === req.query.universityId);
    }
    res.json(items);
  });

  r.post('/', authenticate, authorize('admin'), (req, res) => {
    const item = { id: generateId(), ...req.body };
    addItem(filename, item);
    logActivity(`create_${label}`, `เพิ่ม ${label} ${item.name || item.label}`, req.user.id);
    res.status(201).json(item);
  });

  r.put('/:id', authenticate, authorize('admin'), (req, res) => {
    const updated = updateById(filename, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
    res.json(updated);
  });

  r.delete('/:id', authenticate, authorize('admin'), (req, res) => {
    if (!deleteById(filename, req.params.id)) {
      return res.status(404).json({ error: 'ไม่พบข้อมูล' });
    }
    res.json({ message: 'ลบสำเร็จ' });
  });

  return r;
};

const router2 = Router();
router2.use('/universities', crudRoutes('universities.json', 'university'));
router2.use('/faculties', crudRoutes('faculties.json', 'faculty'));
router2.use('/sizes', crudRoutes('sizes.json', 'size'));

export default router2;
