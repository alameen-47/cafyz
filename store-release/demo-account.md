# Demo account for store reviewers

**Production account** — auto-provisioned on API startup (`ensureStoreDemoAccount`).

Login at: https://cafyz.ametronyx.com (or the native app — same credentials)

## Apple App Review

Paste into App Store Connect → App Review Information:

```
Email: reviewer@cafyz.com
Password: set on Render as STORE_DEMO_PASSWORD (not stored in git)
```

**Restaurant setup:**
- Name: `Cafyz Demo Restaurant`
- Plan: Premium (active license, 2 years from first boot)
- Sample menu: 12 items (starters, mains, desserts, drinks)
- 4 tables (Main, Patio, Bar)

## Google Play Review

Same credentials in Play Console → App access → provide test credentials:

```
Email: reviewer@cafyz.com
Password: set on Render as STORE_DEMO_PASSWORD (not stored in git)
```

## Notes for reviewers

```
Cafyz is a B2B restaurant management app. Login with email + password.

After login you have full owner access: POS, KDS, Menu, Tables, Staff, Analytics.

Subscription is managed outside the app (no in-app purchases).
Bluetooth is optional — used only for BLE thermal printers.

Account deletion: Profile menu → Account Settings → Delete account.
Do not delete this demo account during review.
```

## Override credentials (optional)

Set on Render → Environment to change defaults:

| Variable | Default |
|----------|---------|
| `STORE_DEMO_EMAIL` | `reviewer@cafyz.com` |
| `STORE_DEMO_PASSWORD` | _(no default — must be set on Render)_ |
| `STORE_DEMO_ENABLED` | `true` (set `false` to disable) |

## Internal accounts (do not submit to stores)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Store reviewer | `reviewer@cafyz.com` | _(Render env)_ | Submit to Apple/Google |
| Founder | `FOUNDER_EMAIL` env | `FOUNDER_PASSWORD` env | Founder panel only — never submit |
