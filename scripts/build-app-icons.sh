#!/usr/bin/env bash
# Builds every iOS and Android launcher icon from the original 1024px artwork.
#
#   scripts/build-app-icons.sh [zoom] [master.png]
#
# zoom enlarges the artwork about its centre before sizing: 1.2 makes the logo 20%
# bigger than in the master (the default). The master is never modified, so running
# this again gives the same icons rather than zooming twice.
#
# Android 8+ draws the adaptive foreground at 108dp and shows only the middle 72dp,
# through whatever shape the launcher picks (a circle on Pixel). The logo already
# fills most of that window, so the foreground is enlarged at most ADAPTIVE_MAX
# (1.12): past that the round mask cuts off the shield corners and the "z".
set -euo pipefail
cd "$(dirname "$0")/.."

ZOOM=${1:-1.2}
MASTER=${2:-store-release/assets/app-icon-1024.png}
ADAPTIVE_MAX=1.12
ADAPTIVE_ZOOM=$(awk -v z="$ZOOM" -v m="$ADAPTIVE_MAX" 'BEGIN { print (z < m ? z : m) }')
BG="#06091a"   # matches @color/ic_launcher_background
IOS=cap-ios/App/App/Assets.xcassets/AppIcon.appiconset
RES=cap-android/app/src/main/res

command -v magick >/dev/null || { echo "ImageMagick 7 (magick) is required" >&2; exit 1; }
[ -f "$MASTER" ] || { echo "Master artwork not found: $MASTER" >&2; exit 1; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
# Crop the centre 1/zoom of the master, flattened onto the icon background: the App
# Store refuses icons with transparency.
W=$(magick identify -format %w "$MASTER")
crop() {
  local c; c=$(awk -v w="$W" -v z="$1" 'BEGIN { printf "%d", w / z + 0.5 }')
  magick "$MASTER" -background "$BG" -alpha remove -alpha off \
    -gravity center -crop "${c}x${c}+0+0" +repage "$2"
}
crop "$ZOOM" "$TMP/art.png"
crop "$ADAPTIVE_ZOOM" "$TMP/adaptive.png"

# One resample from the crop straight to each size keeps small icons crisp.
icon() { magick "${3:-$TMP/art.png}" -filter Lanczos -resize "$1x$1" -strip "PNG24:$2"; }

for f in "$IOS"/*.png; do
  icon "$(magick identify -format %w "$f")" "$f"
done

for pair in mdpi:1 hdpi:1.5 xhdpi:2 xxhdpi:3 xxxhdpi:4; do
  dir=$RES/mipmap-${pair%%:*}; scale=${pair##*:}
  px() { awk -v dp="$1" -v s="$scale" 'BEGIN { printf "%d", dp * s + 0.5 }'; }
  icon "$(px 48)"  "$dir/ic_launcher.png"
  icon "$(px 48)"  "$dir/ic_launcher_round.png"
  icon "$(px 108)" "$dir/ic_launcher_foreground.png" "$TMP/adaptive.png"
done

echo "Icons rebuilt from $MASTER: iOS and legacy Android ${ZOOM}x, Android adaptive ${ADAPTIVE_ZOOM}x"
