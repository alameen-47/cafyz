#!/usr/bin/env bash
# Sync EVERY store-submission asset into store-release/ (single external folder).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STAGE="$ROOT/store-release"

echo "==> store-release full sync"

# 1) Native builds + iOS hosting (existing stage logic)
bash "$ROOT/scripts/stage-store-release.sh"

# 2) Android signing (keystore + properties + credentials)
SIGN_DIR="$STAGE/android/signing"
mkdir -p "$SIGN_DIR"
if [[ -f cap-android/cafyz-release.keystore ]]; then
  cp -f cap-android/cafyz-release.keystore "$SIGN_DIR/cafyz-release.keystore"
  echo "    → store-release/android/signing/cafyz-release.keystore"
fi
if [[ -f cap-android/keystore.properties ]]; then
  cp -f cap-android/keystore.properties "$SIGN_DIR/keystore.properties"
  echo "    → store-release/android/signing/keystore.properties"
fi
if [[ -f "$STAGE/android/signing-credentials.txt" ]]; then
  cp -f "$STAGE/android/signing-credentials.txt" "$SIGN_DIR/credentials.txt"
elif [[ -f "$SIGN_DIR/credentials.txt" ]]; then
  :
else
  echo "    (no signing credentials file yet)"
fi
if [[ -f cap-android/keystore.properties.example ]]; then
  cp -f cap-android/keystore.properties.example "$STAGE/android/keystore.properties.example"
fi

# 3) Capacitor + native env templates
mkdir -p "$STAGE/config"
cp -f capacitor.config.ts "$STAGE/config/capacitor.config.ts" 2>/dev/null || true
cp -f web-v2/.env.capacitor.example "$STAGE/config/env.capacitor.example" 2>/dev/null || true
cp -f web-v2/.env.capacitor "$STAGE/config/env.capacitor" 2>/dev/null || true

# 4) iOS Xcode workspace pointer (canonical project stays in cap-ios/)
cat > "$STAGE/ios/XCODE_PROJECT.txt" <<EOF
Open for archive/upload:
  $ROOT/cap-ios/App/App.xcworkspace

Staged copies in this folder:
  ios/xcode/          — Info.plist, Podfile, ExportOptions.plist
  builds/ios/archive/ — Cafyz.xcarchive
  builds/ios/web-hosting/ — bundled web UI
EOF

# 5) Android Gradle pointer
cat > "$STAGE/android/GRADLE_PROJECT.txt" <<EOF
Canonical Android project:
  $ROOT/cap-android/

Play upload bundle (in this folder):
  builds/android-release/Cafyz-android-release.aab

Signing (in this folder):
  android/signing/cafyz-release.keystore
  android/signing/keystore.properties
  android/signing/credentials.txt
EOF

# 6) Generate FILES.md inventory
python3 - <<'PY'
from pathlib import Path
from datetime import datetime, timezone

root = Path('/Users/alameen/cafyz/store-release')
lines = [
    '# store-release file inventory',
    '',
    f'Generated: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}',
    '',
    'Everything for App Store + Play Store lives under this folder.',
    '',
]

def walk(base: Path, prefix: str = ''):
    items = sorted(base.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    for p in items:
        if p.name.startswith('.') or p.name == 'FILES.md':
            continue
        rel = p.relative_to(root)
        if p.is_dir():
            lines.append(f'- **{rel}/**')
            if str(rel).count('/') < 4:
                walk(p, prefix + '  ')
        else:
            size = p.stat().st_size
            if size > 1024 * 1024:
                sz = f'{size / (1024*1024):.1f} MB'
            elif size > 1024:
                sz = f'{size / 1024:.0f} KB'
            else:
                sz = f'{size} B'
            lines.append(f'- `{rel}` ({sz})')

walk(root)
(root / 'FILES.md').write_text('\n'.join(lines) + '\n')
print('    → store-release/FILES.md')
PY

echo "Done. All store assets → $STAGE/"
