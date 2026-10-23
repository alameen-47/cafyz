# App Store recovery — live status & handoff

**Last updated:** 2026-10-23 17:55 (session 1) — ALL FOUR IN REVIEW
**Purpose:** Full state so any new session / account can resume with zero re-investigation.
**Apple account:** Ameen Khan — Ametronyx. Team ID `647MZ9QGZJ`.

---

## 0. CURRENT STATE — ALL THREE IN REVIEW (23 Oct, 16:35)

| App | Status |
|---|---|
| **Cafyz** | iOS 1.0 (2) — **Waiting for Review** |
| **Coorg Trade** | iOS 1.0 (4) — **Waiting for Review** |
| **FitCore Plus** | iOS 1.0.8 (11) — **Waiting for Review** |
| **CREDI8** | iOS 1.0 (2) — **Waiting for Review** |

Nothing on the account is rejected any more. AxPro ERP and Ametronyx stay live.

**CREDI8** (ASC 6791469433, submission `d6ffe14c-0dbe-401c-94d3-76086dfafd42`):
9-answer reply sent 17:48 with `CREDI8-App-Review-answers.pdf`, then resubmitted.
It is a credit book (khata/udhaar) for shops selling to regular customers on
credit — balances with due dates, part payments, overdue/pending/paid filters,
WhatsApp or SMS reminders with the amount pre-filled, monthly reminder
schedule, contact and CSV/Excel import. Source: `alameen-47/CREDI8_Latest`
(private). Stack verified from its package.json: Capacitor, React, MUI,
Radix UI, Tailwind, Recharts, `@capacitor-community/contacts`,
`@capgo/capacitor-social-login`. Its README is a Figma Make bundle header, and
its package name is `@figma/my-make-file` — the same scaffold label renamed in
the other repos; worth renaming there too.

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
  ✅ **Pushed and verified live** (23 Oct): the workflow shows as *active* on
  GitHub and a manual `workflow_dispatch` run finished `✓ ping in 2s`.
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
