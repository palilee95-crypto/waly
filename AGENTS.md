# AGENTS.md — Risev (RISEV Mobile) Project Guide

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
  join.tsx                Frictionless customer register-to-join page
  nfc.tsx                 NFC stamp claim customer landing page
context/                  AuthContext, LanguageContext (en + ms translations, 403 keys)
lib/pocketbase.ts         PocketBase client singleton (PB_URL from EXPO_PUBLIC_PB_URL)
components/               NotificationBanner (animated overlay), NfcClaimModal (NFC tag claims)
theme/                    Design tokens (colors, spacing, radii, shadows, layout)
assets/                   App icons, splash, logo, mascot
public/                   Web PWA manifest, favicon
pb_hooks/                 PocketBase JS hooks (55 files — routes, automation, WhatsApp, booking, campaigns, hardware/NFC, payments, loyalty, intelligence)
pb_migrations/            PocketBase collection migrations (80 files, chronological)
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
- **Server**: `ssakone/pb_mcp_server` (63⭐) — cloned to `C:\Users\User\Documents\Work\RISEV MOBILE\pb_mcp_server`, built with `npm run build`.
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

- **Cluster superuser**: `risev_db_admin` (NOT `postgres` — that role does NOT exist on this cluster).
- **`evogo_auth`** (18 tables): `whatsmeow_*` WhatsApp session/crypto store + `whatsmeow_version` + `poll_votes`. "auth" = WhatsApp auth/session. This is correct by design, NOT swapped.
- **`evogo_users`** (4 tables): `instances`, `labels`, `messages`, `runtime_configs`. Evolution Go instance management. No gorm `version` table here (by design).
- **`evolution`**: created by `POSTGRES_DB`, largely unused by evolution-go.
- **`evolution_db_init/init.sql`** only runs on an EMPTY data dir (first-ever start). For existing clusters, the `evogo_*` DBs must be created manually with `psql -U risev_db_admin`.

### DB credentials

- Real values live in `/opt/risev/.env` on the VPS:
  - `EVOLUTION_DB_USER=risev_db_admin`
  - `EVOLUTION_DB_PASSWORD=db_pg_risev_7a8f9e0c1b2a3d4e5f6a7b8c9d0e1f2a3b`
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
- **Rewards** (`rewards.tsx`): 5-Tab Executive Architecture —
  1. *Catalogue* (CRUD for rewards: free_item, discount, BOGO, happy_hour, etc., with airline Boarding Pass cards and color-coded vertical spines).
  2. *Card Design* (Live card customizer, stamp colors, background image, font colors, quick inline reward creator).
  3. *Stamp Rule* (Stamp target goal, expiry duration, bonus stamps).
  4. *Point Rule / Points Studio* (`points_tiers`: Apple FinTech minimal formula capsule, 1-row segmented quick pills for earn rates and cash redemption rates, minimum redeem points & max cap % per bill).
  5. *Birthday* (Automated birthday reward campaigns, schedule time, custom birthday message).
  - **Tab Permanence Architecture**: Toggling off Points hides only `points_tiers`; the `catalogue` (Reward) tab remains permanently active for vouchers.
  - **Stand Hardware vs. PRO Plan**: Stand NFC merchants (counter tap quota) use decoupled manual item inputs (`applicable_items_text`) for visual/NFC counter claims; PRO Plan unlocks 8 Smart Growth Campaign Recipes (`PRO_CAMPAIGN_RECIPES` — BOGO, Happy Hour, Flash Sale, Welcome Gift, Bring A Friend, We Miss You, Spend & Save, Festive Special) with interactive Paywall modals and dynamic smart controls (time presets, countdown timers, spend tier calculator).
- **Staff** (`staff.tsx`): Add/remove staff by phone number via `GET/POST/DELETE /api/risev/merchant/staff`
- **Profile** (`profile.tsx`): WhatsApp connection (QR modal with exponential backoff polling), edit store profile (logo, banner, name, structured address/postcode, category via `AllCategoriesModal`, GPS Leaflet map, monthly sales goal, customer win-back alert), operating hours (per-day toggles), change password, language switcher, switch to customer mode

