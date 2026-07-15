# Android screenshots

Save captures here before uploading to Google Play Console.

## Required assets

| Asset | Size | File |
|-------|------|------|
| Phone screenshots | min 320px short side | `phone/01-*.png` |
| 7" tablet (optional) | 1200 × 1920 recommended | `tablet-10/01-*.png` |
| **Feature graphic** | **1024 × 500** | `feature-graphic.png` (create) |
| Hi-res icon | 512 × 512 | use `../assets/app-icon-1024.png` (resize) |

## Suggested screens

1. POS
2. KDS
3. Menu
4. Dashboard
5. Tables

## Capture

```bash
npm run cap:sync
npm run cap:android:emulator   # or USB device

adb -s <device> exec-out screencap -p > store-release/android/screenshots/phone/01-pos.png
```

Or use Android Studio → Logcat / Device Manager → Screenshot.

## Current files

| Folder | Status |
|--------|--------|
| `phone/` | Empty — add 2–8 screenshots |
| `tablet-10/` | Empty — add if listing tablets |
| `feature-graphic.png` | Not created yet |
