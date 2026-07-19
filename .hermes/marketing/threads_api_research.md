# Phase 0 — Threads API Research (WALY Mobile marketing automation)

> Research date: 2026-07-19
> Source: https://developers.facebook.com/documentation/threads/ (Threads API docs)
> Status: **PUBLISHABLE** — Threads API is live, open, and supports everything we need.

---

## TL;DR

✅ **Threads API is fully publishing-enabled for business use in 2026.**
✅ Endpoint confirmed: `POST /{threads-user-id}/threads` → `POST /{threads-user-id}/threads_publish` (two-step).
✅ Rate limit is generous: **250 API-published posts / 24h** — we plan 1–2/day, ~3% of quota.
✅ Long-lived tokens (60 days) + refresh endpoint → fully automatable without daily manual re-auth.
✅ Text post limit: **500 characters** (emojis counted by UTF-8 bytes).
✅ Supports image / video / carousel / replies / quote / repost / polls / location / ghost posts.

**No blocker.** Phase 1 can proceed once WALY creates a Meta App + Threads account (see Q4 in the plan).

---

## 1. API host & versioning

- Base URL: `https://graph.threads.com/v1.0/` (or `graph.threads.net`)
- Auth: OAuth 2.0, **Threads user access tokens** (app-scoped to the app+user pair).
- All publishing/profile/media requests require a Threads user access token.

---

## 2. Publishing flow (single text/image/video post) — TWO steps

This is the flow we'll use for WALY marketing posts.

### Step 1 — Create a media container
```
POST /{threads-user-id}/threads
```
Parameters (text-only post):
- `media_type=TEXT` (required; also `IMAGE` or `VIDEO`)
- `text` (required for TEXT; ≤500 chars; first URL in text becomes link preview)
- `access_token` (required)
- `is_carousel_item=false` (default for single posts)

Example (text-only — our main use case):
```bash
curl -i -X POST \
  -d "media_type=TEXT" \
  -d "text=<POST_TEXT>" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.threads.com/v1.0/<THREADS_USER_ID>/threads"
```
Response:
```json
{ "id": "<THREADS_MEDIA_CONTAINER_ID>" }
```

For image posts (optional later — e.g. card-design screenshots):
```bash
curl -i -X POST \
  -d "media_type=IMAGE" \
  -d "image_url=<IMAGE_URL>" \
  -d "text=<CAPTION>" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.threads.com/v1.0/<THREADS_USER_ID>/threads"
```
⚠️ `image_url` must be **publicly accessible** — Threads downloads the image from that URL. For WALY, host on the existing VPS Caddy or Vercel CDN.

### Step 2 — Publish the container
```
POST /{threads-user-id}/threads_publish
```
Parameters:
- `creation_id` (required — the container ID from Step 1)
- `access_token` (required)

Docs note: wait ~30 seconds between Step 1 and Step 2 to let Meta process the upload.

```bash
curl -i -X POST \
  -d "creation_id=<MEDIA_CONTAINER_ID>" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.threads.com/v1.0/<THREADS_USER_ID>/threads_publish"
```

**Implication for the publish script:** the script must (1) POST to create, (2) sleep ~30s for IMAGE/VIDEO (instant for TEXT), (3) POST to publish. A text-only flow can skip the sleep.

---

## 3. Rate limits (way more than we need)

| Action | Limit | Window | Required permissions |
|---|---|---|---|
| **Posts** | **250** | 24h rolling | `threads_basic`, `threads_content_publish` |
| Replies | 1,000 | 24h | + `threads_manage_replies` |
| Deletions | 100 | 24h | + `threads_delete` |
| Location searches | 500 | 24h | + `threads_location_tagging` |
| App call count | `4800 × impressions` | 24h | (impressions min 10) |
| CPU time | `720000 × impressions` | 24h | |
| Total time | `2880000 × impressions` | 24h | |

**Check current usage anytime:**
```bash
curl -s -X GET \
  "https://graph.threads.com/v1.0/<THREADS_USER_ID>/threads_publishing_limit?fields=quota_usage,config&access_token=<ACCESS_TOKEN>"
```
Response shape: `{ "data": [{ "quota_usage": 4, "config": { "quota_total": 250, "quota_duration": 86400 } }] }`

**WALY plan: 1 post/day (week 1) → 2 posts/day (week 2+) = max ~60 posts/month, ~2% of quota.** No risk of hitting limits.

---

## 4. Auth & tokens

### Short-lived (1 hour)
- Obtained via the **Authorization Window** (OAuth): user logs into Threads, grants permissions, redirected back with an authorization code, code is exchanged for a short-lived token.

### Long-lived (60 days) — what we'll use
Exchange a short-lived token:
```bash
curl -i -X GET "https://graph.threads.com/access_token
  ?grant_type=th_exchange_token
  &client_secret=<THREADS_APP_SECRET>
  &access_token=<SHORT_LIVED_ACCESS_TOKEN>"
```
Response:
```json
{
  "access_token": "<LONG_LIVED_ACCESS_TOKEN>",
  "token_type": "bearer",
  "expires_in": 5183944
}
```
`expires_in` ≈ 60 days in seconds.

### Refresh (extend another 60 days, before expiry)
```bash
curl -i -X GET "https://graph.threads.com/refresh_access_token
  ?grant_type=th_refresh_token
  &access_token=<LONG_LIVED_ACCESS_TOKEN>"
```

