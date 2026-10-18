# AGENTS.md — Risev (RISEV Mobile) Project Guide

> Read this FIRST before working on this codebase. It contains hard-won
> operational knowledge, architecture facts, and pitfalls that are NOT
> obvious from the code alone.
>
> **Last verified against production: 2026-10-19.** If you find something here
> that contradicts the live system, fix the doc.

## Project Overview

**Risev** is a customer-loyalty / WhatsApp-marketing SaaS for merchants.

- **Frontend**: Expo (React Native + Web) app, Expo Router, deployed to Vercel (web) + EAS (mobile).
- **Backend**: PocketBase (Go) on the VPS, serving the API + admin + realtime. This is the only application server.
- **Infra**: Docker Compose on a single VPS (`root@166.88.35.57:/opt/risev`), Caddy reverse proxy, Litestream backups to S3. **No PostgreSQL, no Redis** — see "The VPS stack" below.
- **WhatsApp**: the Evolution Go integration has been **retired** — it is not part of this stack. The `whatsapp_helper.js` / `blast_message.pb.js` hooks remain in the repo as **legacy dead code**; do not build on them and do not try to restore Evolution Go.

### The VPS stack (verified 2026-10-19)

Exactly **five** containers run — this matches `docker-compose.yml` in the repo (which has **zero** `evolution` references):

| Container | Role |
| --- | --- |
| `risev-caddy` | reverse proxy + automatic TLS (80/443) |
| `risev-pocketbase` | the app: API, admin (`/_/`), JSVM hooks |
| `risev-litestream` | SQLite → S3 continuous backup |
| `risev-portainer` | container management console (127.0.0.1:9000) |
| `risev-push` | WebPush relay |

> **Superceded section:** earlier revisions of this file documented an Evolution Go +
> PostgreSQL + Redis + PgBouncer stack (`risev-evolution-go`, `risev-evolution-db`, the
> `evogo_auth`/`evogo_users` databases, the PgBouncer prepared-statement trap, and
> `risev_db_admin` credentials). **Evolution Go has been retired — Risev no longer uses it.**
> Do not reinstate any of it.

## Repository Layout

```
app/                      Expo Router routes (file-based routing)
  (auth)/                 Auth flows (login, OTP, role-select)
  (customer)/             Customer app (dashboard, explore, my-cards, vouchers, history, profile)
  (merchant)/             Merchant app (dashboard, give, marketing, rewards, staff, profile, customers, branches, analytics, bookings)
  _layout.tsx             Root layout (providers, fonts, splash, notification banner)
  +html.tsx               Web HTML shell (PWA manifest, viewport, styles)
  index.tsx               Entry point — redirects based on auth state
  join.tsx                Frictionless customer register-to-join page
  nfc.tsx                 NFC stamp claim customer landing page
  b/[slug].tsx            Public customer booking PWA (no auth — uses server routes)
context/                  AuthContext, LanguageContext (en + ms translations, 403 keys)
lib/pocketbase.ts         PocketBase client singleton (PB_URL from EXPO_PUBLIC_PB_URL)
components/               NotificationBanner, NfcClaimModal, BranchFormModal, DigitalStampReceiptModal
theme/                    Design tokens (colors, spacing, radii, shadows, layout)
pb_hooks/                 PocketBase JS hooks (58 files — routes, automation, booking, campaigns, hardware/NFC, payments, loyalty, intelligence)
pb_migrations/            PocketBase collection migrations (90 files, chronological — auto-run on startup)
pb_schema.json            Schema snapshot
docker-compose.yml        The VPS stack (caddy, pocketbase, litestream, portainer, push)
Caddyfile                 Reverse proxy + SSL
.env / .env.example       Environment config
vercel.json / netlify.toml  SPA deployment configs (all routes → /index.html)
litestream.yml            SQLite backup to S3 (1s sync, 7d retention)
docs/                     Design specs & plans — **gitignored**
tests/                    Playwright e2e specs — **gitignored**
```

## Environment & Deployment

