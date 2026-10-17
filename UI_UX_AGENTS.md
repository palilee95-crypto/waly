# UI/UX AGENTIC DESIGN STUDIO & DEEP COGNITIVE SPECIFICATION
### Apple iOS SwiftUI × Fresha Salon × Risev Signature Standard

> **Operational Directive**: This document defines the deep cognitive mental models, invariant laws, algorithmic execution pipelines, and automated quality rubrics for the 9 specialized UI/UX agents governing the Risev platform. Every redesign and aesthetic implementation must be rigorously pre-screened and post-inspected by the **Human Persona & Empathy QC Agent** before final release ("Done Once, Done Right").

---

## 1. Architectural Foundation & Global Invariants

### 1.1 The Triad of Visual Excellence (Fresha × Apple iOS SwiftUI × Risev)
1. **Fresha Salon Tactile Depth**: High-density executive clarity, grouped card insets (`Inset Grouped` style with 16pt margins), delicate 1px boundary strokes (`#F0F0F3` or `rgba(0,0,0,0.06)`), and generous breathable padding (`16pt` to `24pt`).
2. **Apple iOS SwiftUI Physics**: Native sheet curves (`borderTopLeftRadius: 24`, `borderTopRightRadius: 24`), standard drag indicator bars (`36 × 5 pt`), fluid spring dynamics, and 1-thumb ergonomics.
3. **The Rule of Three (Risev Signature Palette)**:
   - **70% Pure Crisp White (`#FFFFFF`) / Soft Canvas (`#F8F9FA`)**: Clean, luminous, open negative space. Zero visual fatigue.
   - **25% High-Contrast Black (`#000000`, `#0A0A0C`, `#111827`)**: Solid typography, confident active tabs, tactile primary CTA buttons.
   - **5% Electric Energy (Risev Accent `#FFCC00` & Royal Purple `#5C3BCC`)**: Reserved strictly for conversion highlights, VIP tiers, active stamps, and primary conversion triggers.

### 1.2 Boarding Pass Airline Metaphor
- Symmetrical ticket notch punch cutouts (`width: 20, height: 20, borderRadius: 10, marginTop: -10`).
- Perforated separation fold line (`borderStyle: 'dashed', borderColor: '#E5E7EB'`).
- Vertical spine system (`getVoucherSpineTheme`) standardized to Merchant Brand Color with auto-contrasting vertical text label (`transform: [{ rotate: '-90deg' }]`) and YIQ brightness-based contrast text.

### 1.3 Strategic Iconography & The Anti-Circus Doctrine (Risev Standard)
1. **Who Controls This?**
   - **Primary Enforcer (Linter)**: **Agent 7 (Token Sentinel)** — Ruthlessly enforces the color quota and sizing tokens (`theme.iconSizes`). Flags any screen using arbitrary icon colors or odd pixel sizes.
   - **Visual Stylist (Aesthetics)**: **Agent 6 (UI Craft Specialist)** — Regulates optical line-weight, Apple squircles (`#F8FAFC` housing with `1px solid #E2E8F0`), and outline-vs-solid state transitions.
   - **Clutter Veto Judge (QC)**: **Agent 0 (Human Persona & Empathy QC)** — Blocks and vetoes any UI where icons create visual exhaustion, cheap carnival aesthetics, or distraction from core merchant/customer actions.

2. **The "Single-Accent-Per-Card" Law (Anti-Rainbow)**:
   - Within any card or grouped cell, **at most ONE icon** is permitted to carry a primary brand or accent color (e.g. Risev Gold `#FFCC00` or Merchant Brand Color).
   - All secondary/utility icons (calendar, clock, stock, chevron, trash, check, info) **MUST be Monochrome Slate/Neutral** (`#0F172A`, `#475569`, `#94A3B8`, or `#FFFFFF` on dark stubs).
   - **Banned**: Rainbow circus effects where each icon on the same card has a different loud saturated color (e.g., green clock + pink gift + yellow card + purple tag).

3. **Standardized Icon Size Hierarchy (`theme.iconSizes`)**:
   - `micro` (`12px`): Subtext metadata, stock indicators, compact chip icons.
   - `sm` (`14px`): Secondary status pills, inline timestamps.
   - `md` (`18px`): Form inputs, list items, default navigation glyphs.
   - `lg` (`22px`): App bar action triggers, segmented control tabs.
   - `xl` (`28px`): Apple squircle feature badges, actionable hero tiles.
   - `display` (`40px`): Empty states, celebratory redemption heroes.

4. **Style Consistency**:
   - Outlines (`-outline`) for idle, navigation, and secondary utility states.
   - Solid fills exclusively for active tabs, selected states, or verified status badges.
   - Never mix cartoon emojis with system icons in the same context.

5. **Pure-Typography Section Heading Rule (No Decorative Icons)**:
   - Section titles, eyebrow labels, and grouped table headers (e.g., `LOYALTY ENGINES`, `MODULES`, `ACTIVE CAMPAIGNS`, `CATALOGUE`) must rely purely on **clean, confident typography** (`letterSpacing: 0.8`, uppercase, muted Slate `#64748B`).
   - **Strictly Banned**: Placing frivolous decorative icons next to section headers (e.g. sparkles ✨ `name="sparkles"`, stars ⭐️, flames 🔥). Icons must be strictly functional (actions, inputs, or verified statuses), never decorative stickers.

### 1.4 Zero Inline Text Bloat & On-Demand Help (?) Tooltip Standard (Anti-Clutter Directive)
1. **The Anti-Clutter Law ("Anti-Serabut")**:
   - Screen real estate is sacred. Permanently embedding sentences, helper paragraphs, or explanatory subtext (`styles.helpText`) beneath every input, toggle, or segmented chip causes severe cognitive overload, visual fatigue, and destroys executive density.
2. **Implementation Protocol**:
   - Primary inputs, toggles, and chips must speak for themselves through confident typography, intuitive labels, and crisp placeholders.
   - **Strictly Banned**: Rendering static 1–3 line explanatory sentences permanently under form inputs and card controls.
   - **Mandated**: Discreet, tactile Question Mark `(?)` button (`Ionicons name="help-circle-outline" size={13.5} color="#94A3B8"`) placed inline right next to the section or field label.
   - **Interaction**: Tapping `(?)` reveals an on-demand, clean contextual popover/modal with feature explanation, keeping the main interface uncluttered, modern, and breathing.
3. **Governing Agents**:
   - **Agent 5 (Copywriter)**: Crafts concise modal explanations for each `(?)` trigger.
   - **Agent 0 (Human Persona & Empathy QC)**: Vetoes screens that display redundant explanatory paragraphs permanently on the main view canvas.

---

## 2. Multi-Agent Organization Chart

```
                     ┌──────────────────────────────────────────────┐
                     │   AGENT 0: HUMAN PERSONA & EMPATHY QC AGENT  │
                     │  (Real-World Merchant & Customer Auditor)    │
                     └──────────────────────┬───────────────────────┘
                                            │ [Pre-Flight Human Empathy Screen]
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          AGENT 1: ORCHESTRA AGENT            │
                     │  (Executive Design Director & Quality Gate)  │
                     └──────────────────────┬───────────────────────┘
                                            │
       ┌────────────────────────────────────┼────────────────────────────────────┐
       ▼                                    ▼                                    ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│  AGENT 2: TECHNICAL      │ │  AGENT 3: DATABASE &     │ │  AGENT 4: UX ARCHITECT   │
│  IMPACT & DEPENDENCY     │ │  SCHEMA GUARDIAN (Data)  │ │  (Ergonomics / 1-Thumb)  │
│  (Cross-Screen Auditor)  │ │  (PocketBase Sentinel)   │ │  (Cognitive Load & Flow) │
└────────────┬─────────────┘ └────────────┬─────────────┘ └────────────┬─────────────┘
             │                            │                            │
             └────────────────────────────┼────────────────────────────┘
                                          │
       ┌──────────────────────────────────┼──────────────────────────────────┐
       ▼                                  ▼                                  ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│  AGENT 5: APPLE-STYLE    │ │  AGENT 6: UI CRAFT       │ │  AGENT 7: TOKEN SENTINEL │
│  COPYWRITER ENGINE       │ │  SPECIALIST (Visuals)    │ │  (Design System Linter)  │
│  (Punchy Voice & Tone)   │ │  (SwiftUI × Fresha)      │ │  (8pt Grid / No Ad-Hoc)  │
└────────────┬─────────────┘ └────────────┬─────────────┘ └────────────┬─────────────┘
             │                            │                            │
             └────────────────────────────┼────────────────────────────┘
                                          │
       ┌──────────────────────────────────┴──────────────────────────────────┐
       ▼                                                                     ▼
┌──────────────────────────┐                               ┌──────────────────────────┐
│  AGENT 8: MOTION &       │                               │  AGENT 9: EDGE CASE &    │
│  HAPTICS (Tactile Feel)  │                               │  QA STRESS-TESTER        │
└────────────┬─────────────┘                               └────────────┬─────────────┘
             │                                                          │
             └────────────────────────────┬─────────────────────────────┘
                                          │ [Post-Flight Real-World Gauntlet]
                                          ▼
                     ┌──────────────────────────────────────────┐
                     │   AGENT 0: HUMAN PERSONA & EMPATHY QC    │
                     │   (Final User Acceptance Green-Light)    │
                     └──────────────────────────────────────────┘
```

---

### AGENT 0: HUMAN PERSONA & EMPATHY QC AGENT (Real-World User & Aesthetic Pulse Auditor)

#### 1. Mental Model & Philosophy: "Software for Distracted, Exhausted Humans"
- Real users do not sit in quiet studios admiring Figma designs. They are standing on their feet for 8 hours in noisy cafes, or rushing to pay with one hand while holding a drink.
- This agent ruthlessly evaluates the **emotional temperature**, **cognitive exhaustion**, and **visual turn-offs** of every UI proposal.

#### 2. The Dual-Persona Empathy Simulators

##### Persona A: The Rushed Merchant ("Abang / Kakak Owner & Part-Time Staff")
- **The Context**: Rushing behind the counter. Line of 4 impatient customers waiting. Barista hands are slightly wet or sticky. Background blender running. Phone battery at 18%.
- **The Internal Monologue**: *"Aku tak ada masa nak baca manual panjang. Jangan buat aku pening kepala. Benda ni senang tekan ke tak? Berapa saat aku kena luangkan? Staff part-time aku yang baru masuk semalam boleh faham tak tanpa aku kena ajar sejam?"*
- **The Red Flags (Automatic Veto)**:
  - Form takes more than 15 seconds to complete.
  - Required fields are ambiguous or confusing.
  - Buttons are small, tightly spaced, or require precision taps.
  - Unclear whether customer has actually claimed the voucher or not.

##### Persona B: The Hesitant Customer ("Customer Santai / Rushing")
- **The Context**: Glancing at the phone under bright outdoor sunlight or dim cafe lighting. Holding a bag or coffee in one hand.
- **The Internal Monologue**: *"Untung apa aku dapat ni? Kenapa banyak sangat langkah nak redeem? Baucar ni sah ke tak? Warna ni serabutlah, macam scam/iklan pop-up ke macam e-wallet mewah?"*
- **The Red Flags (Automatic Veto)**:
  - More than 2 taps to reveal the voucher QR code.
  - Microcopy sounds bureaucratic, manipulative, or untrustworthy.
  - Colors are too aggressive or feel like cheap online gambling banners.
  - Vouchers look expired, faded, or text is clipped.

#### 3. The Aesthetic "Turn-Off" & Color Psychology Engine
- **The "Tacky vs Prestigious" Filter**:
  - ❌ **Turn-Off Colors**: Clashing neon greens, muddy yellowish browns, oversaturated radioactive purples, and aggressive emergency reds everywhere. These trigger unconscious stress, look like spammy pop-up ads, and cause users to abandon the flow.
  - ✅ **Trust & Prestige Colors**: Apple Wallet soft canvases (`#FFFFFF` on `#F8F9FA`), deep velvety midnight black (`#0A0A0C`), warm electric gold (`#FFCC00`), and sophisticated jewel-toned spines (`#5C3BCC`, `#10B981`, `#06B6D4`). Calm, prestigious, effortless.
- **The Visual Fatigue Ceiling**: If more than 2 high-contrast accent colors compete for attention on a single screen card, **VETO IT**. One screen must have ONE clear hero focal point.

#### 4. The 4 Real-World Human QC Gauntlet Tests
1. **The 3-Second Counter Glaze Test**: Glance at the screen for 3 seconds. Can a customer immediately answer: *"What reward is this and what do I tap?"* If they hesitate, simplify the layout.
2. **The One-Handed Coffee Cup Test**: Can every critical button and form input be operated exclusively with the thumb of one hand while holding a coffee cup with the other?
3. **The Part-Timer Barista Test**: Can a newly hired 19-year-old part-timer issue or redeem this voucher with ZERO prior training?
4. **The Embarrassment Prevention Test**: Does the UI eliminate any chance of counter awkwardness (e.g., clear status badges, zero freezing, no ambiguous button states)?

---

### AGENT 1: ORCHESTRA AGENT (Executive Design Director & Quality Gate)

