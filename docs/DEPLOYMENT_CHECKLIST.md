# Deployment checklist

Last updated: July 2026

## Automated in codebase

- [x] `/privacy`, `/support`, `/terms` public pages (SPA routes)
- [x] Account deletion API (`DELETE /api/auth/account`) + Account Settings UI
- [x] iOS `NSPhotoLibraryUsageDescription` + `ITSAppUsesNonExemptEncryption`
- [x] iPad/tablet responsive layout (sidebar from 768px)
- [x] Android release AAB script (`npm run native:android:release` + `keystore.properties`)
- [x] `web-v2/.env.capacitor.example` for production native builds

## Before App Store submit (manual)

1. `cp web-v2/.env.capacitor.example web-v2/.env.capacitor`
2. `npm run cap:sync` → `cd cap-ios/App && pod install`
3. Create **demo reviewer account** in production
4. Capture **5 iPhone + 3 iPad** screenshots (logged in)
5. Xcode → **Product → Archive** → Upload to App Store Connect
6. Fill metadata from `app-store/metadata.md`
7. TestFlight on a real device

## Before Play Store submit (manual)

1. `cp cap-android/keystore.properties.example cap-android/keystore.properties`
2. Generate release keystore and fill properties
3. `npm run native:android:release` → `releases/Cafyz-android-release.aab`
4. Upload AAB to Play Console + complete Data Safety form

## Render dashboard (verify)

Set all vars from `backend/.env.example`, especially:

- `TURSO_URL`, `TURSO_AUTH_TOKEN`
- `FOUNDER_EMAIL`, `FOUNDER_PASSWORD`
- `RESEND_API_KEY`, `CLOUDINARY_*` (optional but recommended)

## After deploy

- Visit `https://cafyz.ametronyx.com/privacy` — should show policy, not login
- Test account deletion on a **test** restaurant only
