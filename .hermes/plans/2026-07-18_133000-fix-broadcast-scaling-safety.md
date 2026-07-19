# Fix Broadcast Scaling & Safety — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Remove the 1000-record cap on broadcasts and add 24h anti-spam cooldown so merchants with large customer bases can blast safely without WhatsApp bans.

**Architecture:** Add a `fetchAllRecords()` pagination helper that loops 500-record pages until exhausted. Use it in both `blast_message.pb.js` and `automation_logic.js` wherever `findRecordsByFilter(..., 1000, 0)` is called today. Then add a `recentlyNotifiedIds` Set built from the `notifications` collection (last 24h, same merchant) and skip recipients in that Set during the send loop.

**Tech Stack:** PocketBase 0.39.5 JS VM (goja), Evolution Go 0.7.2. No schema migration needed. No frontend changes.

---

## Context

### Current bugs

1. **1000-record cap** — `blast_message.pb.js:177` and `:202` call `$app.findRecordsByFilter(collection, filter, sort, 1000, 0)`. PocketBase's `findRecordsByFilter` defaults to returning at most `perPage` records (here 1000). Merchants with >1000 cardholders silently lose recipients. Same pattern in `automation_logic.js:51`.

2. **No broadcast anti-spam cooldown** — The blast route sends to every opted-in customer on every call. A merchant who blasts twice in an hour spams the same customers. The automation logic already has a 7-day cooldown (`automation_logic.js:66-81`) but the manual blast route has none. WhatsApp may ban the instance for spam reports.

### Constraints (from AGENTS.md)

- PocketBase JS VM has **no** `dao()`, **no** `deleteAllRecords`. Use only `$app.findRecordsByFilter`, `$app.findRecordById`, `$app.save`, `$app.delete`.
- `findRecordsByFilter(collection, filter, sort, perPage, page)` — `page` is 0-indexed.
- Filter strings use double-quoted values: `field = "value"`. IDs are `[a-z0-9]{15}` (safe to interpolate).
- Hooks hot-reload on SCP — no container restart needed.
- The `notifications` collection has fields: `recipient` (user id), `type` (string), `created` (autodate), `data` (json with `merchant_id`).
- The `loyalty_cards` collection has: `customer`, `program`, `opt_in_marketing`, `stamps_collected`, `updated`.
- Existing anti-spam in automation_logic.js queries `notifications` with `data.merchant_id = "${merchantId}"` — this pattern works, reuse it.

---

## Task 1: Add `fetchAllRecords` helper to `blast_message.pb.js`

**Objective:** Create a reusable pagination helper inside the blast route file so all `findRecordsByFilter` calls can fetch unlimited records.

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\blast_message.pb.js` (top of file, after the comment header)

**Step 1: Add the helper function**

Insert this at the top of `blast_message.pb.js`, after line 1 (the `// pb_hooks/blast_message.pb.js` comment):

```javascript
// Pagination helper: fetch all records matching a filter by looping 500-record pages.
// PocketBase's findRecordsByFilter caps at perPage records per call — this loops until exhausted.
// DO NOT pass a perPage > 500; larger values are silently clamped by PB and may miss records.
function fetchAllRecords(collectionName, filter, sort) {
  const perPage = 500;
  let page = 0;
  let all = [];
  let batch;
  do {
    batch = $app.findRecordsByFilter(collectionName, filter, sort || "-created", perPage, page);
    for (let i = 0; i < batch.length; i++) all.push(batch[i]);
    page++;
  } while (batch.length === perPage);
  return all;
}
```

**Step 2: Verify the file still parses (hot-reload)**

After SCP, watch the PocketBase logs:
```bash
ssh root@166.88.35.57 "docker logs --since 30s risev-pocketbase"
```
Expected: no `failed to execute` lines. The helper is defined but not yet called, so no behavior change.

**Step 3: Commit**

```bash
cd "C:\Users\User\Documents\Work\WALY MOBILE\web-app"
git add pb_hooks/blast_message.pb.js
git commit -m "feat(blast): add fetchAllRecords pagination helper"
```

---

## Task 2: Replace the 1000-record calls in `blast_message.pb.js`

**Objective:** Use `fetchAllRecords` for the two capped queries in the blast route.

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\blast_message.pb.js:177` and `:202`

**Step 1: Replace the loyalty_cards query (line 177)**

Find:
```javascript
const cards = $app.findRecordsByFilter("loyalty_cards", programFilter, "-created", 1000, 0);
```

Replace with:
```javascript
const cards = fetchAllRecords("loyalty_cards", programFilter, "-created");
```

**Step 2: Replace the transactions query (line 202)**

Find:
```javascript
const txs = $app.findRecordsByFilter("transactions", `merchant = "${merchantId}"`, "-created", 1000, 0);
```

Replace with:
```javascript
const txs = fetchAllRecords("transactions", `merchant = "${merchantId}"`, "-created");
```

**Step 3: Verify via logs**

After SCP, trigger a blast from the admin portal for a merchant with >1000 cardholders. Check:
```bash
ssh root@166.88.35.57 "docker logs --since 2m risev-pocketbase | grep -i blast"
```
Expected: `count` in the response should now exceed 1000 if the merchant has that many recipients.

**Step 4: Commit**

```bash
git add pb_hooks/blast_message.pb.js
git commit -m "fix(blast): remove 1000-record cap on recipient queries"
```

---

## Task 3: Add 24h anti-spam cooldown to the blast route

**Objective:** Skip customers who received a campaign notification from this merchant in the last 24 hours.

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\blast_message.pb.js` (inside the `POST /api/risev/merchant/blast` handler, after the recipient collection loop and before the send loop)

