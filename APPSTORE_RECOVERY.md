# App Store recovery — live status & handoff

**Last updated:** 2026-10-23 17:55 (session 1) — ALL FOUR IN REVIEW
**Purpose:** Full state so any new session / account can resume with zero re-investigation.
**Apple account:** Ameen Khan — Ametronyx. Team ID `647MZ9QGZJ`.

---

## 0. CURRENT STATE — 23 Oct, 20:22

| App | Build in review | Status |
|---|---|---|
| **FitCore Plus** | 1.0.8 (11) | **In Review** — a reviewer has it open now |
| **Cafyz** | **1.0 (3)** — has the cold-start fix | Waiting for Review |
| **Coorg Trade** | **1.0 (6)** — has the cold-start fix | Waiting for Review |
| **CREDI8** | 1.0 (2) | Waiting for Review |

Nothing on the account is rejected. AxPro ERP and Ametronyx stay live.

**Cafyz and Coorg were resubmitted on the NEW builds** (23 Oct ~20:16/20:20):
the earlier submissions were cancelled, the build swapped on the version page,
then Add for Review → Submit for Review. Queue position was restarted
deliberately — a reviewer meeting the 30 s timeout bug was the bigger risk.

⚠️ **Coorg's new build is 6, not 5.** Builds 5 and 6 already existed in
TestFlight from early October, so the bump from 3 → 5 collided; the upload
landed as 1.0 (6) (Upload Date 23 Oct 8:10 PM, Binary State Validated).
**Check TestFlight for the highest existing build number before bumping** —
`project.pbxproj` was two builds behind what App Store Connect already had.

### How the resubmit was done (the button path is not obvious)
"Resubmit to App Review" on the submission page is **disabled** while the item
is Rejected. The working path is:
1. App version page (`/distribution/ios/version/inflight`) → **Update Review**
   → item flips from *Rejected* to *Ready for Review*.
2. Back on the submission page → **Resubmit to App Review** → *Waiting for Review*.

Coorg Trade showed a **"Newer Build Available"** dialog on step 1. Build 1.0 (4)
— the one the 4.3 reply describes — was submitted. To ship the newer build
instead: delete the attached build on the version page, add the newer one,
then repeat the two steps above.

The 4.3 replies sent at 15:24 / 15:28 remain in both threads, so the reviewer
sees the answers alongside the resubmission.

### ⚠️ Decided by Ameen: sign-in details stay as they are
No password rotation. The same reviewer credentials are used across all store
submissions. §0c/§0d below describe the exposure and are kept for the record,
but **do not rotate** — that is a deliberate decision, not an oversight.

**Resolved in code — no Render change needed.** Removing the hardcoded
fallback in `b49da9c` would have stopped `ensureStoreDemoAccount` re-syncing
the premium plan, licence and demo data on the next deploy, because Render has
no `STORE_DEMO_PASSWORD` set. `ensureStoreDemoAccount` now treats the password
as optional for an **existing** account: it syncs plan, licence, menu and
tables as before and simply leaves the stored password alone, logging
`leaving the existing password untouched`. Only **creating** a reviewer account
from scratch still needs `STORE_DEMO_PASSWORD`, and it bails with a clear
message if there is none. Covered by a test; suite is 212 passing.

So the reviewer credentials are unchanged, the demo restaurant stays on the
premium plan for App Review, and nothing has to be typed into Render.

---

## 0a. WHAT WAS DONE TODAY (2026-10-23)

**Both 4.3 replies are SENT.** Verified in the threads:

| App | Thread | Sent | Attachment |
|---|---|---|---|
| Cafyz | Messages (4) | Ameen Khan, today 15:24 | `Cafyz-App-Review-answers.pdf` |
| Coorg Trade | Messages (2) | Ameen Khan, today 15:28 | `Coorg-Trade-App-Review-answers.pdf` |

The App Store Connect reply box has a **hard 4000-character limit** (the Reply
button disables above it), so each reply is a 4000-char answer to all 9 questions
with the full-length version attached as a PDF.

**Nothing was resubmitted** — Apple said to reply, not resubmit. Do not press
"Resubmit to App Review" until Apple answers.

### What happens next
- Apple replies in the thread, typically 2–7 days. Watch App Store Connect →
  each app → App Review.
