import { randomInt } from 'crypto';

/** Cryptographically secure 6-digit OTP. */
export function secureOtp6(): string {
  return String(randomInt(100_000, 1_000_000));
}

/** Cryptographically secure 4-digit PIN. */
export function securePin4(): string {
  return String(randomInt(1000, 10_000));
}
