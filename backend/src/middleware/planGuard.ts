import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { getDb } from '../db.js';

export type Plan = 'basic' | 'pro' | 'premium';

const PLAN_RANK: Record<string, number> = { basic: 1, pro: 2, premium: 3, starter: 1, growth: 2, enterprise: 3 };

export function requirePlan(minPlan: Plan) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    if (req.user.role === 'founder') { next(); return; }

    try {
      const row = await getDb().execute({ sql: 'SELECT plan FROM restaurants WHERE id=?', args: [req.user.restaurant_id] });
      const plan = String(row.rows[0]?.plan ?? 'basic');
      if ((PLAN_RANK[plan] ?? 0) < (PLAN_RANK[minPlan] ?? 99)) {
        res.status(403).json({ error: `This feature requires the ${minPlan} plan or higher.`, required_plan: minPlan, current_plan: plan });
        return;
      }
      next();
    } catch (e) { next(e); }
  };
}
