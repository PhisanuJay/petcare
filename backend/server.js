import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { readJSON, writeJSON } from './utils/db.js';
import { generateId } from './utils/helpers.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import costumeRoutes from './routes/costumes.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import masterDataRoutes from './routes/masterData.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import uploadRoutes from './routes/upload.js';
import favoriteRoutes from './routes/favorites.js';
import cartRoutes from './routes/cart.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const seedDefaultUsers = async () => {
  const users = readJSON('users.json');
  if (users.length > 0) return;

  const defaultUsers = [
    { name: 'แอดมิน KruyMo', email: 'admin@kruymo.com', password: 'admin123', role: 'admin' },
    { name: 'พนักงาน KruyMo', email: 'staff@kruymo.com', password: 'staff123', role: 'staff' },
    { name: 'ลูกค้าทดสอบ', email: 'customer@test.com', password: 'customer123', role: 'customer' },
  ];

  for (const u of defaultUsers) {
    users.push({
      id: generateId(),
      name: u.name,
      email: u.email,
      password: await bcrypt.hash(u.password, 10),
      phone: '0812345678',
      role: u.role,
      avatar: null,
      createdAt: new Date().toISOString(),
    });
  }
  writeJSON('users.json', users);
  console.log('✅ Seeded default users (admin@kruymo.com / staff@kruymo.com / customer@test.com)');
};

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/costumes', costumeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', masterDataRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/cart', cartRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', name: 'KruyMo API' }));

seedDefaultUsers().then(() => {
  app.listen(PORT, () => {
    console.log(`🎓 KruyMo API running at http://localhost:${PORT}`);
  });
});