- **Frontend (Vercel)**: push to GitHub `main` → Vercel auto-deploys. Build scripts: `build:web`, `build:staging`, `build:production`. PB URL comes from `EXPO_PUBLIC_PB_URL`.
- **Backend (VPS)**: **`/opt/risev` is NOT a git repository** — `vps_git_sync` fails with `fatal: not a git repository`. Deployment is by **file copy**:
  - Hooks: `mcp__vps__vps_deploy_hook` with `filename: "<name>.pb.js"` (it reads locally from `pb_hooks/` and writes to `/opt/risev/pb_hooks/`, validating and auto-rolling-back on failure).
  - Migrations: **no dedicated tool.** Pass a relative path — `filename: "../pb_migrations/<file>.js"` — which resolves to the real local file *and* lands in `/opt/risev/pb_migrations/` via `/opt/risev/pb_hooks/../pb_migrations/`. Then restart.
  - Apply: `mcp__vps__vps_restart_service` with `service: "pocketbase"`. Migrations run on startup — confirm with the `[MIGRATION]` lines in the logs.
  - **Hooks hot-reload** on file change; a restart is only needed for migrations or `docker-compose.yml` changes.
- **Never commit the real `.env`** — only `.env.example` is safe. The real `/opt/risev/.env` lives on the VPS only.
- **`docs/` and `tests/` are gitignored** — specs, plans and e2e specs are local-only and never committed.
- **The agent must NEVER run `git push`.** Commit locally and let the user push.

## MCP Servers (AI agent integrations)

Configured for **Command Code** in `.mcp.json` (project root, gitignored). Two stdio servers:

### `pocketbase` (`risev-pocketbase-mcp`)
- Local dir: `..\pb-mcp`, entry `dist/index.js`.
- **Endpoint**: `https://api.risev.app` (admin UI at `/_/`).
- Auth via `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` supplied through the entry's `env` block.
- Tools (prefix `mcp__pocketbase__`): `pb_list_collections`, `pb_get_collection_schema`, `pb_query_records`, `pb_get_record`, `pb_create_record`, `pb_update_record`, `pb_delete_record`, `pb_count_records`, `pb_call_custom_route`, `pb_view_system_logs`, `pb_generate_migration_template`.

### `vps` (`risev-vps`)
- Local dir: `..\vps-mcp`, entry `dist/index.js`.
- Tools (prefix `mcp__vps__`): `vps_deploy_hook`, `vps_container_logs`, `vps_restart_service`, `vps_system_status`, `vps_git_sync`, `vps_export_backup`.
- `vps_container_logs` supports `pocketbase`, `caddy`, `litestream`, `portainer`, `push` (the services that actually exist).

**Windows path gotcha (already fixed — do not regress):** the IDE spawns stdio MCP servers with `shell: true`, so a project path containing a space (`…\WALY MOBILE\…`) breaks unquoted commands. Both entries therefore use `command: "node"` with the **8.3 short path** (`…\WALYMO~1\{pb,vps}-mcp\dist\index.js`). The MCP registry is built per conversation — a new chat session is needed after editing `.mcp.json`.

## PocketBase JSVM gotchas (hard-won)

1. **Tagged hooks do NOT see file-level functions.** In `onRecordCreate(fn, "collection")` / `onRecordCreateRequest(fn, "collection")` / `onRecordAfter*Success(fn, "collection")`, the handler is pooled/re-evaluated **without the file scope**, so calling a `function` declared at the top of the `.pb.js` file throws `ReferenceError` — which PocketBase flattens into a misleading `400 "Failed to create record."`. **Declare helpers INSIDE the handler.**
   - `routerAdd` handlers are **not** affected — they keep their closure (e.g. `intelligence_api.pb.js` calls its top-level `calcDistanceKm` from a route).
2. **Unknown fields are silently dropped.** `record.set("field", …)` for a column that does not exist does not throw — the write just vanishes. This is how several "ghost field" bugs hid (`branches.google_review_url`, `nfc_claims.branch`, …). If a field seems to have no effect, check the collection schema first.
3. **`RecordRequestEvent.record` is typed optional** but *is* populated in practice.
4. **List rules act as a filter, not a gate** — an anonymous `getList` on a rule-protected collection returns `200` with `items: []`, not `403`. Use that when asserting privacy in tests.
5. Migrations and hooks: see the deployment method above.

## Outlet (branch) model

An outlet (`branches`) is the per-location dimension for a merchant.

