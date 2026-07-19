# Phase 0 Task 0.2 — WALY Threads Account + Meta App Setup (Manual)

> For: WALY Mobile / Risev marketing automation
> Prereq: You have admin access to the Instagram account that represents WALY Mobile (Threads uses Instagram for identity).
> Time estimate: ~15–25 minutes if you already have an Instagram for WALY; +10 min if you need to create one.
> Status: BLOCKING — Phase 1 cannot start until step 8 produces a long-lived token.

---

## Why this is manual

Threads API authenticates via OAuth 2.0 — Meta requires a human to log into Threads, consent to the app's permissions, and grant an authorization code. This can't be scripted. Once you've run the OAuth flow once and exchanged the code for a long-lived token, everything after that is automatable.

---

## Step 0 — Have an Instagram account for WALY Mobile

Threads uses Instagram for sign-in. If you don't already have one:
1. Install Instagram (or use web).
2. Sign up with a phone/email dedicated to WALY (e.g. `hello@waly…` / your business +60 number).
3. Username suggestion: `waly.mobile` or `walymobile` (whichever is free).
4. Switch the account to **Professional / Business** (Settings → Account type → Switch to professional account → Business). This unlocks insights + API eligibility.
5. Fill the bio: "Loyalty + WhatsApp marketing for Malaysian merchants. RM79/mo, 7-day free trial." + link to https://waly… (your web app).

Skip if you already have this.

---

## Step 1 — Create a Threads account for WALY Mobile