- If they accept the answers, they will either approve or ask for a resubmit.
- **Do not** file an expedite request or any parallel complaint while waiting —
  that is what caused this rejection in the first place (see §3).
- CREDI8 (ASC 6791469433) is next, once these two have an answer.

---

## 0b. HYGIENE FIXES (2026-10-23, after the replies)

Done in the repos (uncommitted — review and commit):

| Change | File | Note |
|---|---|---|
| `name: figma-make-app` → `coorg-trade` | `Coorg_Buisness_Management/package.json` | pnpm-lock has no root name ref, so no lock churn |
| Heading `# figma-make-app` → `# Coorg Trade` | `Coorg_Buisness_Management/AGENTS.md` | doc only |
| `name: @figma/my-make-file` → `fitcore-plus` | `FITCORE_GYM_MANAGEMENT/package.json` + `package-lock.json` | both name fields updated together |
| `UIRequiredDeviceCapabilities: armv7` → `arm64` | `cafyz/cap-ios/App/App/Info.plist` | matches Coorg + FitCore, which were already arm64 |

**Verified:** no self-imports or build references to the old package names;
`npm install --package-lock-only` on a copy of FitCore reports "up to date"
(package.json and lock agree); `plutil -lint` passes on the Cafyz plist.

**These do not reach Apple until the next build is archived and uploaded.**
Nothing is being resubmitted now, so they simply sit in the repos until then.

### ⛔ Google OAuth branding — BLOCKED, needs Ameen

The live Coorg Trade API (`/api/auth/config`) reports Google sign-in **enabled**
with client ID:

```
278037584713-ka17so1u95mo498p4msc7vfr4v0jh764.apps.googleusercontent.com
```

That client belongs to **Google Cloud project number 278037584713**, and the
Google account currently signed in to Chrome **cannot access it** — the console
returns "You need additional access", missing `clientauthconfig.clients.list`,
`oauthconfig.verification.get`, `resourcemanager.projects.get`. The project is
not in this account's project list at all, so the CREDI8-branded consent screen
lives in a **different Google account**.

Two ways to fix, Ameen's choice:
1. **Sign in to the Google account that owns project 278037584713** and rename
   the consent screen (Google Auth Platform → Branding) to "Coorg Trade", with
   `coorgtrade.ametronyx.com` support/privacy links. Careful: if CREDI8 uses the
   *same* client, renaming moves the problem rather than solving it.
2. **Create a new "Coorg Trade" project** in the main account, make fresh Web +
   iOS + Android OAuth clients there, and set `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_IDS` (Render) and `VITE_GOOGLE_CLIENT_ID` (Vercel). This
   changes live website sign-in, so do it deliberately.

**Severity is lower than first thought.** `src/pages/Login.tsx` gates the button
with `Boolean(config?.google.clientId) && !isNativeApp()`, so Google sign-in is
**hidden inside the native iOS app**. The CREDI8 name is only reachable on the
website, not in the binary under review.

### Also seen in that Google account (unrelated, worth a look)
A console banner: "A potential violation of our Acceptable Use Policy has been
detected for multiple projects that you own." Several `project-for-key-*`
projects are marked **Warned / Appeal**. Not touched.

### Render sleep — CORRECTED 2026-10-23

- **Coorg Trade: already solved.** Commit `6006c70` added
  `.github/workflows/keep-api-awake.yml`, which pings the API every 10 minutes.
  Confirmed live: `/api/auth/config` answered instantly.
- **Cafyz: fixed in the repo, BUT NOT LIVE UNTIL PUSHED.**
  `cafyz.onrender.com` took **51.9 seconds** to answer a cold request today.
  `.github/workflows/keep-api-awake.yml` now pings
  `https://cafyz.onrender.com/health` every 10 minutes, same as Coorg's.
  Health is at **`/health`** (root), not `/api/health` — Render's
  `healthCheckPath` in `render.yaml`; `/api/health` returns 404.
  ⚠️ **CORRECTED 23 Oct 16:00 — the schedule does not hold 10 minutes.**
  The workflow is active and works when triggered, but GitHub throttles
  free-tier cron hard. Coorg's identical `*/10 * * * *` job, running since
  2 Oct, actually fires every **3–5 hours**: 19:02, 22:15, 00:43, 05:26,
  10:23, 15:20. Three of those runs took **36–37 s** instead of 7 s — the
  signature of curl waiting for a sleeping instance to wake. So Render free
  tier **is still sleeping**, on both apps, despite the workflow. Cafyz's
  schedule had not fired at all 3 h after being pushed; only the manual run
  shows. The workflow is better than nothing and costs nothing, but it is
  **not** a guarantee a reviewer avoids a cold start. The only reliable fix is
  a paid always-on Render instance (~$7/mo) until the apps are approved.
  Note that scheduled
  workflows are auto-disabled after 60 days of repo inactivity, and free-tier
  cron can drift by 10+ minutes — a paid always-on Render plan is the only
  hard guarantee during review.
