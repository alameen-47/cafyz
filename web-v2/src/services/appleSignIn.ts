import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { authApi } from './api';

// ── Sign in with Apple ─────────────────────────────────────────────────────────
// iOS only. The system sheet returns a signed identity token which only the API
// verifies; the client never decides who the user is. Apple hands over the
// user's name exactly once — on the very first authorization for this app — so
// it is passed along when present and never required.

export interface AppleConfig {
  enabled: boolean;
  /** The bundle ID the token's `aud` will carry. Informational on iOS. */
  clientId: string;
  trialDays: number;
}

let initialised = false;

async function ensureInitialised(): Promise<void> {
  if (initialised) return;
  // iOS uses the native ASAuthorization sheet, which takes its client from the
  // app's own Sign in with Apple entitlement — no client ID to pass here.
  await SocialLogin.initialize({ apple: {} });
  initialised = true;
}

/** Ask the API whether Sign in with Apple is switched on, so no rebuild is needed to toggle it. */
export async function appleSignInConfig(): Promise<AppleConfig | null> {
  try {
    const res = await authApi.appleConfig();
    return {
      enabled: res.enabled === true,
      clientId: String(res.client_id ?? ''),
      trialDays: Number(res.trial_days ?? 0),
    };
  } catch {
    return null;
  }
}

export interface AppleCredential {
  idToken: string;
  /** Present only on the first authorization; empty afterwards. */
  name: string;
}

/**
 * Open the system Sign in with Apple sheet.
 * Resolves with the credential, or null if the user dismissed the sheet.
 */
export async function getAppleCredential(): Promise<AppleCredential | null> {
  await ensureInitialised();
  const res = await SocialLogin.login({ provider: 'apple', options: { scopes: ['name', 'email'] } });

  const result = res.result as {
    idToken?: string | null;
    profile?: { givenName?: string | null; familyName?: string | null };
  };
  if (!result.idToken) return null;

  const name = [result.profile?.givenName, result.profile?.familyName]
    .filter((p): p is string => !!p?.trim())
    .join(' ')
    .trim();

  return { idToken: result.idToken, name };
}

/** True when the sheet closed because the user dismissed it, rather than failing. */
export function isAppleCancel(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === 'USER_CANCELLED' || /cancel/i.test(err?.message ?? '');
}

/**
 * Sign in with Apple is offered on iOS only. On Android it would be a web
 * redirect with no advantage over Google, and on the web the button would need
 * a Services ID that this deployment does not have.
 */
export function isAppleSignInAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
}
