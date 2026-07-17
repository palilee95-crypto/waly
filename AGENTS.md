# AGENTS.md — Risev (WALY Mobile) Project Guide

> Read this FIRST before working on this codebase. It contains hard-won
> operational knowledge, architecture facts, and pitfalls that are NOT
> obvious from the code alone.

## Project Overview

**Risev** is a customer-loyalty / WhatsApp-marketing SaaS for merchants.

- **Frontend**: Expo (React Native + Web) app, Expo Router, deployed to Vercel (web) + EAS (mobile).
- **Backend**: PocketBase (Go) on the VPS, serving the API + admin + realtime.
- **WhatsApp service**: Evolution Go (`evoapicloud/evolution-go:latest`) on the VPS, powered by whatsmeow.
- **Infra**: Docker Compose on a single VPS (`root@<vps>:/opt/risev`), Caddy reverse proxy, PostgreSQL, Redis, Litestream backups.

## Repository Layout

```
app/                      Expo Router routes (file-based routing)
  (auth)/                 Auth flows (login, OTP, role-select)
  (customer)/             Customer app (dashboard, explore, my-cards, vouchers, history, profile)
  (merchant)/             Merchant app (dashboard, give, marketing, rewards, staff, profile, customers)
  _layout.tsx             Root layout (providers, fonts, splash, notification banner)
  +html.tsx               Web HTML shell (PWA manifest, viewport, styles)
  index.tsx               Entry point — redirects based on auth state
context/                  AuthContext, LanguageContext (en + ms translations, 403 keys)
lib/pocketbase.ts         PocketBase client singleton (PB_URL from EXPO_PUBLIC_PB_URL)
components/               NotificationBanner (animated slide-down overlay)
theme/                    Design tokens (colors, spacing, radii, shadows, layout)
assets/                   App icons, splash, logo, mascot
public/                   Web PWA manifest, favicon
pb_hooks/                 PocketBase JS hooks (25 files — routes, automation, WhatsApp, payments, loyalty)
pb_migrations/            PocketBase collection migrations (18 files, chronological)
pb_schema.json            Schema snapshot
docker-compose.yml        Full VPS stack (caddy, pocketbase, evolution-db, evolution-go, redis, litestream, payment-bot, portainer)
evolution_db_init/        Postgres init.sql (creates evogo_auth + evogo_users)
Caddyfile                 Reverse proxy + SSL
.env / .env.example       Environment config
vercel.json / netlify.toml  SPA deployment configs (all routes → /index.html)
litestream.yml            SQLite backup to S3 (1s sync, 7d retention)
docs/                     Feature docs (01-overview ... 25-localization)
implementation_plan.md    WhatsApp broadcast 9-fix plan
```

## Environment & Deployment

- **Frontend (Vercel)**: Push to GitHub `main` → Vercel auto-deploys. Build scripts in `package.json`: `build:web`, `build:staging`, `build:production`. The PB URL is set via `EXPO_PUBLIC_PB_URL`.
- **Backend (VPS)**: SSH to the VPS, `cd /opt/risev`. Edit files locally and SCP them up, then `docker compose up -d` to apply. PocketBase hooks hot-reload on file change (no restart needed for `.pb.js`/`.js` hook files).
- **Never commit the real `.env`** — only `.env.example` is safe. The real `/opt/risev/.env` lives on the VPS only.

## MCP Servers (AI agent integrations)

This project has MCP (Model Context Protocol) servers configured so AI agents can inspect backend state directly without manual SSH/SCP round-trips.

### PocketBase MCP (`ssakone/pb_mcp_server`)
- **Config location**: `opencode.jsonc` in the project root (gitignored — never committed).
- **Server**: `ssakone/pb_mcp_server` (63⭐) — cloned to `C:\Users\User\Documents\Work\WALY MOBILE\pb_mcp_server`, built with `npm run build`.
- **Auth**: Auto-authenticates at startup via `.env` in the `pb_mcp_server` directory (admin email + password). Falls back to manual `pocketbase_authenticate_admin` if needed.
- **Endpoint**: `https://api.166.88.35.57.sslip.io` (PocketBase admin UI at `/_/`).
- **Available tools** (prefixed with `pocketbase_`):
  - `pocketbase_list_collections` — list all collections.
  - `pocketbase_get_collection` — inspect a collection's schema (fields, types, rules).
  - `pocketbase_list_records` — read records with filters + pagination + relationship expansion.
  - `pocketbase_get_record` — get a single record by ID.
  - `pocketbase_create_record` / `pocketbase_update_record` / `pocketbase_delete_record` — CRUD (use with care).
  - `pocketbase_list_users` / `pocketbase_get_user` / `pocketbase_create_user` / `pocketbase_update_user` / `pocketbase_delete_user` — user management.
  - `pocketbase_authenticate_admin` / `pocketbase_authenticate_user` / `pocketbase_logout` / `pocketbase_get_auth_status` — auth.
  - `pocketbase_create_collection` / `pocketbase_update_collection` / `pocketbase_delete_collection` — collection management (admin only).