- **FitCore:** no keep-awake workflow either; its API is on a different host
  (`fitcore.ametronyx.com`) and was not measured. Worth checking.

---

## 0c. ⚠️ SECURITY — reviewer password is public (pre-existing)

**`cafyz` is a PUBLIC GitHub repo**, and the App Review demo password
the old demo password was committed in it in ~18 places, including as a hardcoded
fallback in server source:

```
backend/src/services/ensureStoreDemo.ts
  const DEMO_PASSWORD = process.env.STORE_DEMO_PASSWORD ?? '<burned password>';
```

Also in `backend/.env.example`, `store-release/CHECKLIST.md`,
`store-release/android/metadata.md`, `store-release/demo-account.md`, the
screenshot scripts and the tests. It dates back to commit `1abe0a0`, long
before this session.

Unless `STORE_DEMO_PASSWORD` is set on Render, that string **is** the live
password for `reviewer@cafyz.com`, which has full owner access to the demo
restaurant on production.

**To fix properly:**
1. Set a strong `STORE_DEMO_PASSWORD` on Render and update App Store Connect →
   App Review Information with the new value.
2. Remove the hardcoded fallback in `ensureStoreDemo.ts` — fail closed rather
   than defaulting to a known password.
3. Treat the old string as burned. Scrubbing git history is optional (it is
   already public and indexed); rotating the secret is what actually matters.

Coorg Trade and FitCore are private repos, so the same pattern is lower risk
there, but worth the same treatment.


---

## 0d. ROTATING THE REVIEWER PASSWORD — runbook

### Code side: DONE and pushed (23 Oct)
- `ensureStoreDemo.ts` no longer has a hardcoded password. Config is read
  **at call time** via `demoConfig()`, not at import, so a restart is what
  rotates the password, and a missing `STORE_DEMO_PASSWORD` disables the demo
  account instead of falling back to a known one.
- The burned string is gone from `.env.example`, the three screenshot scripts
  (they now exit with a message if the var is unset), and the store docs.
- `ensureStoreDemo.test.ts` uses a fake value and now actually exercises the
  env var. It also had a **pre-existing failure** — it asserted plan `pro`
  while `289a3ee` moved the demo restaurant to `premium` — fixed.
- Full backend suite: **211 passed / 24 files**.

### How rotation actually works
`ensureStoreDemoAccount()` runs on every API boot and does
`UPDATE users SET password_hash=? WHERE id=?` for `reviewer@cafyz.com`.
So **setting the Render env var and letting it redeploy IS the rotation.**
Minimum length is 8 characters or the account is skipped.

### Steps for Ameen (Claude cannot type passwords into production)

1. **Generate a strong password locally** — it must never go through chat:
   ```bash
   LC_ALL=C tr -dc 'A-Za-z0-9!@#%^&*_-' < /dev/urandom | head -c 28; echo
   ```
2. **Render → `cafyz-api` → Environment** → set `STORE_DEMO_PASSWORD` to it →
   Save. Render redeploys; the new hash is written on boot.
3. **Verify** (reads the password from your shell, never hardcode it):
   ```bash
   read -rs CAFYZ_DEMO_PW && curl -s -X POST https://cafyz.onrender.com/api/auth/login \
     -H 'Content-Type: application/json' \
     -d "{\"email\":\"reviewer@cafyz.com\",\"password\":\"$CAFYZ_DEMO_PW\"}" \
     | head -c 120; unset CAFYZ_DEMO_PW
   ```
   Expect a token and `"role":"owner"`.
4. **App Store Connect → Cafyz → the version → App Review Information →
   Sign-In Information** → update the password → **Save**.
5. **Play Console → App access** → same update, if Cafyz is submitted there.
6. For screenshots later: `export STORE_DEMO_PASSWORD=...` before running the
   capture scripts, since they no longer carry a default.

