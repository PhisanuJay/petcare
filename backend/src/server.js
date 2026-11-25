import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes/index.js';
import { config } from './config/index.js';
import { connectionLabel, getPool } from './db/mssql.js';
import { ensurePetTransportReady } from './modules/pet-transport/routes.js';

const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json({ limit: '9mb' }));

app.get('/health', async (_req, res) => {
  try {
    await getPool();
    res.json({
      ok: true,
      service: 'petcare-backend',
      database: connectionLabel(),
      engine: 'mssql',
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: 'petcare-backend',
      error: error.message || String(error),
    });
  }
});

registerRoutes(app);

async function start() {
  await ensurePetTransportReady();
  app.listen(PORT, () => {
    console.log(`PetCare backend listening on http://localhost:${PORT}`);
    console.log(`SQL Server: ${connectionLabel()}`);
  });
}

start().catch((error) => {
  console.error('Failed to start PetCare backend:', error);
  process.exit(1);
});
