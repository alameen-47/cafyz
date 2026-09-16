import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { authApi, loadGoogleIdentity } from './api';

// ── Google sign-in: one entry point, two implementations ───────────────────────
// Native shells use the Capacitor plugin (system account picker); the web uses
// Google Identity Services. Both end with a Google ID token that only the API
// verifies — the client never decides who the user is.

let nativeReady = false;

/** Native needs the platform client IDs; the API serves them so no rebuild is
 *  required to configure or disable Google sign-in on already-published apps. */
async function ensureNativeInitialised(cfg: GoogleConfig): Promise<void> {
  if (nativeReady) return;
  await SocialLogin.initialize({
    google: {
      // The WEB client id is the "server client id" both platforms send to
      // Google so the ID token comes back with an aud our API accepts.
      webClientId: cfg.clientId,
      ...(cfg.iosClientId ? { iOSClientId: cfg.iosClientId } : {}),
    },
  });
  nativeReady = true;
}

/**
 * Native: open the system account picker and resolve with a Google ID token,
 * or null if the user dismissed it.
 *
 * Web does NOT use this — see renderGoogleButton below.
 */
export async function getNativeGoogleIdToken(cfg: GoogleConfig): Promise<string | null> {
  await ensureNativeInitialised(cfg);
  // No `scopes`: the plugin already asks for openid/email/profile, and on
  // Android any `scopes` option is rejected unless MainActivity implements
  // ModifiedMainActivityForSocialLoginPlugin.
  const res = await SocialLogin.login({
    provider: 'google',
    options: {},
  });
  // The response is a union: offline mode returns only a serverAuthCode. We
  // stay in the default online mode, which is the variant carrying idToken.
  const result = res.result;
  return 'idToken' in result ? result.idToken ?? null : null;
}

/** True when the native picker failed because the user closed it. */
export function isGoogleCancel(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === 'USER_CANCELLED' || /cancel/i.test(err?.message ?? '');
}

/** True when this build is running inside an Android/iOS shell. */
export function isNativeShell(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Web: mount Google's sign-in trigger over `el`.
 *
 * Two constraints pull against each other here:
 *
 *  - `google.accounts.id.prompt()` (One Tap) cannot be used behind our own
 *    button: browsers skip it for reasons outside our control, and a skipped
 *    One Tap looks like a dead button.
 *  - `renderButton()` is reliable, but it draws Google's own markup inline in
 *    our DOM — we cannot restyle it, its text ignores the app's language, and
 *    our i18n walker crawls it.
 *
 * So we render Google's button into an overlay pinned across `el` at zero
 * opacity, and let the caller draw the visible button underneath. Clicks land
 * on Google's real button, while the user sees our design in their language.
 * The visible button must still follow Google's branding guidelines.
 *
 * Returns false if Google's script could not be loaded.
 */
export async function mountGoogleTrigger(
  el: HTMLElement,
  cfg: GoogleConfig,
  onCredential: (idToken: string) => void,
): Promise<boolean> {
  const ready = await loadGoogleIdentity();
  if (!ready) return false;

  const google = (window as unknown as {
    google: {
      accounts: {
        id: {
          initialize: (o: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }).google;

  google.accounts.id.initialize({
    client_id: cfg.clientId,
    callback: (r: { credential?: string }) => { if (r.credential) onCredential(r.credential); },
  });

  el.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  // Google's markup must not be translated by the app's DOM-walking i18n.
  overlay.setAttribute('translate', 'no');
  overlay.dataset.i18nSkip = 'true';
  overlay.style.cssText =
    'position:absolute;inset:0;opacity:0;overflow:hidden;display:flex;justify-content:center';
  el.appendChild(overlay);

  const width = Math.min(400, Math.max(200, el.clientWidth || 320));
  google.accounts.id.renderButton(overlay, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'center',
    width,
  });

  // Google sizes its button to `width` but its own height; stretch the overlay's
  // hit area so every pixel of the visible button is clickable.
  const rendered = overlay.firstElementChild as HTMLElement | null;
  if (rendered) {
    rendered.style.width = '100%';
    rendered.style.height = '100%';
  }
  return true;
}

export interface GoogleConfig {
  enabled: boolean;
  clientId: string;
  iosClientId: string;
}

/** Ask the API whether Google sign-in is on, and which client IDs to use. */
export async function googleSignInConfig(): Promise<GoogleConfig> {
  try {
    const cfg = await authApi.googleConfig();
    // iOS cannot sign in without its own client ID (the plugin never sets up
    // Google, and the SDK needs that ID's URL scheme), so hide the button there
    // rather than show one that fails.
    const iosMissingClient = Capacitor.getPlatform() === 'ios' && !cfg.ios_client_id;
    return {
      enabled: cfg.enabled && !!cfg.client_id && !iosMissingClient,
      clientId: cfg.client_id,
      iosClientId: cfg.ios_client_id ?? '',
    };
  } catch {
    return { enabled: false, clientId: '', iosClientId: '' };
  }
}
