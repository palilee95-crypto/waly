# WALY Mobile — Threads.com Marketing + Copywriting-Study Automation Plan

> **For Hermes:** Use `cronjob` to schedule recurring jobs, `delegate_task` for research/synthesis, `memory` to persist the house style guide, and `skill_manage` if a reusable copywriting workflow emerges. **Do not implement yet — this is planning only.** Confirm with the user before building.

**Goal:** Stand up two recurring automations for WALY Mobile (Risev) that (1) publish marketing content to Threads.com on a fixed cadence and (2) continuously study copywriting frameworks + competitor swipe files to match our B2B-loyalty-SaaS-for-merchants business model — producing a living "house style guide" that every Threads post is generated from.

**Business context (from `AGENTS.md`):**
- **Product:** Risev — customer-loyalty / WhatsApp-marketing SaaS for merchants.
- **Market:** Malaysia (phone +60, RM79/mo Pro plan, English + Bahasa Malaysia, 403 i18n keys).
- **Buyer:** Small/medium Malaysian merchants (cafés, salons, retail) who want repeat customers via stamp cards, vouchers, points, tiers, and WhatsApp broadcasts.
- **Differentiators:** All-in-one (loyalty + WhatsApp marketing + rewards), WhatsApp-native (Evolution Go), Pro plan with 7-day trial, dual-role (customer + merchant) app.
- **Current marketing:** None. Cold start.
- **Repo:** `C:\Users\User\Documents\Work\WALY MOBILE\web-app` (Expo + PocketBase + Evolution Go). Backend already has a daily-cron pattern (`pb_hooks/automation_runner.pb.js`) and a WhatsApp broadcast system — useful precedent for cadence + anti-spam, but **this plan is for outbound social marketing on Threads, not in-app messaging.**

**Tech stack for the automations:**
- **Hermes `cronjob`** — schedules both jobs.
- **Hermes `web_search` / `web_extract`** — competitor research + Threads API docs.
- **Hermes `delegate_task`** — research synthesis + draft generation (isolated context, parallelizable).
- **Hermes `memory`** — persistent house style guide + swipe file index (survives across sessions).
- **Threads API (Meta)** — publishing. Status: Meta opened the Threads API in 2024 for publishing to professional accounts. **Must verify current endpoints/scopes before implementation** (open question Q1).

---

## Two Automation Streams

### Stream A — Threads Publishing Automation
Publishes 1 Threads post per weekday (5/week) at the best Malaysian-engagement window (12:30 MYT lunch + 19:30 MYT after-work). Posts rotate through 5 content pillars (defined in the house style guide):

1. **Pain-point hooks** — "Why your regulars don't come back (and how to fix it in 30 sec)"
2. **Product value** — a single Risev feature (stamps, WhatsApp blast, auto win-back, tiers, vouchers)
3. **Merchant success story / scenario** — mini case study (anonymized or composite)
4. **Educational** — loyalty/WhatsApp marketing tips for Malaysian SMBs
5. **Soft CTA / trial** — "7-day free trial, no card" with a one-line benefit

### Stream B — Copywriting Study Automation
Daily, studies copywriting and produces/updates the house style guide:

- Monitors a rotating set of swipe sources: competitor Threads accounts (other loyalty/CRM/SaaS-for-SMB brands), classic copywriting frameworks (AIDA, PAS, BAB, 4Ps, FAB, Schwartz's "Awareness Stages"), and Malaysian SMB marketing angles.
- Extracts patterns (hook structures, CTA phrasing, length, tone, hashtag use).
- Updates `memory` entries: `waly_threads_house_style`, `waly_swipe_index`, `waly_content_pillars`, `waly_post_templates`.
- Flags swipe-worthy posts into a swipe file under `web-app/.hermes/marketing/swipe/`.

The two streams are **chained**: Stream B (study) runs first and refreshes the style guide; Stream A (publish) reads the style guide to draft the day's post. Use `cronjob` `context_from` to feed Stream B's latest output into Stream A.

---

## Proposed Approach (high level)

```
┌─────────────────────────────────────────────────────────────┐
│  Stream B (daily, 07:00 MYT) — Copywriting study            │
│  web_search competitors / frameworks                         │
│  → delegate_task: synthesize patterns                        │
│  → memory: update house style guide + swipe index            │
│  → output: brief of the day's "angle + pillar"               │
└─────────────────────────────────────────────────────────────┘
                          │ context_from
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Stream A (twice daily, 12:30 & 19:30 MYT) — Publish         │
│  read style guide from memory                                │
│  → delegate_task: draft Thread post (EN + optionally BM)     │
│  → user approval gate (first 2 weeks) OR auto-publish        │
│  → POST to Threads API                                       │
│  → log post to web-app/.hermes/marketing/published.md        │
└─────────────────────────────────────────────────────────────┘
```

**Approval gate:** For the first 2 weeks of running, Stream A should **draft and deliver to chat for human approval** (not auto-post). After approval cadence stabilizes, switch to auto-publish with a weekly review digest. This protects brand voice before the model has been trained on the house style guide.

---

## Step-by-Step Plan

### Phase 0 — Verify Threads API access (BLOCKER, do first)

**Objective:** Confirm we can actually publish to Threads programmatically before building anything.

**Tasks:**

#### Task 0.1: Research Threads API current state
- Use `web_search` for "Threads API publishing 2026 rate limits" and "Threads API post endpoint documentation".
- Confirm: required account type (professional), auth flow (OAuth 2 + Facebook Page link), publishing endpoint (`POST /v1.0/me/threads` or similar), rate limits, media support, char limit (500).
- **Output:** a short findings note saved to `web-app/.hermes/marketing/threads_api_research.md`.

#### Task 0.2: Confirm WALY has / can create a Threads professional account
- Ask user: does WALY Mobile already have a Threads account linked to its Facebook Page, or do we need to create one?
- If creating: document the manual steps (account creation, link to FB Page, switch to professional, get API access in Meta App Dashboard).
- **Output:** `web-app/.hermes/marketing/threads_account_setup.md`.

#### Task 0.3: Store credentials safely
- Once we have a long-lived access token + Threads user ID, store in Hermes via `hermes config` or a `.env`-style secret **outside the repo** (consistent with WALY's `.env` policy in `AGENTS.md` — "Never commit the real `.env`").
- **Output:** token stored; never written to the workspace.

**Gate:** Do not proceed to Phase 1 until Task 0.1 confirms a usable publishing API. If Threads API is still gated/limited, fall back to **draft-and-schedule via Hermes delivery + manual paste** until access opens.

---

### Phase 1 — Build the house style guide (one-time, then maintained by Stream B)

**Objective:** A concrete, living document that defines WALY's Threads voice, post structures, and content pillars — every generated post references it.

**Files:**
- Create: `web-app/.hermes/marketing/house_style.md`
- Create: `web-app/.hermes/marketing/swipe/.gitkeep`
- Create: `web-app/.hermes/marketing/published.md` (append-only log)

#### Task 1.1: Define brand voice + positioning
- **Buyer persona:** Malaysian SMB merchant (café/salon/retail owner), 25–45, mobile-first, time-poor, sensitive to monthly fees, wants more repeat customers.
- **Voice:** warm, practical, direct, lightly energetic. Not hypey. Bilingual awareness (English primary, Bahasa Malaysia sprinkled where natural — e.g. "Hai, boss!").
- **Taboos:** no buzzword salad ("synergistic omnichannel loyalty"), no fake urgency ("LAST CHANCE!!"), no disparaging competitors by name.
- **Output:** Section 1 of `house_style.md`.

#### Task 1.2: Define 5 content pillars + posting rotation
- Pillars A–E as above. One pillar per weekday, rotating.
- Each pillar has: goal, example hook, example CTA, do/don't.
- **Output:** Section 2 of `house_style.md`.

#### Task 1.3: Define 6 reusable post templates (one per pillar + 1 CTA)
- Each template: hook line, value/scenario line, soft CTA, optional hashtag block, optional BM variant.
- Use classic frameworks mapped to pillars:
  - Pain-point → PAS (Problem-Agitate-Solve)
  - Product value → FAB (Feature-Advantage-Benefit)
  - Success story → BAB (Before-After-Bridge)
  - Educational → AIDA (Attention-Interest-Desire-Action)
  - Soft CTA → 4Ps (Promise-Picture-Proof-Push)
- **Output:** Section 3 of `house_style.md` with copy-pasteable templates.

#### Task 1.4: Save the guide to memory
- Use `memory` with `target='memory'` to persist a compact version (`waly_threads_house_style`) that survives across sessions. Full detail stays in the markdown file; memory holds the pointer + key rules.
- **Output:** memory entry created.

---

### Phase 2 — Stream B: Daily copywriting study (cron job)

**Objective:** A daily Hermes `cronjob` that studies copywriting and refreshes the house style guide.

**Files:**
- Create: `web-app/.hermes/marketing/swipe/` (grows over time)

#### Task 2.1: Define the study prompt
- Self-contained prompt for the cron job (cron jobs run with no chat context — must include everything).
- Inputs: 5–10 named competitor Threads handles / brand names (user to confirm list in Q2). Rotating focus per weekday (one framework, one competitor, one angle).
- Work the agent does each run:
  1. `web_search` for the day's competitor + framework.
  2. Extract 3–5 patterns (hook structure, length, CTA phrasing, hashtag usage).
  3. Save any exceptional post to `web-app/.hermes/marketing/swipe/YYYY-MM-DD-<source>.md`.
  4. `memory` — update `waly_swipe_index` (append new entries) and `waly_threads_house_style` if a clear improvement is found.
  5. Output: a 5-line "today's brief" naming the angle + pillar for Stream A.
- **Output:** the prompt text (saved in this plan, then embedded in the cronjob `prompt` field).

#### Task 2.2: Create the cronjob
- `cronjob action='create'`
  - `name`: `waly-copywriting-study`
  - `schedule`: `0 7 * * *` (07:00 MYT daily — Asia/Kuala_Lumpur; if Hermes cron is UTC, use `23 * * * *` = 07:00 MYT = 23:00 UTC previous day; verify in Q3).
  - `prompt`: <the self-contained prompt from Task 2.1>
  - `skills`: `[]` (no skill needed; uses web tools natively)
  - `enabled_toolsets`: `["web", "file", "memory"]`
  - `deliver`: `local` (silent — the brief gets pulled via `context_from` by Stream A, not chatted to the user)
- **Output:** `job_id_b` captured.

---

### Phase 3 — Stream A: Threads publishing (cron job)

**Objective:** A Hermes `cronjob` that drafts and publishes (or queues for approval) a Threads post twice daily.

#### Task 3.1: Define the publishing prompt
- Self-contained. Reads style guide from `memory` and today's brief from Stream B (`context_from: [job_id_b]`).
- Steps in the prompt:
  1. Load `waly_threads_house_style` and `waly_post_templates` from memory.
  2. Read today's brief (Stream B output) for angle + pillar.
  3. Draft a post using the matching template. ~150–280 chars. One hook line, one value/scenario line, one soft CTA. Optional BM variant as a second post in a thread reply.
  4. **If in approval mode (first 2 weeks):** deliver draft to chat via `deliver='origin'` and STOP. Wait for user to approve/edit; on approval, the user pastes into Threads (or replies "post it" and a follow-up cron/action publishes).
  5. **If in auto mode:** call the Threads API via `terminal` (curl with stored token) to publish. Append to `web-app/.hermes/marketing/published.md`.
- **Output:** the prompt text.

#### Task 3.2: Create the cronjob
- `cronjob action='create'`
  - `name`: `waly-threads-publish`
  - `schedule`: `30 4,11 * * *` (12:30 MYT and 19:30 MYT, assuming UTC cron → 04:30 UTC and 11:30 UTC; verify in Q3).
  - `prompt`: <the self-contained prompt from Task 3.1>
  - `context_from`: `[<job_id_b>]` — chains Stream B → Stream A.
  - `enabled_toolsets`: `["web", "terminal", "file", "memory"]`
  - `deliver`: `origin` (approval mode — drafts go to chat) OR `local` (auto mode — silent publish).
- **Output:** `job_id_a` captured.

#### Task 3.3: Build a small publish script (only for auto mode)
- If auto-publishing, write a tiny bash script `web-app/.hermes/marketing/publish_threads.sh` that takes a JSON post body and curls the Threads API. Keeps the cron prompt clean (no inline curl).
- Token read from env (`THREADS_ACCESS_TOKEN` + `THREADS_USER_ID`) — never committed.
- **Output:** script file + a smoke-test command in the plan.

---

### Phase 4 — Safety, review, and iteration

#### Task 4.1: Weekly review digest (cron job)
- A third `cronjob` `waly-weekly-marketing-review` running every Sunday 20:00 MYT.
- Reads `web-app/.hermes/marketing/published.md`, summarizes what was posted, flags any drafts that were rejected/edited (in approval mode), surfaces swipe-file highlights from the week.
- `deliver: 'origin'` — chatted to the user.

#### Task 4.2: Kill switch
- Document how to pause: `cronjob action='pause', job_id=<id>` for either stream. Keep `job_id_a` and `job_id_b` somewhere findable (a `web-app/.hermes/marketing/README.md` file).

#### Task 4.3: Iterate after 2 weeks
- Review engagement (manual — Threads doesn't expose metrics via the API yet, see Q1). Decide: stay in approval mode, go auto, or adjust pillars/templates.

---

## Files Likely to Be Created

```
web-app/.hermes/
  plans/2026-07-19_012516-waly-threads-automation.md   (this file)
  marketing/
    README.md                  # job IDs, how to pause, how to swap tokens
    threads_api_research.md    # Phase 0 output
    threads_account_setup.md   # Phase 0 output
    house_style.md             # the living style guide (Phase 1, maintained by Stream B)
    swipe/                     # competitor + framework swipe files (grows over time)
      .gitkeep
    published.md               # append-only log of every published post
    publish_threads.sh         # Phase 3 — only if auto-publishing
```

Memory entries (created via `memory` tool, target='memory'):
- `waly_threads_house_style` — compact rules + template pointers
- `waly_swipe_index` — append-only list of saved swipe posts
- `waly_content_pillars` — the 5 pillars + rotation
- `waly_post_templates` — the 6 reusable templates

---

## Risks, Tradeoffs, and Open Questions

### Risks
- **Threads API availability**: Meta's Threads API is newer and access has been gated. If we can't get a publishing token, the entire auto-publish path is blocked. **Mitigation:** Phase 0 first; fall back to "draft in chat → user pastes manually" — still useful, just less automated.
- **Brand voice drift**: An LLM writing daily without supervision can drift toward generic SaaS-speak. **Mitigation:** approval mode for 2 weeks; house style guide with concrete do/don'ts; weekly review digest.
- **Cron timing/timezone**: Hermes cron schedule syntax is UTC by default. MYT = UTC+8, no DST. Easy to get off-by-one. **Mitigation:** verify in Q3; document the UTC↔MYT mapping in `marketing/README.md`.
- **Token leakage**: Threads access token in the repo would be a real secret leak. **Mitigation:** env var outside repo, consistent with WALY's existing `.env` policy.
- **Repetitive content**: 5 pillars × 2 posts/day can repeat quickly. **Mitigation:** Stream B feeds a fresh angle daily; weekly review surfaces repetition; rotate pillar-to-weekday mapping monthly.
- **Bahasa Malaysia quality**: Generated BM may sound stilted to native speakers. **Mitigation:** BM as optional second post (not required), human review in approval mode.

### Tradeoffs
- **Approval mode vs auto mode:** Approval mode = safer, slower, requires daily user time. Auto mode = scalable, risk of bad post. Recommendation: **start in approval mode for 2 weeks, then reassess.**
- **Twice-daily vs daily:** Threads rewards cadence but SMB B2B audiences are small. Recommendation: **start with 1 post/day at 12:30 MYT for week 1, expand to 2/day in week 2 if quality holds.**
- **Memory vs file for style guide:** Memory is injected every turn (good for ad-hoc "write me a post now"); file is the source of truth for full detail. **Use both — memory holds the compact rules, file holds full templates.**

### Open Questions (need user input before implementation)
- **Q1:** Confirm Threads API is still publishing-enabled in 2026 and acceptable for a business account — Phase 0 will answer this; do you want me to run Phase 0 research now (read-only) or wait for full go-ahead?
- **Q2:** Which 5–10 competitor / inspiration Threads accounts should Stream B study? (Suggest: loyalty/CRM SaaS brands + Malaysian SMB marketing accounts — please name any you admire.)
- **Q3:** Is the Hermes cron schedule UTC or local? (I'll verify with `cronjob action='list'` + docs before creating jobs; if UTC, all times above are pre-converted.)
- **Q4:** Do you already have a Threads account for WALY Mobile linked to a Facebook Page, or should the plan include account-creation steps?
- **Q5:** Language mix — English-only Threads posts, or bilingual EN + BM (with BM as a thread reply / separate post)? Your call.
- **Q6:** Approval mode for 2 weeks first, or auto-publish from day one? (Strong recommendation: approval mode.)
- **Q7:** Any topics/claims to avoid on Threads (e.g., don't promise specific ROI numbers, don't name competitors, halal/alcohol-sensitive examples for Malaysian audience)?

---

## Verification (once implemented)

- **Phase 0 done:** `threads_api_research.md` exists and clearly says "publishable" or "blocked — fallback to manual paste."
- **Phase 1 done:** `house_style.md` has all 3 sections; `memory` shows the 4 entries.
- **Stream B live:** `cronjob action='list'` shows `waly-copywriting-study` enabled; after first run, `swipe/` has at least 1 file and `waly_swipe_index` memory entry grew.
- **Stream A live:** `cronjob action='list'` shows `waly-threads-publish`; in approval mode, drafts arrive in chat at scheduled times; in auto mode, `published.md` accumulates posts.
- **Weekly review:** Sunday 20:00 MYT, a digest arrives in chat.

---

## Execution Handoff

Plan complete. Next step is to answer the open questions (Q1–Q7) and confirm whether to begin with Phase 0 (Threads API research, read-only). On your go-ahead I'll either:
(a) run Phase 0 research now, or
(b) build out Phase 1 (house style guide) while you answer the open questions, then wire up the cron jobs once Q1–Q3 are settled.