- **How to use**: Just ask e.g. "List all PocketBase collections" or "Show the schema of the broadcasts collection". The agent will call the `pocketbase_*` tools automatically.
- **⚠️ Security**: The `opencode.jsonc` is gitignored. The `.env` with admin credentials lives only in the `pb_mcp_server` directory (outside the workspace, never committed).

### Future: Docker MCP (planned, not yet configured)
- `ckreiling/mcp-server-docker` — would connect to the VPS Docker daemon over SSH (`DOCKER_HOST=ssh://root@166.88.35.57`) for `docker logs`/`exec`/`restart` without manual copy-paste. Not yet set up.

## CRITICAL: Evolution Go + PostgreSQL (do NOT break this)

### The PgBouncer trap

**Never route Evolution Go through PgBouncer.** whatsmeow (inside Evolution Go) uses
server-side prepared statements. PgBouncer session-pooling recycles server connections,
which DEALLOCATES prepared statements while the Go `pgx` driver still holds cached handles
→ evo-db logs show `bind message supplies N parameters, but prepared statement "" requires M`
→ the connection becomes unusable → Evolution Go reports `driver: bad connection`
("failed to check if version table is up to date") → cannot start WhatsApp clients → no QR codes.

**Fix applied 2026-07-17**: Evolution Go's DSNs point directly at `evolution-db:5432`
(not `pgbouncer:6432`). PgBouncer was removed from the stack entirely. `max_connections=300`
on `evolution-db` is sized for direct connections.

If you ever re-add a pooler, do NOT put evolution-go behind it.

### Database layout (PostgreSQL cluster — `risev-evolution-db`)

- **Cluster superuser**: `waly_db_admin` (NOT `postgres` — that role does NOT exist on this cluster).
- **`evogo_auth`** (18 tables): `whatsmeow_*` WhatsApp session/crypto store + `whatsmeow_version` + `poll_votes`. "auth" = WhatsApp auth/session. This is correct by design, NOT swapped.
- **`evogo_users`** (4 tables): `instances`, `labels`, `messages`, `runtime_configs`. Evolution Go instance management. No gorm `version` table here (by design).
- **`evolution`**: created by `POSTGRES_DB`, largely unused by evolution-go.
- **`evolution_db_init/init.sql`** only runs on an EMPTY data dir (first-ever start). For existing clusters, the `evogo_*` DBs must be created manually with `psql -U waly_db_admin`.

### DB credentials

- Real values live in `/opt/risev/.env` on the VPS:
  - `EVOLUTION_DB_USER=waly_db_admin`
  - `EVOLUTION_DB_PASSWORD=db_pg_waly_7a8f9e0c1b2a3d4e5f6a7b8c9d0e1f2a3b`
  - `EVOLUTION_DB_NAME=evolution`
- `.env.example` was corrected to match (was misleadingly `postgres` before).

## WhatsApp Integration Architecture

### Flow (merchant connects WhatsApp)

1. Merchant opens QR modal in `app/(merchant)/profile.tsx` (`handleWhatsappPress`).
2. Frontend polls `GET /api/risev/merchant/whatsapp/status?generateQr=true` (PocketBase route in `pb_hooks/blast_message.pb.js`).
3. That route calls `callEvo()` in `pb_hooks/whatsapp_helper.js`, which proxies to Evolution Go:
   - `POST /instance/connect` (puts the instance in pairing mode) — gated by a 10s cooldown (`CONNECT_COOLDOWN_MS`) to avoid spawning a new websocket client on every poll.
   - `GET /instance/qr` (retrieves the QR base64).
4. Once scanned, Evolution Go fires a webhook (`POST /api/risev/whatsapp-webhook`) and the instance becomes `connected`.

### Instance naming

- Instance name = `merchant-${merchantId}-${nameSlug}` (slug of merchant name).
- Each instance has a token; `getInstanceToken()` caches tokens in memory and refreshes from `/instance/all` on 401.