- **Brand-wide identity, outlet-scoped facts.** `loyalty_cards` stay merchant-scoped (one card per customer per brand); `transactions`, `vouchers`, `redemptions`, `nfc_claims`, `service_bookings` each carry a `branch` relation.
- **Reporting filters on the relation ID** (`tx.branch === outlet.id`) — never on `metadata.branch_id` / `metadata.branch_name` strings. An empty `branch` is counted as **HQ**.
- **Staff** have `users.branch` (relation). The **owner is brand-wide** (no branch) and picks an outlet at the POS (`give.tsx`).
- **HQ invariant**: exactly one `is_hq` per merchant, enforced in `pb_hooks/branch_entitlements.pb.js` (limits on create, last-HQ guard on update, promote-on-delete, auto-clear other HQ after save).
- **Outlet limits**: `starter` 1, `stand_bundle` 2, `pro` unlimited. Enforced server-side in the same hook. *(There is no `business` plan — do not reintroduce it.)*
- **Stands**: `activation_codes.branch` binds a physical stand to an outlet (`maxSelect: 1`). Merchants assign/re-assign via `POST /api/risev/merchant/bind-stand-branch`, surfaced in the Branch Management screen.
- `branches.listRule` is **merchant-members only**; public booking reads outlets through `GET /api/risev/branches/public?merchant=<id>` (minimal fields).

## Subscriptions

- **`subscriptions` write rules are `null` (superusers only)** — migration `1782807086`. Merchants can read their own subscription but cannot create/update/delete one. All real writes are server-side `$app.save` (`redeem_stand_code.pb.js`, `chipin_webhook.pb.js`, `sync_merchant_subscription.pb.js`).
- **`subscription_enforce.pb.js` has NO trial path** — it requires an active `subscriptions` record for transactions/loyalty_cards/rewards/loyalty_programs. **Consequence:** a merchant with no subscription row cannot transact at all, so any test harness must provision the subscription with **admin** credentials (`getAdminClient()` in `tests/helpers/sandbox.ts`).
- ⚠️ **Known issue (unverified):** that hook's own `catch` tests `err.name === 'ForbiddenError'`, which does not appear to match in this JSVM, so it logs `Subscription check error: …` and lets the write through — i.e. enforcement may be **failing open**. Verify before relying on it to block anything.

## Frontend Architecture

### Auth Flow (`app/(auth)/`)
- **3-step state machine**: Phone input → Register (new user) or Password (returning user) → OTP verification
- `login.tsx`: Malaysian phone input (+60), Customer/Merchant role toggle, consent checkbox
- `otp.tsx`: 6-digit OTP with auto-focus progression, 60s resend cooldown
- `role-select.tsx`: Role selection cards (Customer / Merchant) with feature lists

### Customer App (`app/(customer)/`)
- **Dashboard** (`index.tsx`): Welcome card, promo banner, animated stacked card deck (up to 3 cards), card detail modal with stamp grid + points catalog + redeem flow, QR code modal, notifications modal
- **Explore** (`explore.tsx`): Merchant discovery with search, category pills, merchant cards with distance badges, detail modal with hours/address/phone
- **My Cards** (`my-cards.tsx`): Full loyalty card list, same card detail + redemption flow as dashboard
- **Vouchers** (`vouchers.tsx`): Available/History tabs, ticket-style card design, "Use Now" QR code for store scanning
- **History** (`history.tsx`): Last 50 transactions with color-coded earn/spend badges
- **Profile** (`profile.tsx`): Avatar, tier, points, "Switch to Merchant Mode", edit profile, privacy/terms, support, WhatsApp opt-in toggle, subscription modal

### Merchant App (`app/(merchant)/`)
- **Dashboard** (`index.tsx`): Balance card (total stamps), monthly sales goal progress bar, filtered activity list (Today/Week/Month)
- **Give** (`give.tsx`): QR scanner (expo-camera) + manual phone/voucher code entry, bill amount + stamps input, voucher redemption (WV-/RV- codes), customer lookup, self-issuance prevention. Shows an **outlet picker for brand-wide users (the owner)** and sends `branch_id`.
- **Customers** (`customers.tsx`): Transaction list with search + type filters, customer detail modal, CSV export. Branch filter matches on the `branch` relation ID.
- **Branches** (`branches.tsx`): Outlet CRUD (`BranchFormModal`), per-outlet KPI strip, + Google Review, onboarding QR/link, stand→outlet assignment, upgrade paywall.
- **Analytics** (`analytics.tsx`): Metrics + outlet comparison, branch filter by relation ID.
- **Marketing** (`marketing.tsx`): Loyalty program config, card design, points & tiers, broadcast blast (`{{name}}`, `{{stamps}}`), auto follow-up rules, campaign promotions.
- **Rewards** (`rewards.tsx`): 5-Tab Executive Architecture — Catalogue, Card Design, Stamp Rule, Points Studio, Birthday. Toggling off Points hides only `points_tiers`; the Catalogue tab stays.
- **Staff** (`staff.tsx`): Add/remove staff by phone via `GET/POST/DELETE /api/risev/merchant/staff`.
- **Profile** (`profile.tsx`): WhatsApp connection (QR modal with exponential backoff polling), store profile, operating hours, change password, language switcher, switch to customer mode.

