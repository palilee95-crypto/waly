# Fix Bill Amount / New Customer Duplicate Key Bug — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix the "duplicate key in bill amount for new customer" bug where merchants cannot issue stamps to new customers because the auto-generated email collides and the bill amount state is lost across modal transitions.

**Architecture:** Two-part fix: (1) make the auto-generated email deterministic and collision-safe by using a UUID suffix instead of just phone digits, and (2) ensure `billSubtotal` state is not reset to `''` when transitioning between the create-customer modal and the scan-award modal — pass it as a parameter instead of relying on shared state.

**Tech Stack:** Expo SDK 56, React Native 0.85, TypeScript, PocketBase JS SDK (client-side `pb.collection()` calls). No backend hook changes needed.

---

## Context

### The two bugs

**Bug A — Email collision (the "duplicate key"):**
When a merchant enters a phone number for a customer that doesn't exist, `handleCreateAndIssue()` (line 259) creates a new user with:
```typescript
const cleanNum = tempPhone.replace(/[^\d]/g, '');
const emailVal = `user_${cleanNum}@risev.app`;
```
The `users` collection has a **unique index on `email`** (verified in `pb_schema.json`):
```sql
CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email`) WHERE `email` != ''
```

If the customer was previously created through this same flow (e.g. the phone lookup failed due to formatting differences — `+6012345678` vs `012345678`), the email `user_6012345678@risev.app` already exists → `UNIQUE constraint failed: users.email` → the create call throws → the merchant sees an error.

**Bug B — Bill amount lost in modal transition:**
When a new customer is created, `handleCreateAndIssue()` does:
```typescript
setScannedCustomer(newCustomer);
setBillSubtotal('');  // ← clears the bill amount
setStampsCount(tempCount.toString());
setShowScanAwardModal(true);
```
Then the Scan Award Modal opens (line 912). The merchant enters the bill subtotal in the modal. But `proceedWithIssuingStamps()` (line 132) reads `billSubtotal` from component state — which was just reset to `''`. So if the merchant doesn't re-enter the amount in the modal, `amountPaid` becomes `0` and the transaction is created with `bill_amount: 0` and `points: 0`.

The `billSubtotal` state is shared between three places:
1. The main manual entry form (line 629)
2. The simulate-stamp-scan flow (line 402, reads it)
3. The Scan Award Modal (line 974, reads/writes it)

And it gets reset to `''` at lines 204, 284, 432, 493 — each time a different flow transitions to the next step. This is fragile state sharing.

### The flow that triggers the bug

```
Merchant enters phone + bill amount in main form
  → handleManualSubmit() (line 217)
  → Phone lookup fails (customer doesn't exist)
  → setShowCreateConfirmModal(true) (line 252)
  → Merchant confirms → handleCreateAndIssue() (line 259)
  → Creates user with email user_${cleanNum}@risev.app
  → IF email exists → UNIQUE constraint error → merchant sees "Failed to create new customer account"
  → IF email doesn't exist → setBillSubtotal('') → setShowScanAwardModal(true)
  → Merchant sees modal with EMPTY bill subtotal
  → Merchant enters amount → clicks Issue
  → proceedWithIssuingStamps() reads billSubtotal from state
  → Creates transaction with bill_amount
```

### Constraints

- The `users.email` field is unique and required. We can't change the schema.
- The `@risev.app` domain is used as a placeholder for auto-created customers. The `complete_onboarding.pb.js` hook blocks users from manually using `@risev.app` — it's reserved for auto-created accounts.
- `normalizePhoneNumber()` (line 79) converts `012345678` → `+6012345678`, `6012345678` → `+6012345678`. But the email uses `cleanNum` (digits only from `tempPhone`), which may differ depending on whether the merchant entered `+60...` or `060...` or `60...`.
- PocketBase client SDK `create()` throws on 400-level errors. The error message from a unique constraint violation is generic.

---

## Task 1: Fix email collision — use UUID suffix in auto-generated email

**Objective:** Make the auto-generated email unique even if the same phone number is used twice (due to formatting differences or re-creation attempts).

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\app\(merchant)\give.tsx:264`

**Step 1: Change the email generation**

Find (line 263-264):
```typescript
const cleanNum = tempPhone.replace(/[^\d]/g, '');
const emailVal = `user_${cleanNum}@risev.app`;
```

Replace with:
```typescript
const cleanNum = tempPhone.replace(/[^\d]/g, '');
const randomSuffix = Math.random().toString(36).substring(2, 8);
const emailVal = `user_${cleanNum}_${randomSuffix}@risev.app`;
```

**Why this works:** Adding a 6-char random suffix makes collisions statistically impossible. Even if the same phone number is used twice (due to formatting), the emails will differ. The `@risev.app` domain is still used (reserved for auto-created accounts).

**Step 2: Verify**

- Build the web app: `npx expo export --platform web` (in the web-app directory)
- No TypeScript errors expected (just a string template change).
- Manual test: enter a phone number that doesn't exist → confirm customer is created → enter the same phone number again with different formatting (e.g. `0123456789` vs `+60123456789`) → confirm a second customer is created without error.

**Step 3: Commit**

```bash
cd "C:\Users\User\Documents\Work\WALY MOBILE\web-app"
git add app/\(merchant\)/give.tsx
git commit -m "fix(give): use UUID suffix in auto-generated email to prevent collision"
```

---

## Task 2: Fix bill amount state loss — pass `billSubtotal` as parameter

**Objective:** Stop resetting `billSubtotal` to `''` when transitioning from the create-customer modal to the scan-award modal. Instead, preserve the value the merchant already entered.

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\app\(merchant)\give.tsx:284`

**Step 1: Stop clearing `billSubtotal` in `handleCreateAndIssue()`**

Find (line 282-286):
```typescript
setScannedCustomer(newCustomer);
setScannedRawInput(tempPhone);
setBillSubtotal('');
setStampsCount(tempCount.toString());
setShowScanAwardModal(true);
```

Replace with:
```typescript
setScannedCustomer(newCustomer);
setScannedRawInput(tempPhone);
// Preserve billSubtotal — don't reset to '' here.
// The Scan Award Modal will read it and let the merchant adjust if needed.
setStampsCount(tempCount.toString());
setShowScanAwardModal(true);
```

**Why this works:** The merchant already entered a bill amount in the main form before the phone lookup failed. By the time the create-customer modal opens, `billSubtotal` holds that value. Removing the `setBillSubtotal('')` call means the Scan Award Modal will show the amount the merchant already typed. They can still edit it in the modal.

**Step 2: Also stop clearing `billSubtotal` in the QR scan flow**

Find (line 491-494):
```typescript
setScannedCustomer(customer);
setScannedRawInput(rawInput);
setBillSubtotal('');
setStampsCount(count.toString());
```

Replace with:
```typescript
setScannedCustomer(customer);
setScannedRawInput(rawInput);
// Preserve billSubtotal for the scan award modal.
setStampsCount(count.toString());
```

**Why:** Same issue — the QR scan flow clears the bill amount before opening the modal. The merchant may have already typed an amount in the main form.

**Step 3: Verify**

- Manual test: enter a phone number + bill amount → customer doesn't exist → confirm create → Scan Award Modal opens → bill subtotal field should show the amount you typed, not `0.00`.
- Manual test: scan a QR code → Scan Award Modal opens → bill subtotal should show whatever was in the main form (if anything).

**Step 4: Commit**

```bash
git add app/\(merchant\)/give.tsx
git commit -m "fix(give): preserve bill subtotal across modal transitions"
```

---

## Task 3: Add phone normalization to email generation (defense in depth)

**Objective:** Ensure the phone number used in the email is always normalized, so the same customer always gets the same base email (with the UUID suffix as a tiebreaker).

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\app\(merchant)\give.tsx:263`

**Step 1: Normalize the phone before generating the email**

Find (line 263-264, after Task 1's change):
```typescript
const cleanNum = tempPhone.replace(/[^\d]/g, '');
const randomSuffix = Math.random().toString(36).substring(2, 8);
const emailVal = `user_${cleanNum}_${randomSuffix}@risev.app`;
```

Replace with:
```typescript
const normalizedPhone = normalizePhoneNumber(tempPhone);
const cleanNum = normalizedPhone.replace(/[^\d]/g, '');
const randomSuffix = Math.random().toString(36).substring(2, 8);
const emailVal = `user_${cleanNum}_${randomSuffix}@risev.app`;
```

**Why:** This ensures `+60123456789`, `0123456789`, and `60123456789` all produce the same `cleanNum` (`60123456789`). Combined with the UUID suffix, this means:
- First creation: `user_60123456789_abc123@risev.app`
- Second creation (if lookup fails again): `user_60123456789_def456@risev.app`
- No collision, but consistent base.

**Step 2: Verify**

- TypeScript: `npx tsc --noEmit` — should pass (we're using an existing function).
- Manual test: enter `0123456789` → create customer → check the user's email in PocketBase admin → should be `user_60123456789_<suffix>@risev.app`.

**Step 3: Commit**

```bash
git add app/\(merchant\)/give.tsx
git commit -m "fix(give): normalize phone before generating auto email"
```

---

## Task 4: Add a fallback — if user creation fails, try to find existing user by phone

**Objective:** If the email collision still happens (edge case: exact same email already exists), fall back to looking up the user by phone number and proceeding with the stamp issuance instead of failing.

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\app\(merchant)\give.tsx:267-290`

**Step 1: Wrap the user creation in a try-catch with fallback**

Find (line 267-290):
```typescript
try {
  const newCustomer = await pb.collection('users').create({
    phone: tempPhone,
    email: emailVal,
    name: newCustomerName.trim() || `User ${tempPhone.slice(-4)}`,
    role: 'customer',
    password: randomPassword,
    passwordConfirm: randomPassword,
    total_points: 0,
    tier: 'bronze',
  });

  setNewCustomerName('');

  // Continue the stamp issue process using the new customer!
  setScannedCustomer(newCustomer);
  setScannedRawInput(tempPhone);
  // Preserve billSubtotal — don't reset to '' here.
  // The Scan Award Modal will read it and let the merchant adjust if needed.
  setStampsCount(tempCount.toString());
  setShowScanAwardModal(true);
  setShowCreateConfirmModal(false);
} catch (createErr: any) {
  console.error("Auto customer creation failed:", createErr);
  Alert.alert('Error', 'Failed to create new customer account: ' + (createErr.message || createErr));
  setScanned(false);
  setShowCreateConfirmModal(false);
} finally {
  setIsSubmitting(false);
}
```

Replace with:
```typescript
let newCustomer;
try {
  newCustomer = await pb.collection('users').create({
    phone: tempPhone,
    email: emailVal,
    name: newCustomerName.trim() || `User ${tempPhone.slice(-4)}`,
    role: 'customer',
    password: randomPassword,
    passwordConfirm: randomPassword,
    total_points: 0,
    tier: 'bronze',
  });
} catch (createErr: any) {
  // Fallback: the email may already exist (edge case). Try to find the user by phone.
  console.warn("Auto customer creation failed, trying phone lookup:", createErr.message || createErr);
  try {
    const normalizedPhone = normalizePhoneNumber(tempPhone);
    newCustomer = await pb.collection('users').getFirstListItem(`phone = "${normalizedPhone}"`);
  } catch (lookupErr: any) {
    console.error("Phone lookup fallback also failed:", lookupErr.message || lookupErr);
    Alert.alert('Error', 'Failed to create new customer account: ' + (createErr.message || createErr));
    setScanned(false);
    setShowCreateConfirmModal(false);
    setIsSubmitting(false);
    return;
  }
}

setNewCustomerName('');

// Continue the stamp issue process using the new (or found) customer!
setScannedCustomer(newCustomer);
setScannedRawInput(tempPhone);
// Preserve billSubtotal — don't reset to '' here.
setStampsCount(tempCount.toString());
setShowScanAwardModal(true);
setShowCreateConfirmModal(false);
setIsSubmitting(false);
```

**Why:** This is a safety net. If the create fails for any reason (email collision, network error, validation), we try to find the user by phone. If found, we proceed with the stamp issuance. If not found, we show the original error. This means the merchant never gets stuck — even if the customer already exists with a different email format.

**Step 2: Verify**

- TypeScript: `npx tsc --noEmit` — should pass.
- Manual test: 
  1. Create a customer with phone `+60123456789` (via the give flow).
  2. Enter `0123456789` (different format) in the give form → phone lookup fails (format mismatch) → create-customer modal opens → confirm.
  3. The create will fail (email exists) → fallback phone lookup runs → finds the existing customer → Scan Award Modal opens → proceed with stamps.
  4. No error shown to the merchant.

**Step 3: Commit**

```bash
git add app/\(merchant\)/give.tsx
git commit -m "fix(give): fallback to phone lookup if user creation fails"
```

---

## Verification Plan

### TypeScript check
```bash
cd "C:\Users\User\Documents\Work\WALY MOBILE\web-app"
npx tsc --noEmit
```
Expected: no errors (we only changed string templates and control flow, no type changes).

### Manual integration test

**Test 1 — New customer, fresh phone:**
1. Enter a phone number that doesn't exist (e.g. `+6099999999`).
2. Enter a bill subtotal (e.g. `25.50`).
3. Click "Issue Stamp Points" → create-customer modal opens → confirm.
4. Scan Award Modal opens → bill subtotal should show `25.50` (not `0.00`).
5. Click "Issue" → success modal shows `RM 25.50` and correct points.
6. Check PocketBase admin → new user with email `user_6099999999_<suffix>@risev.app`.

**Test 2 — Duplicate phone (different format):**
1. Enter `0999999999` (same customer, different format).
2. Enter bill subtotal `15.00`.
3. Click "Issue" → create-customer modal opens (phone lookup failed due to format).
4. Confirm → create fails (email exists) → fallback phone lookup finds the customer.
5. Scan Award Modal opens → bill subtotal shows `15.00`.
6. Issue stamps → success.

**Test 3 — Existing customer, correct format:**
1. Enter `+6099999999` (exact format from Test 1).
2. Enter bill subtotal `10.00`.
3. Click "Issue" → phone lookup succeeds → Scan Award Modal opens directly (no create modal).
4. Bill subtotal shows `10.00`.
5. Issue stamps → success.

### What NOT to test
- No backend hook changes → no VPS deployment needed for this fix.
- No PocketBase schema changes → no migration needed.

---

## Risks & Tradeoffs

1. **Email readability** — The auto-generated email now has a random suffix (`user_60123456789_abc123@risev.app`). This is slightly less readable in the PocketBase admin UI, but these are placeholder emails for auto-created customers who haven't completed onboarding. Acceptable.

2. **Multiple accounts per phone** — With the UUID suffix, the same phone number could create multiple accounts if the lookup keeps failing. The fallback in Task 4 mitigates this by finding the existing user by phone. But if the phone formats differ significantly (e.g. `+60123456789` vs `012-345-6789` with dashes), the lookup might still fail. The `normalizePhoneNumber()` function handles dashes and spaces, so this should be rare.

3. **State cleanup** — We removed two `setBillSubtotal('')` calls. The `billSubtotal` is still reset in `proceedWithIssuingStamps()` (line 204) after a successful stamp issuance, which is correct. The state is also reset when the merchant cancels the modal (implicit via component unmount). No state leak risk.

4. **No automated tests** — This project has no test suite for the frontend. Verification is manual. The TypeScript compiler is the only automated check.

---

## Deployment

This is a frontend-only fix. Deploy via the normal Vercel auto-deploy (push to `main`):

```bash
cd "C:\Users\User\Documents\Work\WALY MOBILE\web-app"
git add app/\(merchant\)/give.tsx
git commit -m "fix(give): resolve duplicate-key bug and bill amount state loss for new customers"
git push origin main
```

Vercel will auto-deploy. No VPS changes needed.