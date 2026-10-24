import { createPublicKey, type JsonWebKey } from 'node:crypto';
import jwt from 'jsonwebtoken';

// ── Sign in with Apple (identity token verification) ───────────────────────────
// The iOS app asks the system for an Apple credential and hands us the signed
// identity token. As with Google, the token is only trusted after its signature
// is checked against Apple's rotating JWKS — never the email a client claims.
// Apple publishes no verifier library, so the JWKS fetch and key selection are
// done here; everything cryptographic is left to jsonwebtoken.

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

/** Apple's keys rotate rarely; an hour of caching keeps sign-in off the network. */
const JWKS_TTL_MS = 60 * 60 * 1000;

/**
 * The `aud` of an Apple identity token is the client the user signed in with:
 * the app's bundle ID on iOS, and a Services ID on the web. Both are accepted
 * when configured, so the same endpoint serves either.
 */
function audiences(): string[] {
  return [process.env.APPLE_CLIENT_ID_IOS, process.env.APPLE_CLIENT_ID_WEB]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v);
}

export function isAppleAuthConfigured(): boolean {
  return audiences().length > 0;
}

/** The bundle ID the iOS app signs in with; clients read it from /apple/config. */
export function appleIosClientId(): string {
  return process.env.APPLE_CLIENT_ID_IOS?.trim() ?? '';
}

interface AppleJwk extends JsonWebKey {
  kid: string;
  alg: string;
}

let cache: { keys: AppleJwk[]; fetchedAt: number } | null = null;

async function fetchJwks(): Promise<AppleJwk[]> {
  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error(`Apple JWKS request failed: ${res.status}`);
  const body = (await res.json()) as { keys?: AppleJwk[] };
  if (!body.keys?.length) throw new Error('Apple JWKS response had no keys');
  cache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

/**
 * The signing key for `kid`. A kid we have never seen means Apple rotated since
 * the cache was filled, so the JWKS is refetched once before giving up — without
 * that, a rotation would break sign-in for a full TTL.
 */
async function signingKey(kid: string): Promise<AppleJwk> {
  const fresh = cache && Date.now() - cache.fetchedAt < JWKS_TTL_MS;
  let keys = fresh ? cache!.keys : await fetchJwks();

  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk && fresh) {
    keys = await fetchJwks();
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error('Apple identity token was signed with an unknown key');
  return jwk;
}

export interface AppleIdentity {
  email: string;
  /** Apple's stable per-app user id. Kept because a relay email can change. */
  subject: string;
  /** True when the address is an @privaterelay.appleid.com forwarding address. */
  isPrivateRelay: boolean;
}

/**
 * Verify an Apple identity token and return the identity it proves.
 * Throws if the signature, issuer, audience or expiry is wrong, or if Apple has
 * not verified the address.
 */
export async function verifyAppleIdToken(idToken: string): Promise<AppleIdentity> {
  const [firstAud, ...otherAuds] = audiences();
  if (!firstAud) throw new Error('Sign in with Apple is not configured');

  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid) throw new Error('Apple identity token has no key id');

  const jwk = await signingKey(kid);
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });

  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: [firstAud, ...otherAuds],
  }) as jwt.JwtPayload;

  // Apple sends email_verified as a boolean on some paths and the string "true"
  // on others; both mean verified, and anything else must not be trusted.
  const verified = payload.email_verified;
  if (verified !== true && verified !== 'true') {
    throw new Error('This Apple account has no verified email address');
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email) throw new Error('Apple identity token contained no email address');

  const subject = payload.sub?.trim();
  if (!subject) throw new Error('Apple identity token contained no subject');

  const privateRelay = payload.is_private_email;
  return {
    email,
    subject,
    isPrivateRelay: privateRelay === true || privateRelay === 'true',
  };
}

/** Test seam: drop the cached JWKS so a test can control what the next fetch returns. */
export function __resetAppleJwksCache(): void {
  cache = null;
}
