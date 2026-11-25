import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes/index.js';
import { config } from './config/index.js';
import { dbPath } from './db/sqlite.js';

const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json({ limit: '9mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'petcare-backend',
    sqlite: dbPath(),
  });
});

registerRoutes(app);

app.listen(PORT, () => {
  console.log(`PetCare backend listening on http://localhost:${PORT}`);
  console.log(`SQLite: ${dbPath()}`);
});