### Confirmed 23 Oct — EXPOSURE IS LIVE
Verified by Ameen against production: a login POST to
`/api/auth/login` with the publicly-committed password returned **HTTP 200**.
`STORE_DEMO_PASSWORD` is NOT overridden on Render, so the password in this
public repo's history is the real one for `reviewer@cafyz.com`, an owner
account on the live demo restaurant. App Store Connect holds the same value in
plaintext in Sign-In Information.

**Rotate now — this is an open door, not a tidiness issue.**
After rotating, that same curl must return 401 instead of 200.

### Timing
**Cafyz is currently Rejected, so no reviewer is testing it right now** — this
is the safe moment to rotate. The only rule: do step 4 before any resubmit, or
App Review will land on a failed login and reject on that alone.

### The old password is burned
It is in this public repo's history from commit `1abe0a0` onward. Rewriting
history is optional and does not un-publish it; **rotating is the fix.**


---

## 0e. Firebase service-account keys (23 Oct, outside the App Store work)

Five Firebase **admin** service-account keys were loose in `~/Downloads`.
The Admin SDK bypasses Firestore and Storage security rules entirely, so each
one is full read/write on its project plus auth-user and FCM control.

**Moved** to `~/.credentials/<project>/`, dir `700`, files `600`:

| Project | Key IDs |
|---|---|
| `credi8-73f30` | `1d0911cb15…`, `ccb51d4e24…` |
| `ccg-track` | `a306efd208…`, `b680547b35…` |
| `asrar-al-asrar` | `b5dcf96bf9…` |

Moving them only reduces accidental exposure. **It is not the fix.**

### One is committed to a repo
`alameen-47/CREDI8_Latest` (**private**, 0 forks) contains
`backend/credi8-73f30-firebase-adminsdk-fbsvc-1d0911cb15.json`, added
2026-07-14 in `dfd6b285` ("Add support for SMS reminders via native SmsManager
and FCM integration"). `backend/.gitignore` already lists
`*firebase-adminsdk*.json` — the rule was added after the file was tracked, and
gitignore does not untrack. Note `alameen-47/CREDI8` is **public** and nearly
the same name; one wrong visibility toggle exposes the private one's history.

### Repo copy removed (23 Oct) — production was never using it
`render.yaml` settles it:

```yaml
- key: FIREBASE_SERVICE_ACCOUNT_PATH
  value: /etc/secrets/firebase-service-account.json
```

Production reads a **Render Secret File**, not the committed key, so removing
it could not break SMS or FCM. Removed in `e8934be` on `main`; verified gone
from the tree. The `*firebase-adminsdk*.json` rule in `backend/.gitignore` was
tested against a twin file and does catch it, so a key dropped there again will
not be committed.

Residual assumption: the Render dashboard could in principle override the
blueprint's `FIREBASE_SERVICE_ACCOUNT_PATH`. Unverified — the dashboard needs a
sign-in. **If SMS reminders or push stop working**, that is the cause: re-add
the secret file in Render (Environment > Secret Files, named
`firebase-service-account.json`) from `~/.credentials/credi8/`.

### The actual fix (blocked — needs a different Google account)
The Google account signed in to Chrome **cannot access `credi8-73f30`**
(missing `iam.serviceAccounts.list`, `resourcemanager.projects.get`) — the same
wall as the Coorg OAuth project 278037584713. So rotation must be done from the
account that owns these projects:
1. Create a new key for `firebase-adminsdk-fbsvc@credi8-73f30.iam.gserviceaccount.com`.
2. Deploy it as a Render Secret File, set `FIREBASE_SERVICE_ACCOUNT_PATH` to it.
3. Verify SMS reminders and push still work.
4. **Then delete key IDs `1d0911cb15…` and `ccb51d4e24…`.**
5. ~~`git rm --cached` the committed file.~~ Done in `e8934be`.

Step 4 is what actually closes it; the key stays in git history regardless.


---

## 0f. WHAT IS AND IS NOT FIXED (honest read, 23 Oct 16:00)

### Resubmitted on the SAME binaries
Apple is reviewing the exact builds it rejected — nothing in any app changed:

| App | Build rejected | Build now in review |
|---|---|---|
| Cafyz | 1.0 (2) | **1.0 (2)** — same |
| Coorg Trade | 1.0 (4) | **1.0 (4)** — same |
| CREDI8 | 1.0 (2) | **1.0 (2)** — same |
| FitCore Plus | — (never rejected) | 1.0.8 (11), queued since 6 Oct |

Today's code changes (arm64, package renames, demo-password handling,
keep-awake) are in the repos but **not in these builds**. They reach Apple only
after a new archive and upload.

