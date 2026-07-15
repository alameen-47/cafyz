# iOS store release

## Xcode project (canonical)

Open **`../../cap-ios/App/App.xcworkspace`** in Xcode.

## Staged copies in `store-release/`

| File | Path |
|------|------|
| **Web hosting bundle** | [../builds/ios/web-hosting/](../builds/ios/web-hosting/) |
| **Capacitor config** | [../builds/ios/capacitor.config.json](../builds/ios/capacitor.config.json) |
| **Xcode archive** | [../builds/ios/archive/Cafyz.xcarchive](../builds/ios/archive/Cafyz.xcarchive) |
| **Info.plist** | [xcode/Info.plist](xcode/Info.plist) |
| **ExportOptions.plist** | [xcode/ExportOptions.plist](xcode/ExportOptions.plist) |
| **Podfile** | [xcode/Podfile](xcode/Podfile) |

## Build & stage

```bash
npm run cap:sync
cd cap-ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ../../releases/ios/Cafyz.xcarchive archive
cd ../..
bash scripts/stage-store-release.sh
```

Or: **Xcode → Product → Archive**, then re-run `bash scripts/stage-store-release.sh`.

## Docs

- Metadata: [metadata.md](metadata.md)
- Launch guide: [launch-guide.md](launch-guide.md)
- Screenshots: [screenshots/](screenshots/)