### Key Patterns
- **Dual role system**: Users can be both customer and merchant. `activeRole` determines which UI is shown. Role switching persisted in storage.
- **UI/UX Design System**: Single Source of Truth documented in `DESIGN_UI_UX_MEMORY.md` (Apple Wallet × Fresha × Risev Signature, Rule of Three: `#FFFFFF`, `#000000`, `#FFCC00`).
- **Boarding Pass Ticket Metaphor**: Airline boarding pass voucher styling with color-coded vertical spines (`getVoucherSpineTheme`), ticket punch notches, perforated dashed dividers, and live preview synchronization across customer and merchant screens.
- **Subscription gating**: 7-day free trial (`status: 'pending'`), ChipIn payment webhook activates subscription, `subscription_enforce.pb.js` blocks operations for non-active merchants. PRO tier unlocks 8 Smart Campaign Recipes, booking/service catalog, and automated POS calculation. Pricing with duration discounts (1/3/6/9/12 months) + promo codes.
- **Realtime**: PocketBase SSE subscriptions for live updates on transactions, loyalty cards, vouchers, and notifications.
- **Self-healing**: AuthContext auto-creates missing merchant profiles. WhatsApp status endpoint auto-recovers corrupted instances (403 → delete + recreate).
- **i18n**: Full English + Bahasa Malaysia via LanguageContext (403 translation keys).
- **Responsive**: Desktop (>768px) shows sidebar navigation; mobile shows bottom tab bars. Content max-widths center on desktop.

## PocketBase Hooks (55 files)

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
- `protect_users.pb.js` — Security hook: protects user records against unauthorized privilege escalation

### Staff Management
- `staff_management.pb.js` — `GET/POST/DELETE /api/risev/merchant/staff` (owner-only)

### Payment & Subscription
- `chipin_webhook.pb.js` — `POST /api/risev/chipin-webhook` (activates merchant, creates subscription with 30-day period)
- `subscription_checkout.pb.js` — Route: `POST /api/risev/merchant/subscription/checkout` (creates automated checkout sessions)
- `subscription_enforce.pb.js` — `onRecordCreate` hook: blocks transactions/programs/rewards for non-active merchants (allows 7-day trial)
- `sync_merchant_subscription.pb.js` — Syncs merchant status from subscription changes
- `pricing_admin.pb.js` — Admin API routes: `GET/POST /api/risev/admin/pricing` (dynamic plan pricing & promo configuration)

### Loyalty, Stamps & Points
- `stamp_complete.pb.js` — `onRecordUpdate` on loyalty_cards: when stamps reach goal → reset stamps, increment completions, issue voucher (`WV-XXXX-XXXX`)
- `voucher_redeem.pb.js` — `onRecordUpdate` on vouchers: when status → `used`, creates redemption transaction
- `points_multiplier.pb.js` — Points calculation with tier multipliers
- `redemption_points.pb.js` — Points deduction on redemption
- `tier_recalculate.pb.js` — Recalculates customer tiers based on spending
- `velocity_check.pb.js` — Rate limiting for stamp issuance
- `manual_give.pb.js` — Route: `POST /api/risev/merchant/give-manual` (allows manual stamp/points issuance via customer phone number lookup)
- `backfill_transactions.pb.js` — Data repair / transaction backfill utility

### Campaign & Voucher Engines
- `campaign_vouchers.pb.js` — Route: `POST /api/risev/campaigns/claim` (Smart campaign validation, recipe constraints, promo voucher issuance)

### Booking & Salon Services
- `booking_system.pb.js` — Routes: `GET/POST/PUT/DELETE /api/risev/bookings` (Service catalog, slot availability, staff schedules, customer appointments)
- `booking_helper.js` — Core booking validation, duration overlaps, conflict resolution
- `booking_reminders.pb.js` — Automated cron for WhatsApp/push appointment reminders
- `booking_reminders_logic.js` — Reminder delivery calculation (24h / 2h before appointment)

