import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[ERROR]', err.message);
  const isProd = process.env.NODE_ENV === 'production';

  if (err instanceof ZodError) {
    if (isProd) {
      res.status(400).json({ error: 'Validation error' });
    } else {
      res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    return;
  }

  const explicitStatus = Number((err as { status?: number }).status);
  if (explicitStatus >= 400 && explicitStatus < 600) {
    res.status(explicitStatus).json({ error: err.message || 'Request failed' });
    return;
  }

  const code = String((err as NodeJS.ErrnoException & { code?: string }).code ?? '');
  const status = code.includes('SQLITE_CONSTRAINT_UNIQUE') ? 409
               : code.includes('SQLITE_CONSTRAINT') ? 400
               : 500;

  const message =
    status >= 500 && isProd
      ? 'Internal server error'
      : (err.message ?? 'Internal server error');
  res.status(status).json({ error: message });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' });
}
