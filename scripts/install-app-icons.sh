#!/usr/bin/env bash
# Install app icons from AppIcons zip into Capacitor + web + desktop targets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="${1:-$ROOT/AppIcons (1).zip}"
TMP="$(mktemp -d)"

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

if [[ ! -f "$ZIP" ]]; then
  echo "Missing zip: $ZIP" >&2
  exit 1
fi

unzip -q "$ZIP" -d "$TMP"

for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  src="$TMP/android/mipmap-$d/ic_launcher.png"
  dest="$ROOT/cap-android/app/src/main/res/mipmap-$d"
  mkdir -p "$dest"
  cp "$src" "$dest/ic_launcher.png"
  cp "$src" "$dest/ic_launcher_round.png"
  cp "$src" "$dest/ic_launcher_foreground.png"
done

cp -R "$TMP/Assets.xcassets/AppIcon.appiconset/"* "$ROOT/cap-ios/App/App/Assets.xcassets/AppIcon.appiconset/"
mkdir -p "$ROOT/build" "$ROOT/web-v2/public"
cp "$TMP/Assets.xcassets/AppIcon.appiconset/1024.png" "$ROOT/build/icon.png"
cp "$TMP/playstore.png" "$ROOT/web-v2/public/icon-512.png"
cp "$TMP/Assets.xcassets/AppIcon.appiconset/180.png" "$ROOT/web-v2/public/apple-touch-icon.png"
node -e "
const sharp=require('sharp');
sharp('$TMP/Assets.xcassets/AppIcon.appiconset/1024.png').resize(192,192)
  .toFile('$ROOT/web-v2/public/icon-192.png').then(()=>console.log('web icons ok'));
"

echo "✓ Icons installed from $(basename "$ZIP")"