### Key Patterns
- **Dual role system**: users can be both customer and merchant; `activeRole` picks the UI, persisted in storage.
- **UI/UX Design System**: Single Source of Truth in `DESIGN_UI_UX_MEMORY.md` (Rule of Three: `#FFFFFF`, `#000000`, `#FFCC00`).
- **Boarding Pass Ticket Metaphor**: airline boarding-pass vouchers with colour-coded vertical spines (`getVoucherSpineTheme`).
- **Realtime**: PocketBase SSE subscriptions for transactions, loyalty cards, vouchers, notifications.
- **Self-healing**: AuthContext auto-creates missing merchant profiles.
- **i18n**: English + Bahasa Malaysia via LanguageContext (403 keys).
- **Responsive**: desktop (>768px) sidebar nav; mobile bottom tabs.

## PocketBase Hooks (58 files)

Routes are registered via `routerAdd(method, path, handler)` in `pb_hooks/*.pb.js`:

### Auth & Onboarding
- `otp_send.pb.js` — `GET /api/risev/check-phone`, `POST /api/risev/register`, `POST /api/risev/request-otp`
- `complete_onboarding.pb.js` — `POST /api/risev/onboarding/complete`
- `auto_verify_users.pb.js` — auto-verifies user emails
- `protect_users.pb.js` — blocks unauthorized privilege escalation

### Outlets, Staff & Hardware
- `branch_entitlements.pb.js` — outlet limits + single-HQ invariant (**helpers must stay inside the handlers**)
- `public_branches.pb.js` — `GET /api/risev/branches/public` (minimal public outlet list)
- `staff_management.pb.js` — `GET/POST/DELETE /api/risev/merchant/staff` (owner-only), permissions, attendance, compensation, roles, commissions
- `redeem_stand_code.pb.js` — `POST /api/risev/merchant/redeem-stand-code`, `POST /api/risev/merchant/bind-stand-branch`
- `resolve_stand.pb.js` — `GET /api/risev/nfc/resolve` (stand/merchant → outlet metadata)
- `nfc_request.pb.js` / `nfc_transaction.pb.js` — `POST /api/risev/nfc/request`, `POST /api/risev/nfc/complete`
- `quick_register.pb.js` — `POST /api/risev/qr/quick-register`
- `jnt.pb.js` — `POST /api/risev/admin/shipping/jnt` (airway bills)

### Loyalty, Stamps & Points
- `stamp_complete.pb.js` — `onRecordUpdate` on loyalty_cards: goal reached → reset, increment completions, issue voucher (`WV-XXXX-XXXX`)
- `voucher_redeem.pb.js` — `onRecordUpdate` on vouchers: status → `used` writes a redemption transaction
- `manual_give.pb.js` — `POST /api/risev/merchant/give-manual`
- `points_multiplier.pb.js`, `redemption_points.pb.js`, `tier_recalculate.pb.js`, `velocity_check.pb.js`
- `backfill_transactions.pb.js` — data repair utility

### Payment & Subscription
- `chipin_webhook.pb.js` — `POST /api/risev/chipin-webhook`
- `subscription_checkout.pb.js` — `POST /api/risev/merchant/subscription/checkout`
- `subscription_enforce.pb.js` — `onRecordCreate` gate for transactions/programs/rewards/cards (**see the fail-open warning above**)
- `sync_merchant_subscription.pb.js` — syncs merchant status from subscription changes
- `pricing_admin.pb.js` — `GET/POST /api/risev/admin/pricing`

### Booking & Services
- `booking_system.pb.js` — `GET/POST/PUT/DELETE /api/risev/bookings`
- `booking_helper.js` — validation, overlaps, conflict resolution, booking→transaction
- `booking_reminders.pb.js` / `booking_reminders_logic.js` — appointment reminders

