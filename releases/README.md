# Native app release artifacts

Build outputs are placed here by `npm run native:build`.

| File / folder | Platform | How to build |
|---------------|----------|--------------|
| `Cafyz-android-debug.apk` | Android | `npm run native:android` (requires JDK 21) |
| `desktop/` | macOS / Windows / Linux | `npm run desktop:pack:mac` etc. |
| iOS `.ipa` | iPhone / iPad | Xcode archive from `cap-ios/` — see [docs/NATIVE_APPS.md](../docs/NATIVE_APPS.md) |

Full instructions: [docs/NATIVE_APPS.md](../docs/NATIVE_APPS.md)
