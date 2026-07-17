# Implementation Plan — WhatsApp Integration: 9 Fixes (Broadcast & Follow-Up)

> **Context**: PocketBase 0.39.5, Evolution Go 0.7.2. The `broadcasts` and
> `automation_rules` collections have a text `id` field with
> `autogeneratePattern: "[a-z0-9]{15}"` — PocketBase auto-generates IDs, so
> the manual `randomId` generation in the code is unnecessary (verified against
> PB 0.39 docs + existing migration patterns in `pb_migrations/`).

## Summary of Fixes

| #  | Fix                              | Schema migration? | Files changed |
|----|----------------------------------|:-----------------:|---------------|
| 1  | Follow-up threading             | ✅ Yes            | migration + `blast_message.pb.js` |
| 2  | Automation timezone window       | ❌ No             | `automation_logic.js` |
| 3  | Delivery status tracking         | ✅ Yes            | migration + `blast_message.pb.js` + `automation_logic.js` |
| 4  | Pagination (1000-record limit)   | ❌ No             | `blast_message.pb.js` + `automation_logic.js` |
| 5  | Broadcast anti-spam cooldown    | ❌ No             | `blast_message.pb.js` |
| 6  | WhatsApp message language        | ❌ No (env var)   | `blast_message.pb.js` + `automation_logic.js` |
| 7  | STOP opt-out parsing robustness  | ❌ No             | `blast_message.pb.js` |
| 8  | Unsubscribe instructions         | ❌ No             | `blast_message.pb.js` + `automation_logic.js` |
| 9  | Remove manual ID generation      | ❌ No (schema OK) | `blast_message.pb.js` + `automation_logic.js` + `marketing.tsx` |

---

## Proposed Changes

### Phase 1 — Schema Migration (Fixes #1 + #3)

#### [CREATE] `pb_migrations/1782807018_broadcasts_parent_delivery.js`
Add three fields to the `broadcasts` collection (uses `collection.fields.add(new Field({...}))` + `collection.fields.removeById("...")` patterns verified in existing migrations):
- `parent_broadcast` — relation to `broadcasts` (maxSelect 1, not required, no cascade delete) — enables follow-up threading.
- `delivery_status` — text (max 20, not required) — values: `pending` / `partial` / `sent` / `failed`.
- `failed_count` — number (noDecimal, not required) — counts WhatsApp send failures.

Rollback removes all three fields by id (`rel_parent_bc`, `text_delstatus_bc`, `num_failed_bc`).

---

### Phase 2 — Backend: Broadcast Route (Fixes #1, #3, #4, #5, #6, #7, #8, #9)

#### [MODIFY] `pb_hooks/blast_message.pb.js` — `POST /api/risev/merchant/blast`

**Fix #1 — Follow-up threading:**
- Read `const parentBroadcastId = body.parentBroadcastId || "";` from the request body (the frontend already sends it).
- When saving the `broadcasts` record: `if (parentBroadcastId) bcRecord.set("parent_broadcast", parentBroadcastId);`

**Fix #3 — Delivery status tracking:**
- Add `let failedCount = 0;` counter.
- Increment `failedCount++` in the WhatsApp send `catch` block.
- After the loop, compute `deliveryStatus`: `failed` (all failed), `partial` (some failed), or `sent` (none failed).
- Save `bcRecord.set("delivery_status", deliveryStatus)` and `bcRecord.set("failed_count", failedCount)`.
- Return `{ success, count: sentCount, failed: failedCount }`.

**Fix #4 — Pagination:**
- Add a `fetchAllRecords(collectionName, filter, sort)` helper that loops pages of 500 until a batch returns fewer than 500.
- Replace the two `$app.findRecordsByFilter(..., 1000, 0)` calls (loyalty_cards + transactions) with `fetchAllRecords(...)`.

**Fix #5 — Broadcast anti-spam cooldown:**
- After collecting recipients, query `notifications` for `type = "campaign" && created >= "{oneDayAgo}" && data.merchant_id = "{merchantId}"`.
- Build a `recentlyNotifiedIds` Set from the `recipient` field.
- In the send loop, `if (recentlyNotifiedIds.has(customerId)) { skip; continue; }`.

**Fix #6 — WhatsApp message languages:**
- Read `const msgLang = ($os.getenv("WHATSAPP_MSG_LANG") || "ms").toLowerCase();`.
- Define `headerPrefix` and `footerText` as bilingual constants (en/ms) selected by `msgLang`.
- Use them in the `formattedWhatsAppMsg` template instead of the hardcoded Malay strings.

**Fix #7 — STOP opt-out parsing:**
- In the webhook handler, replace `instanceName.split("-")[1]` with `instanceName.match(/^merchant-([^-]+)-/)`.
- Use `merchantMatch[1]` as the merchantId. Safe against hyphens in the merchant name slug.

**Fix #8 — Unsubscribe instructions:**
- Append `_Reply STOP to unsubscribe._` (en) or `_Balas STOP untuk berhenti melanggan._` (ms) to the footer text.

**Fix #9 — Remove manual ID generation:**
- Delete the `randomId` block (the `chars`/`for` loop and `bcRecord.set("id", randomId)`).
- Let PocketBase auto-generate via the existing `autogeneratePattern`.

---

### Phase 3 — Backend: Automation Logic (Fixes #2, #3, #4, #6, #8, #9)

#### [MODIFY] `pb_hooks/automation_logic.js` — `runAutomations()`

**Fix #2 — Timezone window:**
- Replace the single-day window (`updated >= startStr && updated <= endStr`) with `updated <= startStr` (no upper bound).
- This catches all cards inactive for *at least* `trigger_days`, avoiding edge-case misses at day boundaries.

**Fix #3 — Delivery status tracking:**
- Add `let failedCount = 0;` per rule.
- Increment on WhatsApp send failure.
- Save `delivery_status` and `failed_count` on the `broadcasts` record (same logic as the blast route).

**Fix #4 — Pagination:**
- Add the same `fetchAllRecords` helper and use it for the `loyalty_cards` query.

**Fix #6 — WhatsApp message language:**
- Same bilingual `headerPrefix` / `footerText` approach (env var `WHATSAPP_MSG_LANG`).
- Header uses "Automated Follow-up from" (en) / "Susulan Automatik daripada" (ms).

**Fix #8 — Unsubscribe instructions:**
- Same STOP footer appended to the message.

**Fix #9 — Remove manual ID generation:**
- Delete the `randomId` block; let PB auto-generate.

---

### Phase 4 — Frontend (Fix #9)

#### [MODIFY] `app/(merchant)/marketing.tsx` — `handleSaveAutomationRule`
- In the `else` (create) branch, remove the `randomId` generation block and the `id: randomId` property from the payload.
- PocketBase will auto-generate the ID.

---

### Phase 5 — Environment (Fix #6)

#### [MODIFY] `.env.example` + VPS `/opt/risev/.env`
- Add `WHATSAPP_MSG_LANG=ms` (default Malay; set to `en` for English).
- This controls the WhatsApp message wrapper language for both broadcasts and automations.

---

## Verification Plan

### Automated Tests
- Type checking verification:
  ```powershell
  npx tsc --noEmit