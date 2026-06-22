#!/usr/bin/env bash
# Run Cafyz on a USB-connected Android device with live reload + local API.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

DEVICE="$(adb devices | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ { print $1; exit }')"
if [[ -z "${DEVICE}" ]]; then
  echo "No USB Android device found. Plug in a phone and enable USB debugging." >&2
  exit 1
fi

if adb devices | awk 'NR>1 && $2=="device" && $1 ~ /^emulator-/' | grep -q .; then
  echo "Note: an emulator is also connected; forcing install to USB device ${DEVICE}." >&2
fi

# Gradle/adb default to the first device (often the emulator) unless ANDROID_SERIAL is set.
export ANDROID_SERIAL="${DEVICE}"

echo "Using device: ${DEVICE}"
adb -s "${DEVICE}" reverse tcp:4000 tcp:4000
adb -s "${DEVICE}" reverse tcp:5173 tcp:5173
adb -s "${DEVICE}" reverse --list

echo "==> Syncing web bundle into cap-android"
npm run cap:sync

APK="${ROOT}/cap-android/app/build/outputs/apk/debug/app-debug.apk"

echo "==> Installing APK on ${DEVICE} (via Gradle)"
(cd cap-android && ./gradlew installDebug)

if ! adb -s "${DEVICE}" shell pm path com.cafyz.app >/dev/null 2>&1; then
  echo "Gradle install did not register on device; falling back to adb install" >&2
  adb -s "${DEVICE}" install -r "${APK}"
fi

if ! adb -s "${DEVICE}" shell pm path com.cafyz.app >/dev/null 2>&1; then
  echo "Failed to install com.cafyz.app on ${DEVICE}" >&2
  exit 1
fi

echo "==> Launching Cafyz on ${DEVICE}"
adb -s "${DEVICE}" shell am start -n com.cafyz.app/.MainActivity

exec npx cap run android \
  --target "${DEVICE}" \
  --no-sync \
  -l --port 5173 --host localhost --forwardPorts 5173:5173