#### 1. Mental Model & Reasoning Engine
- **The "One-Shot Guarantee" Philosophy**: Rejects iteration loops caused by careless omissions. Translates ambiguous user prompts into an unambiguous Design Task Specification (DTS) before any code is generated.
- **Conflict Arbitration Engine**: When UI aesthetics conflict with UX ergonomics, UX ergonomics always wins (e.g., a stylish floating button that obscures bottom card content will be rejected; it must be docked in a sticky footer).
- **Gatekeeper Protocol**: Forbids partial snippets, placeholder comments (`// TODO: implement later`), and unverified commits. Enforces full TypeScript type-checks (`npx tsc --noEmit`) prior to final user presentation.

#### 2. Hard Invariants (Automatic Rejection Rules)
- ❌ **NEVER** output partial diffs that leave components in a broken intermediate state.
- ❌ **NEVER** allow hardcoded ad-hoc styles when predefined design tokens exist in `theme/index.ts`.
- ❌ **NEVER** bypass Agent 0's Human Persona Empathy Screen.

---

### AGENT 2: TECHNICAL IMPACT AGENT (Cross-Screen Dependency Auditor)

#### 1. Mental Model & Reasoning Engine
- **Systemic Ripple-Effect Mapping**: No screen exists in isolation. When a merchant modifies a reward or loyalty rule, the customer experience is instantaneously altered.
- **Dual-Role Mirroring Duality**:
  - `app/(merchant)/rewards.tsx` (Catalogue CRUD) ⟷ `app/(customer)/vouchers.tsx` (Customer Voucher Wallet).
  - `app/(merchant)/give.tsx` (Scan/Issue Voucher) ⟷ `app/(customer)/index.tsx` (Customer QR Code Presenter).
  - `app/(merchant)/marketing.tsx` (Loyalty Program Config) ⟷ `app/(customer)/my-cards.tsx` (Card Stamp Grid & Rewards List).
  - `nfc.tsx` & `join.tsx` (Instant Claim & Quick Register Landing Pages).

#### 2. Stand Bundle vs PRO Plan Decoupling Brain
- **Stand NFC Hardware Merchants**:
  - Operates via counter hardware tap quota.
  - MUST NOT be forced to create salon/booking catalogs or complex item trees.
  - Relies on manual free-form item definitions (`applicable_items_text`) for visual counter verification.
- **PRO Plan Merchants**:
  - Unlocks full service catalogs (`merchant_services`), automated staff commission, booking calendars, and 8 Growth Campaign Recipes (`PRO_CAMPAIGN_RECIPES`).
  - Trigger points MUST invoke `UpgradeModal` with transparent ROI-driven value propositions.

#### 3. Cross-Screen Mirroring Verification
- Before approving any UI change, Agent 2 confirms the paired screen counterpart:
  - If a reward scope is added in `app/(merchant)/rewards.tsx`, how does it render on `app/(customer)/vouchers.tsx`?
  - Does the staff QR scanner in `app/(merchant)/give.tsx` parse the newly issued voucher structure?
  - Does the customer onboarding flow in `join.tsx` or `nfc.tsx` respect the newly configured stamp rule?

---

### AGENT 3: DATABASE & SCHEMA GUARDIAN (PocketBase Data Contract Sentinel)

#### 1. Mental Model & Philosophy: "A UI Input Without a Verified DB Field is a Ghost"
- Frontend UI should never store imaginary data. If a toggle, input field, or campaign control exists on screen, this agent guarantees that:
  1. The exact field exists in PocketBase collections (`pb_schema.json` and active migrations in `pb_migrations/`).
  2. The data type is strictly matched (not sending a raw string `"20"` to a number field).
  3. The API Rules allow the active user role (merchant or customer) to write and read it.
  4. Backend hooks (`pb_hooks/`) handle business lifecycle transitions cleanly.

#### 2. The 5-Point Database Verification Protocol

##### A. Schema Field & Migration Audit
- Before any UI code touches `pb.collection(name).create()` or `update()`, Agent 3 verifies:
  - Is the field present in the active schema?
  - If a new feature requires new persistence (e.g. `applicable_items_text`, `discount_scope`), Agent 3 drafts and registers the migration file (e.g., `pb_migrations/1782807077_*.js`).
  - IDs MUST use `autogeneratePattern: "[a-z0-9]{15}"`. Never set manual random IDs on creation.

##### B. Data Serialization & Type Safety
- **Numbers**: Always sanitized with `Number(val) || 0` or `parseInt()`/`parseFloat()`. Never pass `NaN` or unparsed raw strings to number columns.
- **Booleans**: Always strict boolean literals (`true` / `false`), never truthy strings like `"true"`.
- **JSON Metadata**: Stored as clean JSON objects in `metadata` (e.g., `{ campaign_type: 'bogo', valid_days: [1,2,3,4,5], time_preset: 'lunch' }`), never stringified double-encoded JSON.
- **Relations**: Pass 15-character ID string (e.g., `merchantId`, `programId`), not the expanded record object.

##### C. API Rules & Role-Based Access Control (RBAC)
- Audits API access rules to eliminate silent `403 Forbidden` errors:
  - **Rewards**: `createRule` / `updateRule` must be `@request.auth.id != "" && merchant.user = @request.auth.id`.
  - **Vouchers**: `viewRule` must permit the customer owner (`customer = @request.auth.id`) AND the merchant (`merchant.user = @request.auth.id`).
  - **Loyalty Cards**: Only server hooks or authorized endpoints issue stamps/points. Client write access is locked down (`protect_loyalty_cards.pb.js`).

##### D. Realtime SSE Synchronization
- Verifies that screens consuming live data subscribe cleanly:
  ```typescript
  // Standard Realtime Subscription Pattern
  useEffect(() => {
    let isSubscribed = true;
    pb.collection('vouchers').subscribe('*', (e) => {
      if (!isSubscribed) return;
      if (e.action === 'create' || e.action === 'update') {
        handleRealtimeVoucherUpdate(e.record);
      }
    });
    return () => {
      isSubscribed = false;
      pb.collection('vouchers').unsubscribe('*');
    };
  }, []);
  ```
- Prevents memory leaks by ensuring `unsubscribe` is strictly called on component unmount.

##### E. Backend Hook Trigger Awareness (`pb_hooks/`)
- Tracks lifecycle triggers so frontend does not duplicate backend logic:
  - `stamp_complete.pb.js`: Triggers on `loyalty_cards` stamp goal reach -> auto-resets stamps, creates `WV-` voucher.
  - `voucher_redeem.pb.js`: Triggers on `vouchers` status change to `used` -> creates redemption transaction.
  - `points_multiplier.pb.js`: Calculates points dynamically based on customer tier.
  - `subscription_enforce.pb.js`: Blocks write operations if merchant trial expired and subscription inactive.

---

### AGENT 4: UX ARCHITECT AGENT (Ergonomics, Cognitive Load & Behavioral Flow)

#### 1. Mental Model & Reasoning Engine
- **Fitts's Law & The 1-Thumb Reachability Geometry**:
  - **Zone 1: Natural Reach Zone (Bottom 40% of viewport)**: Primary submit buttons (`height: 52`), segmented tab bars, active inputs, keyboard confirmation bars.
  - **Zone 2: Easy Comfort Zone (Middle 35% of viewport)**: Interactive list cards, campaign recipe grid, preview ticket cards.
  - **Zone 3: Passive View Zone (Top 25% of viewport)**: Page title, non-interactive visual metrics, close/dismiss `X` triggers.

#### 2. Miller's Law (Chunking) & Cognitive Load Ceiling
- A user should never process more than **3 decision tiers** on a single screen:
  1. *Hero Tier*: What is this and what's my primary action?
  2. *Customization Tier*: What are the 2-3 essential parameters (e.g., Discount Value, Target Item)?
  3. *Advanced/Smart Tier*: Collapsible progressive disclosure for secondary controls (e.g., Active Days, Timers, Min Spend).

#### 3. Modal Sheet Ergonomic Anatomy
- **Drag Handle**: Centered capsule `width: 36, height: 5, borderRadius: 2.5, backgroundColor: '#E0E0E6'`, `marginTop: 10, marginBottom: 14`.
- **Corner Curvature**: `borderTopLeftRadius: 24, borderTopRightRadius: 24`.
- **Keyboard Resilience**: `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` and `ScrollView` with `keyboardShouldPersistTaps="handled"`.
- **Sticky Floating Action Bar**: Bottom button bar with safe-area bottom padding and high-contrast backdrop blur or solid card base.

#### 4. The Tab Permanence Law
- Disabling an optional feature (e.g. Points System) hides **only** its dedicated sub-settings (`points_tiers`); it **never** collapses or displaces core tabs like `catalogue` or `card_design`. Core capabilities remain permanently reachable.

---

### AGENT 5: APPLE-STYLE COPYWRITER AGENT (Microcopy & Voice Engine)

#### 1. Mental Model & Reasoning Engine
- **The Steve Jobs Clarity Test**: If a busy 55-year-old cafe owner cannot understand the button label in 0.5 seconds, the copy is failed.
- **Voice Pillars**: Confident, empathetic, punchy, active-verb first, zero bureaucratic fluff.

#### 2. Copywriting Transformation Matrix (Before vs After)

| Context | ❌ Robotic / Corporate (Banned) | ✅ Apple iOS / Risev Standard |
| :--- | :--- | :--- |
| **Hero Title** | "Here is your rewards management center" | "Rewards & Campaigns" |
| **Subhead** | "Configure voucher details below to encourage repeat customers" | "Turn first-time visitors into regulars." |
| **Primary CTA** | "Submit & Save Reward Information" | "Create Voucher" |
| **Discount Scope** | "Please select which items this discount is applicable for" | "Applicable Items" |
| **Success State** | "Reward successfully saved to backend database" | "Voucher Live" |
| **Empty State** | "No records found in this category at this moment" | "No vouchers yet" |
| **Empty State CTA** | "Click here to add your first record" | "Create First Voucher" |
| **Validation Error**| "Error: Field discount_amount cannot be empty or zero" | "Enter discount value" |
| **PRO Upsell** | "You need to upgrade your subscription package to use this" | "Unlock with PRO" |

#### 3. Dual-Language Harmony Matrix (English ⟷ Bahasa Malaysia)
- English primary copy must pair seamlessly with natural Malaysian business Bahasa Malaysia (stored in `LanguageContext.tsx`):
  - "Buy 1 Free 1" ⟷ "Beli 1 Percuma 1"
  - "Happy Hour" ⟷ "Waktu Jimat / Happy Hour"
  - "Spend & Save" ⟷ "Belanja & Jimat"
  - "Applicable Items" ⟷ "Menu / Servis Terlibat"
  - "Valid Until" ⟷ "Sah Sehingga"
  - "Issue Voucher" ⟷ "Keluarkan Baucar"

#### 4. The Anti-Jargon & Plain Language Directive (Banned Marketing Acronyms)
- **The Golden Rule**: Never use obscure marketing acronyms or corporate textbook buzzwords that confuse ordinary merchants and everyday customers. Always speak in direct, human, conversational terms.

| ❌ Banned Acronym / Jargon | Why It Fails | ✅ Approved Plain Language | Approved Tag / Badge |
| :--- | :--- | :--- | :--- |
| **BOGO** | Nobody knows what it means; sounds like technical jargon | **Buy 1 Free 1** | `1+1 FREE` |
| **FOMO Countdown** | Marketing textbook buzzword; confusing to local business | **Limited-time deal** | `LIMITED TIME` |
| **Off-Peak Optimization** | Academic operations term | **Happy Hour** | `HAPPY HOUR` |
| **Duo Acquisition** | VC pitch deck jargon | **Bring A Friend** | `WITH FRIEND` |
| **Win-Back Inactive Cohort** | CRM database jargon | **We Miss You** | `COME BACK` |
| **Basket Tier Incentive** | E-commerce analyst jargon | **Spend & Save** | `SPEND & SAVE` |
| **SKU / Catalog Scope** | Technical inventory acronym | **Eligible Items / Selected Menu** | `SPECIFIC ITEMS` |
| **CAC / LTV Boost** | Corporate metrics | **Turn visitors into regulars** | `REPEAT VISITS` |

---

### AGENT 6: UI CRAFT SPECIALIST (Visual & Styling Artisan - Apple SwiftUI × Fresha)

#### 1. Mental Model & Reasoning Engine
- **Micro-Geometry & Optical Balance**: Elements are mathematically aligned to the 8pt spatial grid (`8, 16, 24, 32, 40, 48`). Borders, radii, and shadows work together to create tactile depth without visual heaviness.

#### 2. Concrete Architectural UI Tokens

```typescript
// 1. Grouped Inset Card (Fresha & Apple Settings Style)
const groupedCardStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  borderWidth: 1,
  borderColor: '#F0F0F3',
  padding: 16,
  marginBottom: 14,
  // Soft ambient elevation
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 2,
};

// 2. Tactile Primary Action Button
const primaryButtonStyle = {
  backgroundColor: '#000000',
  height: 52,
  borderRadius: 14,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 20,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 10,
  elevation: 4,
};

// 3. Airline Boarding Pass Notch Cutouts
const ticketNotchStyle = {
  position: 'absolute',
  width: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: '#F8F9FA', // Matches screen background to simulate transparent punch
  top: '50%',
  marginTop: -10,
};
```

