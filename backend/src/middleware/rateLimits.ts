import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

const isTestEnv = process.env.NODE_ENV === 'test';

function keyFromIp(req: Request): string {
  return String(req.ip ?? req.socket.remoteAddress ?? 'unknown');
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

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 100000 : 350,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFromIp,
  message: limiterError('Too many requests from this network. Please retry shortly.'),
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

export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTestEnv ? 100000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFromIp,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: limiterError('Too many write requests. Slow down and retry.'),
});
