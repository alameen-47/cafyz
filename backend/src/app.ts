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
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// ── Security ───────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN ?? '*',
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
app.use('/api/kds',          kdsRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/inventory',    inventoryRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/restaurants',  restaurantRoutes);

// ── Error handling ──────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
