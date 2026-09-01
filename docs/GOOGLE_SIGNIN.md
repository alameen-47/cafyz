# Google Sign-In

One backend endpoint serves all three platforms. The client obtains a Google ID
token; `POST /api/auth/google` verifies it against Google's JWKS and maps the
proven email to an existing Cafyz account.

**Google sign-in never creates an account.** A user only exists inside a
restaurant, so new restaurants still come through the trial/inquiry flow. An
unknown address gets `404 GOOGLE_NO_ACCOUNT`.

## Behaviour

| Situation | Result |
|---|---|
| Email matches one active account | Signed in |
| Email matches several restaurants | `200 { status: 'choose_account', accounts, selection_token }` — user picks, client calls `/api/auth/google/select` |
| Email matches no account | `404 GOOGLE_NO_ACCOUNT` |
| Account status is `off` | Excluded; treated as no account |
| Google reports `email_verified: false` | `401` — refused |
| No client IDs configured | `503 GOOGLE_DISABLED`, and clients hide the button |

The selection token is a 5-minute JWT bound to the *verified* email. `/select`
re-resolves the user from that signed email, so a client cannot substitute a
different account by editing `restaurant_id`.

## 1. Create the OAuth clients

Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID**.
Create one per platform — each issues tokens with its own `aud`, and the API
accepts any that are configured.

**Web application**
- Authorised JavaScript origins: `https://cafyz.ametronyx.com`, `http://localhost:5173`
- → `GOOGLE_CLIENT_ID`

**Android**
- Package name: see `cap-android/app/build.gradle` (`applicationId`)
- SHA-1: from the keystore that signs the build you ship —

  ```bash
  keytool -list -v -keystore <your-release.keystore> -alias <alias>
  ```

  Add the debug keystore's SHA-1 as a second Android client if you want Google
  sign-in to work in debug builds too.
- → `GOOGLE_CLIENT_ID_ANDROID`

**iOS**
- Bundle ID: see `cap-ios/App/App.xcodeproj`
- → `GOOGLE_CLIENT_ID_IOS`

## 2. Set the API environment

On Render (and `backend/.env` locally):

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_ID_IOS=xxxxx.apps.googleusercontent.com
```

Leave them unset to disable Google sign-in everywhere — clients ask
`/api/auth/google/config` at load and hide the button, so enabling or disabling
it needs **no client rebuild and no new store release**.

## 3. Native project setup

The web needs nothing beyond step 2. Native shells use
`@capgo/capacitor-social-login` (already a dependency).

```bash
npm run cap:sync
```

**iOS** — add the reversed iOS client ID as a URL scheme in
`cap-ios/App/App/Info.plist` (Google returns to the app through it):

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <!-- GOOGLE_CLIENT_ID_IOS reversed, e.g. com.googleusercontent.apps.1234-abcd -->
      <string>com.googleusercontent.apps.YOUR-IOS-CLIENT-ID</string>
    </array>
  </dict>
</array>
```

**Android** — no manifest edit needed; the plugin reads the web client ID passed
to `SocialLogin.initialize()`. The SHA-1 registered in step 1 must match the
keystore that signs the APK/AAB you install, or sign-in fails with a
developer-error at the picker.

Then rebuild and ship: `npm run native:android:release` / `npm run native:ios`.

## Where the code lives

| Piece | File |
|---|---|
| Token verification | `backend/src/services/googleAuth.ts` |
| Endpoints | `backend/src/routes/auth.ts` (`/google`, `/google/select`, `/google/config`) |
| Platform-specific token capture | `web-v2/src/services/googleSignIn.ts` |
| Button + account chooser | `web-v2/src/app/components/LoginScreen.tsx` |
| Session wiring | `web-v2/src/app/auth.tsx` |
| Tests | `backend/src/__tests__/googleAuth.test.ts` |
