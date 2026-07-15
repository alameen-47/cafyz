# Cafyz native apps — Android and iOS (Capacitor + web-v2)

Cafyz ships as **one UI** (`web-v2/`) wrapped for web and mobile. All features (POS, KDS, Menu, Reports, Staff, etc.) run in every build.

## Platform summary

| Platform | Technology | Printing |
|----------|------------|----------|
| **Web** | `web-v2/` (Vite) | Web Bluetooth/USB in Chromium |
| **Android** | Capacitor (`cap-android/`) | Native BLE |
| **iOS** | Capacitor (`cap-ios/`) | Native BLE |

## Prerequisites

- **Node.js 20+**
- **Android:** Android Studio, SDK, JDK 21 (`JAVA_HOME`)
- **iOS:** Xcode 15+, CocoaPods (`pod install` in `cap-ios/App`)

## Build

```bash
npm install
npm run native:android    # → releases/Cafyz-android-debug.apk
npm run native:build      # sync + Android APK (pass `ios` for Xcode hint)
```

### Android APK

```bash
npm run cap:sync
npm run native:android
```

Install: copy `releases/Cafyz-android-debug.apk` to device, or use:

```bash
npm run cap:android:usb       # USB device + live reload
npm run cap:android:emulator  # emulator + live reload
```

### iOS

```bash
npm run cap:sync
cd cap-ios/App && pod install && cd ../..
npm run cap:ios
# Xcode → Product → Archive
```

**App Store submission:** [store-release/](../store-release/) — metadata, screenshots, links, checklist.

## Development

```bash
npm run dev              # API :4000 + web-v2 :5173
npm run build:native     # web-v2 bundle for Capacitor
npm run cap:sync         # copy web-v2/dist into cap-android / cap-ios
```

## API URL

Native builds bake `VITE_API_URL` from `web-v2/.env.capacitor` at build time. Edit before `npm run cap:sync` if needed.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| White screen (emulator) | Run `npm run dev` first; use `npm run cap:android:emulator` (uses `10.0.2.2`) |
| White screen (USB) | `npm run cap:android:usb`; ensure `npm run api` is running |
| Android BLE scan empty | Enable Location + Bluetooth |
| iOS Bluetooth permission | Settings → Cafyz → Bluetooth |
