import type { NextFunction, Response } from 'express';
import { getDb } from '../db.js';
import type { AuthRequest } from './auth.js';
import {
  hasScreenAccess,
  mergeRoleAccess,
  parseAccessJson,
  type ScreenId,
} from '../services/sectionAccess.js';
import { cacheGet, cacheSet } from '../cache.js';

// Cache user role + access_json for 30 s — role changes are rare and propagate quickly enough.
const ACCESS_TTL = 30_000;

type AccessEntry = { role: string; accessJson: unknown };

/**
 * Gate a route group by section access. Accepts one OR MORE acceptable screens —
 * access is granted if the user's effective access satisfies ANY of them. This
 * lets an API surface be reached by multiple roles that legitimately use it
 * (e.g. orders are operated from both the POS screen and the Waiter screen),
 * while finer route-level `requireRole` still guards destructive/admin actions.
 */
export function requireSectionAccess(...screens: ScreenId[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.role === 'founder') {
      next();
      return;
    }

    try {
      const cacheKey = `access:${req.user.id}`;
      let entry = cacheGet<AccessEntry>(cacheKey);

      if (!entry) {
        const row = await getDb().execute({
          sql: 'SELECT role, access_json FROM users WHERE id=? AND restaurant_id=? LIMIT 1',
          args: [req.user.id, req.user.restaurant_id],
        });
        if (!row.rows.length) {
          res.status(404).json({ error: 'User not found' });
          return;
        }
        entry = { role: String(row.rows[0].role ?? req.user.role), accessJson: row.rows[0].access_json };
        cacheSet(cacheKey, entry, ACCESS_TTL);
      }

      const effective = mergeRoleAccess(entry.role, parseAccessJson(entry.accessJson));
      const ok = screens.some((screen) => hasScreenAccess(req.method, effective, screen));
      if (!ok) {
        res.status(403).json({
          error: `Access denied for ${screens.join('/')} (${req.method.toUpperCase()})`,
          code: 'SECTION_ACCESS_DENIED',
        });
        return;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