1. Install the Threads app (iOS/Android) or go to threads.net.
2. Sign in **using the Instagram account from Step 0** (not a personal one).
3. Choose the same username as Instagram (Threads auto-suggests it).
4. **Set the profile to PUBLIC** — required for token refresh to work later. Settings → Account → Public profile = ON.
5. Add a profile photo (use `assets/` in the repo if there's a logo — likely `web-app/assets/`).
6. Bio: copy from Step 0.

You now have a Threads account. The username is what people will see; the **Threads user ID** (numeric) is what the API uses — we'll grab that in Step 6.

---

## Step 2 — Create a Meta App

1. Go to https://developers.facebook.com/ and log in with the **same Instagram/Threads identity** (or a Facebook account that's an admin of the WALY Business Manager).
2. Click **My Apps** → **Create App**.
3. App name: `WALY Mobile Marketing` (internal — only Meta sees this).
4. App contact email: your WALY email.
5. Business account: select WALY's if you have one; otherwise "Personal" is fine for self-publishing.
6. **Use case**: pick **"Threads"** when prompted (this matters — it sets which permissions the app can request).
7. Once created, you'll land on the App Dashboard.

⚠️ **Two app IDs / app secrets will be generated.** For Threads API, use the **Threads app ID** and its matching app secret (NOT the Facebook app ID). The dashboard labels them clearly.

---

## Step 3 — Add the Threads Use Case (if not auto-selected)

1. In the App Dashboard left sidebar → **Use Cases** → **Threads** → **Add** or **Set Up**.
2. Confirm the Threads use case is enabled.

---

## Step 4 — Add yourself as a Threads Tester

Required so your Threads account can grant permissions to the app before App Review.

1. In the App Dashboard → **Roles** → **Threads Testers** → **Add**.
2. Enter the Threads username / IG handle of the WALY account from Step 1.
3. Meta sends an invitation.
4. Open the **Threads app** → Settings → **Account settings** → **Permissions** → **Invites** → **Accept** the WALY Mobile Marketing app invite.

Now your Threads account can grant permissions to your own app — no App Review needed.

---

## Step 5 — Get a short-lived access token (OAuth flow)

Easiest path for a one-off self-publishing app: **Meta's Graph API Explorer**.

1. Go to https://developers.facebook.com/tools/explorer/
2. Select your app (`WALY Mobile Marketing`) in the dropdown.
3. Click **"Generate Access Token"**.
4. Select permissions: **`threads_basic`** and **`threads_content_publish`** (these are the two required for publishing).
5. Authorize as your **WALY Threads account** (log into Instagram when prompted, then continue as the WALY Threads profile).
6. Copy the **short-lived access token** (valid 1 hour — we'll exchange it immediately).

Alternative: Meta's open-source sample app — https://github.com/threads-api/threads-api-sample-app — runs the same OAuth flow locally if you'd rather see what's happening. Optional.

---

## Step 6 — Get your Threads user ID

While you have the short-lived token, grab the numeric Threads user ID:

```bash
curl -s "https://graph.threads.com/v1.0/me?fields=id,username&access_token=<SHORT_LIVED_TOKEN>"
```

Expected response:
```json
{ "id": "1234567890123456", "username": "waly.mobile" }
```

Save both — `id` is the `THREADS_USER_ID`.

---

## Step 7 — Exchange for a long-lived token (60 days)

Run this curl, replacing the placeholders:

```bash
curl -i -X GET "https://graph.threads.com/access_token\
  ?grant_type=th_exchange_token\
  &client_secret=<THREADS_APP_SECRET>\
  &access_token=<SHORT_LIVED_ACCESS_TOKEN>"
```

- `<THREADS_APP_SECRET>` = the Threads app secret from Step 2 (App Dashboard → Settings → Basic → App Secret).
- `<SHORT_LIVED_ACCESS_TOKEN>` = the token from Step 5.

Response:
```json
{
  "access_token": "<LONG_LIVED_ACCESS_TOKEN>",
  "token_type": "bearer",
  "expires_in": 5183944
}
```

`expires_in` ≈ 60 days in seconds. Save `<LONG_LIVED_ACCESS_TOKEN>` — this is what the automation uses.

---

## Step 8 — Hand the secrets to Hermes

Send me (in chat) the three values below. I'll store them as Hermes secrets / env vars — **never written to the repo**, consistent with WALY's `.env` policy in `AGENTS.md`.

```
THREADS_USER_ID      = <numeric id from Step 6>
THREADS_ACCESS_TOKEN = <long-lived token from Step 7>
THREADS_APP_SECRET   = <app secret from Step 2 — needed for monthly refresh>
```

Optionally also tell me the **Threads @username** (e.g. `waly.mobile`) so I can reference it in the published.md log.

Once I have these three, Phase 1 can start immediately.

---

## Sanity check — verify publishing works (do this yourself before handing over)

Optional but recommended — proves end-to-end before we build automation:

```bash
# 1. Create a text container
curl -s -X POST \
  -d "media_type=TEXT" \
  -d "text=Test post from WALY Mobile marketing automation. 🚀" \
  -d "access_token=<LONG_LIVED_ACCESS_TOKEN>" \
  "https://graph.threads.com/v1.0/<THREADS_USER_ID>/threads"
# → { "id": "<CONTAINER_ID>" }

# 2. Wait ~5 seconds for text posts (30s for image/video)

# 3. Publish the container
curl -s -X POST \
  -d "creation_id=<CONTAINER_ID>" \
  -d "access_token=<LONG_LIVED_ACCESS_TOKEN>" \
  "https://graph.threads.com/v1.0/<THREADS_USER_ID>/threads_publish"
```

If a test post appears on your Threads profile, you're done. Delete it via the Threads app or:
```bash
curl -X DELETE "https://graph.threads.com/v1.0/<CONTAINER_ID>?access_token=<LONG_LIVED_ACCESS_TOKEN>"
```

---

## Common pitfalls

- **Wrong app ID/secret pair** — there are two; use the Threads one, not the Facebook one.
- **Private Threads profile** — token refresh won't extend the permission grant. Keep it public.
- **Short-lived token expired before exchange** — they last only 1 hour. Exchange immediately after Step 5.
- **Tester invite not accepted** — OAuth will fail with "permission not granted" until the invite is accepted in Threads settings.
- **Instagram account not set to Professional** — some Threads API features require a professional/business Instagram. Recommended to switch.
- **Account in Malaysia** — Threads API is available in Malaysia (no geo-block). No issue expected.

---

## After this is done

Send me the three secrets in chat. I'll:
1. Store them via Hermes (never in repo).
2. Run the sanity-check curl myself to confirm.
3. Move into Phase 1 — building the house style guide + setting up Stream B (copywriting study cron).