### Circuit breakers in `whatsapp_helper.js` (keep these!)

- `sendFailureCache` + `SEND_FAILURE_COOLDOWN_MS` (60s): skips sends to an instance that recently failed, to avoid exhausting DB connections (each failed send can trigger ~12 DB-connection attempts).
- `connectCache` + `CONNECT_COOLDOWN_MS` (10s): skips `POST /instance/connect` if one was already fired for this instance within 10s — stops the websocket client storm.
- **Do not remove these without understanding why they exist.** They prevent cascading failures when Evolution Go or Postgres is degraded.

### Frontend polling (keep the backoff!)

- `app/(merchant)/profile.tsx` QR modal polls with **exponential backoff** (3s→6s→12s→24s→30s capped, max 20 attempts ~5min). Do NOT revert to a fixed `setInterval(poll, 3000)` — that spawned dozens of websocket clients when the backend was down (the original bug).
- `app/(merchant)/marketing.tsx` fetches WhatsApp status once on mount (no polling loop) — fine as-is.

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
- **Profile** (`profile.tsx`): Avatar, tier, points, "Switch to Merchant Mode", edit profile, privacy/terms, support, WhatsApp opt-in toggle, subscription modal (RM79/mo Pro plan)

### Merchant App (`app/(merchant)/`)
- **Dashboard** (`index.tsx`): Balance card (total stamps), monthly sales goal progress bar, filtered activity list (Today/Week/Month)
- **Give** (`give.tsx`): QR scanner (expo-camera) + manual phone/voucher code entry, bill amount + stamps input, voucher redemption (WV-/RV- codes), customer lookup, self-issuance prevention
- **Customers** (`customers.tsx`): Transaction list with search + type filters, customer detail modal (profile, cards, vouchers, visits), CSV export (3 options)
- **Marketing** (`marketing.tsx`): Loyalty program config (stamp goal, expiry, reward), card design (colors, icons, background image, live preview), points & tiers explanation, broadcast blast (template variables `{{name}}`, `{{stamps}}`), auto follow-up rules, broadcast history, campaign promotions (double points, bonus stamps)
- **Rewards** (`rewards.tsx`): 3 tabs — Catalogue (CRUD for rewards: free_item/discount/experience/cash_credit), Card Design, Points & Tiers
- **Staff** (`staff.tsx`): Add/remove staff by phone number via `GET/POST/DELETE /api/risev/merchant/staff`
- **Profile** (`profile.tsx`): WhatsApp connection (QR modal with exponential backoff polling), edit store (logo, banner, name, category, GPS with Leaflet map), operating hours (per-day toggles), change password, language switcher, switch to customer mode

### Key Patterns
- **Dual role system**: Users can be both customer and merchant. `activeRole` determines which UI is shown. Role switching persisted in storage.
- **Subscription gating**: 7-day free trial (`status: 'pending'`), ChipIn payment webhook activates subscription, `subscription_enforce.pb.js` blocks operations for non-active merchants. Pricing with duration discounts (1/3/6/9/12 months) + promo codes.
- **Realtime**: PocketBase SSE subscriptions for live updates on transactions, loyalty cards, vouchers, and notifications.
- **Self-healing**: AuthContext auto-creates missing merchant profiles. WhatsApp status endpoint auto-recovers corrupted instances (403 → delete + recreate).
- **i18n**: Full English + Bahasa Malaysia via LanguageContext (403 translation keys).
- **Responsive**: Desktop (>768px) shows sidebar navigation; mobile shows bottom tab bars. Content max-widths center on desktop.

## PocketBase Hooks (25 files)

Routes are registered via `routerAdd(method, path, handler)` in `pb_hooks/*.pb.js`:

### WhatsApp Integration
- `whatsapp_helper.js` — Evolution Go API proxy (`callEvo()`, `getInstanceToken()`, `sendTextMessage()`) with circuit breakers
- `blast_message.pb.js` — Routes: `GET /api/risev/merchant/whatsapp/status` (QR + state), `POST .../disconnect`, `POST .../blast` (broadcast with anti-spam), `POST /api/risev/whatsapp-webhook` (STOP opt-out parsing)
- `automation_logic.js` — Win-back follow-up: finds inactive customers, anti-spam (7-day cooldown), sends personalized WhatsApp + push
- `automation_runner.pb.js` — Daily cron (`0 10 * * *`) + manual test endpoint `GET /api/risev/test/run-automations`

