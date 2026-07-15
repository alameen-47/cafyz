# App Store screenshots

## Required sizes (2026)

Apple scales from the largest size you provide, but upload these for best results:

| Device slot | Resolution (portrait) | Simulator to use |
|-------------|----------------------|------------------|
| **iPhone 6.7"** (required) | **1290 × 2796** | iPhone 17 Pro Max, iPhone 16 Pro Max, iPhone 15 Pro Max |
| iPhone 6.5" (optional) | 1284 × 2778 | iPhone 14 Plus |
| **iPad 12.9"** (required — app supports iPad) | **2048 × 2732** | iPad Pro 13" / 12.9" |

You need **3–10 screenshots per device class**. Apple recommends 5–8 showing key features.

## Suggested screens

Capture these flows (log in with demo data first):

| # | Screen | Why |
|---|--------|-----|
| 1 | Login / splash | First impression |
| 2 | POS — active order | Core feature |
| 3 | Kitchen display (KDS) | Differentiator |
| 4 | Menu editor | Management |
| 5 | Analytics / dashboard | Value for owners |
| 6 | Tables view | Operations |
| 7 | Staff / roles | Team management |
| 8 | Printer setup (optional) | BLE printing |

## Capture from Simulator (CLI)

```bash
# 1. Build & run on the right simulator
npm run cap:sync
npx cap run ios --target <SIMULATOR_UUID> --no-sync

# List simulators
xcrun simctl list devices available

# Screenshot (replace UUID with booted simulator)
xcrun simctl io <UUID> screenshot app-store/screenshots/iphone-6.7/02-pos.png

# Check dimensions
sips -g pixelWidth -g pixelHeight app-store/screenshots/iphone-6.7/02-pos.png
```

## Capture from Simulator (GUI)

1. Run app: `npm run cap:ios` → Xcode → select simulator → Run (⌘R)
2. Navigate to the screen
3. **File → New Screen Shot** (or ⌘S in Simulator app)
4. Screenshots save to Desktop by default — move into `app-store/screenshots/`

## iPad screenshots

```bash
# Boot iPad simulator (if not already)
xcrun simctl boot 1C2F9D69-CA24-46CC-AB32-B1118EF936FC
open -a Simulator

# Run app on iPad
npx cap run ios --target 1C2F9D69-CA24-46CC-AB32-B1118EF936FC --no-sync

# Capture
xcrun simctl io 1C2F9D69-CA24-46CC-AB32-B1118EF936FC screenshot app-store/screenshots/ipad-12.9/01-dashboard.png
```

## Upload to App Store Connect

1. App Store Connect → your app → **App Store** tab → version **1.0**
2. **Previews and Screenshots** → select device size
3. Drag PNG files (no alpha channel on marketing screenshots — Simulator PNGs are fine)
4. Order: most compelling first (usually POS or dashboard)

## Tips

- Use **dark theme** or **light theme** consistently across all shots
- Hide personal data — use demo restaurant only
- Status bar: Simulator shows clean status bar automatically
- If resolution is wrong, use a different simulator model (Pro Max for 6.7")
- Optional: frame screenshots with [screenshot.rocks](https://screenshot.rocks) or Figma device frames for marketing polish (not required by Apple)

## Current captures

| File | Status |
|------|--------|
| `iphone-6.7/01-launch.png` | Placeholder — replace after logging in with demo data |
| `ipad-12.9/*` | Not captured yet — run on iPad simulator |
