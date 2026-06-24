import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { buildNotificationsFeed } from '../services/notificationsFeed.js';
import { pushConfigured } from '../services/push.js';
import { uid } from '../utils.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const uid_ = req.user!.id;
    const role = req.user!.role;
    const feed = await buildNotificationsFeed(rid, uid_, role);
    res.json({
      items: feed.items,
      unread: feed.unread,
      pushEnabled: pushConfigured(),
    });
  } catch (e) { next(e); }
});

const ReadSchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(50),
});

// POST /api/notifications/read
router.post('/read', async (req: AuthRequest, res, next) => {
  try {
    const { keys } = ReadSchema.parse(req.body);
    const userId = req.user!.id;
    const db = getDb();
    await db.batch(
      keys.map(key => ({
        sql: `INSERT INTO notification_reads(user_id, notification_key, read_at)
              VALUES(?,?,datetime('now'))
              ON CONFLICT(user_id, notification_key) DO UPDATE SET read_at=datetime('now')`,
        args: [userId, key],
      })),
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req: AuthRequest, res, next) => {
  try {
    const rid = req.user!.restaurant_id;
    const userId = req.user!.id;
    const role = req.user!.role;
    const feed = await buildNotificationsFeed(rid, userId, role);
    if (!feed.items.length) { res.json({ ok: true }); return; }
    const db = getDb();
    await db.batch(
      feed.items.map(n => ({
        sql: `INSERT INTO notification_reads(user_id, notification_key, read_at)
              VALUES(?,?,datetime('now'))
              ON CONFLICT(user_id, notification_key) DO UPDATE SET read_at=datetime('now')`,
        args: [userId, n.key],
      })),
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

const TokenSchema = z.object({
  token: z.string().min(8).max(512),
  platform: z.enum(['android', 'ios', 'web']),
});

// PUT /api/notifications/push-token
router.put('/push-token', async (req: AuthRequest, res, next) => {
  try {
    const { token, platform } = TokenSchema.parse(req.body);
    const userId = req.user!.id;
    const rid = req.user!.restaurant_id;
    const id = uid();
    await getDb().execute({
      sql: `INSERT INTO push_device_tokens(id, user_id, restaurant_id, token, platform, updated_at)
            VALUES(?,?,?,?,?,datetime('now'))
            ON CONFLICT(user_id, token) DO UPDATE SET
              platform=excluded.platform,
              restaurant_id=excluded.restaurant_id,
              updated_at=datetime('now')`,
      args: [id, userId, rid, token, platform],
    });
    res.json({ ok: true, registered: true, pushEnabled: pushConfigured() });
  } catch (e) { next(e); }
});

// DELETE /api/notifications/push-token
router.delete('/push-token', async (req: AuthRequest, res, next) => {
  try {
    const token = z.object({ token: z.string().min(8) }).parse(req.body).token;
    await getDb().execute({
      sql: 'DELETE FROM push_device_tokens WHERE user_id=? AND token=?',
      args: [req.user!.id, token],
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
