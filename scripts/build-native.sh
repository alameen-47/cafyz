#!/usr/bin/env bash
# Build Cafyz native apps — Android APK, iOS (Xcode), Desktop (Electron).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${VITE_API_URL:-https://cafyz.onrender.com}"
APP_URL="${VITE_APP_URL:-https://cafyz.ametronyx.com}"
APP_ICONS_DIR="${APP_ICONS_DIR:-AppIcons (1)}"
APP_ICONS_ZIP="${APP_ICONS_ZIP:-}"

apply_icons_from_dir() {
  local dir="$1"
  echo "==> Applying app icons from: $dir"
  local ios_set="cap-ios/App/App/Assets.xcassets/AppIcon.appiconset"
  local src_ios="$dir/Assets.xcassets/AppIcon.appiconset"
  if [[ -d "$src_ios" ]]; then
    cp -f "$src_ios/40.png"  "$ios_set/Icon-App-20x20@2x.png"
    cp -f "$src_ios/60.png"  "$ios_set/Icon-App-20x20@3x.png"
    cp -f "$src_ios/20.png"  "$ios_set/Icon-App-20x20@1x.png"
    cp -f "$src_ios/29.png"  "$ios_set/Icon-App-29x29@1x.png"
    cp -f "$src_ios/58.png"  "$ios_set/Icon-App-29x29@2x.png"
    cp -f "$src_ios/87.png"  "$ios_set/Icon-App-29x29@3x.png"
    cp -f "$src_ios/80.png"  "$ios_set/Icon-App-40x40@2x.png"
    cp -f "$src_ios/120.png" "$ios_set/Icon-App-40x40@3x.png"
    cp -f "$src_ios/40.png"  "$ios_set/Icon-App-40x40@1x.png"
    cp -f "$src_ios/120.png" "$ios_set/Icon-App-60x60@2x.png"
    cp -f "$src_ios/180.png" "$ios_set/Icon-App-60x60@3x.png"
    cp -f "$src_ios/76.png"  "$ios_set/Icon-App-76x76@1x.png"
    cp -f "$src_ios/152.png" "$ios_set/Icon-App-76x76@2x.png"
    cp -f "$src_ios/167.png" "$ios_set/Icon-App-83.5x83.5@2x.png"
    cp -f "$src_ios/1024.png" "$ios_set/ItunesArtwork@2x.png"
  fi
  for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
    local src="$dir/android/mipmap-$d/ic_launcher.png"
    local dest="cap-android/app/src/main/res/mipmap-$d"
    if [[ -f "$src" ]]; then
      cp -f "$src" "$dest/ic_launcher.png"
      cp -f "$src" "$dest/ic_launcher_round.png"
      cp -f "$src" "$dest/ic_launcher_foreground.png"
    fi
  done
  if [[ -f "$dir/playstore.png" ]]; then
    mkdir -p build
    cp -f "$dir/playstore.png" build/icon.png
  fi
}

# Capacitor 8 requires JDK 21 for Android builds
if [[ -z "${JAVA_HOME:-}" ]]; then
  if /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
  elif [[ -d /opt/homebrew/opt/openjdk@21 ]]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  elif [[ -d /usr/local/opt/openjdk@21 ]]; then
    export JAVA_HOME="/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  fi
fi

echo "==> Building web bundle for native shells (API: $API_URL)"
if [[ -n "$APP_ICONS_ZIP" && -f "$APP_ICONS_ZIP" ]]; then
  echo "==> Applying custom app icons from zip: $APP_ICONS_ZIP"
  ICON_TMP_DIR="$(mktemp -d)"
  unzip -qo "$APP_ICONS_ZIP" -d "$ICON_TMP_DIR"
  apply_icons_from_dir "$ICON_TMP_DIR"
  rm -rf "$ICON_TMP_DIR"
elif [[ -d "$APP_ICONS_DIR" ]]; then
  apply_icons_from_dir "$APP_ICONS_DIR"
elif [[ "${REGEN_ICONS:-}" == "1" ]]; then
  echo "==> Regenerating icons from logo-source.png (REGEN_ICONS=1)"
  npm run gen-icons
else
  echo "==> Using existing launcher icons in cap-android/ and cap-ios/"
fi
VITE_API_URL="$API_URL" VITE_APP_URL="$APP_URL" npx vite build --config web-v2/vite.config.ts --mode capacitor

echo "==> Syncing Capacitor (Android + iOS)"
npx cap sync

mkdir -p releases

if [[ "${1:-}" == "android" || "${1:-}" == "all" || -z "${1:-}" ]]; then
  if [[ -d cap-android ]]; then
    echo "==> Building Android debug APK"
    (cd cap-android && ./gradlew assembleDebug)
    APK="cap-android/app/build/outputs/apk/debug/app-debug.apk"
    if [[ -f "$APK" ]]; then
      cp "$APK" "releases/Cafyz-android-debug.apk"
      echo "    → releases/Cafyz-android-debug.apk"
    fi
  fi
fi

if [[ "${1:-}" == "ios" || "${1:-}" == "all" ]]; then
  echo "==> iOS: open Xcode to archive — run: npx cap open ios"
fi

if [[ "${1:-}" == "desktop" || "${1:-}" == "all" ]]; then
  if [[ -d node_modules/electron ]]; then
    echo "==> Packaging Electron desktop app"
    npx electron-builder --dir
    echo "    → releases/ (see electron-builder output)"
  else
    echo "    Skip desktop — run: npm install electron electron-builder --save-dev"
  fi
fi

echo "Done."