### Genuinely fixed
- The 4.3 threads, unanswered since 6 Oct, now carry full 9-answer replies with
  PDFs on Cafyz, Coorg Trade and CREDI8. That was the actual blocker.
- Cafyz reviewer login verified working (HTTP 200).
- Firebase admin key out of `CREDI8_Latest` and out of `~/Downloads`.

### Cannot be cleared by us
4.3 Spam is a **reviewer judgement**, not a defect with a fix. The replies
argue the case; Apple decides. Apple's own warning stands: resubmitting
without substantial improvement "will be rejected again, and may be rejected
for additional issues." We resubmitted on unchanged binaries, at Ameen's
explicit instruction after that risk was raised.

### Still a live risk
Render free tier sleeping (see §0 above) — the keep-awake workflow fires every
3–5 hours, not every 10 minutes.


---

## 0g. Self-ping keep-awake (23 Oct) — replaces the GitHub cron

All three backends now ping their own public URL from inside the process every
10 minutes. The request returns through Render's router as **inbound traffic**,
which is what resets the 15-minute idle timer — a localhost ping would not, so
each one requires `RENDER_EXTERNAL_URL` (Render sets it automatically) and
skips with a warning if it is missing.

| Repo | File | Pings |
|---|---|---|
| cafyz | `backend/src/services/keepAwake.ts` | `/health` |
| Coorg Trade | `server/src/keepAwake.js` | `/api/health` |
| CREDI8_Latest | `backend/src/services/keepAwake.js` | `/api/health` |

Verified: 6 unit tests on the Cafyz one (off by default, no-URL guard, ping
interval, window, midnight-wrapping window, survives a failed ping) — Cafyz
suite now **218 passing**. The Coorg and CREDI8 copies were smoke-tested
against a local HTTP server and both delivered pings to the right path.

### ⚠️ IT IS OFF BY DEFAULT, ON PURPOSE — read the budget first
Render gives **750 free instance hours per calendar month across the whole
account**, and a month is ~730 hours. A service that never sleeps consumes
nearly the entire allowance on its own. **Exhausting it suspends every free
service in the account until the 1st** — all three APIs dark at once, which is
far worse than an occasional cold start.

Three free services awake 24/7 = ~2,190 h against a 750 cap: gone in ~10 days.

So on Render → each service → Environment:
- `KEEP_AWAKE=true`
- `KEEP_AWAKE_WINDOW=4-9` (04:00–09:59 UTC, six hours). **3 services x 6 h/day
  x 30 days = 540 h**, leaving ~210 h of headroom for real traffic that wakes a
  service outside its window. 8 h/day would be 720 h of 750 — technically under
  the cap but with almost nothing spare. Windows wrap midnight (`22-6` works).

**Confirmed 23 Oct:** the 750 hours are **per workspace per calendar month**,
pooled across every free web service, reset on the 1st, and do not roll over.
Hours are only consumed while a service is awake — which is why the current
sleep-by-default setup has never hit the cap.

Leave `KEEP_AWAKE` unset on a service to keep the old behaviour.

**The reliable alternative is a paid instance** (~$7/mo each): no sleep, no
hour cap, no window needed. Cheapest insurance while the apps are in review.

The GitHub workflows were left in place — harmless, and they cover a restart
when the process is down.


---

## 0h. The real cold-start bug (23 Oct) — the client gave up first

Waking the server was never the whole problem. A reviewer's request **does**
wake it; the question is whether the app waits long enough to see the answer.

| App | Client timeout | Cold start | Result |
|---|---|---|---|
| **Cafyz** | was **30 s** | **51.9 s measured** | **FAILED** — "check your connection" ~22 s before the server replied |
| **Coorg Trade** | was 45 s | ~30 s, Render says "about a minute" | marginal, could abort on a slow wake |
| CREDI8 | none (plain `fetch`, no AbortController) | — | never falsely errors; just a long spinner |

