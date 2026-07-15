# Cafyz — App Store Connect metadata (copy-paste)

Use this when creating the app in [App Store Connect](https://appstoreconnect.apple.com).

## App identity

| Field | Value |
|-------|-------|
| **Name** | Cafyz |
| **Subtitle** (30 chars max) | Restaurant POS & operations |
| **Bundle ID** | `com.cafyz.app` |
| **SKU** | `cafyz-ios-001` (any unique string you choose) |
| **Primary language** | English (U.S.) |
| **Category (primary)** | Business |
| **Category (secondary)** | Food & Drink |
| **Content rights** | Does not contain third-party content |
| **Age rating** | 4+ (no restricted content) |

## URLs (required — create these pages before submission)

| Field | Suggested URL |
|-------|----------------|
| **Privacy Policy URL** | `https://cafyz.ametronyx.com/privacy` |
| **Support URL** | `https://cafyz.ametronyx.com/support` |
| **Marketing URL** (optional) | `https://cafyz.ametronyx.com` |

> **Action:** Publish simple privacy + support pages on your web host (Vercel). Apple will reject without a privacy policy URL.

## Description

### Promotional text (170 chars, updatable without new build)

Run your restaurant from one app: POS, kitchen display, menu, staff, inventory, analytics, and BLE receipt printing.

### Description (4000 chars max)

```
Cafyz is a complete restaurant operating system for owners, managers, and staff — on iPhone and iPad.

POINT OF SALE
Take orders fast, split bills, apply discounts, and accept multiple payment methods. Built for busy service.

KITCHEN DISPLAY (KDS)
Send tickets to the kitchen in real time. Keep front-of-house and back-of-house in sync.

MENU & INVENTORY
Manage categories, items, modifiers, and stock. Upload menu photos and share QR menus with customers.

TABLES & ORDERS
Track table status, open tabs, and order history across your venue.

STAFF & ROLES
Invite team members with role-based access — owner, manager, cashier, kitchen, and more.

ANALYTICS & REPORTS
Daily sales, top items, and period comparisons to understand what’s working.

THERMAL PRINTING
Connect BLE thermal printers for receipts and kitchen tickets (iOS app).

MULTI-LANGUAGE
English and Arabic interface for international teams.

SUBSCRIPTION
Cafyz is licensed per restaurant. Start with a trial, then choose a plan that fits your operation. Billing is managed outside the App Store — contact support to activate or renew.

Support: support@cafyz.com
Website: https://cafyz.ametronyx.com
```

### Keywords (100 chars, comma-separated, no spaces after commas)

```
restaurant,pos,kds,menu,orders,kitchen,inventory,staff,analytics,receipt,thermal,ble,cafe
```

## Review notes (for Apple reviewer)

```
Cafyz is a B2B restaurant management app. Login requires a restaurant account (email + password or PIN).

Demo / test account:
Email: [CREATE A DEMO ACCOUNT AND PASTE HERE]
Password: [PASTE HERE]

The app connects to our production API at https://cafyz.onrender.com.
Bluetooth is used only to pair with ESC/POS thermal printers (optional).

Subscription is sold outside the app (license key / sales contact). No in-app purchases.

Contact for review questions: cafyzofficial@gmail.com
```

> **Action:** Create a dedicated demo restaurant in production with sample menu data before submitting.

## App Privacy (questionnaire in App Store Connect)

Declare data types your app collects:

| Data type | Collected? | Linked to user? | Used for |
|-----------|------------|-----------------|----------|
| Contact info (email, name, phone) | Yes | Yes | Account, support |
| User content (menu photos) | Yes | Yes | Restaurant branding |
| Identifiers (device token) | Optional | Yes | Push notifications (if enabled) |
| Usage / diagnostics | Minimal | No | Error handling |
| Financial info | No (payments not in-app) | — | — |
| Location | No | — | — |
| Tracking | No | — | — |

**Privacy practices:** Data used for app functionality and account management. Not sold to third parties.

## Export compliance

- App uses HTTPS only (`https://cafyz.onrender.com`).
- Add to `Info.plist` or answer in Connect: **Uses encryption: No** (or exempt — standard TLS only).

## Screenshots

See `app-store/screenshots/README.md` for required sizes and capture steps.

Minimum recommended set:
- **iPhone 6.7"** — 5 screenshots (1290 × 2796)
- **iPad 12.9"** — 3 screenshots (2048 × 2732) — required because the app supports iPad (`TARGETED_DEVICE_FAMILY = 1,2`)

Suggested screens to capture:
1. Login / welcome
2. POS (order screen)
3. Kitchen display
4. Menu management
5. Analytics dashboard

## Versioning (Xcode)

| Field | Current | When to bump |
|-------|---------|--------------|
| **Marketing version** (`MARKETING_VERSION`) | 1.0 | User-visible version (1.1, 2.0) |
| **Build** (`CURRENT_PROJECT_VERSION`) | 1 | Every upload to App Store Connect |

## Checklist before Submit for Review

- [ ] Apple Developer Program active ($99/year)
- [ ] App record created in App Store Connect with bundle ID `com.cafyz.app`
- [ ] Privacy policy + support pages live on web
- [ ] Demo account created for Apple reviewer
- [ ] Screenshots uploaded (iPhone + iPad)
- [ ] App icon 1024×1024 (`cap-ios/.../AppIcon.appiconset/1024.png`)
- [ ] `npm run cap:sync` with production `.env.capacitor`
- [ ] Xcode Archive succeeds (Product → Archive)
- [ ] TestFlight internal test passed on real device
- [ ] Build number incremented for each upload
