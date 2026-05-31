#!/usr/bin/env bash
# Build Cafyz native apps — Android APK, iOS (Xcode), Desktop (Electron).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${VITE_API_URL:-https://cafyz.onrender.com}"
APP_URL="${VITE_APP_URL:-https://cafyz.ametronyx.com}"

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
echo "==> Regenerating branded icons from logo-source.png"
npm run gen-icons
VITE_API_URL="$API_URL" VITE_APP_URL="$APP_URL" npx vite build --config web/vite.config.ts --mode capacitor

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
