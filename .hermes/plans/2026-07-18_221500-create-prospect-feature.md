# Create Prospect Feature + Agent WhatsApp Connection — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Allow sales agents to (1) connect their own WhatsApp account via QR pairing, and (2) create prospects by entering a phone number — which automatically sends the agent's referral link via WhatsApp.

**Architecture:**
- **Backend:** New PocketBase endpoints for agent WhatsApp connection (status/QR/disconnect) + prospect creation. Reuses existing Evolution API patterns from `blast_message.pb.js` but scoped to `sales_agent` role.
- **Frontend:** New "WhatsApp Connection" card on the Sales Dashboard + "Create Prospect" modal on the Inactive Prospects page.
- **Data Model:** New `prospects` collection to track leads before they become registered merchants.

**Tech Stack:** React, Ant Design, PocketBase JS VM, Evolution API (Baileys).

---

## Prerequisites

### New Collection: `prospects`
- `phone` (Text, Required, Unique)
- `agent` (Relation -> users, Required)
- `status` (Select: `lead`, `registered`, `converted` — Default: `lead`)
- `last_contacted` (DateTime)
- `notes` (Text, Optional)

### Evolution API Instance Naming
- Merchants use: `merchant-${merchantId}-${nameSlug}`
- Agents will use: `agent-${userId}`

---

## Task 1: Create `prospects` Collection (Migration)

**Objective:** Create the database schema to store prospects.

**Files:**
- Create: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_migrations\1782807020_create_prospects.js`

**Implementation:**
```javascript
migrate((db, app) => {
  let collection = new Collection({
    name: "prospects",
    type: "base",
    fields: [
      { name: "phone", type: "text", required: true, options: { max: 20 } },
      { name: "agent", type: "relation", required: true, options: { collectionId: "users", cascadeDelete: false, minSelect: 1, maxSelect: 1 } },
      { name: "status", type: "select", options: { maxSelect: 1, values: ["lead", "registered", "converted"] } },
      { name: "last_contacted", type: "date", options: { max: 0 } },
      { name: "notes", type: "text", options: { max: 500 } }
    ]
  });
  app.save(collection);
}, (db, app) => {
  // Rollback
  const col = app.findCollectionByNameOrId("prospects");
  if (col) app.delete(col);
});
```

**Verification:**
Run migration on VPS and verify collection appears in PocketBase Admin UI.

---

## Task 2: Agent WhatsApp Connection Endpoints (`agent_whatsapp.pb.js`)

**Objective:** Create WhatsApp connection endpoints for sales agents (mirrors merchant endpoints but scoped to `sales_agent` role).

**Files:**
- Create: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\agent_whatsapp.pb.js`

**Endpoints:**

### 2a. `GET /api/risev/agent/whatsapp/status?generateQr=true`
- Validates `role === "sales_agent"`
- Instance name: `agent-${authRecord.id}`
- Calls `callEvo("GET", "/instance/fetchInstances")` to check if instance exists
- If not exists + `generateQr=true`: creates instance with `WHATSAPP-BAILEYS`, returns QR
- If exists + state `open`: returns `{ status: "connected", phone: "+60..." }`
- If exists + state `close` + `generateQr=true`: calls `/instance/connect/{name}`, returns QR
- Self-healing: if create returns 403, delete + recreate (same as merchant logic)

### 2b. `POST /api/risev/agent/whatsapp/disconnect`
- Validates `role === "sales_agent"`
- Calls `callEvo("DELETE", "/instance/delete/agent-${authRecord.id}")`
- Returns `{ success: true }`

