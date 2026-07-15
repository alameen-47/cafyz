# iOS screenshots

Save captures here before uploading to App Store Connect.

## Required sizes

| Slot | Resolution (portrait) | Simulator |
|------|----------------------|-----------|
| **iPhone 6.7"** | 1290 × 2796 | iPhone 17 Pro Max |
| **iPad 12.9"** | 2048 × 2732 | iPad Pro 12.9" / 13" |

Need **5 iPhone** + **3 iPad** minimum.

## Suggested screens

1. Login
2. POS
3. Kitchen (KDS)
4. Menu
5. Analytics

## Capture commands

```bash
npm run cap:sync
npx cap run ios --target <SIMULATOR_UUID> --no-sync

# iPhone
xcrun simctl io <UUID> screenshot store-release/ios/screenshots/iphone-6.7/02-pos.png

# iPad (UUID: 1C2F9D69-CA24-46CC-AB32-B1118EF936FC)
xcrun simctl io 1C2F9D69-CA24-46CC-AB32-B1118EF936FC screenshot store-release/ios/screenshots/ipad-12.9/02-dashboard.png

sips -g pixelWidth -g pixelHeight store-release/ios/screenshots/iphone-6.7/02-pos.png
```

## Current files

| File | Status |
|------|--------|
| `iphone-6.7/01-launch.png` | Placeholder — replace after demo login |
| `ipad-12.9/01-tablet-shell.png` | Shell layout — add feature screens |

## Upload

App Store Connect → App → version 1.0 → Previews and Screenshots
