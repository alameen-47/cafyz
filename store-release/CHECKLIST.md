# Master store release checklist

Use this before submitting to **App Store** or **Play Store**.

## Codebase (done in repo)

- [x] `/privacy`, `/support`, `/terms` live on web
- [x] Account deletion in Account Settings
- [x] iPad/tablet responsive layout
- [x] iOS `NSPhotoLibraryUsageDescription` + encryption export flag
- [x] Android release AAB script (`npm run native:android:release`)

## Shared (both stores)

- [ ] Demo reviewer account created — fill in `demo-account.md`
- [ ] Privacy URL opens real policy: https://cafyz.ametronyx.com/privacy
- [ ] Support URL opens real page: https://cafyz.ametronyx.com/support
- [ ] Render env vars verified (`TURSO_*`, `FOUNDER_*`, `RESEND_*`, `CLOUDINARY_*`)
- [ ] Vercel deploy green after latest `main` push

## iOS App Store

- [ ] Apple Developer Program active ($99/year)
- [ ] App created in App Store Connect (`com.cafyz.app`)
- [ ] `cp web-v2/.env.capacitor.example web-v2/.env.capacitor`
- [ ] `npm run cap:sync` → `cd cap-ios/App && pod install`
- [ ] 5+ iPhone screenshots in `ios/screenshots/iphone-6.7/`
- [ ] 3+ iPad screenshots in `ios/screenshots/ipad-12.9/`
- [ ] Metadata pasted from `ios/metadata.md`
- [ ] Xcode Archive → Upload → TestFlight test on real device
- [ ] Submit for Review

## Google Play Store

- [ ] Play Console developer account ($25 one-time)
- [ ] `cp cap-android/keystore.properties.example cap-android/keystore.properties`
- [ ] Release keystore generated and backed up securely
- [ ] `npm run native:android:release` → `releases/Cafyz-android-release.aab`
- [ ] Phone + tablet screenshots in `android/screenshots/`
- [ ] Metadata from `android/metadata.md`
- [ ] Data Safety form completed
- [ ] Upload AAB → Internal testing → Production

## After approval

- [ ] Update `demo-account.md` with production test credentials location
- [ ] Bump `CURRENT_PROJECT_VERSION` / `versionCode` for next release
- [ ] Archive screenshots used for this version in `store-release/`