### Customer Management & Intelligence
- `customer_management.pb.js` — Routes: `GET/POST /api/risev/merchant/customers` (Advanced customer listing, segmented filtering, manual visit adjustments)
- `intelligence_api.pb.js` — Route: `GET /api/risev/merchant/intelligence` (Merchant analytics, customer churn alerts, basket size predictions)
- `resolve_google_review.pb.js` — Route: `GET /api/risev/feedback/route` (Smart review filtering: 4-5 stars → Google Reviews redirect; 1-3 stars → private merchant feedback)

### Sales Agents & Prospects
- `agent_click.pb.js` — Route: `GET /api/risev/agent/click` (tracks referral link click count)
- `agent_whatsapp.pb.js` — Scoped WhatsApp pairing/status endpoints for sales agents (`GET /api/risev/agent/whatsapp/status`)
- `create_prospect.pb.js` — Route: `POST /api/risev/agent/create-prospect` (registers new prospect and sends referral link)
- `merchant_referral.pb.js` — Hook: `onRecordCreate` on `merchants` (links new merchant to its referring agent)
- `sales_agent_signup.pb.js` — Hook: `onRecordCreate` on `sales_agents` (initializes defaults and referral code)

### Hardware Stand, NFC & J&T Delivery
- `nfc_request.pb.js` — Route: `POST /api/risev/nfc/request` (submits customer NFC stamp request via web landing page)
- `nfc_transaction.pb.js` — Route: `POST /api/risev/nfc/complete` (completes an NFC claim with merchant confirmation)
- `quick_register.pb.js` — Route: `POST /api/risev/qr/quick-register` (frictionless Name + Phone registration for QR scanning)
- `redeem_stand_code.pb.js` — Route: `POST /api/risev/hardware/redeem-code` (Activation code verification & stand binding)
- `resolve_stand.pb.js` — Route: `GET /api/risev/stand/:code` (Resolves physical counter stand QR/NFC metadata)
- `jnt.pb.js` — Route: `POST /api/risev/admin/shipping/jnt` (J&T Express shipping airway bill generation for Stand hardware kits)

### Birthday Rewards
- `birthday.pb.js` — Cron Route: `GET /api/risev/cron/birthdays` (runs daily birthday campaigns and auto-issues vouchers)

### Notifications & Push
- `notification_helper.js` — Creates notification records in `notifications` collection
- `push_notify.js` — Sends Expo push notifications via `exp.host/--/api/v2/push/send`, auto-cleans invalid tokens
- `push_api.pb.js` — Route: `POST /api/risev/notifications/push-test` & WebPush subscriptions management
- `welcome_notification.pb.js` — Sends welcome notification on user creation

### Access Control & Validation
- `protect_loyalty_cards.pb.js` — Access control for loyalty cards
- `stock_deduct.pb.js` — Deducts reward stock on redemption
- `sync_program_reward.pb.js` — Syncs program-reward relationships

### Engine / Sequence Automation
- `smart_follow_up.js` — Helper/runner: called by cron (every 5 minutes) to run automated multi-step follow-up message sequences
- `smart_follow_up_api.pb.js` — Routes: `GET/POST /api/risev/merchant/follow-up` (Sequence builder, condition rules, broadcast history)
- `smart_follow_up_enroll.pb.js` — Hook: `onRecordCreate` on `transactions` / `customer_events` (auto-enrolls customers into smart sequences)
- `cascade_delete_user.pb.js` — Hook: `onRecordDelete` on `users` (cleans up all merchant/customer relations to prevent schema violations)

### System Settings & Infra
- `system_settings.pb.js` — Global configuration cache & feature flags getter
- `smtp_env.pb.js` — Dynamic SMTP mailer injector from environment variables

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