**Implementation:**
Copy the pattern from `blast_message.pb.js` lines 4-110, but:
- Change role check from `merchant` to `sales_agent`
- Change instance name from `merchant-${merchantId}-${nameSlug}` to `agent-${authRecord.id}`
- Remove merchant_id lookup (agents don't have merchant profiles)

**Verification:**
```bash
# Get QR code (with auth token)
curl -H "Authorization: Bearer <agent_token>" "https://api.risev.app/api/risev/agent/whatsapp/status?generateQr=true"
# Expected: { "status": "disconnected", "qrcode": "base64..." }

# Check status
curl -H "Authorization: Bearer <agent_token>" "https://api.risev.app/api/risev/agent/whatsapp/status"
# Expected: { "status": "connected", "phone": "+6012345678" }
```

---

## Task 3: Agent WhatsApp Connection UI

**Objective:** Add a WhatsApp connection card to the Sales Dashboard so agents can scan a QR code and connect.

**Files:**
- Create: `C:\Users\User\Documents\Work\WALY MOBILE\admin-portal\src\pages\sales-dashboard\components\WhatsAppConnectCard.tsx`
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\admin-portal\src\pages\sales-dashboard\index.tsx`

**Step 1: Create `WhatsAppConnectCard` component**
- Shows connection status: connected (green badge + phone number) or disconnected (red badge)
- If disconnected: "Connect WhatsApp" button → fetches QR from `/api/risev/agent/whatsapp/status?generateQr=true`
- Displays QR code in a modal or inline
- Polls status every 5 seconds after QR is shown
- "Disconnect" button when connected
- Uses PocketBase SDK `pb.send()` for API calls

**Step 2: Add to Sales Dashboard**
Place the card in Row 1 next to the Referral Link card. Change the grid from `lg:grid-cols-3` to accommodate the new card, or add it as a new row.

**Verification:**
1. Open Sales Dashboard as a sales agent
2. See "WhatsApp Disconnected" status
3. Click "Connect WhatsApp" → QR code appears
4. Scan with phone → status changes to "Connected" with phone number
5. Click "Disconnect" → status returns to "Disconnected"

---

## Task 4: Create Prospect Backend Endpoint (`create_prospect.pb.js`)

**Objective:** Create endpoint that registers the prospect and sends the WhatsApp message.

**Files:**
- Create: `C:\Users\User\Documents\Work\WALY MOBILE\web-app\pb_hooks\create_prospect.pb.js`

**Endpoint:** `POST /api/risev/agent/create-prospect`

**Logic:**
1. Validate `role === "sales_agent"`
2. Parse body: `{ phone: string }`
3. Normalize phone: ensure `+60` prefix
4. Check if prospect already exists for this agent (by phone) — if yes, update `last_contacted` instead of creating duplicate
5. If new: create record in `prospects` collection with `status: "lead"`, `agent: authRecord.id`
6. Check agent's WhatsApp instance is connected (`callEvo("GET", "/instance/fetchInstances")` → find `agent-${authRecord.id}` → state === "open")
7. If not connected: return `{ success: false, message: "WhatsApp not connected. Please connect first." }`
8. Build referral link from agent's `referral_code`: `https://waly-five.vercel.app/?ref=${referralCode}`
9. Send WhatsApp message via `sendTextMessage()` from `whatsapp_helper.js`
10. Update `last_contacted` to now
11. Return `{ success: true, prospect: { id, phone, status } }`

**Message template:**
```
Hey! I'm {agentName} from RISEV. Deploy Loyalty Stamps for your shop to boost your repeat customer rates. Register here: {referralLink}
```

**Verification:**
```bash
curl -X POST -H "Authorization: Bearer <agent_token>" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+6012345678"}' \
  "https://api.risev.app/api/risev/agent/create-prospect"
# Expected: { "success": true, "prospect": { "id": "...", "phone": "+6012345678", "status": "lead" } }
```

---

## Task 5: Create Prospect UI

**Objective:** Add "Create Prospect" button and modal to the Inactive Prospects page.

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\admin-portal\src\pages\sales-dashboard\prospects.tsx`

**Step 1: Add "Create Prospect" button**
Next to the "Prospect List" heading, add a button with `person_add` icon.

**Step 2: Create modal with:**
- Phone number input (with `+60` prefix hint)
- Preview of the message that will be sent
- Submit button with loading state
- Success: shows "Prospect created! WhatsApp message sent." + closes modal
- Error: shows error message (e.g. "WhatsApp not connected")
- If WhatsApp not connected: show a warning linking back to the dashboard to connect first

**Step 3: Refresh list after creation**
After successful creation, refetch the prospects list so the new prospect appears.

**Verification:**
1. Open "Inactive Prospects" page
2. Click "Create Prospect"
3. Enter a phone number
4. See message preview
5. Click "Send & Create"
6. Verify success message
7. Verify prospect appears in the list
8. Verify WhatsApp message received on the prospect's phone

---

## Task 6: Wire up prospects list to show `prospects` collection

**Objective:** The current "Inactive Prospects" page only shows registered merchants with status `pending`. It should also show prospects from the new `prospects` collection.

**Files:**
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\admin-portal\src\pages\sales-dashboard\useSalesData.ts`
- Modify: `C:\Users\User\Documents\Work\WALY MOBILE\admin-portal\src\pages\sales-dashboard\prospects.tsx`

**Step 1: Fetch prospects in `useSalesData`**
Add a `useList` call for the `prospects` collection filtered by `agent = identity.id`.

**Step 2: Merge prospects into `inactiveProspects`**
Map prospect records to the `ReferredMerchant` shape (with `status: "lead"`, `name: "Prospect {phone}"`, etc.) and merge them into the `inactiveProspects` array.

**Verification:**
1. Create a prospect via the new UI
2. It should appear in the "Inactive Prospects" list with a "Lead" badge
3. When the prospect registers as a merchant, they transition from `lead` → `registered` status

---

## Risks & Tradeoffs

1. **WhatsApp Ban Risk:** Agents sending too many prospect messages could get their WhatsApp account flagged. Mitigation: The 24h anti-spam cooldown logic from `blast_message.pb.js` should be applied here too (one message per prospect per 24h).
2. **Instance Naming Collision:** Agent instances use `agent-${userId}` which is unique. No collision risk.
3. **Evolution API Capacity:** Each connected agent creates a new Baileys instance. If there are many agents, this could consume server memory. Monitor and consider rate limiting.
4. **Phone Normalization:** Malaysian phone numbers can be `0123456789`, `+60123456789`, `60123456789`. Must normalize consistently before both DB storage and WhatsApp sending.

---

## Deployment

### Backend (VPS)
```bash
scp "pb_migrations/1782807020_create_prospects.js" "pb_hooks/agent_whatsapp.pb.js" "pb_hooks/create_prospect.pb.js" root@166.88.35.57:/opt/risev/pb_hooks/
```
Then run the migration via PocketBase admin or restart the server.

### Frontend (Vercel)
```bash
cd admin-portal
git add src/pages/sales-dashboard/
git commit -m "feat(sales): agent WhatsApp connection + create prospect"
git push origin main
```