⚠️ **Permission grants are valid 90 days for public profiles.** Refreshing the long-lived token extends the permission grant another 90 days **only if the Threads account is public**. If WALY's Threads profile is private, we'd need to re-auth every 90 days — **recommend keeping WALY's Threads profile public.**

**Automation implication:** a small monthly cron job can call `refresh_access_token` to keep the token alive indefinitely (as long as the profile stays public). Add this to the plan as a maintenance task.

---

## 5. Permissions we need

For text/image publishing:
- `threads_basic`
- `threads_content_publish`

Optional (later):
- `threads_manage_replies` — to auto-reply to comments
- `threads_location_tagging` — to tag Malaysia location on posts
- `threads_delete` — to retract bad posts

**App Review:** Without App Review approval, the app can only post to its own account and tester accounts. Since WALY will post only to **its own Threads account**, **no App Review is needed** — we can post immediately once the app + token are set up. App Review only matters if we later want to post on behalf of *other* users (e.g. our merchants' Threads accounts) — that's a future feature, not Phase 0.

---

## 6. Account & app setup steps (Phase 0 Task 0.2 — needs user)

This is the manual part WALY's owner must do (cannot be automated):

1. **Create a Threads account** for WALY Mobile (if not already) at threads.net — sign up with the Instagram account linked to the business. Set profile to **public**.
2. **Go to Meta Developer Dashboard** → https://developers.facebook.com/ → "Create App".
3. Pick the **Threads Use Case** when creating the app.
   - Two app IDs / secrets will be generated; use the **Threads app ID** + its **app secret** for everything.
4. In the app, add the **Threads Use Case** if not selected.
5. Add yourself as a **Threads Tester** (App Dashboard → Roles → Threads Testers → send invite → accept in Threads settings).
6. Implement / use the **Authorization Window** to get a short-lived token. Easiest path for a single-business self-publishing app: use the **Graph API Explorer** or Meta's [Threads API sample app](https://github.com/threads-api/threads-api-sample-app) to run the OAuth flow once manually.
7. Exchange the short-lived token for a **long-lived token** (curl in §4).
8. Get the **Threads user ID** — query `GET /me?fields=id,username&access_token=<TOKEN>` against `graph.threads.com`.
9. Store `THREADS_USER_ID` + `THREADS_ACCESS_TOKEN` + `THREADS_APP_SECRET` (for refresh) somewhere safe outside the repo (WALY's `.env` policy from `AGENTS.md` — never commit).

**Output needed from user:** the long-lived access token + Threads user ID (and the app secret if we want automated refresh). I'll never write these to the repo.

---

## 7. Content limits / specs (relevant to our text-first plan)

- **Text posts: 500 characters max** (emojis = UTF-8 byte count, not 1 char each).
- Carousel: 2–20 items.
- Image: JPEG/PNG, ≤8MB, 320–1440px wide, ≤10:1 aspect ratio, sRGB.
- Video: MOV/MP4, H.264/HEVC, 23–60fps, ≤5 min, ≤1GB, ≤1920px wide.
- First URL in `text` field becomes the link preview (good for "free trial" CTAs pointing to https://waly…).

**For WALY's plan:** 150–280 char text posts → comfortably under 500, leaves room for hashtags + a CTA URL.

---

## 8. What's NOT available via the API (relevant)

- **No native post scheduling** — we handle scheduling with Hermes `cronjob` instead.
- **No engagement metrics per-post** via the basic API. Insights endpoint exists but is aggregate (views/likes/replies/shares/reposts/quotes over a window). For weekly review, we'll use the Insights endpoint or manual review.
- **No hashtag querying / trending API.**
- **No bulk publish** — one POST + one publish per post.

---

## 9. Decision: Go / No-Go

✅ **GO.** All blockers from the original plan Q1 are resolved:
- Publishing endpoint is live and open to any business account.
- 250 posts/24h limit vastly exceeds our 1–2/day plan.
- Long-lived tokens + refresh → unattended operation possible.
- No App Review needed (self-publishing to own account).
- Only manual steps left: create Threads account + Meta App + grab the long-lived token (§6 above).

---

## 10. Updates to the original plan

Two changes worth noting to the plan in `2026-07-19_012516-waly-threads-automation.md`:

1. **Add a token-refresh maintenance cron** — monthly `cronjob` calling `refresh_access_token` so the long-lived token never expires. Low priority (token lasts 60 days; we'd notice). Recommend adding as a Phase 4 task.
2. **Two-step publish script** — the publish script in Phase 3 Task 3.3 must do **container-creation → (sleep 30s if media) → publish**, not a single call. For text-only posts (our default), the sleep can be skipped or shortened.
3. **Keep WALY Threads profile public** — required for token refresh to extend permission grants. Document in `marketing/README.md`.

---

## Next step (Phase 0 Task 0.2 — needs user input)

Answer Q4 from the plan:
- Do you already have a Threads account linked to your Instagram/Facebook for WALY Mobile? If yes → we just need to create the Meta App and grab a long-lived token (steps 2–8 above, ~15 min of manual work).
- If no → I'll write a step-by-step setup doc you can follow, then we proceed.

Once you have a `THREADS_USER_ID` + long-lived `THREADS_ACCESS_TOKEN`, hand them to me in chat (I'll store them via Hermes secrets, never in the repo) and we move to Phase 1 (house style guide).