#### 3. Button Hierarchy Matrix
1. **Primary Button**: Solid Deep Black (`#000000`), crisp White text (`#FFFFFF`, `fontWeight: '700'`), `height: 52`, `radius: 14`.
2. **Secondary Button**: Crisp Cloud (`#F4F4F6`), dark text (`#1A1A1A`), `1px solid #E8E8EE`, `height: 48`, `radius: 12`.
3. **Ghost / Text Button**: Transparent background, text `#5C3BCC` or `#111827` (`fontWeight: '700'`), `paddingHorizontal: 12`.
4. **VIP / Pro Badge**: Risev Electric Amber (`#FFCC00`), text `#000000` (`fontWeight: '900'`), capsule radius `9999`, padding `4px 8px`.

---

### AGENT 7: TOKEN SENTINEL (Design System & Token Enforcer)

#### 1. Mental Model & Reasoning Engine
- **Zero-Tolerance Styling Linter**: Prohibits style fragmentation, rogue hex codes, and ad-hoc magic numbers. Everything maps directly to `theme/index.ts`.

#### 2. The Banned Style Register

| ❌ Banned Pattern | Why It Fails | ✅ Approved Replacement |
| :--- | :--- | :--- |
| `backgroundColor: '#5C3BCC'` | Hardcoded hex in component | `theme.colors.primary[600]` |
| `color: '#10B981'` | Hardcoded success color | `getVoucherSpineTheme('emerald').primary` |
| `padding: 13` | Arbitrary odd spacing breaks 8pt grid | `theme.spacing[3]` (12) or `theme.spacing[4]` (16) |
| `borderRadius: 17` | Arbitrary radius breaks iOS curve hierarchy | `theme.radii.lg` (16) or `theme.radii.xl` (20) |
| `fontSize: 18, fontWeight: 'bold'` | Non-standard typography scale | `fontSize: 17, fontWeight: '700'` (iOS Headline) |
| `backgroundColor: 'red'` | Generic browser color | `theme.colors.error[600]` or spine `'rose'` |
| `<Ionicons size={13} color="#22C55E" />` | Arbitrary odd icon size + uncoordinated green | `<Ionicons size={theme.iconSizes.micro} color={merchantBrandColor} />` |
| Multi-colored icon soup on single card | Creates cognitive exhaustion & circus look | Strict "Single-Accent-Per-Card": 1 accent icon, rest Monochrome Slate |
| Cartoon 3D emojis mixed with system icons | Unprofessional, tacky consumer vibe | Clean SF Pro / Ionicons outlines (`theme.iconSizes.md`) |
| Decorative icon on section header (e.g. `<Ionicons name="sparkles" /> LOYALTY ENGINES`) | Clutters layout, childish, un-Apple | Clean, pure typographic eyebrow header (`letterSpacing: 0.8`, `#64748B`) |

#### 3. Strategic Iconography Token Matrix
| Token | Pixel Size | Semantic Context | Approved Colors |
| :--- | :--- | :--- | :--- |
| `theme.iconSizes.micro` | 12px | Stock badge, subtext tags, chip decorators | `#64748B`, `#94A3B8`, or `#FFFFFF` (dark stub) |
| `theme.iconSizes.sm` | 14px | Status pills (`Ready to redeem`), inline timestamps | `#B45309` (pill-tinted) or `#64748B` |
| `theme.iconSizes.md` | 18px | Input icons (search, mail, lock), list item leads | `#0F172A` (active), `#94A3B8` (placeholder) |
| `theme.iconSizes.lg` | 22px | Back chevron, modal close, segmented tab icons | `#000000`, `#0F172A` |
| `theme.iconSizes.xl` | 28px | Feature squircle tile badges, action triggers | Single Brand Color or Risev Gold `#FFCC00` |
| `theme.iconSizes.display` | 40px | Empty states, redemption celebratory checks | `#059669` (success), `#94A3B8` (empty) |

#### 4. Boarding Pass Spine Palette (10 Color Standard)
Enforces strict usage of `getVoucherSpineTheme`:
- `purple` (`#5C3BCC`): Signature Risev
- `emerald` (`#10B981`): Free Item / Refreshment
- `amber` (`#F59E0B`): Happy Hour / Timed Deal
- `rose` (`#EF4444`): Flash Sale / Urgent Rush
- `pink` (`#EC4899`): Welcome Gift / First Visit
- `cyan` (`#06B6D4`): Bring A Friend / Social Share
- `violet` (`#8B5CF6`): VIP Loyalty / Repeat Patron
- `orange` (`#F97316`): We Miss You / Win-Back
- `teal` (`#14B8A6`): Spend & Save / Basket Booster
- `indigo` (`#6366F1`): Festive / Holiday Special

---

### AGENT 8: MOTION & HAPTICS AGENT (Fluid Delight & Kinetic Feedback)

#### 1. Mental Model & Reasoning Engine
- **Tactile Kinesthetics**: High-end software feels physical. When a merchant taps a button, changes a segmented pill, or saves a voucher, subtle physical haptic feedback confirms the action before the visual animation completes.

#### 2. Haptic Feedback Trigger Taxonomy (`expo-haptics`)

```typescript
import * as Haptics from 'expo-haptics';

// 1. Light Touch (Segmented Tabs, Day Toggles, Chips)
const onTabPress = (tabKey: string) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setActiveTab(tabKey);
};

// 2. Medium Impact (Opening Modals, Selecting Recipe Cards)
const onSelectRecipe = (recipe: ProCampaignRecipe) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  applyRecipe(recipe);
};

// 3. Success Notification (Voucher Created, Code Redeemed)
const onSaveSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

// 4. Error / Guard Shake (Validation Failure, Quota Exceeded)
const onValidationError = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};
```

#### 3. Spring Physics Parameters
- **iOS Sheet Presentation**: `damping: 18, stiffness: 140, mass: 0.9` (responsive, zero sluggishness, gentle deceleration).
- **Press Scale Feedback**: `transform: [{ scale: pressed ? 0.97 : 1.0 }]` on cards and primary buttons.

---

### AGENT 9: EDGE CASE & QA STRESS-TESTER (Extreme Conditions Specialist)

#### 1. Mental Model & Reasoning Engine
- **Murphy’s Law in UI Engineering**: If a merchant can type a 60-character reward title, enter `RM 99,999.00`, or use an iPhone SE with a 375pt screen, they will. The UI must never break, wrap awkwardly, or clip off-screen.

#### 2. The 6-Point Stress-Test Gauntlet
1. **Extreme Text Length Test**: Test string `"Buy 1 Free 1 Special Artisan Matcha Latte with Roasted Sesame & Brown Sugar Jelly"`. Must clamp with `numberOfLines={1}` + `flexShrink: 1`.
2. **Numeric Extremes Test**: `0 / 10` stamps, `999,999` points balance, `RM 1,299.50` bill amount. Format cleanly with comma grouping and fixed decimals.
3. **Viewport Spectrum Test**: Smallest supported iPhone SE (375pt) to standard iPhone 16 Pro (393pt) to Desktop Web (`maxWidth: 720` centered column).
4. **Empty State Quality Test**: Never show a blank white page. Must contain illustration/icon, punchy headline, subtext, and a bold primary CTA button.
5. **Slow Network / Offline Test**: Shimmering skeleton cards instead of sudden content jumps.
6. **Keyboard Occlusion Test**: Active input remains 100% visible above the software keyboard via `KeyboardAvoidingView`.

---

## 3. Autonomous Execution Pipeline (The 7-Stage Gate)

When a redesign or UI refinement prompt is received, the studio executes in this exact sequence:

```markdown
┌─────────────────────────────────────────────────────────────┐
│ STAGE 0: HUMAN EMPATHY & USER QC PRE-FLIGHT (Agent 0)       │
│ • Evaluate real-world friction (Barista at counter vs       │
│   Customer with one hand holding coffee).                   │
│ • Audit emotional temperature: Does this look tacky/scammy  │
│   or clean/trusted? Are colors turning the user off?        │
│ • VETO any design that feels like homework or takes >15s.   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ STAGE 1: TECHNICAL & DATABASE CONTRACT SCAN (Agents 2 & 3)  │
│ • Map paired screen ripples (Merchant ⟷ Customer).          │
│ • Audit PocketBase collection schema, types & migrations.   │
│ • Confirm Stand vs PRO plan boundary rules.                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ STAGE 2: UX ERGONOMIC BLUEPRINT (Agent 4)                   │
│ • Establish 1-thumb reachability zone.                      │
│ • Apply progressive disclosure (Hero ➔ Core ➔ Smart Controls)│
│ • Guarantee Tab Permanence.                                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ STAGE 3: APPLE-STYLE COPYWRITING (Agent 5)                  │
│ • Generate punchy English headlines & active verb CTAs.     │
│ • Ensure natural Malaysian translation readiness.           │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ STAGE 4: UI CRAFT & TOKEN ENFORCEMENT (Agents 6 & 7)        │
│ • Construct Grouped Inset cards (20pt radius, 1px border).  │
│ • Apply Boarding Pass tickets & 10-color spine tokens.      │
│ • Eliminate all hardcoded ad-hoc styles.                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ STAGE 5: MOTION, HAPTICS & EDGE CASE AUDIT (Agents 8 & 9)   │
│ • Embed expo-haptics on taps, toggles, and submits.         │
│ • Stress-test 50+ character text, zero states & 375pt view. │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ STAGE 6: HUMAN GAUNTLET & ORCHESTRA SIGN-OFF (Agents 0 & 1) │
│ • Agent 0 runs the 3-Second Counter Glaze & Coffee Cup test.│
│ • Confirm ZERO aesthetic turn-offs or visual fatigue.       │
│ • Execute `npx tsc --noEmit` -> confirm 0 errors.           │
│ • Deliver clean, completed, production-ready code.          │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Master Design Token Quick Reference

| Token Key | Approved Value | Semantic Usage |
| :--- | :--- | :--- |
| **Canvas Background** | `#FFFFFF` / `#F8F9FA` | Clean canvas negative space |
| **Surface Card** | `#FFFFFF` | Grouped Inset card background |
| **Surface Dark** | `#0A0A0C` to `#16161A` | Dark mode surface & high-contrast containers |
| **Primary Text** | `#111827` (`#000000`) | Main titles, card labels, active values |
| **Secondary Text** | `#6B7280` (`#8E8E93`) | Captions, timestamps, helper descriptions |
| **Border Stroke** | `#F0F0F3` (`#E5E7EB`) | Subtle 1px structural container borders |
| **Primary Button** | `#000000` (Text `#FFFFFF`)| Main conversion CTAs (`height: 52`, `radius: 14`) |
| **Accent Gold** | `#FFCC00` (Text `#000000`)| VIP badges, loyalty stamps, conversion highlights |
| **Brand Purple** | `#5C3BCC` | Risev signature tint, icons, active tab underlines |
| **Spine Palettes** | 10 Theme Colors | `getVoucherSpineTheme(colorKey)` |
| **Corner Radius** | `14` (button), `20` (card), `24` (modal top) | Apple iOS curve standards |
| **Min Tap Target** | `44 × 44 pt` | Touch accessibility baseline |

---

## 5. Apple Grouped List Configuration Standard (Linear / iOS Settings Pattern)

When designing complex configuration or automation setup panels (such as Birthday Rewards):
- **Never embed inline form inputs inside nested grey containers ("Box Inception")**.
- **Use modular, interactive row cards with right chevrons (`›`)**:
  - **Hero Offer Card**: Displays rich media product thumbnail (`52 × 44 pt`, `radius: 10`), bold item title, and formatted price subtitle.
  - **Metadata & Schedule Cards**: Clean vector icons (`calendar-outline`, `time-outline`, `document-text-outline`), primary bold values, and concise human-readable subtitles.
  - **Drill-Down Modals**: Tapping opens focused bottom sheets for option selection without cluttering the primary canvas.
  - **Primary CTA**: Full-width black capsule button `[ Save Changes ]` (`height: 50`, `borderRadius: 9999`, bold `#FFFFFF`).
- **Unified Rewards Catalog Integration**:
  - Automatically surface configured automated Birthday Passes inside the primary Rewards Catalog (`activeTab === 'catalogue'`).
  - Provide a dedicated `Birthday` filter pill with dynamic counter (`Birthday 1`) alongside `All`, `Active`, and `Draft`.
  - Display full-fidelity voucher ticket cards with distinctive festive branding (`[ 🎂 BIRTHDAY PASS ]`, validity period, scheduled time, and direct quick-edit navigation).

---

## 6. Manage Staff 3-Screen Design Standard (Apple iOS / Linear Pattern)

The Manage Staff experience (`app/(merchant)/staff.tsx`) follows a strict 3-screen clean Apple iOS flow:

1. **Screen 1: Main Team Dashboard**:
   - Clean white canvas background (`#FFFFFF`) with zero bulky dark banners.
   - Header with circular back button, bold title `Manage Staff`, subtitle `Your team & access`, and right black capsule CTA **`[+ Add Staff]`**.
   - Dual executive stat cards row: `[ 👥 ] 1 Team member` | `[ 🟢 ] 1 On duty`.
   - Minimalist segmented capsule tabs (`Team` active `#FFC700`, `Performance`, `Commission`, `Permissions`).
   - Section header `Your Team` ... `X members`.
   - Clean staff cards with embedded avatar status dots (`🟢`/`🟡`), bold name, role & branch subtitle (`Provider • Scoop creamy (HQ)`), soft green attendance badge (`• On duty`), and right chevron `›` opening Screen 3.