Both raised to **75 s**, and the timeout messages no longer blame the user's
internet ("…is taking longer than usual to respond"). A host that is genuinely
unreachable still fails fast, because `fetch` rejects outright instead of
hanging — the 75 s only applies once the connection is accepted.

- `cafyz/web-v2/src/services/api.ts` — `REQUEST_TIMEOUT_MS`
- `Coorg_Buisness_Management/src/lib/api.ts` — `TIMEOUT_MS`

Verified: Cafyz web build succeeds; `tsc` reports 23 errors both with and
without the change (all pre-existing, none in `api.ts`). Coorg's build could
not be run locally — `.mise.toml` pins Node 22 and this machine has 20.19.6,
so `pnpm install` fails. The change there is one constant and one string.

**This matters more than the keep-awake work.** Keep-awake reduces how often a
cold start happens; this fix decides whether a cold start looks like a slow app
or a broken one. Note it reaches Apple only in a new build.


---

## 0i. New builds with the cold-start fix (23 Oct)

| App | New build | Carries |
|---|---|---|
| Cafyz | **1.0 (3)** | 75 s client timeout (was 30 s), honest timeout message, self-ping keep-awake |
| Coorg Trade | **1.0 (5)** | 75 s client timeout (was 45 s), honest message, self-ping keep-awake |

Both archived and exported successfully, signed **Cloud Managed Apple
Distribution**, and uploaded via `xcodebuild -exportArchive` with
`destination: upload`. Xcode reported **"Upload succeeded" / "Uploaded App"**
for both (Cafyz 20:07, Coorg 20:09).

As of 20:15 neither had appeared in TestFlight yet — Apple's processing takes
5–30 minutes and occasionally longer. **Check TestFlight before assuming an
upload failed**, and if a build never appears, look for a rejection email from
App Store Connect (an invalid binary is reported by email, not in the UI).

### The builds under review were NOT touched
Cafyz 1.0 (2) and Coorg 1.0 (4) are still the submitted builds and both apps
remain *Waiting for Review*. Uploading a new build does not disturb an existing
submission. To actually ship the fix, the submission has to be cancelled, the
new build attached on the version page, and the app resubmitted — **which loses
queue position**, so it is a deliberate choice, not automatic.

### Build notes for next time
- **Cafyz** uses CocoaPods, and `npx cap sync ios` fails at `pod install`
  because the repo's `Gemfile` pins cocoapods 1.15.2 while Homebrew has 1.16.2.
  Run it bypassing Bundler:
  ```
  env -u BUNDLE_GEMFILE -u RUBYOPT LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 \
    /opt/homebrew/bin/pod install
  ```
- **Coorg** uses Swift Package Manager, so no pod step. But `cap sync` needs
  **Node >= 22** and this machine had 16/18/20; `nvm install 22` fixed it. Its
  `pnpm` binary is also broken (MODULE_NOT_FOUND after an nvm switch) — use
  `npx -y pnpm@10.34.3` instead. The vite build itself runs fine on Node 20.
- **Coorg had no `DEVELOPMENT_TEAM`** in `project.pbxproj`, only
  `CODE_SIGN_STYLE = Automatic`, so archiving failed with "Signing for App
  requires a development team". Now set to `647MZ9QGZJ`, matching Cafyz and
  FitCore. Earlier builds must have been made by picking the team in Xcode.
- Signing works with `-allowProvisioningUpdates`: Xcode has a usable account
  and issues a **cloud managed** distribution certificate on demand. There is
  no local Apple Distribution cert in the keychain, and none is needed.


---

## 0j. FitCore checked (23 Oct, while it was In Review)

**No timeout bug.** `src/lib/api.ts` uses a plain `fetch` with no
AbortController, like CREDI8, so a cold start is a long spinner, never a false
"check your connection". Nothing to fix there.

**Its API does sleep**, though: `fitcore-gym-management-rou5.onrender.com`,
Render free tier, with no keep-awake and no GitHub workflow. It measured
**0.62 s** when probed — warm only because a reviewer was using it at the time.

Added the same opt-in self-ping at `server/src/jobs/keepAwake.js`, wired into
`server/src/index.js`, pinging `/api/health`. Smoke-tested against a local
server. **Off unless `KEEP_AWAKE=true`**, and this is now a *fourth* free
service, so the 750-hour budget is tighter than ever — see §0g.

