import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'crypto';

const isTestEnv = process.env.NODE_ENV === 'test';

function keyFromIp(req: Request): string {
  return String(req.ip ?? req.socket.remoteAddress ?? 'unknown');
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim() || null;
  return null;
}

/**
 * Stable per-principal rate-limit key.
 *
 * Authenticated requests are bucketed per session token, NOT per IP. This is
 * critical because restaurants routinely run many devices (POS, KDS, tablets)
 * behind a single shared NAT / public IP — and on Render multiple tenants can
 * also egress from the same address. Keying the global limiter purely by IP
 * meant all those devices drained one bucket, so normal real-time polling
 * tripped 429s for legitimate users.
 *
 * We hash the token only to produce a short, stable key — signature
 * verification still happens later in requireAuth. Anonymous traffic falls
 * back to a per-IP key.
 */
function principalKey(req: Request): string {
  const token = bearerToken(req);
  if (token) {
    return 'u:' + createHash('sha1').update(token).digest('base64').slice(0, 27);
  }
  return 'ip:' + keyFromIp(req);
}

function authIdentifier(req: Request): string {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raw = String(
    body.email
      ?? body.phone
      ?? body.device_id
      ?? '',
  ).trim().toLowerCase();
  return raw || 'anon';
}

function limiterError(message: string) {
  return { error: message, code: 'RATE_LIMITED' };
}

// App-wide limiter. Authenticated sessions get a generous budget that
// comfortably covers real-time polling across multiple open panels/tabs
// (KDS list, dashboard stats, printer + notification sync); anonymous
// traffic keeps a tighter per-IP budget to deter public-endpoint abuse.
//
// Budgets are per 15 min. A single active device legitimately needs
// ~600–800 req/15min, so 6000 leaves wide head-room for power users while
// still stopping a runaway client.
const AUTHED_GLOBAL_MAX = 6000;
const ANON_GLOBAL_MAX = 400;

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req: Request) => {
    if (isTestEnv) return 1_000_000;
    return bearerToken(req) ? AUTHED_GLOBAL_MAX : ANON_GLOBAL_MAX;
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: principalKey,
  message: limiterError('Too many requests. Please retry shortly.'),
  skip: (req) => req.path === '/health',
});

export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 100000 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFromIp,
  skipSuccessfulRequests: true,
  message: limiterError('Too many authentication attempts from this network. Try again shortly.'),
});

export const authIdentityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 100000 : 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${keyFromIp(req)}:${authIdentifier(req)}`,
  skipSuccessfulRequests: true,
  message: limiterError('Too many attempts for this account or phone. Please wait and try again.'),
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isTestEnv ? 100000 : 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${keyFromIp(req)}:${authIdentifier(req)}`,
  message: limiterError('OTP rate limit reached. Wait a few minutes before requesting again.'),
});

export const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTestEnv ? 100000 : 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFromIp,
  message: limiterError('Too many trial requests from this network. Please try later.'),
});

// Write limiter is per-principal (per session) so a busy POS device gets its
// own 120/min budget instead of colliding with sibling devices on the same IP.
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTestEnv ? 100000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: principalKey,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: limiterError('Too many write requests. Slow down and retry.'),
});
