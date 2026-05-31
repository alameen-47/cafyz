# Cafyz native apps — Android, iOS, and desktop

Cafyz ships as **one React web app** wrapped for each platform. All features (POS, KDS, Menu, Reports, Staff, etc.) run in every build. Printing uses **native BLE on mobile** and **Web Bluetooth/USB on desktop**.

## Platform summary

| Platform | Technology | Printing | Download / install |
|----------|------------|----------|-------------------|
| **Android** | Capacitor (`cap-android/`) | Native BLE via `@capacitor-community/bluetooth-le` | `releases/Cafyz-android-debug.apk` after build |
| **iOS** | Capacitor (`cap-ios/`) | Native BLE (iPhone/iPad app) | Archive in Xcode → `.ipa` |
| **Windows / Mac / Linux** | Electron | Web Bluetooth + Web USB (Chromium) | `releases/desktop/` after `npm run desktop:pack` |
| **Browser / PWA** | Vite PWA | BT/USB on Android & desktop; AirPrint on iOS Safari | Install from https://cafyz.ametronyx.com |

## Prerequisites

- **Node.js 20+**
- **Android:** Android Studio, SDK, `JAVA_HOME` set
- **iOS:** Xcode 15+ (macOS only), CocoaPods (`pod install` in `cap-ios/App`)
- **Desktop:** `npm install electron electron-builder --save-dev` (first time only)

## Build everything

```bash
# From repo root
npm install
npm run native:build          # web bundle + Capacitor sync + Android APK + desktop (if electron installed)
```

### Android APK only

```bash
npm run native:android
# Output: releases/Cafyz-android-debug.apk
```

Install on device: enable “Install unknown apps”, copy APK, open to install.

For Play Store release, open Android Studio:

```bash
npm run cap:sync
npm run cap:android
# Build → Generate Signed Bundle / APK
```

### iOS app

```bash
npm run cap:sync
cd cap-ios/App && pod install && cd ../..
npm run cap:ios
# Xcode → Product → Archive → Distribute
```

**Info.plist** already needs Bluetooth usage strings — added automatically by the BLE plugin on sync.

### Desktop (PC software)

```bash
npm install electron electron-builder --save-dev   # once
npm run desktop:pack:mac      # macOS .dmg + .zip
npm run desktop:pack:win      # Windows installer + portable .exe
npm run desktop:pack:linux    # AppImage + .deb
```

Run without packaging (dev):

```bash
npm run desktop
```

The desktop app loads `https://cafyz.ametronyx.com` with full Chromium printing support.

Override URL:

```bash
CAFYZ_URL=https://your-domain.com npm run desktop
```

## Development workflow

```bash
npm run dev                   # local API + web (browser)
npm run web:build:native      # production bundle for Capacitor
npm run cap:sync              # copy web/dist into native projects
```

Live reload on device (optional):

```bash
npx cap run android -l --external
npx cap run ios -l --external
```

## Printing by platform

- **Android app:** POS → Connect Bluetooth → BLE thermal printers (Xprinter, Munbyn, etc.)
- **iOS app:** Same BLE flow via native plugin (Safari/WebView cannot do this)
- **Desktop app:** Bluetooth + USB thermal printers via built-in Chromium
- **iOS Safari (web only):** AirPrint / browser print — no ESC/POS Bluetooth

## Legacy React Native shell

The older `android/` and `ios/` folders (React Native WebView) still exist but **Capacitor is the recommended native path** (`cap-android/`, `cap-ios/`). Use Capacitor builds for store submission and BLE printing.

## API URL

Native builds bake `VITE_API_URL` at compile time from `web/.env.capacitor`. Change it before `npm run cap:sync` if your API host differs.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Android BLE scan empty | Enable Location + Bluetooth; pair printer in system settings |
| iOS “Bluetooth permission” | Allow when prompted; check Settings → Cafyz → Bluetooth |
| Desktop printer not listed | Use Chrome-based Electron; printer in pairing mode |
| White screen in native app | Run `npm run cap:sync` after `web:build:native` |
