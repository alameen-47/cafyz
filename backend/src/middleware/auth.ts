import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';
import { cacheGet, cacheSet, cacheDel } from '../cache.js';
import { tokenVersionFromRow } from '../services/tokenVersion.js';

export interface AuthPayload { id: string; role: string; email: string; restaurant_id: string; tv?: number; }
export interface AuthRequest extends Request { user?: AuthPayload; }

const DEFAULT_DEV_SECRET = 'cafyz-dev-secret-change-in-prod';
const configuredSecret = process.env.JWT_SECRET?.trim();
if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret === DEFAULT_DEV_SECRET)) {
  throw new Error('JWT_SECRET must be set to a strong secret in production');
}
export const JWT_SECRET = configuredSecret || DEFAULT_DEV_SECRET;
export const JWT_EXPIRES = '24h';

const JWT_VERIFY_OPTS: jwt.VerifyOptions = { algorithms: ['HS256'] };

export function signToken(payload: AuthPayload) {
  return jwt.sign(
    { ...payload, tv: payload.tv ?? 0 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES, algorithm: 'HS256' },
  );
}

export function signTokenForUser(user: Record<string, unknown>): string {
  return signToken({
    id: String(user.id),
    role: String(user.role),
    email: String(user.email),
    restaurant_id: String(user.restaurant_id),
    tv: tokenVersionFromRow(user),
  });
}

type LiveUser = { status: string; role: string; restaurant_id: string; email: string; token_version: number };

async function loadLiveUser(userId: string): Promise<LiveUser | null> {
  const cached = cacheGet<LiveUser>(`user:auth:${userId}`);
  if (cached) return cached;

  const row = await getDb().execute({
    sql: `SELECT status, role, restaurant_id, email, token_version FROM users WHERE id=? LIMIT 1`,
    args: [userId],
  });
  if (!row.rows.length) return null;

  const r = row.rows[0] as Record<string, unknown>;
  const live: LiveUser = {
    status: String(r.status ?? 'active'),
    role: String(r.role ?? ''),
    restaurant_id: String(r.restaurant_id ?? ''),
    email: String(r.email ?? ''),
    token_version: tokenVersionFromRow(r),
  };
  cacheSet(`user:auth:${userId}`, live, 30_000);
  cacheSet(`user:status:${userId}`, { status: live.status }, 30_000);
  return live;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid token' });
    return;
  }

  let decoded: AuthPayload & { tv?: number };
  try {
    decoded = jwt.verify(header.slice(7), JWT_SECRET, JWT_VERIFY_OPTS) as AuthPayload & { tv?: number };
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
    return;
  }

  try {
    const live = await loadLiveUser(decoded.id);
    if (!live) {
      res.status(401).json({ error: 'Token expired or invalid' });
      return;
    }
    if ((decoded.tv ?? 0) !== live.token_version) {
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }
    if (live.status === 'off') {
      res.status(403).json({ error: 'This user is currently inactive. Contact your manager.' });
      return;
    }

    req.user = {
      id: decoded.id,
      role: live.role,
      email: live.email,
      restaurant_id: live.restaurant_id,
      tv: live.token_version,
    };
    next();
  } catch (e) {
    next(e);
  }
}

/** Clear cached auth snapshot after user record changes. */
export function invalidateUserAuthCache(userId: string): void {
  cacheDel(`user:auth:${userId}`);
  cacheDel(`user:status:${userId}`);
}
