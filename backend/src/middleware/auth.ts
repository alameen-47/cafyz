import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload { id: string; role: string; email: string; }
export interface AuthRequest extends Request { user?: AuthPayload; }

export const JWT_SECRET = process.env.JWT_SECRET ?? 'cafyz-dev-secret-change-in-prod';
export const JWT_EXPIRES = '24h';

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid token' });
    return;
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}
