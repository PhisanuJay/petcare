import { Router } from 'express';
import { readJSON, addItem, findById, writeJSON } from '../utils/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateId } from '../utils/helpers.js';

const router = Router();

const enrichFavorite = (fav) => {
  const costumes = readJSON('costumes.json');
  const universities = readJSON('universities.json');
  const faculties = readJSON('faculties.json');
  const costume = costumes.find((c) => c.id === fav.costumeId);
  if (!costume) return { ...fav, costume: null };
  return {
    ...fav,
    costume: {
      ...costume,
      university: universities.find((u) => u.id === costume.universityId),
      faculty: faculties.find((f) => f.id === costume.facultyId),
    },
  };
};

router.get('/', authenticate, authorize('customer'), (req, res) => {
  const favorites = readJSON('favorites.json', [])
    .filter((f) => f.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(enrichFavorite)
    .filter((f) => f.costume);
  res.json(favorites);
});

router.get('/ids', authenticate, authorize('customer'), (req, res) => {
  const ids = readJSON('favorites.json', [])
    .filter((f) => f.userId === req.user.id)
    .map((f) => f.costumeId);
  res.json(ids);
});

router.post('/', authenticate, authorize('customer'), (req, res) => {
  const { costumeId } = req.body;
  if (!costumeId) return res.status(400).json({ error: 'กรุณาเลือกรหัสชุดครุย' });

  const costume = findById('costumes.json', costumeId);
  if (!costume) return res.status(404).json({ error: 'ไม่พบชุดครุย' });

  const favorites = readJSON('favorites.json', []);
  const existing = favorites.find((f) => f.userId === req.user.id && f.costumeId === costumeId);
  if (existing) {
    return res.json({ ...enrichFavorite(existing), alreadyExists: true });
  }

  const fav = addItem('favorites.json', {
    id: generateId(),
    userId: req.user.id,
    costumeId,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(enrichFavorite(fav));
});

router.post('/toggle', authenticate, authorize('customer'), (req, res) => {
  const { costumeId } = req.body;
  if (!costumeId) return res.status(400).json({ error: 'กรุณาเลือกรหัสชุดครุย' });

  const costume = findById('costumes.json', costumeId);
  if (!costume) return res.status(404).json({ error: 'ไม่พบชุดครุย' });

  const favorites = readJSON('favorites.json', []);
  const index = favorites.findIndex((f) => f.userId === req.user.id && f.costumeId === costumeId);

  if (index >= 0) {
    favorites.splice(index, 1);
    writeJSON('favorites.json', favorites);
    return res.json({ costumeId, favorited: false });
  }

  const fav = {
    id: generateId(),
    userId: req.user.id,
    costumeId,
    createdAt: new Date().toISOString(),
  };
  favorites.push(fav);
  writeJSON('favorites.json', favorites);
  res.status(201).json({ costumeId, favorited: true });
});

router.delete('/:costumeId', authenticate, authorize('customer'), (req, res) => {
  const favorites = readJSON('favorites.json', []);
  const filtered = favorites.filter(
    (f) => !(f.userId === req.user.id && f.costumeId === req.params.costumeId)
  );
  if (filtered.length === favorites.length) {
    return res.status(404).json({ error: 'ไม่พบในรายการโปรด' });
  }
  writeJSON('favorites.json', filtered);
  res.json({ message: 'ลบออกจากรายการโปรดแล้ว', costumeId: req.params.costumeId });
});

export default router;