Unlike the client-side timeout fixes, this one **takes effect on the next
Render deploy with no new build and no resubmission**, because it runs on the
server rather than in the app.

### Keep-awake coverage now
| Service | Self-ping in code | Enabled on Render |
|---|---|---|
| cafyz-api | yes | **not yet — needs `KEEP_AWAKE=true`** |
| Coorg API | yes | **not yet** |
| credi8-backend | yes | **not yet** |
| FitCore API | yes | **not yet** |

None of them is actually keeping itself awake until the env var is set in the
Render dashboard.


---

## 1. THE HEADLINE (read this first)

**Nothing is "stuck in review." Three apps are REJECTED under Guideline 4.3.0
(Design: Spam) and Apple is waiting for a WRITTEN REPLY that was never sent.**
The clock has been burning since **6 October 2026** — 17 days of silence as of today.

Apple's message says, verbatim:

> "If you believe the app already meets the requirements of guidelines 4.3(a),
> 4.3(b) and 4.2.6, **do not resubmit the app. Instead, reply to this message and
> answer all of the following questions in full**"

So: **uploading new builds does not help. Answering the 9 questions is the only path.**

### ⚠️ DO NOT DELETE OR RE-CREATE THE APPS
Deleting the app records and re-uploading under new bundle IDs is the single
worst available move:
- 4.3 Spam is flagged at **developer-account level**, not per app.
- Re-registering the same product under a new bundle ID after a 4.3 rejection is
  the textbook evasion pattern Apple's spam enforcement targets. It escalates to
  **account termination**, which would also remove **AxPro ERP** and **Ametronyx**,
  which are currently live and earning.
- A deleted bundle ID can never be reused.
- It throws away the existing review threads, which are the only route back.

---

## 2. EXACT STATE OF EVERY APP (verified in App Store Connect, 2026-10-23)

| App | ASC ID | Status | Reality |
|---|---|---|---|
| **FitCore Plus** | 6818657311 | iOS 1.0.8 — *Waiting for Review* | Submitted 6 Oct. 17 days in queue = abnormal; likely held behind the account-level 4.3 flag. |
| **Coorg Trade** | 6809769851 | iOS 1.0 — *Prepare for Submission* | Submission of 3 Oct is **Rejected 4.3.0**. Apple msg 6 Oct. **Never replied.** Build 1.0 (4). |
| **CREDI8** | 6791469433 | iOS 1.0 — *Rejected* | Submitted 3 Oct, Unresolved Issues. Same 4.3 family. Not in local folders. |
| **Cafyz** | 6808643611 | iOS 1.0 — *Rejected* | Rejected **4.3.0 Design: Spam**. Build 1.0 (2). See thread below. |
| AxPro ERP | — | iOS 1.0.1 *Ready for Distribution* | LIVE |
| Ametronyx | — | iOS 1.0 *Ready for Distribution* | LIVE |

### Cafyz review thread (3 messages)
- **2026-09-16** Apple: 4.3 Spam rejection.
- **2026-10-03** Ameen replied — short, informal, did **not** answer the questions.
- **2026-10-06** Apple: escalated to the **full 9-question questionnaire**. No reply since.

### Coorg Trade review thread (1 message)
- **2026-10-06** Apple: same 9-question questionnaire. **No reply ever sent.**
- Submission ID `13c52e96-e09a-4ece-a8d5-bfd26be96eb1`

### Cafyz submission ID
`d49f7513-deff-4c5d-8163-1a11aab464b9`

---

## 3. WHY THIS HAPPENED (root cause)

From `Coorg_Buisness_Management/deployment/app-store/guideline-4.3-resubmission.md`
(written in an earlier session):

> A **review-delay complaint was filed that listed every app on the account as
> "similar apps."** All four were rejected under 4.3(a) the next day.

That one message told App Review the apps were one batch from one team — which is
exactly the pattern 4.3(a) exists to catch. Six business-management apps
(AxPro ERP, Ametronyx, Cafyz, Coorg Trade, CREDI8, FitCore), all Capacitor + React
shells, same branding, same account.

**Rule going forward: contact Apple about ONE app at a time. Never file parallel
expedite requests / complaints / calls about the same issue.**

---

## 4. APPLE'S 9 QUESTIONS (identical for every rejected app)

