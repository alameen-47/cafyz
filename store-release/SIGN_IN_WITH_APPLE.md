# Sign in with Apple — what shipped, and what you must do

Added 24 Oct 2026 so Cafyz build 1.0 (4) can answer Guideline 4.3 the way
FitCore Plus did: with a build that gained real Apple-platform integration,
not a version bump.

**Status 24 Oct, 14:19:** steps 1–4 below are done — licence accepted, App ID
capability added by automatic signing, `APPLE_CLIENT_ID_IOS` live on Render,
build 1.0 (4) uploaded, and at ~14:40 swapped into the submission in place of
build 3 — Cafyz is *Waiting for Review* on build 4. Simulator smoke test
passed; a full sign-in on a real device (step 5) was not done.

## What is in the code

| Piece | File |
|---|---|
| Apple identity-token verification (JWKS, signature, iss, aud, exp) | `backend/src/services/appleAuth.ts` |
| `/api/auth/apple`, `/apple/config`, `/apple/signup`, `/apple/select` | `backend/src/routes/auth.ts` |
| Client service (system sheet, name capture) | `web-v2/src/services/appleSignIn.ts` |
| Button + wiring | `web-v2/src/app/components/LoginScreen.tsx` |
| Entitlement | `cap-ios/App/App/App.entitlements` |

The Google and Apple flows are now one shared path: once a provider proves an
address, the choose-restaurant and start-a-trial outcomes are identical. The
`purpose` claim still names the provider, so a token minted for one cannot be
replayed against the other — there is a test for exactly that.

Verified here: backend suite **229 passing** (26 files, 11 of them new Apple
tests covering a forged signature, wrong audience, wrong issuer, expiry,
unverified email, key rotation and cross-provider replay); `vite build` clean;
entitlements and project file both pass `plutil -lint`; the built bundle in
`cap-ios/App/App/public` contains the Apple code.

**Not verified here:** nothing iOS was compiled. Xcode's licence has not been
accepted on this machine, so `xcodebuild` refuses to run.

## What you must do

### 1. Accept the Xcode licence (needs your password)

```bash
sudo xcodebuild -license accept
```

### 2. Enable the capability on the App ID

developer.apple.com → Certificates, Identifiers & Profiles → Identifiers →
`com.cafyz.app` → tick **Sign in with Apple** → Save.

Without this the archive fails to sign: the entitlement is in the build but not
in the provisioning profile.

### 3. Set the backend env var on Render

The service is named `cafyz` in the dashboard (it serves cafyz.onrender.com),
not `cafyz-api` as `render.yaml` says — it was created by hand. → Environment:

```
APPLE_CLIENT_ID_IOS=com.cafyz.app
```

Until this is set, `/api/auth/apple/config` returns `enabled: false` and the
button stays hidden — by design, so a half-configured deploy shows nothing
rather than a broken button. Verify after the redeploy:

```bash
curl -s https://cafyz.onrender.com/api/auth/apple/config
```

Expect `{"enabled":true,"client_id":"com.cafyz.app",...}`.

### 4. Archive and upload

Build number is already bumped to **4** (TestFlight's highest for Cafyz was 3,
so there is no collision — the mistake that made Coorg land on 6).

Open `cap-ios/App/App.xcworkspace` in Xcode → Product → Archive → Distribute.
Xcode will show the Sign in with Apple capability once step 2 is done.

### 5. Test the button on a device before submitting

The sheet cannot be exercised in this session. Check: the button appears on the
login screen on iOS, the sheet opens, and signing in with an Apple ID whose
email matches an existing Cafyz user lands in the app. Hide My Email works too —
the relay address is a verified address as far as the API is concerned.

## Still not done

- **Keychain sessions.** `web-v2/src/utils/safeStorage.ts` mirrors the session
  into Capacitor Preferences, which on iOS is UserDefaults, not the Keychain.
  Moving it needs a small native plugin, and writing native code that cannot be
  compiled here would be guesswork — left out deliberately.
- The entitlements file is wired in via `CODE_SIGN_ENTITLEMENTS` but has no
  `PBXFileReference`, so it will not appear in Xcode's file navigator. The build
  uses it regardless; add it from Xcode if you want to see it listed.
