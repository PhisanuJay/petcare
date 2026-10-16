import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'petcare-backend' });
});

registerRoutes(app);

app.listen(PORT, () => {
  console.log(`PetCare backend listening on http://localhost:${PORT}`);
});