Single Source of Truth documented in `DESIGN_UI_UX_MEMORY.md` and implemented in `theme/index.ts`:

### The Rule of Three (Brand Color Palette)
- **Primary / Dominant Surface**: Pure Crisp White (`#FFFFFF`) — Clean, airy, spacious canvas.
- **Secondary / High-Contrast Structural**: Deep Midnight Black (`#000000`, surface dark `#0A0A0C` to `#16161A`) — Solid typography, high-contrast badges, tactile primary CTA buttons.
- **Accent / Dynamic Energy**: Electric Amber / Risev Accent (`#FFCC00`, primary purple `#5C3BCC`, warning amber `#F4A825`) — VIP badges, loyalty stamps, conversion triggers.

### Boarding Pass Airline Spine System (`getVoucherSpineTheme`)
Curated 10-color vertical spine system for voucher cards, auto-adapting border, background, and high-contrast vertical title text:
1. `purple`: `#5C3BCC` (Default Risev Signature)
2. `emerald`: `#10B981` (Free Item / Refreshment)
3. `amber`: `#F59E0B` (Happy Hour / Timed)
4. `rose`: `#EF4444` (Flash Sale / Urgency)
5. `pink`: `#EC4899` (Welcome Gift / First-Timer)
6. `cyan`: `#06B6D4` (Bring A Friend / Social)
7. `violet`: `#8B5CF6` (VIP / Repeat Customer)
8. `orange`: `#F97316` (We Miss You / Win-Back)
9. `teal`: `#14B8A6` (Spend & Save / Basket Booster)
10. `indigo`: `#6366F1` (Festive Special / Seasonal)

### PRO Campaign Recipes (`PRO_CAMPAIGN_RECIPES`)
8 growth campaign formulas with preset voucher spines, discounts, and copy formulas:
- `bogo` (Buy 1 Free 1), `happy_hour` (Time-decay off-peak), `flash_sale` (Short-window rush), `welcome_gift` (First visit friction remover), `bring_a_friend` (Viral referral booster), `we_miss_you` (30-day churn winback), `spend_and_save` (Tiered basket booster), `festive_special` (Holiday/Merdeka flash reward).

### Spacing, Radii, Shadows & Typography
- **Spacing**: 0–128 geometric scale (`theme.spacing`)
- **Radii**: Smooth curves from `sm` (6px) to `full` (9999px pill)
- **Shadows**: Premium multi-layer presets (`theme.shadows.sm`, `md`, `lg`, `xl`)
- **Typography**: Inter / Outfit / System sans-serif with strict semantic weights (`400`, `600`, `700`, `800`, `900`)

