# Cafyz — Store release hub

**Everything for App Store + Play Store is in this folder.**  
Copy `store-release/` to a USB drive, cloud folder, or zip it — it is self-contained.

## Start here

| File | What |
|------|------|
| [FILES.md](FILES.md) | Auto-generated inventory of every file |
| [LINKS.md](LINKS.md) | URLs, portals, emails |
| [CHECKLIST.md](CHECKLIST.md) | Pre-submit checklist |
| [demo-account.md](demo-account.md) | Reviewer login for Apple/Google |

## Builds (upload these)

| Platform | File |
|----------|------|
| **Play Store AAB** | [builds/android-release/Cafyz-android-release.aab](builds/android-release/Cafyz-android-release.aab) |
| Android debug APK | [builds/android/Cafyz-android-debug.apk](builds/android/Cafyz-android-debug.apk) |
| **iOS archive** | [builds/ios/archive/Cafyz.xcarchive](builds/ios/archive/Cafyz.xcarchive) |
| iOS web hosting | [builds/ios/web-hosting/](builds/ios/web-hosting/) |

## Screenshots

| Store | Folder |
|-------|--------|
| Google Play phone | [android/screenshots/phone/](android/screenshots/phone/) |
| Google Play tablet | [android/screenshots/tablet-10/](android/screenshots/tablet-10/) |
| Google feature graphic | [android/screenshots/feature-graphic.png](android/screenshots/feature-graphic.png) |
| App Store iPhone | [ios/screenshots/iphone-6.7/](ios/screenshots/iphone-6.7/) |
| App Store iPad | [ios/screenshots/ipad-12.9/](ios/screenshots/ipad-12.9/) |

## Metadata (copy-paste into consoles)

| Store | File |
|-------|------|
| App Store Connect | [ios/metadata.md](ios/metadata.md) |
| Play Console | [android/metadata.md](android/metadata.md) |

## Signing & config

| Item | Path |
|------|------|
| Android keystore | `android/signing/cafyz-release.keystore` |
| Keystore passwords | `android/signing/credentials.txt` |
| Gradle properties | `android/signing/keystore.properties` |
| Capacitor config | [config/capacitor.config.ts](config/capacitor.config.ts) |
| Native env | [config/env.capacitor.example](config/env.capacitor.example) |
| iOS export plist | [ios/xcode/ExportOptions.plist](ios/xcode/ExportOptions.plist) |
| App icon 1024² | [assets/app-icon-1024.png](assets/app-icon-1024.png) |

## Guides

- iOS launch: [ios/launch-guide.md](ios/launch-guide.md)
- Android signing: [android/SIGNING.md](android/SIGNING.md)
- Builds: [builds/README.md](builds/README.md)

## Refresh everything

```bash
npm run store:all
```

Or step by step: `npm run sync:store-release` · `npm run capture:android-screenshots` · `npm run capture:ios-screenshots`

## Live URLs

| Page | URL |
|------|-----|
| Web | https://cafyz.ametronyx.com |
| Privacy | https://cafyz.ametronyx.com/privacy |
| Support | https://cafyz.ametronyx.com/support |
| Account deletion | https://cafyz.ametronyx.com/support#account-deletion |
| API | https://cafyz.onrender.com |

## Folder tree

```
store-release/
├── FILES.md                 ← full file list
├── README.md
├── LINKS.md · CHECKLIST.md · demo-account.md
├── assets/app-icon-1024.png
├── config/                  ← capacitor + env
├── builds/
│   ├── android/             ← debug APK
│   ├── android-release/     ← Play AAB
│   └── ios/                 ← web-hosting, xcarchive
├── android/
│   ├── metadata.md · SIGNING.md
│   ├── signing/             ← keystore + passwords (local)
│   └── screenshots/
├── ios/
│   ├── metadata.md · launch-guide.md · xcode/
│   └── screenshots/
```

Canonical native projects (for rebuilding only): `../cap-ios/` · `../cap-android/`
