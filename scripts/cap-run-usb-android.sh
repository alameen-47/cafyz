#!/usr/bin/env bash
# Run Cafyz on a USB-connected Android device with live reload + local API.
set -euo pipefail
cd "$(dirname "$0")/.."

DEVICE="$(adb devices | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ { print $1; exit }')"
if [[ -z "${DEVICE}" ]]; then
  echo "No USB Android device found. Plug in a phone and enable USB debugging." >&2
  exit 1
fi

echo "Using device: ${DEVICE}"
adb -s "${DEVICE}" reverse tcp:4000 tcp:4000
adb -s "${DEVICE}" reverse tcp:5173 tcp:5173
adb -s "${DEVICE}" reverse --list

exec npx cap run android \
  --target "${DEVICE}" \
  -l --port 5173 --host localhost --forwardPorts 5173:5173