1. What the app does + primary problem solved (NOT the marketing description).
2. Intended user / specific target audience.
3. Market gap existing apps don't address.
4. Beta testing done + examples of beta feedback applied to the production build.
5. Standalone or part of a suite? If suite, how does scope differ from each other app.
6. Could this be an IAP / feature of another app on the account? Why not consolidated?
7. Does the binary share significant code/frameworks/assets with your other apps?
8. Does it share codebase/SDK/content library with any third-party app?
9. Was it built for a client/partner who provided content, concept or branding?
   (4.2.6: template-built apps must be submitted by the content provider.)

---

## 5. ASSETS ALREADY IN THE REPOS

- **FitCore reply — WRITTEN AND GOOD:**
  `FITCORE_GYM_MANAGEMENT/store-assets/ios/app-review-reply.md`
  Full honest 9-answer reply. Q4 correctly states there was **no formal external
  beta** — do not change that to invent testers.
- **Coorg 4.3 playbook:**
  `Coorg_Buisness_Management/deployment/app-store/guideline-4.3-resubmission.md`
- **Cafyz store metadata + demo account:**
  `cafyz/store-release/ios/metadata.md`, `cafyz/store-release/demo-account.md`
  Reviewer login: `reviewer@cafyz.com`, password set on Render (see §0d)

---

## 6. TECHNICAL FINDINGS (local repos)

| Finding | App | Status |
|---|---|---|
| `package.json` name is `figma-make-app` | Coorg | Cosmetic/dev-only, does NOT ship in the iOS bundle. Worth renaming anyway. |
| `package.json` name is `@figma/my-make-file` | FitCore | Same — rename as hygiene. |
| `index.html` `<!-- figma:title -->` placeholders | Coorg | **Verified safe** — `.figma/make/site.json` sets title to "Coorg Trade"; Vite plugin substitutes at build. |
| `UIRequiredDeviceCapabilities = armv7` | Cafyz | Capacitor default; should be `arm64` like the other two. Minor. |
| Google OAuth consent screen named "CREDI8" | Coorg | **Only the user can fix** (Google Cloud console). Cross-app link a reviewer could notice. |
| Render free tier sleeps after 15 min | Coorg/Cafyz | Must be always-on during review or reviewer sees a dead app. |

---

## 7. FACTS — CONFIRMED BY AMEEN 2026-10-23

- **Q4 beta testing:** No formal TestFlight/external beta for any app. Internal
  device testing only. Both replies state this honestly. **Never change this to
  invent testers** — Apple can check TestFlight records.
- **Q9 Coorg Trade:** NOT built for a client. Ametronyx's own product, own brand,
  licensed to many traders. Safe to submit under this developer account.
- **CREDI8:** to be handled **after** Cafyz and Coorg replies are in. One at a time.

Both drafts are now **send-ready** — no placeholders left.

## 8. PLAN

1. ~~Diagnose actual ASC state~~ **DONE**
2. ~~Write full 9-answer replies for **Cafyz** and **Coorg Trade**~~ **DONE** — drafts at:
   - `cafyz/store-release/ios/app-review-reply.md`
   - `Coorg_Buisness_Management/deployment/app-store/app-review-reply.md`
   - (FitCore already had one: `FITCORE_GYM_MANAGEMENT/store-assets/ios/app-review-reply.md`)
   Each has Q4 and Q9 marked `[CONFIRM BEFORE SENDING]`.
3. Confirm the facts in §7 with Ameen, then paste each reply into its thread.
4. Send each reply in the Resolution Center — **one app at a time**, no resubmit
   unless Apple says to.
5. Leave **FitCore** alone — it is already in the queue; do not touch it.
6. Fix the §6 hygiene items (package names, armv7, Google OAuth branding, Render always-on).
7. If a rejection is upheld and is genuinely wrong:
   App Review Board appeal — https://developer.apple.com/contact/app-store/?topic=appeal

---

## 9. HONEST TIMELINE EXPECTATION

**"Live within 2 days" cannot be guaranteed by anyone — it is Apple's decision, not ours.**
Realistic: a 4.3 questionnaire reply typically draws an Apple response in **2–7 days**.
If the answers are accepted, approval can follow within a day or two.
The fastest real lever is **sending a complete, substantive reply today**.
Every day the thread sits unanswered is a day added to the wait.

**Do not** file an expedited-review request as well — parallel contact is what
caused this rejection in the first place.