**Step 1: Build the `recentlyNotifiedIds` Set**

Insert this block immediately after the `customerRecords` collection is finalized (after the transactions scan, around line 215, before the `if (customerRecords.length === 0)` check):

```javascript
// Anti-spam: build a Set of customer IDs who received a campaign notification
// from this merchant in the last 24 hours. Skip them in the send loop.
const oneDayAgo = new Date();
oneDayAgo.setDate(oneDayAgo.getDate() - 1);
const cooldownStr = oneDayAgo.toISOString().replace('T', ' ').substring(0, 19);

const recentNotifs = fetchAllRecords(
  "notifications",
  `type = "campaign" && created >= "${cooldownStr}" && data.merchant_id = "${merchantId}"`,
  "-created"
);
const recentlyNotifiedIds = new Set();
for (let n = 0; n < recentNotifs.length; n++) {
  const r = recentNotifs[n].get("recipient");
  if (r) recentlyNotifiedIds.add(r);
}
```

**Step 2: Skip recently-notified customers in the send loop**

In the send loop (around line 229), add the skip check at the top of the loop body, before any message formatting:

Find:
```javascript
for (let i = 0; i < customerRecords.length; i++) {
  const customerItem = customerRecords[i];
  const customer = customerItem.record;
  const customerId = customer.id;
```

Replace with:
```javascript
for (let i = 0; i < customerRecords.length; i++) {
  const customerItem = customerRecords[i];
  const customer = customerItem.record;
  const customerId = customer.id;

  // Anti-spam: skip customers notified in the last 24h
  if (recentlyNotifiedIds.has(customerId)) continue;
```

**Step 3: Verify via logs**

After SCP, trigger two blasts from the same merchant within 1 hour. The second blast should report `count: 0` (or a much smaller number) because all recipients were just notified.

```bash
ssh root@166.88.35.57 "docker logs --since 5m risev-pocketbase | grep -i blast"
```

**Step 4: Commit**

```bash
git add pb_hooks/blast_message.pb.js
git commit -m "feat(blast): add 24h anti-spam cooldown for manual broadcasts"
```

---

## Task 4: Add `fetchAllRecords` to `automation_logic.js` and remove the cap

**Objective:** Apply the same pagination fix to the automation runner.

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\automation_logic.js:51`

**Step 1: Add the same helper at the top of the file**

Insert after line 1 (the `// pb_hooks/automation_logic.js` comment):

```javascript
// Pagination helper: fetch all records matching a filter by looping 500-record pages.
function fetchAllRecords(collectionName, filter, sort) {
  const perPage = 500;
  let page = 0;
  let all = [];
  let batch;
  do {
    batch = $app.findRecordsByFilter(collectionName, filter, sort || "-created", perPage, page);
    for (let i = 0; i < batch.length; i++) all.push(batch[i]);
    page++;
  } while (batch.length === perPage);
  return all;
}
```

**Step 2: Replace the capped loyalty_cards query (line 51)**

Find:
```javascript
const cards = $app.findRecordsByFilter("loyalty_cards", filter, "-created", 1000, 0);
```

Replace with:
```javascript
const cards = fetchAllRecords("loyalty_cards", filter, "-created");
```

**Step 3: Verify via the test endpoint**

After SCP, hit the manual test trigger:
```bash
ssh root@166.88.35.57 "curl -s http://localhost:8090/api/risev/test/run-automations"
```
Expected: JSON response with `stats` array. If a merchant has >1000 inactive cards, the `recipients` array should now exceed 1000 entries for that rule.

**Step 4: Commit**

```bash
git add pb_hooks/automation_logic.js
git commit -m "fix(automation): remove 1000-record cap on inactive card query"
```

---

## Task 5: Extract `fetchAllRecords` into a shared helper (DRY)