2. **Screen 2: Invite Staff Bottom Sheet Modal**:
   - Triggered by `[+ Add Staff]` capsule button.
   - iOS bottom sheet with drag handle, title, subtitle, and circular close button `(X)`.
   - Dual-input phone row: Country prefix dropdown pill `[ 🇲🇾 +60 ⌄ ]` + phone text input.
   - Dropdown selector boxes with icons for `Assign Branch` (`🏬`) and `Staff Role` (`👤`).
   - Soft grey info callout box: *"The staff member will receive an invitation and must accept it before they can access your store."*
   - Full-width black capsule CTA: `[ Send Invitation → ]` with yellow accent arrow (`#FFC700`).

3. **Screen 3: Staff Details Drill-Down View**:
   - Header with `←` back navigation and `•••` action menu.
   - Profile Hero Card: Large avatar with status dot, Name + `• Active` pill, Role & Branch, Phone, and `›` chevron.
   - Sub-tabs: `Overview`, `Permissions`, `Performance`, `Commission`.
   - Overview Tab:
     - `Quick Stats` section with time filter (`This Month ⌄`).
     - 3 metric cards: `Stamps issued`, `Sales handled`, `Customers served`.
     - Grouped iOS Settings rows: `Assigned Branches`, `Staff Role`, `Account Status`, `Last Active`.
     - Soft red destructive button: `[ 🗑️ Remove Staff ]` (`backgroundColor: '#FEE2E2'`, text `#DC2626`).

4. **Screen 4: Staff Roles & Compensation Tiers Full Page (Pangkat & Tahap Gaji / Komisen)**:
   - **Header Action Button**: `[ 🏷️ Roles ]` / `[ 🏷️ Roles & Tiers ]` located right beside `[ + Add ]` / `[ + Add Staff ]` in the merchant header.
   - **Full Page Architecture & Real Data Integration (`isRolesPage`)**:
     - 100% full-screen responsive page with dedicated back navigation and full-height scroll views.
     - **PocketBase Backend Integration**:
       - `GET /api/risev/merchant/staff/roles`: Retrieves merchant's customized role tiers stored in `merchant.metadata.staff_role_tiers`. Dynamically scans active staff from `users` and `merchant_staff` to attach real assigned member counts and member avatars. If no tiers exist yet, automatically derives roles directly from active store staff.
       - `POST /api/risev/merchant/staff/roles`: Saves and persists configured role tiers into PocketBase `merchants.metadata`.
       - Local caching with `@risev_staff_role_tiers_${merchantId}` for offline and zero-latency loading.
     - **Real Staff Assignment & Live Counters**:
       - Live calculation of active staff assigned to each role: `👥 X staff assigned` (with avatar chips and names).
       - Smart banner `Real Staff Roles Detected`: Automatically scans active staff records and offers 1-tap `[ + Add to Roles ]` for any role titles not yet saved as presets.
       - Empty state handling: Clean UI with options to create custom roles, sync from active staff, or import starter templates.
       - Safety deletion guard: Warns the merchant with exact staff names if active staff currently hold the role prior to deletion.
   - **1-Tap Auto-Population in Edit Staff**:
     - `Display Title` dropdown shows all available role presets with preview pills (`Full-Time • RM 2,800/mo • 15% Comm`).
     - Selecting a tier automatically applies its default base pay, hourly wage, and commission structure with immediate toast feedback (`⚡ Auto-applied Senior Provider preset`).
     - Integrated `[ ➕ + Add Custom Role / Level ]` button directly within the dropdown to quickly create new tiers on the fly.
     - On the `Employment & Compensation` screen, an active preset banner allows 1-tap `[ Guna Preset ]` reset if values were modified.
   - **Role Preset Integration in Invite Staff**:
     - `Staff Role` dropdown maps all configured tiers.
     - Dynamic preview card below the dropdown displays the pre-configured base pay, wage, and commission model for the selected role.
     - Passes compensation defaults directly when submitting the staff invitation.

### 40. Adaptive Staff Performance Redesign (Solo Staff vs. Multi-Staff Leaderboard)
- **Design Inspiration**: Matches the executive dual-state layout from Image 1:
  - **Solo Staff Mode (`staff.length === 1`)**:
    - **Header**: `Staff Performance` title + `Track your team's contribution` subtitle + interactive timeframe selector dropdown pill (`[ This Month ⌄ ]`).
    - **Individual Performance Amber Banner**: Warm gradient card (`#FFFBEB`, `#FEF08A`) with `#FFC700` circular trending-up icon acknowledging solo team state.
    - **Hero Performance Card**: Executive white card featuring staff avatar, full name, role title (`Provider • All Branches (HQ)`), status badge (`🟢 Active` / `🔴 On Leave`), divider, and 3 high-contrast stat columns (`Stamps Issued`, `Sales Handled`, `Customers Served`) each backed with a mini `#FFC700` icon circular badge.
    - **Detailed Performance Link Card**: Interactive card linking directly to full analytics, service records, and customer redemption logs (`[ 📊 View Detailed Performance > ]`).
    - **Footnote Explainer Card**: Clear transparency disclosure on completed vs refund/cancelled transactions.
  - **Multi-Staff Mode (`staff.length > 1`)**:
    - **Segment Switcher**: Rounded segmented tab bar (`[ Stamps ]`, `[ Sales (RM) ]`, `[ Customers ]`) with energetic `#FFC700` highlight.
    - **Team Total Aggregate Card**: 3-column store-wide total row with icon badges (`Stamps Issued`, `Sales Volume`, `Customers Served`).

### 41. Adaptive Staff Commission 3-Screen Redesign (Unconfigured vs Active vs Staff Details)
- **Design Inspiration**: Matches the executive 3-screen hierarchy from Image 1:
  - **Screen 1: Unconfigured Commission State (`!hasActiveCommission`)**:
    - **Header**: Title `Commission`, subtitle `Staff earnings & payouts`, interactive month picker dropdown `[ 📅 Oct 2026 ⌄ ]`.
    - **2-Column Summary Card**: `Total Sales` (RM with service count) + `Commission Earned` (`RM 0.00`, `No active commission rules`).
    - **Warm Amber Setup Commission Banner**: `#FFFDF5` card with `#FFC700` wallet icon, title `Set up staff commission`, subtitle, and full-width black button with gold arrow `[ Set Up Commission → ]` linking directly to Roles & Compensation page.
    - **Staff List (`Staff (X)`)**: Header with sort selector `[ Name A-Z ⌄ ]` / `[ Highest Sales ⌄ ]`, sleek staff rows with avatar, job & sales count, `RM 0.00 No commission`, and chevron `>`. Tapping any staff navigates to their detailed commission sheet.
    - **Footnote Box**: `ⓘ About these numbers` (completed eligible sales disclosure).
  - **Screen 2: Active Commission State (`hasActiveCommission`)**:
    - **3-Column Key Ledger Card**: `Earned` (`RM X.XX` bold emerald), `Unpaid` (`RM X.XX` slate), `Paid` (`RM X.XX` muted).
    - **Payouts to Review Card**: Elevated white card with wallet icon `Payouts to review` $\rightarrow$ `Review and record payments for staff. >` opening the bulk settlement modal.
    - **Staff List (`Staff (X)`)**: Header with sort dropdown `[ Highest Commission ⌄ ]`, staff rows displaying emerald commission badge (`RM X.XX Pending payout` / `Paid`).
    - **Footnote Box**: `💡 Commission calculation` transparency note.
  - **Screen 3: Dedicated Staff Commission Details Sheet**:
    - **Header**: Circle back button `<`, staff name title (`Hashiff`), subtitle `Commission details`, month picker `[ 📅 Oct 2026 ⌄ ]`.
    - **Profile Header**: Staff avatar, full name, role title (`Provider • All Branches (HQ)`), `🟢 Active` pill.
    - **Segment Switcher**: `[ Overview ]` (active gold `#FFC700`), `[ Transactions ]`, `[ Payout History ]`.
    - **Overview Tab**:
      - 3-Column performance card (`Completed Jobs`, `Sales Generated`, `Commission Earned`).
      - Commission Rate Card (`%` icon, rate formula, chevron `>` linking to edit staff role).
      - `Eligible Sales Breakdown (X)`: Transaction items with service code (`#SRV-1023`), timestamp, sales amount, and commission cut (`5% • RM 90.00`).
      - `Payouts (X)`: Recorded payment history and 1-tap `[ Record Payout of RM X.XX ]` settlement button.
  - **Backend Support**: Extended `/api/risev/merchant/staff/commissions` endpoint in `pb_hooks/staff_management.pb.js` to return `bookings: []` and `payouts: []` breakdowns per staff member.
### 42. Custom Milestone Sub-Rewards & Margin Simulator Architecture
- **Rule of Three Stamp Goals**:
  - Full Reward stamp completion goals are strictly selectable as **5, 10, or 15 Stamps** (`5 | 10 | 15`).
  - Stored in `loyalty_programs.stamp_goal`.
- **Milestone Sub-Rewards (Ganjaran Kemajuan)**:
  - Merchants can dynamically configure, add, and remove intermediate rewards on any stamp number between `1` and `stamp_goal - 1` (e.g. at Stamp 3, Stamp 5, Stamp 7).
  - Stored in `loyalty_programs.sub_rewards` (JSON field created via PocketBase migration `1782807078_add_sub_rewards_to_loyalty_programs.js`).
  - Interface `CardSubReward`:
    ```ts
    export interface CardSubReward {
      id: string;
      at_stamp: number;
      reward_title: string;
      reward_type: 'discount_amount' | 'discount_percent' | 'free_item' | 'voucher_code';
      reward_value: string;
      linked_reward?: string;
      badge_icon?: 'gift' | 'ribbon' | 'star' | 'coffee' | 'heart';
    }
    ```
  - **Auto-Pruning on Goal Reduction**: When merchant downsizes stamp goal (e.g. 10 $\rightarrow$ 5 stamps), sub-rewards at or above the new goal are automatically pruned from state and database.
  - **Milestone Interactive Map**: Horizontal visual track preview showing each milestone slot `#1` to `#stamp_goal` with instant 1-tap addition on empty slots.
  - **Real-Time Margin & Profitability Simulator Widget**:
    - Calculates Customer Total Spend (`spendPerStamp * stampGoal`), Total Rewards Given (`Full Reward + Sum(Sub-Rewards)`), and Effective Discount Rate %.
    - Real-time health badge (`Healthy Margin <= 15%`, `Moderate 15-25%`, `High Cost > 25%`) and guidance copy advising merchants on commercial viability.
- **Visual Card Previews & Customer Wallet (`rewards.tsx` & `nfc.tsx`)**:
  - Unearned milestone slots display a golden milestone gift box (`🎁` with milestone stamp badge).
  - Earned milestone slots render the earned stamp with a golden mini gift indicator badge.
- **Backend Auto-Issuance (`pb_hooks/stamp_complete.pb.js`)**:
  - On stamp transaction, hook detects intermediate crossing (`new_stamps >= atStamp && prev_stamps < atStamp`).
  - Generates customer voucher (`vouchers` record) without resetting card progress.
  - When `new_stamps >= goal`, completes full reward and resets card for the next cycle.

### 43. Stamp Loyalty V3 Focused Settings Architecture (Fresha x Apple iOS x Risev Signature)
- **Scope & Isolation**: Strictly scoped **inside Tab `stamp_rules` (Aturan Cop)** only. The global page header (`Tetapan Ganjaran`), the `LOYALTY ENGINES` status toggles, and the 5-tab navigation bar (`Ganjaran`, `Reka Kad`, `Aturan Cop`, `Aturan Mata`, `Hari Lahir`) remain permanently visible and fully functional across the entire Rewards manager.
- **Main Hub (Overview Inside Stamp Rule Tab)**:
  - Header: Section title `Stamp Loyalty / Aturan Kad Setem`, subtitle `Manage your stamp rules & milestones / Urus aturan cop & ganjaran kemajuan`, and interactive `🟢 Active` / `Inactive` status capsule.
  - `YOUR LOYALTY CARD`: Hero card showcasing the live customer stamp value proposition (`Collect X stamps` $\rightarrow$ `Get [Reward Name]`) with gold gift squircle and chevron linking directly to Screen B.
  - `Loyalty Rules` (4 tappable navigation rows with chevrons):
    1. **Stamps Required**: Shows current goal (e.g. `10 stamps`) $\rightarrow$ opens Screen A.
    2. **Completion Reward**: Shows current reward name $\rightarrow$ opens Screen B.
    3. **Card Expiration**: Shows expiry period (e.g. `90 days` or `No expiry`) $\rightarrow$ opens Screen C.
    4. **Minimum Spend per Stamp**: Shows minimum bill threshold (e.g. `RM 15 per stamp` or `No minimum spend`) $\rightarrow$ opens Screen D.
  - `More Options` (2 tappable navigation rows with chevrons):
    1. **Milestone Rewards**: Shows configured milestone count $\rightarrow$ opens Screen E.
    2. **Reward Cost Preview**: Shows margin estimator callout $\rightarrow$ opens Screen F.
  - Sticky bottom `Save Changes` CTA (`#000000` with white bold typography).
