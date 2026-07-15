#!/usr/bin/env bash
# Copy native build outputs and iOS hosting bundle into store-release/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGE="$ROOT/store-release"
ANDROID_OUT="$STAGE/builds/android"
IOS_OUT="$STAGE/builds/ios"
IOS_HOSTING="$IOS_OUT/web-hosting"
IOS_XCODE="$STAGE/ios/xcode"

mkdir -p "$ANDROID_OUT" "$IOS_OUT" "$IOS_HOSTING" "$IOS_XCODE" "$STAGE/android"

echo "==> Staging store-release artifacts"

# Android binaries
if [[ -f releases/Cafyz-android-debug.apk ]]; then
  cp -f releases/Cafyz-android-debug.apk "$ANDROID_OUT/Cafyz-android-debug.apk"
  echo "    → store-release/builds/android/Cafyz-android-debug.apk"
fi
if [[ -f releases/Cafyz-android-release.aab ]]; then
  mkdir -p "$STAGE/builds/android-release"
  cp -f releases/Cafyz-android-release.aab "$STAGE/builds/android-release/Cafyz-android-release.aab"
  echo "    → store-release/builds/android-release/Cafyz-android-release.aab"
fi

# iOS web hosting bundle (Capacitor copies web-v2/dist here on cap sync)
if [[ -d cap-ios/App/App/public ]]; then
  rm -rf "$IOS_HOSTING"
  cp -R cap-ios/App/App/public "$IOS_HOSTING"
  echo "    → store-release/builds/ios/web-hosting/ ($(du -sh "$IOS_HOSTING" | cut -f1))"
fi

# Capacitor runtime config baked into the iOS shell
if [[ -f cap-ios/App/App/capacitor.config.json ]]; then
  cp -f cap-ios/App/App/capacitor.config.json "$IOS_OUT/capacitor.config.json"
  cp -f cap-ios/App/App/capacitor.config.json "$IOS_XCODE/capacitor.config.json"
fi

# iOS Xcode / App Store export helpers
for f in Info.plist Podfile Podfile.lock; do
  if [[ -f "cap-ios/App/App/$f" ]]; then
    cp -f "cap-ios/App/App/$f" "$IOS_XCODE/$f"
  elif [[ -f "cap-ios/App/$f" ]]; then
    cp -f "cap-ios/App/$f" "$IOS_XCODE/$f"
  fi
done
if [[ -f capacitor.config.ts ]]; then
  cp -f capacitor.config.ts "$IOS_XCODE/capacitor.config.ts"
fi

# Android signing template
if [[ -f cap-android/keystore.properties.example ]]; then
  cp -f cap-android/keystore.properties.example "$STAGE/android/keystore.properties.example"
fi

# Native env template
if [[ -f web-v2/.env.capacitor.example ]]; then
  cp -f web-v2/.env.capacitor.example "$STAGE/builds/env.capacitor.example"
fi

# iOS archive / IPA if present
if [[ -d releases/ios ]]; then
  mkdir -p "$IOS_OUT/archive"
  cp -R releases/ios/. "$IOS_OUT/archive/" 2>/dev/null || true
fi
if [[ -f releases/Cafyz-ios.ipa ]]; then
  cp -f releases/Cafyz-ios.ipa "$IOS_OUT/Cafyz-ios.ipa"
  echo "    → store-release/builds/ios/Cafyz-ios.ipa"
fi

# Manifest for humans + tooling
cat > "$STAGE/builds/MANIFEST.json" <<EOF
{
  "staged_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "android_debug_apk": "$([ -f "$ANDROID_OUT/Cafyz-android-debug.apk" ] && echo "builds/android/Cafyz-android-debug.apk" || echo null)",
  "android_release_aab": "$([ -f "$STAGE/builds/android-release/Cafyz-android-release.aab" ] && echo "builds/android-release/Cafyz-android-release.aab" || echo null)",
  "ios_web_hosting": "$([ -d "$IOS_HOSTING" ] && echo "builds/ios/web-hosting" || echo null)",
  "ios_archive": "$([ -d "$IOS_OUT/archive/Cafyz.xcarchive" ] && echo "builds/ios/archive/Cafyz.xcarchive" || echo null)",
  "ios_capacitor_config": "$([ -f "$IOS_OUT/capacitor.config.json" ] && echo "builds/ios/capacitor.config.json" || echo null)",
  "ios_xcode_project": "../cap-ios/App/App.xcworkspace",
  "ios_export_options": "ios/xcode/ExportOptions.plist"
}
EOF

echo "    → store-release/builds/MANIFEST.json"
echo "Done staging store-release."
