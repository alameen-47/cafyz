#!/usr/bin/env bash
# Run Cafyz on the Android emulator with live reload + local API.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${JAVA_HOME:-}" ]]; then
  if /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
  elif [[ -d /opt/homebrew/opt/openjdk@21 ]]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  elif [[ -d /usr/local/opt/openjdk@21 ]]; then
    export JAVA_HOME="/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  fi
fi

DEVICE="$(adb devices | awk 'NR>1 && $2=="device" && $1 ~ /^emulator-/ { print $1; exit }')"
if [[ -z "${DEVICE}" ]]; then
  echo "No Android emulator found. Start one in Android Studio (AVD Manager)." >&2
  exit 1
fi

export ANDROID_SERIAL="${DEVICE}"
# Emulator alias for the host machine — more reliable than localhost + adb reverse for Vite.
DEV_HOST="${CAP_DEV_HOST:-10.0.2.2}"
DEV_PORT="${CAP_DEV_PORT:-5173}"

echo "Using emulator: ${DEVICE} (dev server: http://${DEV_HOST}:${DEV_PORT})"

# API still uses adb reverse so native code can call http://localhost:4000
adb -s "${DEVICE}" reverse tcp:4000 tcp:4000
adb -s "${DEVICE}" reverse --list

if ! curl -sf "http://127.0.0.1:${DEV_PORT}/" >/dev/null 2>&1; then
  echo "==> Start the dev stack first: npm run dev" >&2
  exit 1
fi

APK="${ROOT}/cap-android/app/build/outputs/apk/debug/app-debug.apk"

if [[ ! -f "${APK}" ]]; then
  echo "==> Syncing web bundle into cap-android"
  npm run cap:sync
fi

echo "==> Installing APK on ${DEVICE}"
(cd cap-android && ./gradlew installDebug)

adb -s "${DEVICE}" shell am force-stop com.cafyz.app || true
adb -s "${DEVICE}" shell am start -n com.cafyz.app/.MainActivity

exec npx cap run android \
  --target "${DEVICE}" \
  --no-sync \
  -l --port "${DEV_PORT}" --host "${DEV_HOST}"
