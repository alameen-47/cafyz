# Android screenshots

Play Store assets — **captured and ready to upload.**

## Phone (`phone/`)

| File | Screen |
|------|--------|
| `01-dashboard.png` | Home / Dashboard |
| `02-pos.png` | Point of Sale |
| `03-orders.png` | Live Orders |
| `04-tables.png` | Table Map |
| `05-menu.png` | Menu |

Size: **1082×2426** (Pixel-class phone)

## 10" tablet (`tablet-10/`)

Same five screens at **1920×1200** (sidebar layout).

## Feature graphic

| File | Size |
|------|------|
| `feature-graphic.png` | 1024×500 |

## Re-capture

```bash
npm run capture:android-screenshots
```

Uses Playwright against production (`cafyz.ametronyx.com`) with the store reviewer account. Same UI as the Capacitor Android app.

**Emulator capture (optional):**
```bash
npm run cap:android:emulator   # in another terminal
bash scripts/capture-android-screenshots.sh
```

## Upload

Google Play Console → Store presence → Screenshots → drop files from `phone/` and `tablet-10/`.