### Auth & Onboarding
- `otp_send.pb.js` — `GET /api/risev/check-phone`, `POST /api/risev/register`, `POST /api/risev/request-otp`
- `complete_onboarding.pb.js` — `POST /api/risev/onboarding/complete` (updates name/email, verifies user, returns new JWT)
- `auto_verify_users.pb.js` — Auto-verifies user emails

### Staff Management
- `staff_management.pb.js` — `GET/POST/DELETE /api/risev/merchant/staff` (owner-only)

### Payment & Subscription
- `chipin_webhook.pb.js` — `POST /api/risev/chipin-webhook` (activates merchant, creates subscription with 30-day period)
- `subscription_enforce.pb.js` — `onRecordCreate` hook: blocks transactions/programs/rewards for non-active merchants (allows 7-day trial)
- `sync_merchant_subscription.pb.js` — Syncs merchant status from subscription changes

### Loyalty & Points
- `stamp_complete.pb.js` — `onRecordUpdate` on loyalty_cards: when stamps reach goal → reset stamps, increment completions, issue voucher (`WV-XXXX-XXXX`)
- `voucher_redeem.pb.js` — `onRecordUpdate` on vouchers: when status → `used`, creates redemption transaction
- `points_multiplier.pb.js` — Points calculation with tier multipliers
- `redemption_points.pb.js` — Points deduction on redemption
- `tier_recalculate.pb.js` — Recalculates customer tiers based on spending
- `seed_tiers.pb.js` — Seeds default tier data (Bronze/Silver/Gold/Platinum)
- `earn_points.pb.js` — Deprecated (points now handled in `points_multiplier.pb.js`)

### Notifications
- `notification_helper.js` — Creates notification records in `notifications` collection
- `push_notify.js` — Sends Expo push notifications via `exp.host/--/api/v2/push/send`, auto-cleans invalid tokens
- `welcome_notification.pb.js` — Sends welcome notification on user creation

### Access Control & Validation
- `protect_loyalty_cards.pb.js` — Access control for loyalty cards
- `stock_deduct.pb.js` — Deducts reward stock on redemption
- `sync_program_reward.pb.js` — Syncs program-reward relationships
- `velocity_check.pb.js` — Rate limiting for stamp issuance

Hooks hot-reload when the files change on disk — no PocketBase restart needed. But if you change `docker-compose.yml`, run `docker compose up -d` (add `--force-recreate <service>` to recreate a specific container).

## Data Flow

### Customer Visit (Stamp Issuance)
```
Staff scans QR / enters phone in give.tsx
  → Creates transaction record (subscription_enforce checks merchant status)
  → points_multiplier.pb.js calculates points with tier multiplier
  → stamp_complete.pb.js checks if stamp goal reached → issues voucher
  → notification_helper.js creates in-app notification
  → push_notify.js sends Expo push notification
  → Frontend receives realtime update via PocketBase SSE
```

### Broadcast Flow
```
Merchant composes message in marketing.tsx
  → POST /api/risev/merchant/blast
  → Fetches all active loyalty card holders
  → Anti-spam check (24h cooldown per customer)
  → whatsapp_helper.js sends WhatsApp messages (with circuit breaker)
  → Creates broadcasts record + push notifications
```

### Auto Follow-Up Flow
```
Daily cron (10 AM) in automation_runner.pb.js
  → automation_logic.js finds inactive customers
  → Anti-spam check (7-day cooldown)
  → Sends personalized WhatsApp + push notifications
  → Creates broadcasts record per rule
```

## Theme / Design Tokens

Defined in `theme/index.ts`:
- **Colors**: Primary (royal purple `#5C3BCC`), Accent (amber gold `#F4A825`), Dark/Light surfaces, Semantic (success/warning/error/info), Text hierarchy, Stamp colors
- **Spacing**: 0–128 scale
- **Radii**: none to full (9999)
- **Shadows**: sm/md/lg/xl presets
- **Layout**: Screen padding, header/tab bar/button/input heights, stamp card dimensions, avatar sizes

## pb_migrations (18 files, chronological)

