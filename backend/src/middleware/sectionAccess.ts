import type { NextFunction, Response } from 'express';
import { getDb } from '../db.js';
import type { AuthRequest } from './auth.js';
import {
  hasScreenAccess,
  mergeRoleAccess,
  parseAccessJson,
  type ScreenId,
} from '../services/sectionAccess.js';

export function requireSectionAccess(screen: ScreenId) {
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
      const row = await getDb().execute({
        sql: 'SELECT role, access_json FROM users WHERE id=? AND restaurant_id=? LIMIT 1',
        args: [req.user.id, req.user.restaurant_id],
      });
      if (!row.rows.length) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const role = String(row.rows[0].role ?? req.user.role);
      const access = parseAccessJson(row.rows[0].access_json);
      const effective = mergeRoleAccess(role, access);
      const ok = hasScreenAccess(req.method, effective, screen);
      if (!ok) {
        res.status(403).json({
          error: `Access denied for ${screen} (${req.method.toUpperCase()})`,
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