- **3/4 Height Bottom Sheet Modal Architecture (Screens A through F)**:
  - Tapping any row in `Loyalty Rules` (e.g. `Stamps Required`) or `More Options` slides up a native-feeling bottom sheet modal covering **3/4 of the screen height** (`height: Math.round(screenHeight * 0.75)` / `maxHeight: 75%`).
  - Features dimmed backdrop dismissal (`rgba(0,0,0,0.45)`), rounded top corners (`borderTopRadius: 28`), drag handle indicator pill (`40x4px`), internal ScrollView, and a sticky bottom `Save` button.
  - **Screen A (Set Stamp Goal)**: 2x2 squircle grid with `5 stamps` (Fast Goal), `10 stamps` (Recommended, yellow border & checkmark badge), `15 stamps` (High Value), and `Custom` (inline numeric input with clamp validation). Prunes invalid milestones upon save.
  - **Screen B (Select Completion Reward)**: Filter pills (`All Items`, `Free Item`, `Discount`, `Custom`), search input with instant clear, item card list with Risev signature radio circles, and custom reward title generator with quick catalog creator button.
  - **Screen C (Set Card Expiration)**: Radio choices (`30 days`, `60 days`, `90 days`, `180 days`, `No expiry`) and dynamic explanation card.
  - **Screen D (Minimum Spend per Stamp)**: Preset choices (`No minimum spend`, `RM 10 per stamp`, `RM 20 per stamp`, `Custom amount`) with inline RM currency input.
  - **Screen E (Milestone Rewards)**: Master toggle for milestone rewards, reorderable list of configured intermediate gifts, interactive bottom-sheet modal for editing target stamp (`#1` to `#goal-1`), reward title, reward type, and estimated value (RM).
  - **Screen F (Reward Cost Preview)**: 3-column stats card displaying `Total Spend`, `Total Rewards`, and `Effective Rate % of turnover` paired with an intelligent margin advisory callout.

