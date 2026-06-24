import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

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
import supportRoutes     from './routes/support.js';
import searchRoutes      from './routes/search.js';
import { requirePlan }   from './middleware/planGuard.js';
import { requireAuth }   from './middleware/auth.js';
import { requireActiveSubscription } from './middleware/subscriptionGuard.js';
import { requireSectionAccess } from './middleware/sectionAccess.js';
import {
  authIdentityLimiter,
  authIpLimiter,
  globalLimiter,
  inquiryLimiter,
  mutationLimiter,
  otpLimiter,
  publicLimiter,
} from './middleware/rateLimits.js';
import publicRoutes from './routes/public.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

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
// ── Public (no-auth) routes — customer QR menu. Mounted before the global
//    limiter so diners on a shared restaurant WiFi aren't blocked by the anon cap.
app.use('/api/public', publicLimiter, publicRoutes);

app.use(globalLimiter);

// ── Compression ─────────────────────────────────────────────────────────────────
// Gzip responses > 1 KB. Placed before body-parsing so the stream is compressed
// at the Express layer before it hits the network.
app.use(compression({ threshold: 1024 }));

// ── Body parsing ────────────────────────────────────────────────────────────────
// Logo uploads store dithered PNG data URLs (up to ~3 MB).
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health ──────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Routes ──────────────────────────────────────────────────────────────────────
app.use('/api/auth/login',      authIpLimiter, authIdentityLimiter);
app.use('/api/auth/pin',        authIpLimiter, authIdentityLimiter);
app.use('/api/auth/request-otp', authIpLimiter, authIdentityLimiter, otpLimiter);
app.use('/api/auth/verify-otp',  authIpLimiter, authIdentityLimiter, otpLimiter);
app.use('/api/auth',             authRoutes);
app.use('/api/users',            mutationLimiter, requireAuth, requireActiveSubscription, requireSectionAccess('roles'), userRoutes);
app.use('/api/menu',             mutationLimiter, requireAuth, requireActiveSubscription, requireSectionAccess('menu'), menuRoutes);
app.use('/api/orders',           mutationLimiter, requireAuth, requireActiveSubscription, requireSectionAccess('pos', 'waiter'), orderRoutes);
app.use('/api/tables',           mutationLimiter, requireAuth, requireActiveSubscription, requireSectionAccess('tableSetup', 'waiter', 'pos'), tableRoutes);
app.use('/api/kds',              mutationLimiter, requireAuth, requireActiveSubscription, requireSectionAccess('kds'), requirePlan('pro'),     kdsRoutes);
app.use('/api/reservations',     mutationLimiter, requireAuth, requireActiveSubscription, requireSectionAccess('manager'), requirePlan('premium'), reservationRoutes);
app.use('/api/inventory',        mutationLimiter, requireAuth, requireActiveSubscription, requireSectionAccess('inventory'), requirePlan('pro'),     inventoryRoutes);
app.use('/api/dashboard',        requireAuth, requireActiveSubscription, requireSectionAccess('manager', 'reports'), dashboardRoutes);
app.use('/api/restaurants',      mutationLimiter, restaurantRoutes);
app.use('/api/licenses',         mutationLimiter, requireAuth, requireSectionAccess('license'), licenseRoutes);
app.use('/api/founder',          mutationLimiter, founderRoutes);
app.use('/api/inquiries',    inquiryLimiter, inquiryRoutes);
app.use('/api/support',          mutationLimiter, supportRoutes);
app.use('/api/search',           requireAuth, requireActiveSubscription, searchRoutes);

// ── Error handling ──────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
