#!/bin/zsh
# Turns the generated sign-in background (scripts/art/generate.mjs) into the web
# images the app ships, in web-v2/public/login. Needs ImageMagick 7 and cwebp.
#
#   scripts/art/build.sh <raw-dir> [scene]   (scene defaults to neon-dining)
set -euo pipefail
RAW=${1:?usage: build.sh <raw-dir>}
HERE=${0:A:h}
OUT=$HERE/../../web-v2/public/login
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Phones get the 640px copy, tablets and desktops the full 1024px frame.
SCENE=${2:-neon-dining}
for w in 640 1024; do
  magick "$RAW/$SCENE.png" -resize ${w}x -strip "$TMP/$SCENE-$w.png"
  cwebp -quiet -q 76 -m 6 "$TMP/$SCENE-$w.png" -o "$OUT/$SCENE-$w.webp"
done

ls -la "$OUT"
du -sh "$OUT"