### 44. Executive Store Identity Card Redesign (Image No 2 Exact 1:1)
- **File**: [`app/(merchant)/profile.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/profile.tsx)
- **Visual Architecture**:
  - Replaced the three separate bordered metric cards with a seamless, unified **3-column horizontal layout separated by subtle vertical dividing lines (`|`)**.
  - **Top Row**:
    - Squircle store logo (`width: 66, height: 66, borderRadius: 18, backgroundColor: #FFCC00`).
    - Clean business name: `PlusJakartaSans_800ExtraBold`, `fontSize: 20`.
    - Shortened, elegant location: `📍 Kampung Padang, Jitra` (`fontSize: 13, color: #64748B`).
    - Right chevron: `Ionicons name="chevron-forward" size={18} color="#000000"`.
  - **PRO vs NOT PRO Tier Row**:
    - **PRO Tier**: Jet black capsule `👑 PRO` in gold `#FFCC00` + vertical divider `|` + `🟢 Active` (`#16A34A`).
    - **NOT PRO Tier**: Soft grey capsule `FREE` + vertical divider `|` + `🟢 Active` + gold upgrade pill `👑 Upgrade PRO >` linking to `/subscription`.
  - **3-Column Modern Squircle Metric Tiles**:
    - **Tile 1 (NFC Stand)**: Pastel yellow squircle (`#FEF9C3`) with `radio` icon, large count (e.g. `1`), and right chevron `>`. Subtitle: `NFC Stand`.
    - **Vertical Divider**: `width: 1, height: 36, backgroundColor: #F1F5F9`.
    - **Tile 2 (Customers)**: Pastel slate squircle (`#F1F5F9`) with `people` icon, large count (e.g. `34`), and right chevron `>`. Subtitle: `Customers`.
    - **Vertical Divider**: `width: 1, height: 36, backgroundColor: #F1F5F9`.
    - **Tile 3 (Tap Alerts)**: Pastel mint squircle (`#ECFDF5`) with `notifications` bell icon & green active dot, large status (`On` in `#16A34A` or `Off`), and right chevron `>`. Subtitle: `Tap Alerts`.
### 45. Google Reviews Growth Engine Page Beautification
- **File**: [`app/(merchant)/google-reviews.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/google-reviews.tsx)
- **Visual & Functional Enhancements**:
  - **Executive Header**: Daylight Studio header with circular `<` back button (`38x38px`), title `Google Reviews`, subtitle `Amplify 5-star ratings & local SEO`, and top-right Risev branding.
  - **Executive Hero Growth Card**: Jet-black card (`#050505`) with gold pill `⭐ 5.0★ Growth Engine`, active NFC trigger indicator, and visual micro-workflow track (`NFC Tap` $\rightarrow$ `Rates 5★` $\rightarrow$ `Google Review 🚀`).
  - **Settings & Generator Card**: Squircle icon header with live status capsules (`🟢 1-Click Ready` / `⚡ Resolving...`).
  - **Smart Helper Actions**: Instant 1-tap `Paste from Clipboard` and `Search Shop on Maps ↗` buttons below the input box.
  - **Result Card**: Displays active 1-click write-review popup URL with 5 golden stars, `Test Review Popup ↗` CTA, and `Copy` button with visual feedback.
  - **Customer Experience Mockup**: Interactive preview showing the exact Google rating modal that opens on customer smartphones with 5 pre-selected stars and review box.
  - **3-Step How-It-Works Guide**: Numbered dark step badges with gold numbers explaining the zero-friction rating flow.

### 46. Onboarding & Member Claim Screen Studio Redesign
- **File**: [`app/(merchant)/onboarding-setup.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/onboarding-setup.tsx)
- **Architectural Upgrades**:
  - **Executive Studio Header**: Standard Daylight Studio styling (`#FFFFFF` background, circular back button, bilingual title & subtitle, top-right Risev logo) replacing the heavy dark blob.
  - **Responsive 2-Column Split View (`windowWidth >= 1024`)**:
    - **Left Column**: Controls, theme presets, custom color pickers, wallpaper banner dropzone, welcome text, and QR share hub.
    - **Right Column**: Sticky dynamic smartphone mockup that stays in viewport at eye level while scrolling settings on desktop.
  - **Apple-Style Segmented Tabs on Mobile**:
    - `🎨 Theme & Styling`: Primary brand color customizer with hex/swatches and background wallpaper (9:16) dropzone.
    - `📱 QR Code & Links`: High-definition counter stand QR code, direct URL copy, and 1-tap WhatsApp broadcast share.
    - `👁️ Live Preview`: Dedicated full-height customer smartphone preview for mobile merchants.
  - **Dynamic Contrast & Live Reactive Mockup**:
    - `getIsLight(color)` automatically adapts customer sheet text, badges, and CTA button colors between light and dark backgrounds.
    - Accurately previews store name, welcome message, customer phone/name input fields, and the 1-tap claim stamp card.
  - **Full PocketBase Persistence**:
    - Seamlessly binds to `merchants` table via `onboarding_primary_color`, `onboarding_welcome_text`, `onboarding_bg_url`, and `background_image`.

### 47. A6 Acrylic Counter Stand Poster Generator & Asset Integration
- **File**: [`app/(merchant)/onboarding-setup.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/onboarding-setup.tsx)
- **Asset**: [`assets/images/stand_a6_template.png`](file:///Users/fazlihadir/Desktop/risev%20app/waly/assets/images/stand_a6_template.png) & [`public/assets/stand_a6_template.png`](file:///Users/fazlihadir/Desktop/risev%20app/waly/public/assets/stand_a6_template.png)
- **Visual & Functional Implementations**:
  - **Direct Template Integration**: Integrated the official Risev vibrant yellow A6 poster template (`641 × 1024` native aspect ratio) featuring the high-impact sticker headline *"SCAN & GET REWARD!"* and Risev top branding.
  - **Live Reactive Mockup in Tab `QR & Links`**:
    - Displays an accurate miniature table tent card preview (`240 × 383 px`) with the merchant's live onboarding QR code dynamically injected inside the middle white squircle (`left: 22.93%, top: 48.63%, width: 53.98%, height: 33.59%`).
    - Renders the merchant's store name in Gaya 2 (Clean Bold Text style, `#050505`) below *"Scan with your phone camera"*.
  - **High-Resolution 2X Canvas Stamping Engine (`handleDownloadA6Stand`)**:
    - Generates a crystal-clear `1282 × 2048 px` print-ready PNG (standard A6 at 300 DPI equivalent).
    - Composites the official template background, high-definition QR code, and uppercase business name centered at the bottom.
    - Dynamically measures text width and auto-clamps font sizes for longer store names to guarantee zero overflow.
    - Exports directly to client peranti with clean naming convention: `Risev_Stand_A6_[StoreName].png`.
  - **Dual Action Architecture**:
    - Primary Button: `🖨️ MUAT TURUN STAND MEJA A6 (SIAP CETAK)` in signature Risev yellow (`#FFCC00`).
    - Secondary Actions: `Share via WhatsApp` (`#25D366`) and `QR Sahaja (PNG)` for raw vector/asset requirements.

### 48. Interactive Customer Onboarding Preview (Matching Booking Page Architecture)
- **File**: [`app/(merchant)/onboarding-setup.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/onboarding-setup.tsx)
- **Visual & Functional Implementations**:
  - Replaced the previous static/fake phone mockup with the exact high-fidelity **interactive customer preview container** from [`bookings.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/bookings.tsx).
  - **Live URL Toolbar**:
    - Status pill with active green dot `● /nfc?m=[merchant_id]`.
    - Instant `Reload` button with refresh key triggers to immediately re-render live styling changes.
    - Prominent `Open ↗` button in Risev Yellow (`#FFCC00`) opening the live customer claim page in a new browser tab.
  - **Authentic iPhone Device Frame (Real Dimensions: 390 × 840 px)**:
    - Expanded from the cramped 360 × 640px to standard modern iPhone dimensions (**`390 × 840 px`**, 19.5:9 aspect ratio) with dynamic island notch pill (`width: 90, height: 18, borderRadius: 10`).
    - **Zero-Cutoff Layout**: The full customer journey — Store Logo & Title, 3D Flippable Loyalty Card, Milestone Reward Voucher Pass, and the Complete "Claim Your Stamps" Form with the action button — now fits 100% within the viewport without any clipping or truncation.
    - Embeds the actual live page via `iframe` (`/nfc?m=[id]&preview=1&t=[timestamp]`) with 100% height fill and smooth native scrolling.
    - Cleaned Tab 3 view by hiding the floating "Save Branding" button during live preview mode and adding ample bottom clearance (`paddingBottom: 160`) above the merchant navigation bar.
    - Seamless native fallback with `Launch Customer View ➔` for mobile environments.
### 49. Onboarding Setup Wallpaper Sync & Preview Resolution
- **Files**: [`app/(merchant)/onboarding-setup.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/onboarding-setup.tsx), [`context/AuthContext.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/context/AuthContext.tsx)
- **Problem**: In Onboarding Setup, merchants with an existing wallpaper (such as Scoop Creamy with `background_image = 'a24_cf9_...png'`) saw the live wallpaper rendered perfectly inside the **Live Preview** tab (`/nfc?m=...`), but the **Theme** tab dropzone displayed an empty "Tap to Upload Custom Wallpaper" state.
- **Root Cause & Fix**:
  1. `AuthContext.tsx`: Initial cache hydration (`setUser`) omitted `merchant_id: record.merchant_id`, causing `onboarding-setup.tsx` to briefly mount without `merchant_id` and exit `fetchProfileData` early. Fixed by including `merchant_id: record.merchant_id || undefined` in the initial cache state.
  2. `onboarding-setup.tsx`: Upgraded `fetchProfileData` with fallback resolution via `owner = "${user.id}"`, wired `useFocusEffect` to guarantee re-fetch on navigation/tab focus, and used PocketBase official `pb.files.getURL(mRec, mRec.background_image)` with fallback to `onboarding_bg_url`.
  3. Image Dropzone Layout: Wrapped dropzone preview with explicit `width: '100%', height: '100%'` and ensured URL input updates `brandingBgPreview` dynamically.
### 50. Subscription Header & Hero Cards Redesign (RiseV New Standard UI)
- **File**: [`app/(merchant)/subscription.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/subscription.tsx)
- **Problem**:
  - The previous top section of `subscription.tsx` retained a legacy dark theme design: a heavy pitch-black bar header (`#050505`) with awkward negative-margin white sheet curve cutouts, an unrefined dark block for the Active Subscription card, and a secondary dark cart row.
- **Architectural & Visual Refinements**:
  1. **Daylight Studio Pure White Header**:
     - Background: Pure White `#FFFFFF` with subtle bottom border divider (`#F1F5F9`).
     - Replaced dark close button with an Apple-style circular daylight close button `(✕)` (`38×38px`, `#F8FAFC`, border `#E2E8F0`, black `#000000` icon).
     - Title block: `Subscription Plan` (`18px PlusJakartaSans_800ExtraBold`, `#0F172A`) paired with helper subtitle `Manage store tier & quota` (`11px PlusJakartaSans_500Medium`, `#64748B`).
     - Right: Official RiseV logo in pure black branding.
     - Removed obsolete `headerBleed` and awkward negative margin curve overlays.
  2. **Active Subscription Card (Clear White Compact Style + Dual-Bar Milestones)**:
     - Permukaan putih bersih (`#FFFFFF`) dengan border halus `1px solid #E2E8F0` dan bayang lembut (`elevation: 2`, `shadowOpacity: 0.04`).
     - Saiz lebih padat & kemas: padding dikurangkan ke `13px`, border radius `18px`.
     - Ikon squircle kuning berseri `#FFCC00` (`34×34px`, radius 10) dengan lambang kilauan (`sparkles`).
     - Tajuk pelan bold (`14.5px`, `#0F172A`) + subteks `Executive VIP Membership` (`10.5px`, `#64748B`).
     - Apple-style status capsule: `[ 🟢 ACTIVE VIP ]` berlatar hijau pastel (`#DCFCE7`, border `#86EFAC`, teks `#15803D`).
     - **Dual Quota Milestones Bar**:
       1. 👥 **Customer Database**: `${customerCount} / 300` (Starter) atau `${customerCount} Unlimited ♾️` (PRO) dengan progress bar emas `#FFCC00`.
       2. 📅 **Monthly Bookings**: `${monthlyBookingCount} / 30` (Starter) atau `${monthlyBookingCount} Unlimited ♾️` (PRO) dengan progress bar hijau `#10B981`.
     - **Pautan Milestone Kuota (`Usage Details ›`)**:
       - Menggantikan butang `Dashboard ➔` lama kepada pembuka modal Apple Bottom Sheet **Feature Usage & Milestones** yang memperincikan status langsung kuota Pangkalan Pelanggan, Tempahan Bulanan, Cawangan Kedai, Akaun Staf, dan **Baucar Aktif (Active Vouchers)**.
  3. **Daylight Stand Card with RiseV Yellow Accent (Card 2)**:
     - Pure White card (`#FFFFFF`, border `1px solid #E2E8F0`, `borderRadius: 18`, soft elevation).
     - Left: Signature RiseV Yellow squircle (`40×40px`, `#FFCC00`, `borderRadius: 12`) with black shopping cart icon.
     - Title: `Don't have a Stand?` (`13.5px PlusJakartaSans_800ExtraBold`, `#0F172A`).
     - Subtitle: `Get RiseV NFC Bundle · Lifetime Quota` (`11px PlusJakartaSans_500Medium`, `#64748B`).
     - Right: High-contrast black pill button `[ Order ➔ ]` with gold arrow.
  4. **Explore Plans & Key Differences Table (Apple Subscriptions / Fresha Benchmark)**:
     - **Header Row**: `Explore Plans` (`17px ExtraBold`) dipadukan dengan pautan bantuan `Compare benefits`.
     - **Segmented Cadence Pill**: Toggle kelabu lembut `#F1F5F9` bertukar pil hitam `#000000` antara `Monthly` dan `Annually (Save 20%)`.
     - **Kad Pelan Menegak (Stacked Radio Rows)**:
       - Starter (`RM 47` / `RM 38` /month): Radio bulatan kosong `⚪`, subteks `Essential loyalty tools`, tag `Current` bila aktif.
       - PRO (`RM 97` / `RM 78` /month): Radio bulatan emas dengan dot hitam `🔘`, border kuning emas `#FFCC00`, tag `Current` / `Popular`.
     - **Jadual Perbandingan Kemas (Key Differences Table - 6 Ciri Teras)**:
       - Header 3-lajur: Ciri, Starter, dan lajur PRO dengan *highlight* latar lembut `#F8FAFC`.
       - Memaparkan tepat **6 ciri paling penting & bernilai tinggi**:
         1. 👥 `Customer capacity`: `300` vs `Unlimited ♾️`
         2. 📅 `Booking engine`: `30 / month` vs `Unlimited`
         3. 🏪 `Business outlets`: `1 (HQ)` vs `5 Outlets`
         4. 👤 `Staff accounts`: `Up to 5` vs `10 + Comm`
         5. 🎁 `Milestone loyalty`: `Standard` vs `All Engines 🎁`
         6. 🏷️ `Active vouchers`: `5 Max` vs `Unlimited`
       - Tiada butang buka/tutup yang meleret — jadual kekal padat, kemas, dan boleh diimbas dalam masa 3 saat!

### 51. Loyalty Rewards Card Design Overhaul (Apple iOS Settings & Stripe Studio Benchmark)
- **File**: [`app/(merchant)/rewards.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/rewards.tsx)
- **Problem**:
  - The previous Card Design tab (`card_design`) was clunky, sprawling, and visually fragmented: large separate cards for background, slots, and font colors, bulky input boxes (`# 000000`) taking entire rows, and an oversized 2×6 grid of stamp icons that consumed extensive vertical scroll height.
- **Architectural & Visual Refinements (Pixel-Perfect Image 2 Alignment)**:
  1. **Segmented Studio Control**:
     - `[ 🎨 Colors & Icons ]` and `[ 🖼️ Artwork ]` pills on `#F1F5F9`. Clicking Artwork auto-expands the Artwork accordion.
  2. **Card 1: Colors & Icons (Unified iOS Settings List Card)**:
     - Pure White card (`#FFFFFF`, `borderRadius: 22`, border `1px solid #E2E8F0`, soft shadow).
     - **Row 1: Background**:
       - Squircle icon badge `🎨` (`color-palette-outline` in `#F8FAFC`).
       - Title `Background` + Subtitle `Card background color`.
       - Compact horizontal swatch row (Gold `#FFCC00`, Deep Indigo `#1E293B`, Emerald `#064E3B`, Wine `#7F1D1D`, Amber `#78350F`).
       - Active item features an exclusive black double-ring border.
       - Right chevron `›` opening full color picker modal with HEX input & color wheel.
     - **Row 2: Stamp Slots**:
       - Squircle icon badge `⊞` (`grid-outline`).
       - Title `Stamp Slots` + Subtitle `Color for stamp slots`.
       - Color swatches (Blue, Red, Green, Amber, Purple) + `···` More button + Chevron `›`.
     - **Row 3: Text Color**:
       - Squircle icon badge `T` (`text-outline`).
       - Title `Text Color` + Subtitle `Name, balance and labels`.
       - Color swatches (Black, White, Slate, Gold, Silver, Orange) + Chevron `›`.
     - **Row 4: Stamp Check Icon**:
       - Squircle icon badge `✓` (`checkmark-circle-outline`).
       - Title `Stamp Check Icon` + Subtitle `Icon for collected stamps`.
       - Mini icon preview circles (Checkmark with black ring, Ticket, Star, Heart) + `···` More button + Chevron `›`.
  3. **Card 2: Artwork (Interactive Collapsible Accordion)**:
     - Pure White card (`#FFFFFF`, `borderRadius: 22`, border `1px solid #E2E8F0`).
     - Header: Squircle icon badge `🖼️` (`image-outline`) + title `Artwork` + subtitle `Custom designs for front and back of your card.` + toggle chevron `▲ / ▼`.
     - Inside Accordion:
       - **Front Design Row**: Mini landscape card thumbnail (`68×42px`), title `Front Design`, status subtitle (`Custom artwork uploaded` / `No artwork uploaded`), `[ Replace / Upload ]` pill button, red trash button `[ 🗑️ ]`, and chevron `›`.
       - **Back Design Row**: Mini landscape card thumbnail (`68×42px`), title `Back Design`, status subtitle, `[ Replace / Upload ]` pill button, red trash button `[ 🗑️ ]`, and chevron `›`.
  4. **High-Contrast Sticky Bottom Action Button**:
     - Solid pure black button **`Save Changes`** (`#050505`, `borderRadius: 14`, height 50px, white bold text).
  5. **Full Color & Icon Picker Modal Sheet**:
     - Tapping `···` or chevron on any row smoothly opens a bottom sheet with preset chips, custom `# HEX` input with live preview, and full 18-icon grid.

### 52. Minimalist Single Selected Value Indicator (Rewards Card Studio)
- **File**: [`app/(merchant)/rewards.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/rewards.tsx)
- **Refinement**:
  - Instead of sprawling 5-6 swatches per row that crowded the layout, each setting row now adopts the clean Apple iOS Settings pattern:
    - **Left**: Squircle badge + Feature Title (`14px ExtraBold`) + Subtitle (`11px Medium`).
    - **Right**: **Hanya memaparkan satu bulatan warna/ikon yang dipilih secara aktif** (`26×26px` circle with double border and soft elevation) diikuti oleh chevron `›`.
    - **Interaction**: Menekan mana-mana bahagian baris membuka modal helaian bawah (*bottom sheet*) untuk memilih atau menukar warna dan ikon lengkap dengan kod HEX.

### 53. Removal of Redundant Sub-Tab Segmented Pill (Rewards Card Studio)
- **File**: [`app/(merchant)/rewards.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/rewards.tsx)
- **Refinement**:
  - The redundant segmented pill bar `[ Colors & Icons | Artwork ]` has been completely removed.
  - The screen now flows seamlessly and cleanly from the live interactive card preview directly into **Card 1 (Colors & Icons)** and **Card 2 (Artwork)** without intermediate redundant tabs.

### 54. High-Dopamine Milestone Celebration Modal (Concept A + B)
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Features Implemented**:
  1. **Hero Celebration**:
     - Ambient golden halo glow with floating celebration sparkle stars (`✨`, `🌟`).
     - Dual-ring border with golden accents surrounding the 3D gift/trophy emoji box.
     - Celebratory pill tag with sparkle icon (`✨ MILESTONE COP #5 DIBUKA! ✨`).
  2. **Gamified Milestone Journey Track (Concept B)**:
     - Visual progress pipeline displaying `[ Start ] ─── [ ★ Cop #5 (Dibuka) ] ─── [ 🏆 Cop #10 ]`.
     - Proportional progress bar fill showing exact customer journey towards the ultimate card goal.
  3. **Luxe Notched Boarding Pass Ticket (Concept A)**:
     - Authentic physical voucher ticket styling with top and bottom semi-circle notch cutouts (`14×14px` border notches matching the dark backdrop `#121217`).
     - Vertical dashed perforation tear-line dividing the left voucher stub and the main ticket body.
     - Left stub with brand primary color, crisp white gift badge, and vertical voucher ribbon text.
     - Right body with merchant name, active status dot badge, 15px bold reward title, and interactive 1-tap copyable voucher code with "Copied!" visual feedback.
  4. **Next Milestone Retention Teaser**:
     - Dynamic motivational retention hook: *"Kumpul lagi X cop untuk tebus Ganjaran Utama: [Title]!"* motivating the customer to revisit.

### 55. Milestone Celebration Modal: English Localization
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Refinement**:
  - All copy inside the Milestone and Card Completion celebration popup modal is now fully standardized in clean, modern English:
    - Badge: `MILESTONE STAMP #{X}` / `STAMP CARD 100% COMPLETED`
    - Heading: `Milestone Reward Unlocked!` / `Congratulations! Card Completed!`
    - Subtitle: `Congratulations! You reached Milestone Stamp #{X} and unlocked this exclusive voucher!`
    - Progress Track: `Start` ─── `Stamp #{X}` ─── `Stamp #{Goal}`
    - Voucher: `VOUCHER`, `ACTIVE`, `Valid 30 days • Redeem at store counter`
    - Action CTAs: `Log In & Save Voucher` / `View in My Vouchers`, and `Stay Here & View Stamp Card`.

### 56. Boarding Pass Ticket Layout & Notch Refinement
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Refinement Details**:
  1. **Solved Milestone Pill Clipping**:
     - Constrained the milestone badge with `maxWidth: '96%'`, `alignSelf: 'flex-start'`, and added `numberOfLines={1}` with `ellipsizeMode="tail"`.
     - Added `paddingRight: 8` and `overflow: 'hidden'` to the main content body so badges never run underneath the dashed perforation line.
  2. **Rebalanced Proportions & Free Space**:
     - Slimmed the left brand band from `44px` to `36px` and the right stub from `105px` to `90px`, gaining **~23px of horizontal canvas** for the center content.
     - Increased card height slightly to `165px` to provide breathing room for the reward title, progress bar, and milestone pill.
  3. **Seamless Authentic Notches**:
     - Removed the harsh `borderWidth: 1, borderColor: '#FFFFFF'` from the circular notches.
     - Set the notch cutout background to `#100720` so the bite marks blend naturally into the page backdrop rather than appearing as white-bordered stickers.

### 57. Post-Approval Next Visit Booking Card: Luxury Glassmorphism & English Standardization
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Refinements**:
  1. **Contrast & Readability (Solved Wallpaper Conflict)**:
     - Upgraded background from `rgba(255, 255, 255, 0.08)` to rich luxury dark glassmorphism `rgba(15, 15, 24, 0.76)` with `1.2px` subtle light border and soft drop shadow.
     - Subtitle and title text are now 100% legible, preventing any visual bleed from busy background wallpapers.
  2. **Elevated Pill Badge Tag**:
     - Converted `PLAN YOUR NEXT VISIT` into a refined golden capsule pill (`postApprovalBookingTagPill`) with ambient golden glow and sparkle icon.
  3. **High-Converting English Copy**:
     - Tag: `✨ PLAN YOUR NEXT VISIT`
     - Heading: `Loved today's visit? Skip the line next time!`
     - Subtitle: `Book your next appointment seamlessly from your phone.`
     - Primary Button: `Book Next Appointment ➔`
     - Secondary Button: `View My Stamp Card`
     - Receipt: `Payment of RM {amount} Successful` · `Receipt`

### 58. Points Loyalty Hub Overhaul: Fresha x Apple iOS Grouped List Design System
- **File**: [`app/(merchant)/rewards.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/rewards.tsx)
- **Goal**: Harmonize the Points Loyalty configuration tab with the Stamp Loyalty tab using the Apple iOS x Fresha design system.
- **Key Features Implemented**:
  1. **Header & Interactive Status Capsule**:
     - Modern typography (`Points Loyalty` + subtitle `Manage point earn rates, redemption value & limits`).
     - Tappable status badge (`● Active` in `#F0FDF4` / `○ Inactive` in `#F8FAFC`).
  2. **Flagship Hero Card ("YOUR POINTS PROGRAM")**:
     - Golden 48×48 rounded squircle icon (`#FFCC00`) with star icon.
     - Live dynamic program summary: `Earn 1 Pt per RM {spendPerPoint} spent` · `{pointsPerRm} Pts = RM 1.00 Discount ({rewardRatePercent}% Cashback)`.
     - Tapping opens the interactive **Points Simulator & Calculator**.
  3. **Grouped List 1: "Points Rules" (Apple iOS Settings Rows)**:
     - **Earn Rate**: Emerald squircle `cash-outline` (`#D1FAE5`) ➔ `Spend RM {spendPerPoint} ➔ Earn 1 Point`.
     - **Redemption Rate**: Amber squircle `gift-outline` (`#FEF3C7`) ➔ `{pointsPerRm} Pts = RM 1.00 Discount Value`.
     - **Minimum Points to Redeem**: Blue squircle `shield-checkmark-outline` (`#DBEAFE`) ➔ `{parsedMin} Pts (RM min discount)` or `No minimum threshold`.
  4. **Grouped List 2: "More Options"**:
     - **Points Calculator & Simulator**: Violet squircle `calculator-outline` (`#EDE9FE`) ➔ Interactive spend slider, quick preset buttons (`RM 20`, `RM 50`, `RM 100`, `RM 200`), live cashback rate, and merchant net margin.
     - **Redemption Limits & Fraud Guard**: Rose squircle `lock-closed-outline` (`#FFE4E6`) ➔ Max discount percentage per transaction.
  5. **Apple 3/4 Bottom Sheet Modals (`pointsSubScreen`)**:
     - Replaces heavy inline boxes with sleek bottom sheets containing pull handles, back buttons, 2×2 preset grids, custom input toggles, dual-metric preview strips, and sticky black `Save` buttons.

### 59. NFC Tap Customer Journey: 2-Step Progressive Reveal Overhaul
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Goal**: Transform the NFC tap customer experience from a crowded single-page stack into a clean, luxury 2-step progressive reveal where the merchant's background wallpaper takes center stage.
- **Key Changes Implemented**:
  1. **Step 1 (After Tap) - Clean Wallpaper Hero View**:
     - **Top Brand Strip**: Renders circular merchant logo + `Welcome to {Merchant Name}` on the left and white `risev` logo on the right.
     - **Hidden Stamp Card & Voucher**: The VIP Stamp Card and Boarding Pass Voucher Ticket are strictly hidden during initial tap (`step === 'form'`).
     - **Frosted Glass Card (`styles.innerFormCard`)**:
       - `● VERIFIED NFC SCAN` pill.
       - Title: `Claim Your Stamp` (or `Claim Your Points`).
       - Subtitle: `Tap detected. Enter your phone number to continue.`
       - Phone input with country prefix `🇲🇾 +60`, clear `x` button, and error handling.
       - Primary action button: `Collect My Stamp ➔` (or `Collect My Points ➔`).
       - Reassurance teaser note: `🔒 Reward preview will appear after request is sent.`
       - Prominent `Walk-in: Book Appointment` button (`Tempah slot temujanji & pilih servis`) with `ATAU` divider.
  2. **Step 2 (Waiting for Merchant Approval) - The Big Reveal**:
     - When the customer taps `Collect My Stamp ➔` (`setStep('sent')`):
       - The **VIP Stamp Card** and **Boarding Pass Reward Ticket** dynamically reveal!
       - **Approval Status Box**: Yellow circular clock icon badge (`#FEF08A`), `Waiting for merchant approval` title, pulsing amber status dots, summary table with customer phone number and `🟡 Pending` status, and `Wrong number? Edit Phone` action.

### 60. NFC Tap Card Overhaul: Pure White Apple-Grade Luxury Design
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Goal**: Replaced dark frosted glass with an Apple-grade pure white card matching the exact user design mockup.
- **Key Features Implemented**:
  1. **White Squircle Card**:
     - `backgroundColor: '#FFFFFF'`, `borderRadius: 28`, `borderColor: '#F1F5F9'`, subtle ambient drop shadow (`shadowOpacity: 0.12, shadowRadius: 24`).
  2. **Mint Green Status Pill**:
     - `#ECFDF5` background with `#10B981` dot and `#047857` bold text: `● NFC tap successful`.
  3. **High-Impact Typography**:
     - Headline: `Collect your stamp.` (or `Collect your points.`) in 30px `PlusJakartaSans_800ExtraBold`, color `#000000`, letterSpacing `-0.8`.
     - Subtitle: `Enter your phone number to continue.` in `#64748B`.
  4. **Segmented Country Pill Phone Input**:
     - Dual-tone input box (`#F8FAFC`, `borderRadius: 16`).
     - Inner white country pill: `🇲🇾 +60 ⌄`.
     - Hairline vertical divider (`#E2E8F0`).
     - Black bold phone input text + circular gray clear button (`✕`).
  5. **Golden Yellow Primary CTA**:
     - `#FFCC00` capsule button with black extra bold text `Collect My Stamp ➔`.
  6. **Loyalty Reassurance**:
     - Centered lock icon with `Your number is used for loyalty rewards.` in `#64748B`.
  7. **OR Divider & Walk-in Appointment Card**:
     - Centered `OR` hairline divider.
     - Squircle card with pastel yellow circular calendar icon, `Walk-In: Book Appointment` title, `Tempah slot temu janji & pilih servis` subtitle, and right chevron.

### 61. NFC Screen Dynamic Contrast & Lowered Card Positioning
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Changes**:
  1. **Removed Bottom Risev Logo**: Eliminated the redundant `fakeRisevLogoPhoneBg` image below the card container.
  2. **Adaptive Contrast (Light vs Dark Wallpaper)**:
     - Implemented dynamic top-strip luminance detection with HTML5 Canvas sampling and fallback to `getContrastColor(onboarding_primary_color)`.
     - When background is bright (cerah): `Welcome to` & `[Merchant Name]` are black/dark navy (`#0F172A`), and `risev` top logo is tinted black (`#0F172A`).
     - When background is dark (gelap/hitam): Text and `risev` logo adapt to crisp white (`#FFFFFF`).
  3. **Lowered Card Position**:
     - Configured `styles.scrollContent` with `flexGrow: 1, justifyContent: 'space-between'` and `styles.contentCard` with `flex: 1, justifyContent: 'space-between'`.
     - Set card `marginTop: 'auto', marginBottom: 12`, cleanly anchoring the white card to the lower viewport and providing generous visibility for the merchant's wallpaper in the center.

### 62. NFC Compact Card Overhaul & Integrated Appointment CTA
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Changes**:
  1. **Compact Proportions**:
     - Card container padding optimized to `paddingHorizontal: 20, paddingVertical: 18`, `borderRadius: 24`.
     - Headline scaled to `fontSize: 22` (`letterSpacing: -0.6`), subtitle to `fontSize: 13`.
     - Phone input streamlined to `height: 48` with compact country badge (`height: 36`).
  2. **Direct Appointment Button Placement**:
     - Replaced the large nested Walk-In appointment card and OR divider with a sleek secondary action button directly beneath `Collect My Stamp` (`height: 44`, `borderRadius: 14`, `#F8FAFC` background with `#E2E8F0` border and calendar icon).
  3. **Visual Balance**:
     - Reduced total card height by over 130px, completely unveiling the merchant's hero branding and wallpaper cup in the upper viewport while maintaining effortless one-thumb ergonomics.

### 63. Milestone Reward Celebration Modal: 3D Gift Box & Perforated Boarding Pass Ticket
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Asset**: [`assets/reward_gift_box.png`](file:///Users/fazlihadir/Desktop/risev%20app/waly/assets/reward_gift_box.png)
- **Design Overhaul**: Transformed the dark celebration popup into an Apple-grade, high-contrast floating white card modal that matches the user's design reference mockup with 100% fidelity.
- **Key Features Implemented**:
  1. **Floating White Card Modal**:
     - `backgroundColor: '#FFFFFF'`, `borderRadius: 28`, `borderColor: '#F1F5F9'`, subtle ambient drop shadow (`shadowOpacity: 0.18, shadowRadius: 32`), with a clean top-right `✕` dismiss button.
  2. **3D Gift Box Hero Celebration**:
     - High-resolution 3D open white gift box with shiny golden ribbon bow, inner warm illumination, and sparkling golden confetti.
     - Implemented `mixBlendMode: 'multiply'` for seamless background blending.
  3. **Celebration Headline & Copy**:
     - `You've unlocked a reward!` (22px `PlusJakartaSans_800ExtraBold`, `#0F172A`).
     - `Amazing! You've collected [X] stamps at [Merchant Name].` (`#64748B`).
  4. **Stamp Progress Box**:
     - Header row with `Your stamp progress` and bold fraction `[X] / [Goal]` (e.g. `5 / 10`).
     - Rounded track with dynamic yellow progress bar (`#FFCC00`).
  5. **Horizontal Boarding Pass Voucher Ticket**:
     - **Left Orange Stub**: Warm orange accent bar (`#EA580C`) with vertical text `[MERCHANT NAME] REWARD PASS` running vertically along the edge.
     - **Middle Voucher Section**:
       - Mini `PROGRESS` bar with percentage indicator (e.g. `50%`).
       - `YOUR REWARD` label and bold reward title (e.g. `Free Artisan Coffee`).
       - Location pin detail with stamps collected fraction.
       - Milestone pill tag: `🎁 Milestone at [X] stamps: [Reward Name]`.
     - **Perforation & Notches**: Semicircular top and bottom cutout notches (`width: 12, height: 12, borderRadius: 6`) with a vertical dashed tear-off perforation line (`borderStyle: 'dashed'`).
     - **Right Orange Stub**: Merchant circular logo with store branding underneath in crisp white text.
  6. **Next Milestone Retention Teaser**:
     - Compact squircle card with pastel yellow circle trophy icon, `Next Milestone` title, and motivating text `Collect [X] more stamps to unlock your next reward!` with right chevron.
  7. **High-Contrast Solid Black Action CTA**:
     - Full-width black button (`backgroundColor: '#000000'`, `height: 48`, `borderRadius: 14`) with bold white text `Log In & Save Voucher ➔`.
     - Secondary `Maybe later` link centered below for effortless modal dismissal.

### 64. Milestone Modal Refinement: Grand Golden Gift Box & Realistic Boarding Pass Voucher
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Asset**: [`assets/golden_gift_box.png`](file:///Users/fazlihadir/Desktop/risev%20app/waly/assets/golden_gift_box.png)
- **Refinement Summary**:
  1. **Grand 3D Golden Gift Box Asset & Overlapping Typography**:
     - Enlarged the round golden gift box with shimmering ribbon bow and swirling golden confetti streamers (`240 x 185`) to dominate the hero section with a festive 3D feel.
     - Positioned the bold headline `You've unlocked a reward!` with `marginTop: -48`, allowing approximately 3/4 of the text block to overlap directly onto the bottom base of the golden gift box.
     - Enhanced typography with subtle high-contrast drop shadow (`textShadowColor: 'rgba(255, 255, 255, 0.95)'`, `textShadowRadius: 8`) and `zIndex: 10` for crisp legibility over the 3D graphic.
  2. **De-duplicated Progress Tracking**:
     - Removed redundant mini progress bar from the inside of the voucher ticket, leaving the dedicated `Your stamp progress` box as the single source of truth (`5 / 10`).
  3. **Realistic Boarding Pass Voucher Information**:
     - **Header**: `YOUR REWARD` along with an amber countdown expiry pill (`⏳ Sah 30 Hari` / `Sah [N] Hari`).
     - **Title**: High-impact bold 13px reward title (`Free Artisan Coffee`).
     - **Code Pill**: `[barcode icon] KOD: WV-MILE-5555` with squircle pill background.
     - **Eligibility Badge**: Mint green badge `⚡ Sah untuk kunjungan seterusnya` for instant redemption clarity.
  4. **No-Scroll Mobile Viewport Fit (410x711)**:
     - Tightened vertical margins and component heights across the hero, progress box, voucher, and next milestone card.
     - Ensured the primary button (`Simpan Baucar ke Wallet ➔`) and secondary link (`Maybe later`) are 100% visible immediately upon modal appearance without needing any manual scrolling.

### 65. Slide-Up Bottom Sheet Modal Transformation
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Transition**: Converted from centered floating popup dialog into an Apple iOS native slide-up bottom sheet (`animationType="slide"`).
- **Key Enhancements**:
  1. **Bottom Sheet Geometry**:
     - `rewardModalBackdrop`: Aligned to `justifyContent: 'flex-end'`, `paddingHorizontal: 0`, `paddingVertical: 0`.
     - `rewardModalCard`: Anchored flush to the bottom edge (`borderBottomLeftRadius: 0, borderBottomRightRadius: 0`, `borderTopLeftRadius: 32, borderTopRightRadius: 32`).
  2. **Tactile iOS Handle Bar**:
     - Added centered drag indicator pill (`width: 42, height: 4.5, borderRadius: 3, backgroundColor: '#CBD5E1'`) at the top of the sheet.
  3. **Dismissal & Ergonomics**:
     - Preserved circular close button `(✕)` at top-right for quick tap-to-dismiss.
     - Backdrop tap to dismiss supported seamlessly.
  4. **Title Position Fine-Tuning**:
     - Adjusted `celebrationTitle` `marginTop` to `-24`, lowering the text so only the very top edge kisses the bottom ribbon rim of the golden gift box, leaving the open 3D box graphic completely unobstructed and legible.

### 66. Milestone Voucher Standardization with Core Voucher System
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Standardization**: Replaced bespoke modal boarding pass ticket with the platform's standardized real voucher architecture (`getVoucherSpineTheme` from `@/theme` matching `app/(customer)/vouchers.tsx`).
- **Key Enhancements**:
  1. **Dynamic Category Color Spine (`realVoucherLeftSpine`)**:
     - 38px left vertical spine utilizing `getVoucherSpineTheme(unlockedReward?.isMilestone ? 'milestone' : rewardType, title, brandColor)`.
     - Centered `-90deg` rotated text with `MILESTONE REWARD` (or `STAMP REWARD`) and subtext `EXCLUSIVE PASS`.
     - Auto-contrasted text (`#FFFFFF` or `#0F172A`) via YIQ luminance calculation.
  2. **Three-Tier Center Information Grid (`realVoucherCenterZone`)**:
     - **Top Row**: Amber `🎁 Ready to redeem` badge alongside golden `FREE ITEM` or dark `DISCOUNT` pill.
     - **Middle**: Uppercase `YOUR REWARD` tracking label, primary reward title (14.5px ExtraBold), and contextual milestone subtitle.
     - **Bottom Row**: Validity duration (`🕒 Sah 30 Hari`) on the left and barcode code pill (`WV-...`) on the right (removed redundant source pill for clean aesthetics).
  3. **Realistic Perforation with Dual Semicircular Notches**:
     - Perforation column with top and bottom semicircular circular cutouts (`width: 16, height: 16, borderRadius: 8`) and crisp dashed divider line.
  4. **Merchant Brand Right Stub (`realVoucherRightStub`)**:
     - Merchant brand color background seamlessly flowing from the perforation line to the right curved edge.
     - Raised circular badge (`width: 44, height: 44, borderRadius: 22`) framing the store logo with subtle shadow and contrast border.
     - Uppercase merchant store name with contrast-aware typography.

### 67. Complete Stamp Card (100% Goal) Modal Architecture
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Standardization**: Differentiated celebration state for a 100% completed loyalty stamp card from incremental milestone passes.
- **Key Enhancements**:
  1. **Dynamic Progress Bar Lock**:
     - When completed, locks label to `Status Kad Setem` and ratio to `10 / 10 (SELESAI)` with 100% glowing amber fill track (`#FFCC00`), replacing partial progress indicators.
  2. **Grand Reward Spine & Tag**:
     - Left spine dynamically presents `GRAND REWARD` with `EXCLUSIVE PASS` rotated label.
     - Bottom badge presents `🏆 GRAND PRIZE` alongside unclipped `Sah 30 Hari` validity.
  3. **Next Cycle Teaser Card**:
     - Replaces blank space with mint pastel card (`#F0FDF4`, border `#BBF7D0`):
     - `🔄 Kad Baharu Diaktifkan: Kumpul setem semula pada lawatan seterusnya untuk ganjaran baharu! ✨`
  4. **Single-Tap Wallet Persistence**:
     - Primary button `Simpan Baucar ke Wallet ➔` saves the grand reward voucher straight into customer storage.







### 68. State-Adaptive Smart Billing & Membership Hub
- **Files**: [`app/(merchant)/subscription.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/subscription.tsx), [`app/(merchant)/_layout.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/_layout.tsx)
- **Standardization**: Transformed the subscription screen from a static upsell page into an adaptive VIP Membership and Billing Management Hub.
- **Key Enhancements**:
  1. **Dual Visual State Logic**:
     - **Active Subscriber Mode (`renderActiveSubscriberHub`)**: Shown when `user?.merchant_status === "active" && activeSub?.status === "active"`. Presents an Executive VIP Black Card, live quota metrics, quick actions, and receipt/invoice history.
     - **Non-Subscribed / Trial Mode (`renderUpgradeCatalog`)**: Shown when on free tier or inactive. Delivers a high-conversion value proposition, billing cycle switcher (Monthly vs Annual 20% savings), Starter vs PRO cards, feature matrix, and 1-tap checkout.
  2. **Executive VIP Black & Gold Membership Card**:
     - Deep slate/black card (`#0F172A`) with subtle gold border accent (`#F59E0B`).
     - Live plan tier badge (`PRO MERCHANT` / `VIP STAND PASS`).
     - Renewal / billing cycle date countdown (`Renews automatically on <date>` or `Perpetual Lifetime Access`).
     - Status dot with live pulsating green active indicator.
  3. **3-Column Squircle Live Entitlements Quota**:
     - **Active Customers**: Real-time customer volume count vs quota (`Unlimited ♾️` for Pro/Perpetual).
     - **Branches**: Active outlets vs plan quota (e.g. `1 / 5 Outlets`).
     - **Staff Access**: Connected team accounts vs plan quota (e.g. `10 Seats`).
  4. **Merchant Quick Actions**:
     - `Order NFC Hardware`: Direct route to shop counter stands.
     - `Redeem TikTok / Shopee Code`: Modal dialog with activation token verification for merchant counter stand bundles.
     - `Switch / Upgrade Plan`: Collapsible smooth accordion exposing the plan switcher without cluttering the primary view.
  5. **Global FAB Collision Prevention**:
     - Excluded `subscription` route in `app/(merchant)/_layout.tsx` via `!pathname.includes("subscription")` to prevent the yellow `Need Help?` bubble from obstructing payment/checkout action buttons.
     - Bottom scroll content padding calibrated to `140px` for seamless mobile browser scrolling.


### 69. Post-Approval Appointment Booking Card Daylight Redesign
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Standardization**: Aligned the post-stamp approval booking prompt with the crisp, daylight white card aesthetic of the customer onboarding experience.
- **Key Enhancements**:
  1. **Daylight White Container (`postApprovalBookingCard`)**:
     - Upgraded from dark translucent background (`rgba(15, 15, 24, 0.76)`) to crisp daylight white (`#FFFFFF`) with 24px squircle border radius, subtle slate border (`#F1F5F9`), and soft ambient shadow (`shadowOpacity: 0.10, shadowRadius: 20`).
  2. **Mint Status Pill Badge (`postApprovalBookingTagPill`)**:
     - Mint badge (`#ECFDF5`) featuring live emerald indicator dot (`#10B981`) and bold label `Plan your next visit` (`#047857`), replacing the high-contrast yellow tag.
  3. **High-Contrast Left-Aligned Typography Hierarchy**:
     - 20px ExtraBold dark heading (`#000000`): `Loved today's visit? Skip the line next time!`
     - 13px slate subtitle (`#64748B`): `Book your next appointment seamlessly from your phone.`
  4. **RiseV Yellow Primary Action Button (`postApprovalBookingBtn`)**:
     - High-impact yellow button (`#FFCC00`) with pitch black typography (`#000000`), calendar icon, and forward arrow for single-tap navigation to the merchant booking screen.
  5. **Secondary Walk-In Style Action Button (`postApprovalBookingSecondaryBtn`)**:
     - Daylight off-white pill (`#F8FAFC`, border `#E2E8F0`) for `View My Stamp Card` / `View My Points Balance` with right chevron, eliminating dark button clash.
  6. **Reassuring Trust Footnote**:
     - Subtle lock icon footnote: `Instant booking confirmation · Skip the queue`.


### 70. NFC Step 2: Waiting for Merchant Approval Luxury 3D Card Redesign
- **File**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx)
- **Asset**: `assets/images/waiting_approval_clock.png` (Transparent high-res 3D yellow clock & glass hourglass with sand).
- **Design Metaphor**: Merged Image 2's centered luxury card & 3D hero with 100% of Image 1's operational information.
- **Key Features Implemented**:
  1. **Floating Luxury Squircle Card**:
     - `borderRadius: 28`, pure white background (`#FFFFFF`), crisp subtle border (`#F1F5F9`), and soft ambient drop shadow (`shadowOpacity: 0.08, shadowRadius: 20`).
  2. **Top-Right Cancel / Dismiss (`✕`) Button**:
     - Discreet circular button (`32×32px`, `#F1F5F9`) allowing customers to back out and edit their phone number at any time without feeling trapped.
  3. **3D Centerpiece Artwork with Warm Ambient Halo**:
     - Center 3D yellow clock and hourglass asset (`116×116px`) illuminated by a soft radial amber backdrop (`#FEF08A` at 42% opacity).
     - Subtle breathing/floating micro-animation using `beaconAnim` for continuous live visual feedback.
  4. **Centered High-Contrast Typography**:
     - Headline: `Waiting for approval` in 21px `PlusJakartaSans_800ExtraBold` (`#0F172A`).
     - Subtitle: `Your stamp/point request has been sent to [Merchant Name].` with smooth bilingual Malay support.
  5. **Inset Dual-Action Information Table (`#F8FAFC`, `borderRadius: 18`)**:
     - **Row 1 (Phone & Direct Edit Action)**: Black circular squircle (`36×36px`) with white phone icon, customer's unmasked formatted phone number, and prominent white `[Edit]` pill button.
     - **Row 2 (Approval Status)**: Black circular squircle (`36×36px`) with white shield icon, `Stamp Approval` title, and animated glowing `Pending` yellow pill badge (`#FEF9C3` with pulsing `#D97706` amber beacon dot).
  6. **Dual-Item Reassurance Footer**:
     - Left: `🔒 Auto-syncs in real-time`.
     - Hairline vertical divider (`#CBD5E1`).
     - Right: `📲 Keep screen open`.


### 71. NFC Smart Active Voucher Slide-Up Prompt & Counter Sync
- **Files**: [`app/nfc.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/nfc.tsx), [`components/NfcClaimModal.tsx`](file:///Users/fazlihadir/Desktop/risev%20app/waly/components/NfcClaimModal.tsx), [`pb_hooks/nfc_request.pb.js`](file:///Users/fazlihadir/Desktop/risev%20app/waly/pb_hooks/nfc_request.pb.js)
- **Concept**: Integrated customer voucher redemption directly into the frictionless NFC counter stamp claim flow.
- **Workflow**:
  1. **Pre-Claim Active Voucher Check**:
     - When customer enters phone number and taps `Collect My Stamp ➔`, an asynchronous call checks `/api/risev/nfc/customer-vouchers`.
     - If the customer has existing active vouchers for this merchant, a luxury Apple Wallet-grade Slide-Up Modal smoothly presents.
  2. **Slide-Up Voucher Modal (`VoucherPromptModal`)**:
     - Pull handle, `#FEF08A` badge `BAUCAR SEDIA ADA`.
     - Heading: `Gunakan Baucar Anda Hari Ini?` / `Use Your Voucher Today?`.
     - Selectable list of active vouchers with gift squircle badges, reward descriptions, and checkmark selection state.
     - Primary Action: `Gunakan Baucar di Kaunter ➔` (`#FFCC00`).
     - Secondary Dismiss: `Simpan Untuk Nanti (Kumpul Cop Sahaja)`.
  3. **Waiting Screen Dual Status Rows**:
     - If customer chooses to use a voucher:
       - Row 1: `Kumpul 1 Cop` -> `🟡 Pending`
       - Row 2: `Tebus Baucar: [Voucher Title]` -> `🟡 Pending Approval`
       - Compact phone number + edit pill positioned neatly below.
  4. **Merchant Counter Terminal Auto-Selection & Visual Presentation**:
     - **Transmission & Tag Persistence**: Claims carry the selected voucher via both `voucher_id` and metadata embedded in the customer name (`[VOUCHER:id#title]`), ensuring immediate transmission even across remote server environments.
     - **Prominent Amber Highlight Card (`chosenVoucherCard`)**: Renders directly between order amounts and vouchers with `✨ PELANGGAN INGIN GUNAKAN BAUCAR INI`, large gift squircle, voucher title, code pill, and discount/free-item tag.
     - **Customer Header Indicator**: Displays a golden `[🏷️ Guna Baucar]` badge alongside the session code.
     - **Active Voucher Navigation Row**: Changes from generic text to `Baucar Digunakan (1 Dipilih)` with amber highlight and discount pill.
     - **Sticky Checkout Footer**: Displays the active voucher benefit directly under `Total Amount` with auto-calculated net discount.
     - Cashier can easily tap `Batal` to dismiss or proceed to payment and award stamps + burn voucher simultaneously in 1 tap!
  5. **Stamp Stepper Layout Refinement (`stampIssueCard`)**:
     - Fixed React Native Web `<TextInput>` auto-expansion overflow by constraining `stampStepperInput` with explicit `width: 32`, `maxWidth: 36`, `height: 26`, and `stampStepperRow` / buttons with `flexShrink: 0`.
     - Preserved clean gap separation and alignment between `STAMPS TO GIVE` title and the counter stepper.

