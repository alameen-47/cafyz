# Cafyz — App Store Connect metadata (copy-paste)

Portal: https://appstoreconnect.apple.com  
Full links: [../LINKS.md](../LINKS.md)

## App identity

| Field | Value |
|-------|-------|
| **Name** | Cafyz |
| **Subtitle** (30 chars max) | Restaurant POS & operations |
| **Bundle ID** | `com.cafyz.app` |
| **SKU** | `cafyz-ios-001` |
| **Primary language** | English (U.S.) |
| **Category (primary)** | Business |
| **Category (secondary)** | Food & Drink |
| **Age rating** | 4+ |

## URLs

| Field | URL |
|-------|-----|
| **Privacy Policy** | https://cafyz.ametronyx.com/privacy |
| **Support** | https://cafyz.ametronyx.com/support |
| **Marketing** | https://cafyz.ametronyx.com |
| **Terms** | https://cafyz.ametronyx.com/terms |

## Promotional text (170 chars)

Run your restaurant from one app: POS, kitchen display, menu, staff, inventory, analytics, and BLE receipt printing.

## Description

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
Daily sales, top items, and period comparisons to understand what's working.

THERMAL PRINTING
Connect BLE thermal printers for receipts and kitchen tickets (iOS app).

MULTI-LANGUAGE
English and Arabic interface for international teams.

SUBSCRIPTION
Cafyz is licensed per restaurant. Billing is managed outside the App Store — contact support to activate or renew.

Account deletion: Profile → Account Settings → Delete account.
Support: support@cafyz.com
Website: https://cafyz.ametronyx.com
```

## Keywords (100 chars)

```
restaurant,pos,kds,menu,orders,kitchen,inventory,staff,analytics,receipt,thermal,ble,cafe
```

## Review notes

```
Cafyz is a B2B restaurant management app. Login requires a restaurant account (email + password or PIN).

Demo account:
Email: reviewer@cafyz.com
Password: CafyzReview2026!

API: https://cafyz.onrender.com
Bluetooth: optional, ESC/POS thermal printers only.
No in-app purchases. Subscription sold outside App Store.
Account deletion: Account Settings → Delete account.

Review contact: cafyzofficial@gmail.com
```

## App Privacy questionnaire

| Data type | Collected? | Linked to user? | Purpose |
|-----------|------------|-----------------|---------|
| Contact info | Yes | Yes | Account, support |
| User content (photos) | Yes | Yes | Menu/logo uploads |
| Device token | Optional | Yes | Push (if enabled) |
| Financial info | No | — | — |
| Location | No | — | — |
| Tracking | No | — | — |

## Export compliance

Answer: **No** — app uses standard HTTPS only (`ITSAppUsesNonExemptEncryption` is false in Info.plist).

## Screenshots & icon

- Screenshots: `store-release/ios/screenshots/` — see `screenshots/README.md`
- App icon 1024×1024: `store-release/assets/app-icon-1024.png`

## Build commands

```bash
cp web-v2/.env.capacitor.example web-v2/.env.capacitor
npm run cap:sync
cd cap-ios/App && pod install && cd ../..
npm run cap:ios
# Xcode → Product → Archive
```

## Versioning

| Field | Current | Bump when |
|-------|---------|-----------|
| Marketing version | 1.0 | User-visible releases |
| Build number | 1 | Every upload |
