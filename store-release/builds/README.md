# Build artifacts

Native binaries are written to `releases/` at the repo root.  
Store marketing assets stay in `store-release/`.

## Outputs

| Platform | Command | File |
|----------|---------|------|
| Android debug | `npm run native:android` | `releases/Cafyz-android-debug.apk` |
| Android release (Play) | `npm run native:android:release` | `releases/Cafyz-android-release.aab` |
| iOS | Xcode → Archive → Export | Upload via App Store Connect (no local .ipa in repo) |

## Before building

```bash
cp web-v2/.env.capacitor.example web-v2/.env.capacitor
npm run cap:sync
```

Android release also needs `cap-android/keystore.properties` (see `keystore.properties.example`).

## After building

- Copy screenshot captures to `../ios/screenshots/` or `../android/screenshots/`
- Note build number in `../CHECKLIST.md`
- Do not commit `.aab` / `.apk` unless intentionally versioning a release tag
