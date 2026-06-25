import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';
import { cacheGet, cacheSet } from '../cache.js';

export interface AuthPayload { id: string; role: string; email: string; restaurant_id: string; }
export interface AuthRequest extends Request { user?: AuthPayload; }

const DEFAULT_DEV_SECRET = 'cafyz-dev-secret-change-in-prod';
const configuredSecret = process.env.JWT_SECRET?.trim();
if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret === DEFAULT_DEV_SECRET)) {
  throw new Error('JWT_SECRET must be set to a strong secret in production');
}
export const JWT_SECRET = configuredSecret || DEFAULT_DEV_SECRET;
export const JWT_EXPIRES = '24h';

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid token' });
    return;
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
    return;
  }

  const userId = req.user.id;
  const cached = cacheGet<{ status: string }>(`user:status:${userId}`);
  if (cached) {
    if (cached.status === 'off') {
      res.status(403).json({ error: 'This user is currently inactive. Contact your manager.' });
      return;
    }
    next();
    return;
  }

  try {
    const row = await getDb().execute({
      sql: 'SELECT status FROM users WHERE id=? LIMIT 1',
      args: [userId],
    });
    if (!row.rows.length) {
      res.status(401).json({ error: 'Token expired or invalid' });
      return;
    }
    const status = String(row.rows[0].status ?? 'active');
    cacheSet(`user:status:${userId}`, { status }, 30_000);
    if (status === 'off') {
      res.status(403).json({ error: 'This user is currently inactive. Contact your manager.' });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
