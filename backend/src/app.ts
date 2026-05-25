import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes        from './routes/auth.js';
import userRoutes        from './routes/users.js';
import menuRoutes        from './routes/menu.js';
import orderRoutes       from './routes/orders.js';
import tableRoutes       from './routes/tables.js';
import kdsRoutes         from './routes/kds.js';
import reservationRoutes from './routes/reservations.js';
import inventoryRoutes   from './routes/inventory.js';
import dashboardRoutes   from './routes/dashboard.js';
import restaurantRoutes  from './routes/restaurants.js';
import licenseRoutes     from './routes/licenses.js';
import founderRoutes     from './routes/founder.js';
import { requirePlan }   from './middleware/planGuard.js';
import { requireAuth }   from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// ── Security ───────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  // Comma-separated origins in ALLOWED_ORIGIN (production).
  // Also accepts *.vercel.app preview URLs automatically.
  // In dev, allow Vite ports.
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / server-to-server
    const allowed = process.env.ALLOWED_ORIGIN
      ? process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim())
      : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'];
    const ok = allowed.includes(origin) || /\.vercel\.app$/.test(origin);
    cb(ok ? null : new Error(`CORS: ${origin} not allowed`), ok);
  },
  credentials: true,
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true }));

// ── Body parsing ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health ──────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Routes ──────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/menu',         menuRoutes);
app.use('/api/orders',       orderRoutes);
app.use('/api/tables',       tableRoutes);
app.use('/api/kds',          requireAuth, requirePlan('pro'),     kdsRoutes);
app.use('/api/reservations', requireAuth, requirePlan('premium'), reservationRoutes);
app.use('/api/inventory',    requireAuth, requirePlan('pro'),     inventoryRoutes);
app.use('/api/dashboard',    requireAuth, requirePlan('pro'),     dashboardRoutes);
app.use('/api/restaurants',  restaurantRoutes);
app.use('/api/licenses',     licenseRoutes);
app.use('/api/founder',      founderRoutes);

// ── Error handling ──────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
