# iOS App Store launch guide

Project: `com.cafyz.app` · Team `647MZ9QGZJ` · v1.0 build 1  
Metadata: [metadata.md](metadata.md) · Links: [../LINKS.md](../LINKS.md)

## 1. Apple account

1. https://developer.apple.com/programs/ ($99/year)
2. Xcode → Settings → Accounts → team **647MZ9QGZJ**
3. https://appstoreconnect.apple.com → **My Apps → + → New App**
   - Name: **Cafyz**
   - Bundle ID: **com.cafyz.app**
   - SKU: `cafyz-ios-001`

## 2. Legal URLs (live)

| Page | URL |
|------|-----|
| Privacy | https://cafyz.ametronyx.com/privacy |
| Support | https://cafyz.ametronyx.com/support |
| Terms | https://cafyz.ametronyx.com/terms |

Account deletion: **Account Settings → Delete account** (in-app).

## 3. Production build

```bash
cp web-v2/.env.capacitor.example web-v2/.env.capacitor
npm run cap:sync
cd cap-ios/App && pod install && cd ../..
npm run cap:ios
```

Xcode → **Any iOS Device (arm64)** → **Product → Archive** → **Distribute → App Store Connect**

Increment **Build** number for each upload.

## 4. Screenshots

Save to `store-release/ios/screenshots/` — see [screenshots/README.md](screenshots/README.md).

Minimum: **5 iPhone 6.7"** + **3 iPad 12.9"**

```bash
npx cap run ios --target <SIMULATOR_UUID> --no-sync
xcrun simctl io <UUID> screenshot store-release/ios/screenshots/iphone-6.7/02-pos.png
```

## 5. App Store Connect

Paste from [metadata.md](metadata.md):

- Description, keywords, subtitle
- Privacy URL, Support URL
- App Privacy questionnaire
- Review notes + demo account from [../demo-account.md](../demo-account.md)

App icon: upload [../assets/app-icon-1024.png](../assets/app-icon-1024.png) if needed.

Export compliance: **No** (standard HTTPS only).

## 6. TestFlight → Submit

1. Internal test on real iPhone
2. **Add for Review**
3. Review typically 24–72 hours

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Signing failed | Xcode → Accounts → Download Profiles |
| Archive greyed out | Select Any iOS Device, not simulator |
| White screen | Re-run `npm run cap:sync` |
| Pod errors | `cd cap-ios/App && pod install --repo-update` |
