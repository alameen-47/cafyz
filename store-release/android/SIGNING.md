# Android release signing

## Play Store upload file

**`../builds/android-release/Cafyz-android-release.aab`**

Upload this in Google Play Console → Release → Create release → Upload bundle.

## Keystore (local only — not in git)

| File | Location |
|------|----------|
| Keystore | `cap-android/cafyz-release.keystore` |
| Gradle config | `cap-android/keystore.properties` |
| **Passwords** | `signing-credentials.txt` (same folder, gitignored) |

**Back up the keystore and passwords somewhere safe.** Google requires the same signing key for all future app updates.

## Rebuild AAB

```bash
npm run native:android:release
# → store-release/builds/android-release/Cafyz-android-release.aab
```
