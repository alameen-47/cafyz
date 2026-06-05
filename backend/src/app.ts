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
import inquiryRoutes     from './routes/inquiries.js';
import { requirePlan }   from './middleware/planGuard.js';
import { requireAuth }   from './middleware/auth.js';
import { requireActiveSubscription } from './middleware/subscriptionGuard.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
app.set('trust proxy', 1);
const isTestEnv = process.env.NODE_ENV === 'test';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 100000 : 500,
  standardHeaders: true,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 100000 : 25,
  standardHeaders: true,
  message: { error: 'Too many authentication attempts. Try again shortly.' },
});

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTestEnv ? 100000 : 20,
  standardHeaders: true,
  message: { error: 'Too many requests. Please try again later.' },
});

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
    const isNativeLocalhost =
      /^https?:\/\/localhost(?::\d+)?$/i.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin) ||
      /^capacitor:\/\/localhost$/i.test(origin) ||
      /^ionic:\/\/localhost$/i.test(origin);
    const ok =
      allowed.includes(origin) ||
      isNativeLocalhost ||
      /\.vercel\.app$/.test(origin) ||
      /^https:\/\/([a-z0-9-]+\.)?ametronyx\.com$/i.test(origin);
    cb(ok ? null : new Error(`CORS: ${origin} not allowed`), ok);
  },
  credentials: true,
}));
app.use(globalLimiter);

// ── Body parsing ────────────────────────────────────────────────────────────────
// Logo uploads store dithered PNG data URLs (up to ~3 MB).
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health ──────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Routes ──────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authLimiter, authRoutes);
app.use('/api/users',        requireAuth, requireActiveSubscription, userRoutes);
app.use('/api/menu',         requireAuth, requireActiveSubscription, menuRoutes);
app.use('/api/orders',       requireAuth, requireActiveSubscription, orderRoutes);
app.use('/api/tables',       requireAuth, requireActiveSubscription, tableRoutes);
app.use('/api/kds',          requireAuth, requireActiveSubscription, requirePlan('pro'),     kdsRoutes);
app.use('/api/reservations', requireAuth, requireActiveSubscription, requirePlan('premium'), reservationRoutes);
app.use('/api/inventory',    requireAuth, requireActiveSubscription, requirePlan('pro'),     inventoryRoutes);
app.use('/api/dashboard',    requireAuth, requireActiveSubscription, requirePlan('pro'),     dashboardRoutes);
app.use('/api/restaurants',  restaurantRoutes);
app.use('/api/licenses',     licenseRoutes);
app.use('/api/founder',      founderRoutes);
app.use('/api/inquiries',    inquiryLimiter, inquiryRoutes);

// ── Error handling ──────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