1. `1782000000_collections_snapshot.js` — Initial schema snapshot
2. `1782806195_updated_users.js` — User collection updates
3. `1782806993_updated_users.js` — More user updates
4. `1782807001_created_broadcasts.js` — Broadcasts collection
5. `1782807003_create_automation_rules.js` — Automation rules collection
6. `1782807005_updated_loyalty_programs.js` — Loyalty programs updates
7. `1782807006_updated_loyalty_cards_rules.js` — Loyalty cards API rules
8. `1782807007_updated_loyalty_programs_colors.js` — Card color customization fields
9. `1782807008_updated_loyalty_cards_points.js` — Points balance field
10. `1782807009_updated_redemptions_rules.js` — Redemptions API rules
11. `1782807010_sales_team_system.js` — Sales team system
12. `1782807011_updated_loyalty_cards_customer_update_rule.js` — Customer update rules
13. `1782807012_pricing_and_promo_system.js` — Pricing settings + promo codes
14. `1782807013_add_duration_toggles.js` — Duration enable/disable toggles
15. `1782807014_simplify_loyalty_api_rules.js` — Simplified loyalty API rules
16. `1782807015_simplify_transactions_api_rules.js` — Simplified transaction API rules
17. `1782807016_add_merchant_banner.js` — Merchant banner image field
18. `1782807017_add_transaction_bill_amount.js` — Bill amount field on transactions

## VPS Operations Cheat Sheet

```bash
# SSH in
ssh root@<vps>
cd /opt/risev

# Logs
docker logs -f risev-evolution-go      # WhatsApp service
docker logs -f risev-evolution-db      # Postgres
docker logs -f risev-pocketbase        # Backend
docker logs --since 5m risev-evolution-db | grep -E "bind message|unnamed prepared|driver: bad"
# (the above should return NOTHING if the stack is healthy)

# DB inspection (use waly_db_admin, NEVER postgres)
docker exec -it risev-evolution-db psql -U waly_db_admin -l
docker exec -it risev-evolution-db psql -U waly_db_admin -d evogo_users -c "\dt"
docker exec -it risev-evolution-db psql -U waly_db_admin -d evogo_auth -c "\dt"

# Apply compose changes + clean up removed services
docker compose up -d --remove-orphans

# Recreate a single service
docker compose up -d --force-recreate evolution-go

# Verify evolution-go DSNs (should show evolution-db:5432, NOT pgbouncer)
docker exec risev-evolution-go env | grep POSTGRES
```

## Known Pitfalls

1. **Never use `-U postgres`** on `risev-evolution-db` — the role doesn't exist. Use `-U waly_db_admin`.
2. **Never route evolution-go through PgBouncer** — prepared-statement desync breaks it (see above).
3. **`init.sql` only runs on empty data dir** — for existing clusters, create `evogo_auth`/`evogo_users` manually.
4. **`.env.example` user is `waly_db_admin`** (corrected 2026-07-17). If you see `postgres` there, it's been reverted — fix it.
5. **QR polling must stay backoff-capped** — a tight 3s loop spawns dozens of websocket clients in evolution-go and exhausts resources.
6. **`docker-compose.yml` `version` key is obsolete** — the WARN on `docker compose up` is harmless, but you can remove `version: '3.8'` to silence it.
7. **PocketBase hooks hot-reload** — don't restart the container for hook-only changes; just SCP the file.

## Tech Stack Versions (as of 2026-07-17)

- Expo SDK 56, React 19.2, React Native 0.85, Expo Router 56
- PocketBase **0.39.5** (`ghcr.io/muchobien/pocketbase:latest` — pin this if auto-updates cause issues). Migrations auto-run on container startup. `id` fields use `autogeneratePattern: "[a-z0-9]{15}"` so PocketBase auto-generates IDs — do NOT set `id` manually when creating records.
- Evolution Go 0.7.2 (`evoapicloud/evolution-go:latest`)
- PostgreSQL 15-alpine
- Redis alpine
- Caddy latest
- TypeScript ~6.0

## Key Files to Reference

- `docker-compose.yml` — the entire VPS stack; DSNs for evolution-go (must stay direct to evolution-db:5432).
- `pb_hooks/whatsapp_helper.js` — Evolution Go proxy + circuit breakers; `callEvo()`, `getInstanceToken()`, `sendTextMessage()`.
- `pb_hooks/blast_message.pb.js` — WhatsApp status/QR/disconnect/blast routes + webhook receiver.
- `app/(merchant)/profile.tsx` — WhatsApp QR modal + backoff polling.
- `lib/pocketbase.ts` — PocketBase client singleton.
- `context/AuthContext.tsx` / `context/LanguageContext.tsx` — auth + i18n (en/ms).
- `.env.example` — env var reference (DB user is waly_db_admin).