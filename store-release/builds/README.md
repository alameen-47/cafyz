# Build artifacts (staged into this folder by `scripts/stage-store-release.sh`)

Run any native build, then artifacts are copied here automatically:

```bash
npm run native:android          # → builds/android/Cafyz-android-debug.apk
npm run native:android:release  # → builds/android-release/Cafyz-android-release.aab (needs keystore)
npm run native:ios              # → builds/ios/archive/Cafyz.xcarchive (Xcode archive)
bash scripts/stage-store-release.sh  # manual re-stage
```

## Current files

| Path | What |
|------|------|
| `android/Cafyz-android-debug.apk` | Android debug install (sideload / internal test) |
| `android-release/Cafyz-android-release.aab` | Play Store upload (after `native:android:release`) |
| `ios/web-hosting/` | **iOS hosting bundle** — Capacitor web app copied from `cap-ios/App/App/public` |
| `ios/capacitor.config.json` | Runtime config baked into the iOS shell |
| `ios/archive/Cafyz.xcarchive` | Xcode archive — open in Xcode → Distribute App |
| `ios/archive/ExportOptions.plist` | App Store export template (also in `../ios/xcode/`) |
| `env.capacitor.example` | Production API URLs for native builds |
| `MANIFEST.json` | Machine-readable list of what was staged |

## iOS hosting bundle

The native iOS app does **not** load from Vercel. It hosts the built web UI locally:

- Source: `web-v2/dist` → synced to `cap-ios/App/App/public`
- Staged copy: `builds/ios/web-hosting/`

Rebuild after UI changes: `npm run cap:sync` then `bash scripts/stage-store-release.sh`.

## iOS App Store upload

1. Open `cap-ios/App/App.xcworkspace` in Xcode, or use the staged archive:
   `builds/ios/archive/Cafyz.xcarchive`
2. **Distribute App** → App Store Connect
3. Or CLI: `xcodebuild -exportArchive` with `ios/xcode/ExportOptions.plist`

IPA export may require App Store Connect API access; Xcode upload is the fallback.

## Android Play upload

Upload `builds/android-release/Cafyz-android-release.aab` after configuring `android/keystore.properties.example`.
