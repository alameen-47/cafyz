import { OAuth2Client } from 'google-auth-library';

// ── Google Sign-In (ID token verification) ──────────────────────────────────────
// The client (web GIS, or the Capacitor plugin on Android/iOS) performs the OAuth
// dance and hands us a signed ID token. We only ever trust the token after
// verifying its signature against Google's rotating JWKS — never the email a
// client claims. Verification is delegated to Google's own library rather than
// hand-rolled, since a subtle mistake here is an authentication bypass.

/**
 * Each platform gets its own OAuth client in Google Cloud, so an ID token's
 * `aud` differs by where the user signed in. All configured IDs are accepted.
 */
function audiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_CLIENT_ID_IOS,
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v);
}

export function isGoogleAuthConfigured(): boolean {
  return audiences().length > 0;
}

/** The web client ID initialises the browser GIS button, and doubles as the
 *  "server client ID" the Android/iOS plugin needs to request an ID token. */
export function googleWebClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
}

/** iOS additionally needs its own client ID to open the system sign-in sheet. */
export function googleIosClientId(): string {
  return process.env.GOOGLE_CLIENT_ID_IOS?.trim() ?? '';
}

const client = new OAuth2Client();

export interface GoogleIdentity {
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Verify a Google ID token and return the identity it proves.
 * Throws if the signature, issuer, audience or expiry is wrong, or if Google
 * has not verified the address — an unverified email would let anyone register
 * a Google account against someone else's address and sign in as them.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const auds = audiences();
  if (!auds.length) throw new Error('Google sign-in is not configured');

  const ticket = await client.verifyIdToken({ idToken, audience: auds });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('Google token payload missing');

  if (payload.email_verified !== true) {
    throw new Error('This Google account has no verified email address');
  }
  const email = payload.email?.trim().toLowerCase();
  if (!email) throw new Error('Google token contained no email address');

  return { email, name: payload.name, picture: payload.picture };
}
