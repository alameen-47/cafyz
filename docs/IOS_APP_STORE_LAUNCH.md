# iOS App Store launch guide

Step-by-step checklist to ship **Cafyz** on the App Store. Your Xcode project is already configured (`com.cafyz.app`, team `647MZ9QGZJ`, v1.0 build 1).

---

## Overview

| Phase | What you do | Time estimate |
|-------|-------------|---------------|
| 1. Apple account | Enroll / verify Developer Program | 1–2 days |
| 2. Legal pages | Privacy + support URLs on web | 1–2 hours |
| 3. Production build | Sync web bundle + archive in Xcode | 30 min |
| 4. Screenshots | Capture 5 iPhone + 3 iPad shots | 1–2 hours |
| 5. App Store Connect | Metadata, privacy, upload | 1–2 hours |
| 6. TestFlight | Internal test on real iPhone | 30 min |
| 7. Submit for review | Send to Apple | 1–3 days review |

---

## Phase 1 — Apple Developer account

1. Go to [developer.apple.com/programs](https://developer.apple.com/programs/) — enroll ($99/year) if not already.
2. Confirm team **647MZ9QGZJ** appears in Xcode → **Settings → Accounts**.
3. In [App Store Connect](https://appstoreconnect.apple.com):
   - **My Apps → + → New App**
   - Platform: iOS
   - Name: **Cafyz**
   - Bundle ID: **com.cafyz.app** (must match Xcode)
   - SKU: `cafyz-ios-001`

---

## Phase 2 — Legal pages (blockers)

Apple **requires** these URLs before you can submit:

| Page | URL to publish |
|------|----------------|
| Privacy Policy | `https://cafyz.ametronyx.com/privacy` |
| Support | `https://cafyz.ametronyx.com/support` |

Minimum privacy policy should cover:
- What you collect (email, name, restaurant data, optional menu photos)
- Why (account, app functionality)
- Third parties (Cloudinary for images, Render for API)
- Contact: `support@cafyz.com` or `cafyzofficial@gmail.com`
- Data retention / deletion (contact support to delete account)

**Account deletion:** Apple requires apps with account creation to offer account deletion. Today owners can remove staff via the app; for full restaurant account deletion, document “email support@cafyz.com to request deletion” in privacy policy until an in-app flow is added.

---

## Phase 3 — Production build

### 3a. Environment file

```bash
cp web-v2/.env.capacitor.example web-v2/.env.capacitor
# Edit if needed — defaults point to production API
```

Default values:
- API: `https://cafyz.onrender.com`
- App URL: `https://cafyz.ametronyx.com`

### 3b. Sync & open Xcode

```bash
npm install --legacy-peer-deps   # root, if needed
npm run cap:sync
cd cap-ios/App && pod install && cd ../..
npm run cap:ios                  # opens Xcode
```

### 3c. Xcode settings (verify once)

Open **App** target → **Signing & Capabilities**:
- Team: your Apple team
- Bundle ID: `com.cafyz.app`
- Signing: **Automatically manage signing**

**General** tab:
- Version: `1.0`
- Build: `1` (increment for every upload)

### 3d. Archive for App Store

1. Select destination: **Any iOS Device (arm64)** — not a simulator
2. **Product → Archive**
3. Organizer opens → **Distribute App**
4. **App Store Connect** → Upload
5. Wait for processing in Connect (10–30 min)

> First archive must be on a **real Mac** with Xcode. You cannot upload from CI without extra setup.

---

## Phase 4 — Screenshots

See **`app-store/screenshots/README.md`** for sizes and capture commands.

### Quick path

```bash
# iPhone (use Pro Max simulator for 1290×2796 if available)
npm run cap:sync
npx cap run ios --target 4A001C28-81A3-4C6E-B190-3931D1DBF37D --no-sync

# Log in with demo account, navigate to each screen, then:
xcrun simctl io 4A001C28-81A3-4C6E-B190-3931D1DBF37D screenshot app-store/screenshots/iphone-6.7/02-pos.png
```

### Screens to capture (5 minimum)

1. Login
2. POS
3. Kitchen (KDS)
4. Menu
5. Analytics

### iPad (required)

```bash
npx cap run ios --target 1C2F9D69-CA24-46CC-AB32-B1118EF936FC --no-sync
# capture 3+ screens to app-store/screenshots/ipad-12.9/
```

Copy-paste metadata and descriptions: **`app-store/metadata.md`**

---

## Phase 5 — App Store Connect listing

In your app → **App Store** tab → version **1.0**:

| Field | Source |
|-------|--------|
| Screenshots | `app-store/screenshots/` |
| Description, keywords, subtitle | `app-store/metadata.md` |
| Privacy Policy URL | your `/privacy` page |
| Support URL | your `/support` page |
| App icon | auto from build (1024×1024 in Xcode assets) |
| Age rating | Complete questionnaire → likely **4+** |
| App Privacy | See questionnaire in `app-store/metadata.md` |
| Pricing | Free (subscription sold outside App Store) |

### Review information

- Create a **demo login** (email + password) with sample menu/orders
- Paste credentials in **App Review Information**
- Contact: `cafyzofficial@gmail.com`

### Export compliance

When prompted: app uses standard HTTPS only → **No** custom encryption (exempt).

Optional: add to `cap-ios/App/App/Info.plist`:
```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

---

## Phase 6 — TestFlight (recommended)

1. After upload processes, go to **TestFlight** tab
2. Add yourself as **Internal Tester**
3. Install **TestFlight** app on your iPhone
4. Test: login, POS, menu, BLE printer (if you have hardware)
5. Fix any crashes before submitting for review

---

## Phase 7 — Submit for review

1. App Store Connect → version 1.0 → **Add for Review**
2. Confirm screenshots, privacy, demo account
3. Submit
4. Typical review: **24–72 hours**

---

## What you already have ✓

| Item | Status |
|------|--------|
| Bundle ID `com.cafyz.app` | ✓ |
| Xcode team `647MZ9QGZJ` | ✓ |
| App icons (`AppIcon.appiconset`) | ✓ on disk |
| Splash screen assets | ✓ on disk |
| Bluetooth privacy strings | ✓ in Info.plist |
| Capacitor iOS project + pods | ✓ |
| Production API defaults | ✓ |
| Simulator build tested | ✓ iPhone 17 Pro |

## What you still need ✗

| Item | Action |
|------|--------|
| Privacy policy page | Publish on `cafyz.ametronyx.com` |
| Support page | Publish on `cafyz.ametronyx.com` |
| Demo account for Apple | Create in production |
| Full screenshot set | Capture after demo login (see Phase 4) |
| App Store Connect app record | Create if not done |
| Xcode Archive upload | Phase 3d |
| Account deletion policy | Document in privacy policy (or add in-app) |

---

## Differences from Android emulator dev

| Android dev (`cap:android:emulator`) | iOS App Store |
|--------------------------------------|---------------|
| Emulator + `npm run dev` + live reload | Production bundle baked in |
| Debug APK | Release archive signed by Apple |
| Gradle | Xcode Archive |
| Optional for Play Store | Apple Developer account required |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Signing failed | Xcode → Settings → Accounts → Download Manual Profiles |
| Archive greyed out | Select **Any iOS Device**, not simulator |
| White screen on device | Re-run `npm run cap:sync` with `.env.capacitor` |
| Pod install fails | `cd cap-ios/App && pod install --repo-update` |
| Upload rejected — missing icon | Verify `AppIcon.appiconset/1024.png` exists |
| Review rejection — no account deletion | Add support email flow in privacy policy |

---

## File reference

| Path | Purpose |
|------|---------|
| `app-store/metadata.md` | Copy-paste App Store text |
| `app-store/screenshots/` | Screenshot output folder |
| `web-v2/.env.capacitor.example` | Production env template |
| `cap-ios/` | Xcode project |
| `docs/NATIVE_APPS.md` | Native build basics |

---

## Next action (do this now)

1. **Publish** `/privacy` and `/support` on your website
2. **Create** a demo restaurant account for Apple reviewers
3. **Log in** on the simulator and capture 5 screenshots (Phase 4)
4. **Archive** in Xcode and upload to TestFlight

When phases 1–4 are done, say which step you're on and we can walk through Archive + Connect upload together.