**Objective:** Avoid duplicating the helper across two files. Move it to `whatsapp_helper.js` (already required by both files) and import it.

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\whatsapp_helper.js` (add export)
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\blast_message.pb.js` (remove local def, import)
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\automation_logic.js` (remove local def, import)

**Step 1: Add `fetchAllRecords` to `whatsapp_helper.js`**

At the top of `whatsapp_helper.js` (after any existing constants), add:

```javascript
function fetchAllRecords(collectionName, filter, sort) {
  const perPage = 500;
  let page = 0;
  let all = [];
  let batch;
  do {
    batch = $app.findRecordsByFilter(collectionName, filter, sort || "-created", perPage, page);
    for (let i = 0; i < batch.length; i++) all.push(batch[i]);
    page++;
  } while (batch.length === perPage);
  return all;
}
```

In the `module.exports` block at the bottom of `whatsapp_helper.js`, add `fetchAllRecords`:

```javascript
module.exports = {
  callEvo,
  getInstanceToken,
  sendTextMessage,
  fetchAllRecords
};
```

**Step 2: Remove the local definitions and import in `blast_message.pb.js`**

Delete the `function fetchAllRecords(...)` block added in Task 1 from the top of `blast_message.pb.js`.

In the blast route handler (around line 138), update the require:

Find:
```javascript
const { sendTextMessage } = require(`${__hooks}/whatsapp_helper.js`);
```

Replace with:
```javascript
const { sendTextMessage, fetchAllRecords } = require(`${__hooks}/whatsapp_helper.js`);
```

Do the same for the other two route handlers in the file (the status route and disconnect route) — only if they also use `fetchAllRecords`. They don't, so only the blast route needs the import.

**Step 3: Remove the local definition and import in `automation_logic.js`**

Delete the `function fetchAllRecords(...)` block from the top of `automation_logic.js`.

At the top of `runAutomations()` (around line 8), update the require:

Find:
```javascript
const { sendTextMessage } = require(`${__hooks}/whatsapp_helper.js`);
```

Replace with:
```javascript
const { sendTextMessage, fetchAllRecords } = require(`${__hooks}/whatsapp_helper.js`);
```

**Step 4: Verify via logs**

After SCP, confirm no `ReferenceError: fetchAllRecords is not defined` in logs:
```bash
ssh root@166.88.35.57 "docker logs --since 30s risev-pocketbase"
```

**Step 5: Commit**

```bash
git add pb_hooks/whatsapp_helper.js pb_hooks/blast_message.pb.js pb_hooks/automation_logic.js
git commit -m "refactor: extract fetchAllRecords to shared whatsapp_helper.js"
```

---

## Verification Plan

### Manual integration test (after all tasks)

1. **Pagination fix:**
   - Find a merchant with >1000 loyalty cardholders (or create test data).
   - Trigger a blast from the admin portal.
   - Confirm the `count` in the API response matches the actual number of opted-in cardholders (not capped at 1000).

2. **Anti-spam cooldown:**
   - Trigger a blast from the same merchant.
   - Immediately trigger a second blast.
   - Confirm the second blast returns `count: 0` (all recipients were just notified).

3. **Automation pagination:**
   - SSH to VPS and run: `curl -s http://localhost:8090/api/risev/test/run-automations`
   - Confirm the response includes recipients for merchants with >1000 inactive cards.

### Log checks

```bash
# After each SCP, confirm no errors:
ssh root@166.88.35.57 "docker logs --since 30s risev-pocketbase"

# Check for the pagination helper being called:
ssh root@166.88.35.57 "docker logs --since 5m risev-pocketbase | grep -i 'blast\|automation'"
```

### Static verification (local, before SCP)

```python
# Run via execute_code before each SCP
from hermes_tools import read_file
files = [
    r"C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\blast_message.pb.js",
    r"C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\automation_logic.js",
    r"C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\whatsapp_helper.js",
]
for f in files:
    content = read_file(f)["content"]
    has_no_1000_cap = "1000, 0" not in content
    has_fetch_all = "fetchAllRecords" in content
    print(f"{f.split(chr(92))[-1]}: no-1000-cap={has_no_1000_cap}, has-helper={has_fetch_all}")
```

---

## Risks & Tradeoffs

1. **Memory usage** — `fetchAllRecords` loads all matching records into memory. For merchants with 10k+ cardholders, this is ~10k small objects. Acceptable for a blast operation (not a hot path). If memory becomes an issue, switch to streaming sends page-by-page instead of collecting all records first.

2. **Anti-spam false positives** — The 24h cooldown uses the `notifications` collection, which records both in-app and WhatsApp campaign notifications. A customer who received an in-app-only notification 23 hours ago will be skipped on a WhatsApp blast. This is conservative (errs toward not spamming) and acceptable.

3. **`data.merchant_id` filter** — The anti-spam query filters on `data.merchant_id = "${merchantId}"` inside the JSON `data` field. This works in the existing automation logic (verified at `automation_logic.js:72`), so it should work here too. If PocketBase's JSON filtering has issues, fall back to fetching all recent campaign notifications and filtering in JS.

4. **No test suite** — This project has no automated tests for pb_hooks. Verification is manual via logs and API responses. Static verification (no `1000, 0` in the file, helper present) is the best we can do locally.

---

## Deployment

After each task, SCP the changed file(s) to the VPS:

```bash
# Single file
scp "C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\blast_message.pb.js" root@166.88.35.57:/opt/risev/pb_hooks/blast_message.pb.js

# Multiple files (Task 5)
scp "C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\whatsapp_helper.js" "C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\blast_message.pb.js" "C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\automation_logic.js" root@166.88.35.57:/opt/risev/pb_hooks/
```

PocketBase hot-reloads hooks on file change — no restart needed.