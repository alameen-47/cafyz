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

## Build outputs

| Platform | Command | Output |
|----------|---------|--------|
| iOS | Xcode → Archive | Upload to Connect |
| Android debug | `npm run native:android` | `../releases/Cafyz-android-debug.apk` |
| Android release | `npm run native:android:release` | `../releases/Cafyz-android-release.aab` |

See [builds/README.md](builds/README.md).

## Folder structure

```
store-release/
├── README.md              ← you are here
├── LINKS.md               ← all URLs, emails, portals
├── CHECKLIST.md           ← pre-submit checklist
├── demo-account.md        ← reviewer credentials template
├── assets/
│   └── app-icon-1024.png
├── builds/
│   └── README.md
├── ios/
│   ├── metadata.md
│   ├── launch-guide.md
│   └── screenshots/
│       ├── iphone-6.7/
│       └── ipad-12.9/
└── android/
    ├── metadata.md
    └── screenshots/
        ├── phone/
        └── tablet-10/
```

## Contacts

- Support: support@cafyz.com
- Billing / review: cafyzofficial@gmail.com
