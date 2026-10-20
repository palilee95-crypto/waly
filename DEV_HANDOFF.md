# Developer Handoff

This file records repository changes for developers who pull the project from GitHub. Entries are append-only and summarize behavior, implementation areas, validation, and operational notes.

**Last documented commit:** `169cf37` (`feat: add manual POS and catalog inventory support`)

## 2026-10-19 — NFC, quota, infrastructure, POS, and inventory updates

The branch advanced from `7563e4b` through `169cf37`. The four commits from `b82e00b` to `c73d607` were pulled from `origin/main`; `169cf37` added and pushed the manual POS launcher and catalog inventory work.

### NFC dashboard repair — `b82e00b` (`fix(dashboard,nfc): repair incomplete upstream pull and honest metrics`)

- Repaired merchant dashboard metrics and included the upstream NFC checkout components and Malaysian manual-phone normalization utility.
- Main paths: `app/(merchant)/index.tsx`, `components/FullPosCheckout.tsx`, `lib/manualPosPhone.ts`.

### Lifetime customer-slot top-ups — `8ae11fa` (`feat(quota): add lifetime customer-slot top-ups for Stand Bundle`)

- Added merchant add-on/quota purchase flow and UI for lifetime customer-slot top-ups on the Stand Bundle.
- Updated customer views and subscription/profile/NFC marketplace screens to surface or account for add-ons.
- Added PocketBase quota add-on hooks, shared subscription enforcement logic, Chip-in webhook integration, and a merchant-addons migration.
- Main paths: `app/(merchant)/_components/CustomerOverviewCards.tsx`, `app/(merchant)/_components/QuotaTopUpModal.tsx`, `app/(merchant)/customers.tsx`, `app/(merchant)/nfc-marketplace.tsx`, `app/(merchant)/profile.tsx`, `app/(merchant)/subscription.tsx`, `pb_hooks/chipin_webhook.pb.js`, `pb_hooks/customer_management.pb.js`, `pb_hooks/quota_addons.js`, `pb_hooks/quota_addons.pb.js`, `pb_hooks/subscription_enforce.pb.js`, `pb_hooks/subscription_enforce_logic.js`, `pb_migrations/1782807093_create_merchant_addons.js`.

### Litestream backup configuration — `c55aa31` (`fix(infra): point Litestream at Cloudflare R2 and run it as root`)

- Updated Litestream configuration and container setup to use Cloudflare R2 and run the service as root.
- Updated `.env.example` with the corresponding configuration variables. Verify production secrets and deployment environment values are set before deploying.
- Main paths: `.env.example`, `docker-compose.yml`, `litestream.yml`.

### NFC pre-claim voucher prompt — `c73d607` (`fix(nfc): make the pre-claim voucher prompt actually work`)

- Updated the customer NFC flow, claim modal, and PocketBase request/transaction hooks to repair the pre-claim voucher prompt flow.
- Main paths: `app/nfc.tsx`, `components/NfcClaimModal.tsx`, `pb_hooks/nfc_request.pb.js`, `pb_hooks/nfc_transaction.pb.js`.

### Manual POS and catalog inventory — `169cf37` (`feat: add manual POS and catalog inventory support`)

- Added `ManualPosLauncher`, mounted globally in the merchant layout. The dashboard's former Marketing quick action now opens the POS phone-entry flow. The launcher normalizes a Malaysian phone number, requests an NFC claim, verifies the returned claim belongs to the active merchant and is pending, then opens the existing NFC claim/checkout flow.
- Added shared catalog item types, pricing units, stock/booking capabilities, merchant-specific type/category suggestions, and legacy `gadget` → `repair` category normalization in `lib/catalogConfig.ts`.
- Updated profile onboarding to use the normalized merchant category and show `repair` in the Auto & Tech category group.
- Added a PocketBase migration for catalog category, SKU/barcode/unit, stock settings, POS/booking flags, balances, and inventory movement collections. Inventory remains separate from legacy booking capacity; the migration enables POS and booking flags for existing merchant services without inferring stock quantities.
- Added an authenticated inventory adjustment endpoint and helper. The helper checks merchant/branch/item access, limits stock tracking to physical products/add-ons, rejects negative stock, uses transactions, records audit movements, and supports idempotent adjustment references. Record hooks protect catalog-category ownership, merchant ownership, and stock semantics.
- The migration intentionally refuses rollback until an explicit stock-history retention/export plan exists; do not remove this guard without deciding how to retain operational inventory history.
- Main paths: `app/(merchant)/_layout.tsx`, `app/(merchant)/index.tsx`, `app/(merchant)/profile-onboarding.tsx`, `components/ManualPosLauncher.tsx`, `lib/catalogConfig.ts`, `pb_hooks/inventory.pb.js`, `pb_hooks/inventory_helper.js`, `pb_migrations/1782807093_catalog_inventory.js`.

### Validation and status

- `npx --no-install tsc --noEmit` passed after `169cf37` was created.
- `git diff --cached --check` passed before commit.
- Commit `169cf37` was pushed to `origin/main`.
- No PocketBase migration execution or production deployment was performed as part of this handoff.

---