### Campaigns, Customers & Intelligence
- `campaign_vouchers.pb.js` — `POST /api/risev/campaigns/claim`
- `customer_management.pb.js` — `GET/POST /api/risev/merchant/customers`
- `intelligence_api.pb.js` — merchant analytics / churn / predictions
- `resolve_google_review.pb.js` — `GET /api/risev/feedback/route`

### Sales Agents & Prospects
- `agent_click.pb.js`, `agent_whatsapp.pb.js`, `create_prospect.pb.js`, `merchant_referral.pb.js`, `sales_agent_signup.pb.js`

### Automation, Notifications & Infra
- `smart_follow_up.js` + `smart_follow_up_api.pb.js` + `smart_follow_up_enroll.pb.js`
- `automation_logic.js` / `automation_runner.pb.js` — daily cron + `GET /api/risev/test/run-automations`
- `birthday.pb.js` — `GET /api/risev/cron/birthdays`
- `notification_helper.js`, `push_notify.js`, `push_api.pb.js`, `welcome_notification.pb.js`
- `cascade_delete_user.pb.js`, `protect_loyalty_cards.pb.js`, `stock_deduct.pb.js`, `sync_program_reward.pb.js`
- `system_settings.pb.js`, `smtp_env.pb.js`

## Data Flow

### Customer Visit (Stamp Issuance)
```
Staff scans QR / enters phone in give.tsx   (owner also picks an outlet)
  → POST /api/risev/merchant/give-manual  (or /nfc/complete)
  → subscription_enforce checks merchant status   (⚠ may fail open — see above)
  → transaction created WITH the branch relation
  → points_multiplier.pb.js calculates points with tier multiplier
  → stamp_complete.pb.js checks goal → issues voucher
  → notification_helper.js creates in-app notification
  → push_notify.js sends Expo push
  → frontend receives realtime update via SSE
```

### Broadcast Flow
```
Merchant composes message in marketing.tsx
  → POST /api/risev/merchant/blast
  → fetches active card holders → anti-spam (24h cooldown)
  → whatsapp_helper.js sends (circuit breaker)   ⚠ Evolution retired — sends are inert
  → creates broadcasts record + push notifications
```

## Theme / Design Tokens

Single Source of Truth in `DESIGN_UI_UX_MEMORY.md` and `theme/index.ts`:

### The Rule of Three
- **Dominant surface**: Pure Crisp White (`#FFFFFF`).
- **Structural contrast**: Deep Midnight Black (`#000000`; dark surface `#0A0A0C`–`#16161A`).
- **Accent**: Electric Amber (`#FFCC00`), signature purple (`#5C3BCC`), warning amber (`#F4A825`).

### Boarding Pass Spine System (`getVoucherSpineTheme`)
10 colours: `purple` `#5C3BCC` (default), `emerald` `#10B981`, `amber` `#F59E0B`, `rose` `#EF4444`, `pink` `#EC4899`, `cyan` `#06B6D4`, `violet` `#8B5CF6`, `orange` `#F97316`, `teal` `#14B8A6`, `indigo` `#6366F1`.

### PRO Campaign Recipes (`PRO_CAMPAIGN_RECIPES`)
`bogo`, `happy_hour`, `flash_sale`, `welcome_gift`, `bring_a_friend`, `we_miss_you`, `spend_and_save`, `festive_special`.

### Spacing, Radii, Shadows, Type
`theme.spacing` (0–128), radii `sm` (6px) → `full` (9999px), `theme.shadows.{sm,md,lg,xl}`, Inter/Outfit with weights 400/600/700/800/900.

## pb_migrations (90 files, chronological)

The full history runs `1782000000_collections_snapshot.js` … `1782807077_add_applicable_items_text_and_scope_to_rewards.js`
(the long annotated list that used to live here is unchanged; run
`Get-ChildItem pb_migrations\*.js` for the authoritative list), then:

