# Master store release checklist

Use this before submitting to **App Store** or **Play Store**.

## Codebase (done in repo)

- [x] `/privacy`, `/support`, `/terms` live on web
- [x] Account deletion in Account Settings
- [x] iPad/tablet responsive layout
- [x] iOS `NSPhotoLibraryUsageDescription` + encryption export flag
- [x] Android debug APK in `builds/android/Cafyz-android-debug.apk`
- [x] iOS web hosting bundle in `builds/ios/web-hosting/`
- [x] iOS Xcode archive in `builds/ios/archive/Cafyz.xcarchive`

## Shared (both stores)

- [x] Demo reviewer account — `reviewer@cafyz.com` / `CafyzReview2026!` (auto-provisioned on API boot)
- [ ] Privacy URL opens real policy: https://cafyz.ametronyx.com/privacy
- [ ] Support URL opens real page: https://cafyz.ametronyx.com/support
- [ ] Render env vars verified (`TURSO_*`, `FOUNDER_*`, `RESEND_*`, `CLOUDINARY_*`)
- [ ] Vercel deploy green after latest `main` push

## iOS App Store

- [ ] Apple Developer Program active ($99/year)
- [ ] App created in App Store Connect (`com.cafyz.app`)
- [ ] `cp web-v2/.env.capacitor.example web-v2/.env.capacitor`
- [ ] `npm run cap:sync` → `cd cap-ios/App && pod install`
- [x] 7+ iPhone screenshots in `ios/screenshots/iphone-6.7/`
- [x] 7+ iPad screenshots in `ios/screenshots/ipad-12.9/`
- [ ] Metadata pasted from `ios/metadata.md`
- [ ] Xcode Archive → Upload → TestFlight test on real device
- [ ] Submit for Review

## Google Play Store

- [ ] Play Console developer account ($25 one-time)
- [x] Android release AAB in `builds/android-release/Cafyz-android-release.aab`
- [x] Release keystore generated locally (`cap-android/cafyz-release.keystore` — **back up**, gitignored)
- [x] Phone screenshots in `android/screenshots/phone/` (5 screens)
- [x] Tablet screenshots in `android/screenshots/tablet-10/` (5 screens)
- [x] Feature graphic `android/screenshots/feature-graphic.png`
- [ ] Metadata from `android/metadata.md`
- [ ] Data Safety form completed
- [ ] Upload AAB → Internal testing → Production

## After approval

- [x] Production test credentials in `demo-account.md`
- [ ] Bump `CURRENT_PROJECT_VERSION` / `versionCode` for next release
- [ ] Archive screenshots used for this version in `store-release/`
