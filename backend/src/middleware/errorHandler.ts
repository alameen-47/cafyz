import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[ERROR]', err.message);

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: err.errors });
    return;
  }

  const code = String((err as NodeJS.ErrnoException & { code?: string }).code ?? '');
  const status = code.includes('SQLITE_CONSTRAINT_UNIQUE') ? 409
               : code.includes('SQLITE_CONSTRAINT') ? 400
               : 500;

  res.status(status).json({ error: err.message ?? 'Internal server error' });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' });
}