## pb_migrations (80 files, chronological)

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
19. `1782807018_smart_follow_up.js` — Created follow_up_groups and follow_up_sequences collections
20. `1782807019_update_follow_up_sequences_required.js` — Follow-up sequence schema adjustments
21. `1782807020_create_prospects.js` — Created prospects collection for sales agent tracking
22. `1782807020_sales_agent_referrals.js` — Sales agent system fields & relationships
23. `1782807021_add_birthday_to_users.js` — Birthday and notification preferences fields on users
24. `1782807021_allow_sales_agent_signup.js` — Sales agent authentication/creation API rule updates
25. `1782807022_create_birthday_rewards.js` — Created birthday_rewards configuration collection
26. `1782807023_create_birthday_logs.js` — Created birthday_logs execution history collection
27. `1782807024_delete_dead_collections.js` — Cleaned up deprecated collections
28. `1782807025_add_merchant_onboarding_fields.js` — Merchant profile onboarding fields
29. `1782807026_create_qr_transactions.js` — Created qr_transactions tracking collection
30. `1782807027_create_nfc_claims.js` — Created nfc_claims collection
31. `1782807028_add_merchant_bg_image.js` — Card background image field configuration
32. `1782807029_add_merchant_bg_image_v2.js` — Refinement of card background image configurations
33. `1782807030_add_sales_agent_tier_rates.js` — Sales agent commission tier percentage rates
34. `1782807030_allow_draft_nfc_claims_status.js` — Draft status support on NFC claims
35. `1782807031_add_sales_agent_tier_thresholds.js` — Tier qualification thresholds for sales agents
36. `1782807032_create_whatsapp_configurations.js` — Dedicated WhatsApp instance configurations collection
37. `1782807033_add_card_background_back.js` — Restored loyalty card back background field
38. `1782807033_create_system_settings.js` — System configuration collection for feature toggles & global limits
39. `1782807034_create_branches.js` — Multi-branch outlet management collection
40. `1782807035_add_branch_to_users_and_update_plans.js` — User branch associations and branch plan limit flags
41. `1782807036_fix_branches_id_autogenerate.js` — Standardized branches collection ID autogeneration pattern
42. `1782807037_backfill_hq_branches.js` — Backfilled default HQ branch for existing merchants
43. `1782807038_create_activation_codes.js` — Physical NFC stand activation code collection
44. `1782807039_create_hardware_orders.js` — Hardware stand purchase orders & tracking collection
45. `1782807040_seed_pricesettings02.js` — Seeded pricing settings for tiered subscription billing
46. `1782807041_update_pricing_settings_rules.js` — Security rules for pricing settings administration
47. `1782807042_create_store_feedbacks_and_google_review.js` — Feedback collection and Google Review funnel config
48. `1782807043_allow_negative_bill_amount.js` — Allowed negative bill amounts for transaction corrections/refunds
49. `1782807044_allow_transactions_delete.js` — Merchant owner permissions for transaction deletion
50. `1782807045_fix_store_feedbacks_id_autogenerate.js` — Feedback collection ID autogeneration fix
51. `1782807046_add_inactive_threshold_days.js` — Inactivity threshold setting for win-back automations
52. `1782807047_harden_collection_security_rules.js` — Hardened API access rules across all core collections
53. `1782807048_add_staff_to_transactions.js` — Recorded staff member ID on transaction records
54. `1782807049_allow_staff_view_subscriptions.js` — Granted staff read permissions on merchant subscription status
55. `1782807050_add_remark_to_activation_codes.js` — Admin remark field on hardware activation codes
56. `1782807050_create_push_subscriptions.js` — WebPush subscription endpoint registry collection
57. `1782807051_backfill_nfc_transactions.js` — Backfilled transaction records for historical NFC claims
58. `1782807052_add_loyalty_mode_toggles.js` — Added independent `enable_stamps` and `enable_points` switches
59. `1782807053_add_spend_per_point.js` — Configurable spend-per-point ratio in loyalty programs
60. `1782807054_enable_all_existing_loyalty_modes.js` — Enabled dual stamp and points mode on existing loyalty programs
61. `1782807055_create_booking_system_collections.js` — Created merchant_services, service_bookings, service_staff collections
62. `1782807056_add_image_to_merchant_services.js` — Service hero image field in merchant services
63. `1782807057_add_avatar_to_merchant_staff.js` — Staff profile avatar image in booking service staff
64. `1782807058_allow_customers_view_service_bookings.js` — Customer read rules for their own appointment bookings
65. `1782807059_add_merchant_booking_vip_opt_in.js` — VIP booking priority and auto-confirmation flags
66. `1782807060_create_customer_events.js` — Created customer_events audit collection for behavioral triggers
67. `1782807060_update_merchant_services_booking_models.js` — Added deposit, duration buffers, and booking policies
68. `1782807061_create_user_recommendation_cache.js` — Machine-learning / AI customer recommendation cache collection
69. `1782807062_refactor_rewards_and_programs_schema.js` — Refactored rewards schema for standalone catalog items
70. `1782807063_backfill_program_linked_rewards.js` — Migrated legacy embedded reward configurations to standalone rewards
71. `1782807064_structured_rewards_and_eligible_items.js` — Structured voucher discount fields, min spend, and item scoping
72. `1782807070_add_reward_visual_id.js` — Added visual identifiers and icon tokens to rewards
73. `1782807071_update_email_templates.js` — Refreshed system email templates with branded transactional layouts
74. `1782807072_add_assigned_staff_to_merchant_services.js` — Multi-staff assignment relation on merchant services
75. `1782807072_add_push_reminders_support.js` — Push reminder tracking fields on service bookings
76. `1782807073_add_min_spend_to_loyalty_programs.js` — Added minimum qualifying spend per stamp requirement
77. `1782807074_add_commission_to_merchant_services.js` — Staff commission percentage field on service catalog
78. `1782807075_add_merchant_allow_staff_selection.js` — Merchant setting allowing customers to pick preferred staff
79. `1782807076_add_points_redemption_to_loyalty_programs.js` — Added `points_per_rm`, `min_redeem_points`, `max_redeem_percent`, `enable_points`
80. `1782807077_add_applicable_items_text_and_scope_to_rewards.js` — Added `applicable_items_text` and `discount_scope` fields for decoupled Stand vs PRO voucher creation

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

