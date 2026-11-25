import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes/index.js';
import { config } from './config/index.js';
import { dbPath } from './db/sqlite.js';
import { initTransportDb } from './modules/pet-transport/db.js';

const app = express();
const PORT = config.port;

app.use(cors());
<<<<<<< HEAD
app.use(express.json({ limit: '2mb' })); // pet photos are sent as data URLs
=======
app.use(express.json({ limit: '8mb' }));
>>>>>>> origin/Admin-transport

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'petcare-backend',
    sqlite: dbPath(),
  });
});

initTransportDb();
registerRoutes(app);

app.listen(PORT, () => {
  console.log(`PetCare backend listening on http://localhost:${PORT}`);
  console.log(`SQLite: ${dbPath()}`);
});
