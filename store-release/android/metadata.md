# Google Play Store metadata

Portal: https://play.google.com/console  
Full links: [../LINKS.md](../LINKS.md)

## App identity

| Field | Value |
|-------|-------|
| **App name** | Cafyz |
| **Package name** | `com.cafyz.app` |
| **Version code** | 1 |
| **Version name** | 1.0 |
| **Category** | Business |
| **Content rating** | Everyone (questionnaire) |

## URLs

| Field | URL |
|-------|-----|
| **Privacy policy** | https://cafyz.ametronyx.com/privacy |
| **Website** | https://cafyz.ametronyx.com |
| **Account deletion** | https://cafyz.ametronyx.com/support#account-deletion |

## Short description (80 chars max)

Restaurant POS, kitchen display, menu, staff & analytics for iPhone and tablet.

## Full description (4000 chars max)

```
Cafyz is a complete restaurant operating system for owners, managers, and staff.

• Point of Sale — fast ordering, bills, payments
• Kitchen Display (KDS) — real-time tickets to the kitchen
• Menu & Inventory — categories, photos, stock levels
• Tables & Orders — floor plan and live order tracking
• Staff & Roles — role-based access for your team
• Analytics — sales trends and top items
• Thermal printing — BLE and classic Bluetooth printers (Android)

Cafyz is licensed per restaurant. Subscription is managed outside the Play Store.

Account deletion: Profile → Account Settings → Delete account.
Support: support@cafyz.com
Privacy: https://cafyz.ametronyx.com/privacy
```

## Data Safety (Play Console)

| Data | Collected | Shared | Purpose |
|------|-----------|--------|---------|
| Email, name, phone | Yes | No | Account |
| Photos (menu/logo) | Yes | Cloudinary | App functionality |
| App activity | Minimal | No | Analytics/errors |
| Location | No | — | — |
| Financial | No | — | — |

**Permissions to declare:**
- Bluetooth — thermal printer pairing
- Location (if prompted for BLE scan on older Android) — printer discovery only
- Notifications — optional push

## Review notes

```
B2B restaurant app. Login required.
Demo credentials:
Email: reviewer@cafyz.com
Password: CafyzReview2026!
No in-app purchases.
```

## Screenshots

| Type | Min | Folder |
|------|-----|--------|
| Phone | 2–8 | `android/screenshots/phone/` |
| 7" tablet | 1+ (if supported) | `android/screenshots/tablet-10/` |
| Feature graphic | 1024×500 | `android/screenshots/feature-graphic.png` (create) |

Suggested screens: POS, KDS, Menu, Dashboard, Tables.

## Release build

```bash
cp cap-android/keystore.properties.example cap-android/keystore.properties
# Fill keystore paths and passwords
cp web-v2/.env.capacitor.example web-v2/.env.capacitor
npm run cap:sync
npm run native:android:release
# Upload: releases/Cafyz-android-release.aab
```

## Versioning

Increment `versionCode` in `cap-android/app/build.gradle` for every Play upload.
