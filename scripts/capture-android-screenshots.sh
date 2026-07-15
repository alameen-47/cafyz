#!/usr/bin/env bash
# Capture Play Store screenshots on a running Android emulator/device.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEVICE="${ANDROID_SERIAL:-$(adb devices | awk 'NR>1 && $2=="device" { print $1; exit }')}"
if [[ -z "$DEVICE" ]]; then
  echo "No Android device/emulator. Start Pixel_9a or connect a device." >&2
  exit 1
fi

APK="${1:-$ROOT/store-release/builds/android/Cafyz-android-debug.apk}"
OUT_DIR="${2:-$ROOT/store-release/android/screenshots/phone}"
EMAIL="${STORE_DEMO_EMAIL:-reviewer@cafyz.com}"
PASSWORD="${STORE_DEMO_PASSWORD:-CafyzReview2026!}"

mkdir -p "$OUT_DIR"

adb_cmd() { adb -s "$DEVICE" "$@"; }

shot() {
  local file="$1"
  sleep 1.5
  adb_cmd exec-out screencap -p > "$file"
  echo "    → $file"
}

tap() { adb_cmd shell input tap "$1" "$2"; }

clear_field() {
  tap "$1" "$2"
  sleep 0.3
  adb_cmd shell input keyevent KEYCODE_CTRL_LEFT KEYCODE_A 2>/dev/null || true
  adb_cmd shell input keyevent 67
  sleep 0.2
}

set_clipboard() {
  adb_cmd shell cmd clipboard set-text "$1" >/dev/null 2>&1 || \
    adb_cmd shell am broadcast -a clipper.set -e text "$1" >/dev/null 2>&1 || true
}

paste_field() {
  tap "$1" "$2"
  sleep 0.3
  set_clipboard "$3"
  adb_cmd shell input keyevent 279 2>/dev/null || adb_cmd shell input keyevent KEYCODE_PASTE 2>/dev/null || true
  sleep 0.4
}

login() {
  echo "==> Logging in as $EMAIL"
  adb_cmd shell am force-stop com.cafyz.app || true
  sleep 1
  adb_cmd shell am start -n com.cafyz.app/.MainActivity >/dev/null
  sleep 5

  # Ensure Email / Mobile tab (not PIN)
  tap 200 875
  sleep 0.8

  adb_cmd shell cmd clipboard set-text "$EMAIL"
  tap 540 1080
  sleep 0.4
  adb_cmd shell input keyevent 279
  sleep 0.6

  adb_cmd shell cmd clipboard set-text "$PASSWORD"
  tap 540 1230
  sleep 0.4
  adb_cmd shell input keyevent 279
  sleep 0.6

  tap 540 1420
  sleep 10
}

nav_tab() {
  # Bottom nav: Home | POS | Orders | Tables | Menu  (y ≈ 2360)
  local tab="$1"
  local y=2360
  local x
  case "$tab" in
    home) x=108 ;;
    pos) x=324 ;;
    orders) x=540 ;;
    tables) x=756 ;;
    menu) x=972 ;;
    *) echo "unknown tab $tab" >&2; return 1 ;;
  esac
  tap "$x" "$y"
  sleep 2.5
}

echo "==> Installing APK on $DEVICE"
adb_cmd install -r "$APK" >/dev/null

login

nav_tab home
shot "$OUT_DIR/01-dashboard.png"

nav_tab pos
shot "$OUT_DIR/02-pos.png"

nav_tab orders
shot "$OUT_DIR/03-orders.png"

nav_tab tables
shot "$OUT_DIR/04-tables.png"

nav_tab menu
shot "$OUT_DIR/05-menu.png"

# Feature graphic
FG="$ROOT/store-release/android/screenshots/feature-graphic.png"
if [[ ! -f "$FG" && -f "$ROOT/store-release/assets/app-icon-1024.png" ]]; then
  echo "==> Creating feature-graphic.png (1024x500)"
  python3 - <<'PY'
from pathlib import Path
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pillow', '-q'])
    from PIL import Image, ImageDraw, ImageFont

root = Path('/Users/alameen/cafyz')
icon = Image.open(root / 'store-release/assets/app-icon-1024.png').convert('RGBA')
canvas = Image.new('RGBA', (1024, 500), (6, 9, 26, 255))
icon = icon.resize((300, 300), Image.Resampling.LANCZOS)
canvas.paste(icon, (72, 100), icon)
draw = ImageDraw.Draw(canvas)
draw.text((420, 160), 'Cafyz', fill=(30, 127, 255, 255))
draw.text((420, 220), 'Restaurant POS & Operations', fill=(200, 210, 230, 255))
canvas.convert('RGB').save(root / 'store-release/android/screenshots/feature-graphic.png', 'PNG')
PY
  echo "    → $FG"
fi

echo "Done → $OUT_DIR"