# DB inspection (use risev_db_admin, NEVER postgres)
docker exec -it risev-evolution-db psql -U risev_db_admin -l
docker exec -it risev-evolution-db psql -U risev_db_admin -d evogo_users -c "\dt"
docker exec -it risev-evolution-db psql -U risev_db_admin -d evogo_auth -c "\dt"

# Apply compose changes + clean up removed services
docker compose up -d --remove-orphans

# Recreate a single service
docker compose up -d --force-recreate evolution-go

# Verify evolution-go DSNs (should show evolution-db:5432, NOT pgbouncer)
docker exec risev-evolution-go env | grep POSTGRES
```

## Known Pitfalls

1. **Never use `-U postgres`** on `risev-evolution-db` — the role doesn't exist. Use `-U risev_db_admin`.
2. **Never route evolution-go through PgBouncer** — prepared-statement desync breaks it (see above).
3. **`init.sql` only runs on empty data dir** — for existing clusters, create `evogo_auth`/`evogo_users` manually.
4. **`.env.example` user is `risev_db_admin`** (corrected 2026-07-17). If you see `postgres` there, it's been reverted — fix it.
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

- `UI_UX_AGENTS.md` — Multi-agent UI/UX studio protocol (Orchestra, Copywriter, UI Craft, UX Architect, Technical Impact, Token Sentinel, Motion, Edge Case).
- `DESIGN_UI_UX_MEMORY.md` — Single Source of Truth for UI/UX, Rule of Three, Boarding Pass voucher system, 5-Tab executive architecture, Stand vs PRO plan decoupling, Paywalls.
- `theme/index.ts` — Design tokens, color palette, `getVoucherSpineTheme` (10-color vertical spine system), `PRO_CAMPAIGN_RECIPES` (8 growth formulas).
- `app/(merchant)/rewards.tsx` — 5-Tab Executive Architecture (Catalogue, Card Design, Stamp Rule, Points Studio, Birthday), Smart Campaign dynamic controls, PRO paywall modal.
- `docker-compose.yml` — the entire VPS stack; DSNs for evolution-go (must stay direct to evolution-db:5432).
- `pb_hooks/whatsapp_helper.js` — Evolution Go proxy + circuit breakers; `callEvo()`, `getInstanceToken()`, `sendTextMessage()`.
- `pb_hooks/blast_message.pb.js` — WhatsApp status/QR/disconnect/blast routes + webhook receiver.
- `app/(merchant)/profile.tsx` — WhatsApp QR modal + backoff polling.
- `lib/pocketbase.ts` — PocketBase client singleton.
- `context/AuthContext.tsx` / `context/LanguageContext.tsx` — auth + i18n (en/ms).
- `.env.example` — env var reference (DB user is risev_db_admin).