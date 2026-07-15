# Cafyz — Store release hub

**Single folder for everything needed to ship Cafyz on the App Store and Google Play.**

All links, metadata, screenshots, checklists, and build references live here.  
Do not scatter store assets elsewhere — add new files under this tree.

## Quick links

| Resource | File |
|----------|------|
| **All URLs & portals** | [LINKS.md](LINKS.md) |
| **Master checklist** | [CHECKLIST.md](CHECKLIST.md) |
| **Demo reviewer account** | [demo-account.md](demo-account.md) |
| **App icon 1024×1024** | [assets/app-icon-1024.png](assets/app-icon-1024.png) |

## iOS (App Store)

| Resource | Path |
|----------|------|
| Copy-paste metadata | [ios/metadata.md](ios/metadata.md) |
| Step-by-step launch guide | [ios/launch-guide.md](ios/launch-guide.md) |
| Screenshots | [ios/screenshots/](ios/screenshots/) |
| Xcode project | `../cap-ios/` |

**Portal:** https://appstoreconnect.apple.com

## Android (Play Store)

| Resource | Path |
|----------|------|
| Copy-paste metadata | [android/metadata.md](android/metadata.md) |
| Screenshots | [android/screenshots/](android/screenshots/) |
| Signing template | `../cap-android/keystore.properties.example` |
| Gradle project | `../cap-android/` |

**Portal:** https://play.google.com/console

## Live URLs (paste in both stores)

| Page | URL |
|------|-----|
| Web app | https://cafyz.ametronyx.com |
| Privacy | https://cafyz.ametronyx.com/privacy |
| Support | https://cafyz.ametronyx.com/support |
| Terms | https://cafyz.ametronyx.com/terms |
| API | https://cafyz.onrender.com |

## Build outputs (in this folder)

| Platform | File |
|----------|------|
| Android debug APK | [builds/android/Cafyz-android-debug.apk](builds/android/Cafyz-android-debug.apk) |
| Android release AAB | [builds/android-release/](builds/android-release/) (after keystore setup) |
| **iOS web hosting** | [builds/ios/web-hosting/](builds/ios/web-hosting/) |
| **iOS Xcode archive** | [builds/ios/archive/Cafyz.xcarchive](builds/ios/archive/Cafyz.xcarchive) |
| iOS export template | [ios/xcode/ExportOptions.plist](ios/xcode/ExportOptions.plist) |

Re-stage after builds: `bash scripts/stage-store-release.sh` (runs automatically at end of `npm run native:*`).

See [builds/README.md](builds/README.md) and [builds/MANIFEST.json](builds/MANIFEST.json).

## Folder structure

```
store-release/
├── README.md
├── LINKS.md
├── CHECKLIST.md
├── demo-account.md
├── assets/app-icon-1024.png
├── builds/
│   ├── MANIFEST.json
│   ├── env.capacitor.example
│   ├── android/Cafyz-android-debug.apk
│   ├── android-release/          ← Play AAB (when built)
│   └── ios/
│       ├── web-hosting/          ← Capacitor bundled web UI
│       ├── capacitor.config.json
│       └── archive/Cafyz.xcarchive
├── ios/
│   ├── xcode/                    ← Info.plist, Podfile, ExportOptions.plist
│   ├── metadata.md
│   ├── launch-guide.md
│   └── screenshots/
└── android/
    ├── keystore.properties.example
    ├── metadata.md
    └── screenshots/
```

## Contacts

- Support: support@cafyz.com
- Billing / review: cafyzofficial@gmail.com
