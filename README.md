# Cafyz

Restaurant OS — one UI for **web**, **Android**, and **iOS** (Capacitor).

## Canonical app

| Surface | Path | Command |
|---------|------|---------|
| **Web UI** | `web-v2/` | `npm run dev` → http://localhost:5173 |
| **API** | `backend/` | included in `npm run dev` (port 4000) |
| **Android / iOS** | `cap-android/`, `cap-ios/` | `npm run cap:sync` then `npm run cap:android` / `cap:ios` |

## Quick start

```bash
npm install
cd backend && npm install && cd ..
npm run dev
```

Opens the web app at http://localhost:5173 with the local API on port 4000.

## Native (mobile)

```bash
npm run cap:sync              # build web-v2 + copy into native projects
npm run cap:android:emulator  # Android emulator + live reload
npm run cap:android:usb       # USB device + live reload
npm run native:android        # production debug APK → releases/
```

See [docs/NATIVE_APPS.md](docs/NATIVE_APPS.md) for full native build details.

## Environment

- **Frontend (Vite):** root `.env` — `VITE_API_URL` for local dev
- **Capacitor builds:** `web-v2/.env.capacitor` — API URL baked into APK/IPA
- **Backend:** `backend/.env` — Turso, Resend, founder credentials

## Production

- **Web:** Vercel builds `web-v2/` (see `vercel.json`)
- **API:** Render — `https://cafyz.onrender.com`