- `1782807078_add_sub_rewards_to_loyalty_programs.js` — `sub_rewards` JSON (milestone rewards)
- `1782807079_add_branch_to_activation_codes.js` — `branch` relation on physical stands
- `1782807080_add_google_review_url_to_branches.js` — per-outlet Google Review URL (column only — never copy the merchant value in)
- `1782807081_add_branch_relation_to_facts.js` — `branch` on transactions/vouchers/redemptions + `nfc_claims.branch`/`branch_name`/`voucher`/`voucher_title` + `transactions.branch` index
- `1782807082_backfill_users_branch_from_branch_name.js` — `users.branch` from the legacy text field
- `1782807083_backfill_fact_branch_relations.js` — fact `branch` from legacy `metadata`
- `1782807084_enforce_single_hq.js` — normalise to exactly one HQ per merchant
- `1782807085_tighten_branches_rules.js` — `branches` list/view → merchant members only
- `1782807086_lock_subscriptions_rules.js` — subscriptions create/update/delete → superusers only
- `1782807087_add_manager_to_branches.js` — `branches.manager` relation → `users`

## VPS Operations Cheat Sheet

```bash
ssh root@166.88.35.57
cd /opt/risev

# Logs (the five real services)
docker logs -f risev-pocketbase
docker logs -f risev-caddy
docker logs -f risev-litestream
docker logs -f risev-push

# Recent migration / hook activity
docker logs --since 10m risev-pocketbase | grep -E "\[MIGRATION\]|\[BRANCH ENT|Error"

# Restart the app (applies new migrations)
docker compose restart pocketbase

# Apply compose changes + clean up removed services
docker compose up -d --remove-orphans

# Container state
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
```

Preferred from an agent session: `vps_system_status`, `vps_container_logs`, `vps_restart_service`,
`vps_deploy_hook` (see Deployment).

## Known Pitfalls

1. **`/opt/risev` is not a git repo** — `vps_git_sync` always fails. Deploy by file copy (`vps_deploy_hook`).
2. **Helpers inside tagged hooks** — a file-level `function` is invisible to `onRecord*(fn, "collection")`; the failure surfaces as a misleading `400`. See the JSVM gotchas section.
3. **Unknown fields are silently dropped** by `record.set()` — a "no-op" write usually means the column doesn't exist.
4. **Never `git push`** from an agent session — commit locally and hand off.
5. **`docs/` and `tests/` are gitignored** — don't expect specs/plans/tests to appear in git.
6. **`subscription_enforce` may fail open** (its `err.name` check) — verify before trusting it as a gate.
7. **Evolution Go (WhatsApp) has been retired** — the `whatsapp_helper.js` / `blast_message.pb.js` paths are legacy dead code; ignore the old PgBouncer / `risev_db_admin` instructions.
8. **QR polling must stay backoff-capped** (`profile.tsx`) — a tight 3 s loop spawns websocket clients.
9. **`docker-compose.yml` `version` key is obsolete** — the WARN on `docker compose up` is harmless.

## Tech Stack Versions

- Expo SDK 56, React 19.2, React Native 0.85, Expo Router 56, TypeScript ~6.0
- PocketBase **0.39.x** (`ghcr.io/muchobien/pocketbase:latest`). Migrations auto-run on container startup. `id` fields use `autogeneratePattern: "[a-z0-9]{15}"`; hooks commonly set the id explicitly via `$security.randomString(15).toLowerCase()` — that is fine.
- Caddy latest, Litestream latest, Portainer CE latest
- Playwright (e2e), Node for tooling

## Key Files to Reference

- `pb_hooks/branch_entitlements.pb.js` — outlet limits + HQ invariant; the reference for how tagged-handler hooks must be written.
- `pb_migrations/1782807080…1782807087` — the outlet/reporting/subscription schema work.
- `components/BranchFormModal.tsx` / `app/(merchant)/branches.tsx` — outlet CRUD, stand→outlet assignment, manager relation.
- `app/(merchant)/give.tsx` — POS stamp issuance + owner outlet picker.
- `app/b/[slug].tsx` — public booking PWA (consumes the public outlet route).
- `.mcp.json` — MCP server config (gitignored).
- `UI_UX_AGENTS.md` — multi-agent UI/UX studio protocol.
- `DESIGN_UI_UX_MEMORY.md` — UI/UX single source of truth.
- `theme/index.ts` — design tokens, `getVoucherSpineTheme`, `PRO_CAMPAIGN_RECIPES`.
- `lib/pocketbase.ts` — PocketBase client singleton.
- `context/AuthContext.tsx` / `context/LanguageContext.tsx` — auth + i18n (en/ms).
- `.env.example` — env var reference.
