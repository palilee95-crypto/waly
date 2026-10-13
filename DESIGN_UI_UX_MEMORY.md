# RISEV — DESIGN SYSTEM & UI/UX MEMORY
> **Single Source of Truth (SSOT)** for all UI/UX design, visual hierarchy, interaction patterns, and styling standards across the Risev mobile & web applications.

---

## 1. Core Design DNA & Philosophy

The Risev visual identity is built upon three foundational pillars:
$$\textbf{Apple Wallet} \times \textbf{Fresha} \times \textbf{Risev Signature}$$

1. **Apple iOS Tactile Craftsmanship**:
   - Continuous curvature squircles (`borderRadius: 16–24`).
   - Soft, natural, diffuse micro-shadows (`shadowColor: '#000000'`, `shadowOpacity: 0.03–0.06`, `shadowRadius: 5–8`).
   - Native micro-interactions: Active state transforms, filled vs outline glyph toggle, and haptic feedback.
2. **Fresha Compact Executive Density**:
   - Maximum content clarity with zero fluff.
   - Clean spacing, minimal vertical dead space, high scannability.
   - Direct, thumb-accessible primary action bars and sticky footers.
3. **Apple Wallet Ticket Metaphor**:
   - Realistic ticket notches, perforated dashed separation lines, barcode / QR pass check-in patterns, and multi-step progress journeys.

---

## 2. Strict Color System (The Rule of Three)

Use **ONLY** these three core colors throughout all customer booking and discovery interfaces:

| Token Name | Hex Code | Visual Role | Permitted Usages |
|:---|:---|:---|:---|
| **Pure White** | `#FFFFFF` | Primary Surface | Page background, cards, tickets, modals, button text on black. |
| **Pure Black** | `#000000` | Primary Contrast | Primary typography, icons, active borders, main action CTA pill buttons. |
| **Risev Yellow** | `#FFCC00` | Status & Accent | Selected states, active dots, badges (`CONFIRMED`, `ACTIVE`), progress markers. |

### ⚠️ Opacity & Tint Rules:
- **Subtle Borders**: `rgba(0, 0, 0, 0.06)` to `rgba(0, 0, 0, 0.08)`.
- **Secondary / Muted Text**: `rgba(0, 0, 0, 0.55)` to `rgba(0, 0, 0, 0.65)`.
- **Off-white Icon/Pill Surface**: `#F8FAFC` (with `1px` subtle black border).
- **STRICT FORBIDDEN COLORS**:
  - ❌ Do **NOT** introduce random rainbow / candy pastel backgrounds (e.g. pastel pink, baby blue, green, brown).
  - ❌ Do **NOT** use navy (`#101828`) for CTA buttons — **pure black `#000000` is mandatory**.
  - ❌ Do **NOT** use multi-color drop shadows or heavy colored neon glows.

---

## 3. Typography Hierarchy

The official typography across the entire system is **Plus Jakarta Sans**:

| Role | Font Family | Size | Weight / Tracking | Usage |
|:---|:---|:---|:---|:---|
| **Display Hero** | `PlusJakartaSans_800ExtraBold` | 26–30px | Line height 32–36px, letter spacing -0.5px | Screen hero titles (e.g. "Appointment Pass", "Select Service") |
| **Section Title** | `PlusJakartaSans_800ExtraBold` | 18–20px | Letter spacing -0.3px | Section headers ("Picked for you", "Favorite stores") |
| **Card Heading** | `PlusJakartaSans_700Bold` | 14–16px | Line height 20px | Service names, store titles |
| **Primary CTA** | `PlusJakartaSans_800ExtraBold` | 15–16px | Letter spacing +0.5px | Pill button text ("I HAVE ARRIVED", "Continue") |
| **Caption / Badge** | `PlusJakartaSans_800ExtraBold` | 9.5–11px | Letter spacing +0.4px, uppercase | Status badges ("CONFIRMED", "FOR YOU") |
| **Body / Subtitle** | `PlusJakartaSans_500Medium` | 12–14px | Line height 18px | Descriptive copy, helper subtext |

---

## 4. Standard UI Component Library (Design Tokens)

### 4.1. Category Compact Pill Chips & Action Squircles
- **Category Compact Pill Chip (Fresha × Apple iOS Filter Standard)**:
  - Height: `~38px`, `borderRadius: 999px` (capsule pill), `paddingVertical: 9px`, `paddingHorizontal: 14px`, `gap: 7px`.
  - Icon: 16px `#000000` (outline when default, solid when selected).
  - Label: `12.5px` Plus Jakarta Sans Bold (`800ExtraBold` when selected).
  - Default: `#FFFFFF` surface, `1px solid rgba(0, 0, 0, 0.08)`, `#000000` text & icon, subtle elevation (`shadowOpacity: 0.03`).
  - Selected: `#000000` (Pure Black) surface, `#FFFFFF` (Pure White) text & icon, high contrast, clean & executive.
  - Layout: Horizontal `ScrollView` with `gap: 8px, paddingHorizontal: 16px`.

- **Quick Action Squircle (`52×52`)**:
  - Size: `48×48px` to `52×52px`, `borderRadius: 16–18px`.
  - Used in: 4-Icon Quick Actions Hub (My Booking, My Voucher, Explore, Stamp Card).
  - Default: `#F8FAFC` surface with `1px solid rgba(0, 0, 0, 0.06)`, `#000000` icon.
  - Badges: Yellow `#FFCC00` dot or counter pill on top-right.

### 4.2. Primary Pill Action Button (`minHeight: 56`)
- Height: `56px`, `borderRadius: 999px` (pill).
- Background: `#000000` (Pure Black).
- Shadow: `shadowColor: '#000000'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.15`, `shadowRadius: 10`, `elevation: 4`.
- Left icon badge: `32×32px` rounded pill, `backgroundColor: 'rgba(255, 255, 255, 0.15)'`.
- Text: White `#FFFFFF`, `PlusJakartaSans_800ExtraBold`, letter spacing `0.5px`.
- Trailing arrow: `Ionicons name="arrow-forward" size={20} color="#FFFFFF"`.

### 4.3. Apple Wallet Ticket Pass
- Base Card: `#FFFFFF` card, `borderRadius: 24px`, border `1px solid rgba(0, 0, 0, 0.1)`.
- **Ticket Notches**:
  - Semi-circle cutouts positioned at `left: -10px` and `right: -10px` vertically centered along the perforation divider.
  - Size: `20×20px`, `borderRadius: 10px`, background `#FFFFFF`, border `rgba(0, 0, 0, 0.1)`.
- **Perforated Divider**:
  - Dashed border line separating merchant header from booking schedule details.
- **Pass QR Check-in**:
  - Full black button (`#000000`) with white QR icon and arrow for instant attendance verification.

### 4.4. Horizontal 3-Step Journey Tracker
Visualizing the user's appointment state with high clarity:
```
[ (✓) Booked ] ─────── [ (📍) Arrive ] · · · · · · · [ (✂️) Service ]
```
- Step 1 (Booked): Black circle with white checkmark.
- Connector 1–2: Solid black connecting bar (`2px`).
- Step 2 (Arrive): Risev Yellow circle (`#FFCC00`) with black location pin.
- Connector 2–3: Subtle dashed/dotted gray line.
- Step 3 (Service): White circle with black border and scissors/service icon.

### 4.5. Sticky Floating Summary Bar (Steps 1–3)
- Position: Anchored at `bottom: 0, left: 0, right: 0`.
- Background: `#FFFFFF` with `borderTopWidth: 1px`, `borderColor: 'rgba(0, 0, 0, 0.08)'`.
- Shadow: Subtle upward elevation (`shadowOffset: { width: 0, height: -4 }`, `shadowOpacity: 0.05`).
- Left Column: Selected items count (`12.5px`) + Bold Total Price in RM (`24px`).
- Right Column: Black pill `Continue` or `Confirm & Book 🚀` button.

---

## 5. Screen Blueprints & Architecture

### 5.1. Customer Home Dashboard (`app/(customer)/index.tsx`)
1. **Header Nav**: Greeting, search input bar, filter modal trigger button.
2. **Quick Category Squircles**: 6 items (`Barber`, `Beauty`, `Car Wash`, `Cafe`, `Restaurant`, `More`). Unselected outline $\rightarrow$ Selected Risev Yellow.
3. **"Picked for You" Feed**: Horizontal carousel featuring smart AI merchant recommendations.
4. **Quick Actions Hub (4-Icon Row)**:
   - Position: Placed intentionally between *"Picked for you"* and *"Favorite stores"*.
   - 4-item squircle row:
     1. `My Booking` $\rightarrow$ `/(customer)/bookings` (with Yellow live booking dot).
     2. `My Voucher` $\rightarrow$ `/(customer)/vouchers`.
     3. `Explore` $\rightarrow$ `/(customer)/explore`.
     4. `Stamp Card` $\rightarrow$ `/(customer)/my-cards` (with active cards count badge).
5. **Favorite Stores**: Horizontal card carousel with merchant ratings, distance, Pro badges, and instant `Book now >` CTA.

### 5.2. Customer Booking Flow (`app/b/[slug].tsx`)
- **Step 0 — Storefront Profile**:
  - Cover photo with gradient overlay, verified store badge, operating hours popup trigger.
  - Floating bottom yellow `Book Appointment` CTA button.
- **Step 1 — Select Service (Fresha Compact)**:
  - Top navigation with back button, step indicator (`Step 1 of 3`).
  - Branch location selector card.
  - Category pill filter strip (e.g. `All`, `Haircut`, `Coloring`, `Treatment`).
  - Compact service cards: Square cover thumbnail, title, duration, price, circular add/check toggle.
  - Floating sticky summary bar with running total.
- **Step 2 — Schedule Appointment**:
  - Horizontal day selector strip with active yellow card highlight.
  - Time period filter segments (`Morning`, `Afternoon`, `Evening`).
  - Time slot grid pills.
- **Step 3 — Your Details & Confirmation**:
  - Customer contact inputs, staff/provider choice, booking notes.
  - Price breakdown & loyalty stamp summary.
- **Step 4 — Appointment Pass (Apple Wallet)**:
  - Header: Booking Confirmed badge + calendar binder illustration.
  - Main Apple Wallet ticket pass with cutouts and perforation.
  - 3-step appointment progress tracker.
  - Bottom-anchored **`I HAVE ARRIVED`** black pill action button + helper text.
  - Zero dead whitespace at bottom (`paddingBottom: 20px`, `flexGrow: 1`, `marginTop: 'auto'`).

### 5.3. Customer Stamp Cards Wallet (`app/(customer)/my-cards.tsx`)
- **Header**:
  - Pure White `#FFFFFF` backdrop (zero heavy yellow blocks or artificial swoops).
  - iOS Large Title: `Stamp Cards` (`28px PlusJakartaSans_800ExtraBold`, `#000000`).
  - Active Cards count pill badge with Risev Yellow status dot indicator.
  - Apple iOS Search Bar with subtle border and clear button.
  - Segmented Filter Pills: `All`, `In Progress`, and `Ready to Redeem 🎁` with real-time card counters.
- **Wallet Cards Presentation**:
  - Interactive stacked Apple Wallet cards with tap-to-pull micro-interactions, flip-to-view QR codes, and pagination controls.
- **Stamp Card Details Modal (Apple Bottom Sheet × Fresha)**:
  - **Sheet Anatomy**: Native drag handle (`sheetHandleBar`, `[ ─── ]`), Pure White `#FFFFFF` backdrop, top rounded corners (`borderRadius: 32`), and circular close button `(✕)`.
  - **Header**: Merchant name (`18px PlusJakartaSans_800ExtraBold`), uppercase category, and city location dot (`• Jitra, Kedah`).
  - **Hero Card**: Interactive `FlippableLoyaltyCard` with subtle tap-to-flip hint.
  - **Stamp Progress & Milestones Tracker**:
    - Real-time fraction indicator (`X / Y STAMPS` black pill badge).
    - Continuous progress bar with Risev Yellow `#FFCC00` fill.
    - Milestone states: Unlocked celebration badge (`🎉 Reward Ready to Redeem!`) or countdown reminder (`Collect N more stamps to unlock <Reward>`).
  - **2-Column Stats Grid**: Side-by-side cards for `POINTS BALANCE` (large number in PTS) and `MEMBERSHIP` (tier with `#FFCC00` dot).
  - **Quick Actions Row**:
    - `Book Appointment`: Pure Black `#000000` pill button navigating directly to `/b/${merchantSlug}`.
    - `Pin to Home`: Toggle button with yellow `#FFCC00` active state.
  - **Sticky Bottom Action Bar**:
    - Fixed at thumb zone (`stickyModalFooter`).
    - Full-width Pure Black pill CTA: `SHOW QR TO SCAN` (`minHeight: 54`, white QR glyph, trailing chevron).

### 5.4. Customer Vouchers Wallet (`app/(customer)/vouchers.tsx`)
- **Header (Apple Wallet Executive Standard)**:
  - Pure White `#FFFFFF` backdrop (eliminated yellow S-curve block).
  - iOS Large Title: `My Vouchers` (`28px PlusJakartaSans_800ExtraBold`, `#000000`).
  - Active Vouchers count pill badge with Risev Yellow status dot indicator (`● N Active`).
  - Muted helper subtitle: *"Redeem and present rewards vouchers at partner stores."*
  - Apple iOS Search Bar: Real-time search by voucher name, store, code, or category.
  - Segmented Filter Pills: `All`, `Available`, and `History` with real-time counters and clean active black capsule state.
  - Generous bottom scroll padding (`paddingBottom: 130`) to prevent cards from colliding with the floating bottom dock.
- **Card Design Evolution**:
  - Voucher card designs are planned to be harmonized starting from the master voucher in merchant voucher management.

### 5.5. Customer Counter Stamp Bottom Sheet (`components/CustomerStampModal.tsx`)
- **Sheet Architecture (Apple Native Pure White)**:
  - Drag Handle: Centered `sheetHandleBar` (`38×4.5px`, `borderRadius: 99`).
  - Pure White `#FFFFFF` backdrop, top rounded corners (`borderRadius: 32`), and circular close button `(✕)`.
  - Header: Title `Stamp Your Card` + helper subtitle *"Choose how you want to collect your stamp at the counter."*
- **3 Counter Verification Pillars**:
  1. **Tap NFC Reader**:
     - Visual: Black squircle (`48×48px`) with Risev Yellow NFC radio icon + `[ ⚡ INSTANT ]` yellow badge.
     - Mode: Active pulse radar scanning ripples in `#FFCC00` with central phone hub.
  2. **Scan Store QR**:
     - Visual: Black squircle (`48×48px`) with white scan icon + `[ 📷 CAMERA ]` badge.
     - Mode: Viewfinder camera box with Risev Yellow corner brackets.
  3. **Show My QR Code**:
     - Visual: Black squircle (`48×48px`) with white QR icon + `[ 👤 MY CODE ]` badge.
     - Mode: Direct live customer loyalty QR pass card for merchant/cashier handheld scanners.

### 5.6. Customer Profile Screen (`app/(customer)/profile.tsx`)
- **Header Standard (Apple iOS Pure White)**:
  - Eliminated the legacy ~40% yellow `#FFC700` S-curve header block.
  - Pure White `#FFFFFF` backdrop with subtle border line (`rgba(0, 0, 0, 0.05)`).
  - Row layout: Risev brand logo + vertical divider + `My Profile` title + dual action squircles (`Edit Profile` and `Help & Support`).
- **Executive Member Identity Card**:
  - `#FFFFFF` surface with `1.5px solid #F1F5F9`, `borderRadius: 24`, soft diffuse shadow.
  - Avatar: `66×66px` with black ring border and camera edit indicator badge.
  - User details: Full Name (`20px PlusJakartaSans_800ExtraBold`, `#000000`), phone number, and black capsule tier pill (`[ 🛡️ BRONZE MEMBER ]` with `#FFCC00` accent).
  - **3-Column Loyalty Snapshot Row**:
    - Embedded `#F8FAFC` recessed stats container.
    - Column 1: `Total Points` (large balance PTS + yellow star badge).
    - Column 2: `Stamp Cards` (live count of active cards + tap shortcut navigating to `/my-cards`).
    - Column 3: `My Vouchers` (live count of active vouchers + tap shortcut navigating to `/vouchers`).
- **Merchant Mode Switch Card (Compact Risev Yellow Hero Card)**:
  - Maintained prominently at the top (`"kekalkan di atas"`), right below the Member Card.
  - Compact profile (`padding: 14`, `borderRadius: 18`, `gap: 11`).
  - Radiant Risev Yellow `#FFCC00` surface with warm ambient shadow (`shadowColor: '#FFCC00'`).
  - Compact Pure Black `#000000` squircle (`36×36px`) with 18px yellow storefront glyph.
  - Title: `Business Owner?` (`14.5px PlusJakartaSans_800ExtraBold`, `#000000`), Apple-style subtitle: *"More stamps, more bookings. 10x more repeat customers."* (`11px`).
  - Call to action: Compact Pure Black `#000000` pill button (`height: 38`, `borderRadius: 99`) with white text and yellow forward arrow: `Manage My Business →`.
- **Apple Inset Grouped Settings Sections**:
  - `Account & Wallet`: Edit Profile Information, Stamp History & Logs.
  - `Preferences & Support`: Push Notifications (iOS switch toggle), Help & Customer Support, Privacy & Terms of Service.
  - `Account Action`: Soft red destructive cell `Log Out Account`.
- **Apple Native Bottom Action Sheet (Log Out Confirmation)**:
  - Slide-up bottom sheet with native iOS drag handle `[ ─── ]` (`38×4.5px`).
  - Red icon squircle (`54×54px`, `borderRadius: 18`, `#FEF2F2`) with red logout glyph.
  - Title: `We'll Miss You!` (`20px PlusJakartaSans_800ExtraBold`).
  - Subtitle (Real Voucher Retention Hook): *"Don't forget you have {vouchersCount} vouchers worth RM {vouchersTotalValue} waiting in your wallet."* (Eliminated OTP references).
  - Stacked action pills: Destructive Apple Red pill `Log Out` (`#EF4444`, `height: 52`, `borderRadius: 999`) over neutral off-white `Cancel` pill (`#F8FAFC`, `height: 52`, `borderRadius: 999`).
  - Safe bottom clearance: `paddingBottom: 130` on profile content to completely prevent collision with the floating bottom dock.

---

## 6. Engineering & Implementation Guardrails

1. **Production Code is King**:
   - Primary production code lives in `app/b/[slug].tsx` and `app/(customer)/*`.
   - `public/booking-preview.html` is an interactive desktop HTML mockup. Whenever booking passes or steps are changed, ensure the production React Native code is prioritized.
2. **Dead Whitespace Prevention**:
   - Screens without a floating sticky footer (like Step 4 Appointment Pass) must **NOT** have arbitrary large scroll padding (e.g., `paddingBottom: 120`). Always use dynamic padding:
     ```tsx
     paddingBottom: currentStep === 4 ? 20 : 120
     ```
   - Use `flexGrow: 1` and `marginTop: 'auto'` to anchor bottom CTAs comfortably in the user's thumb zone.
3. **Continuous TypeScript Verification**:
   - Always validate changes using `npx tsc --noEmit` before concluding any feature edit.
4. **Git Workflow Safety**:
   - Never commit blindly when remote has unmerged commits; use `git stash` $\rightarrow$ `git pull origin main` $\rightarrow$ `git stash pop` $\rightarrow$ resolve conflicts $\rightarrow$ `git push origin main`.
5. **Language Standard**:
   - Always use **English** as the primary default language across all communication, UI copy, badges, titles, and user assistance unless explicitly requested otherwise.
6. **Apple-Style Copywriting Standard (Outcome Over Features)**:
   - Always frame copy around user empowerment, tangible multipliers, and delightful business outcomes rather than dry technical mechanisms or procedural steps.
   - *Example (Apple Classic)*: Instead of "4,500 mAh battery" $\rightarrow$ "Up to 48 hours of battery life. All day and all night."
   - *Risev Application*: Instead of "Switch to merchant console to scan stamps and manage reward plans" $\rightarrow$ **"More stamps, more bookings. 10x more repeat customers."**
7. **The Human Touch & Emotional Retention Standard (The Real Business Principle)**:
   - **UI/UX is Store Revenue**: Design directly determines merchant retention and cashflow. If a customer at the cashier takes more than 5 seconds to understand what to do, the business loses repeat customer lifetime value. Every screen must be thumb-accessible, ultra-smooth, and effortlessly **"Tap & Done"**.
   - **Emotional Anticipation (The Birthday Effect)**: Never treat loyalty as dry transactional data collection. Celebrate customer humanity:
     - *Birthday Excitement*: Customers eagerly anticipate their birthday because they know their favorite local spots are treating them with free gifts, surprise vouchers, and bonus stamps.
     - *Warm Recognition*: Welcome them back like a cherished regular at their favorite neighborhood café or salon.
   - **Pure Daylight Clarity**: Eliminate dark void containers on authentication. Pure White `#FFFFFF` daylight canvases with crisp Pure Black `#000000` CTAs instill trust, freshness, and Apple-grade professionalism.

---

### 5.7. Authentication & Registration Wizard Flow (`app/(auth)/login.tsx`)
- **First Login Screen (Pixel-Perfect Signature Screen)**:
  - **Canvas & Surface**: Pure White `#FFFFFF` daylight canvas with edge-to-edge native mobile layout.
  - **Unified Centered Composition (`mainCardPhone` — `justifyContent: 'center'`)**:
    - **Centered Brand Lockup (`phoneHeroLockupRow`, `gap: 16`)**:
      - **Official `risev` Logo**: (`width: 145`, `height: 44`, `alignSelf: 'center'`, Pure Black).
      - **3D Floating Reward Hero Asset**: (`@/assets/login-reward-hero.png`, `width: 170`, `height: 175`).
      - Both elements are closely paired side-by-side and horizontally centered as a unified brand lockup (Option 1).
    - **Integrated Value Proposition Headline (`phoneHeadlineBlock`)**:
      - **Headline**: 28px (`lineHeight: 34`, letter-spacing: `-0.6px`), `PlusJakartaSans_800ExtraBold`, Pure Black `#000000`, `textAlign: 'center'`:
        `"Your favourite places.\nAll together."`
      - **Subtitle**: 13.5px, `PlusJakartaSans_500Medium`, `#475569`, `lineHeight: 20`, `marginTop: 6`, `maxWidth: 330`, `textAlign: 'center'`:
        `"Collect stamps, unlock rewards, manage bookings, and enjoy birthday treats."`
      - Positioned immediately beneath the centered hero lockup (`marginTop: 14`), seamlessly connecting brand and value proposition.
    - **Balanced Form Integration (`phoneFormBottom` — `marginTop: 22`)**:
      - Replaced previous disconnecting `marginTop: 'auto'` and `space-between` chasm with a unified `justifyContent: 'center'` layout.
      - Eliminates awkward dead white voids, creating a tight, deliberate, and premium mobile-first composition.
  - **Phone Input Group**:
    - Label: `MOBILE NUMBER` (11.5px, `PlusJakartaSans_800ExtraBold`, uppercase, letter spacing 0.8px).
    - Input Container: Rounded squircle (`height: 60`, `borderRadius: 18`, `borderWidth: 1.5`, `#E2E8F0`).
    - Prefix: `🇲🇾` flag (18px) + `+60` (16px bold) + vertical separator divider (`#CBD5E1`).
    - Input Typography & Auto-Spacing: `17px`, `PlusJakartaSans_700Bold`, auto-formatted with Malaysian natural spacing (`12 345 6789`).
  - **Primary Action CTA**:
    - Solid Pure Black capsule button (`height: 58`, `borderRadius: 999`, `backgroundColor: '#000000'`, `shadowRadius: 14`).
    - Text & Icon: `"Continue  →"` in Pure White `#FFFFFF`, `PlusJakartaSans_700Bold`, 16.5px.
  - **Security & Reassurance**:
    - Golden Yellow shield squircle (`#FFCC00`) with bold black checkmark.
    - Copy: `"Instant, secure and password-free login"` (13px, `#1E293B`, centered).
  - **Legal Consent Notice**:
    - Removed per user instruction to maintain an ultra-clean, decluttered bottom action zone.

- **Returning User Password Login Screen (`step === 'password'` — "Welcome Back")**:
  - **Identical Visual Design System (Option 2 Implementation)**:
    - **Canvas**: Pure White `#FFFFFF` edge-to-edge borderless canvas (`mainCardBorderlessPhone`).
    - **Top Bar**: Official Risev logo on left (`width: 130, height: 38`, `alignSelf: 'flex-start'`). (Top badge removed per user request for an uncluttered look, as phone number is already presented in the verified phone card).
    - **Centered 3D Security Hero Asset**: Transparent 3D security & rewards illustration (`@/assets/password-security-hero.png`, `140×140px`, golden yellow security shield with black padlock, crown diploma, star coin, and gift box).
    - **Headline & Subtitle**:
      - Title: `"Welcome Back"` (26px, `PlusJakartaSans_800ExtraBold`, Pure Black, centered).
      - Subtitle: `"Enter your password to access your loyalty wallet."` (13.5px, `PlusJakartaSans_500Medium`, `#64748B`, centered).
    - **Verified Phone Confirmation Card (`passwordPhoneCard`)**:
      - Clean squircle container (`backgroundColor: '#F8FAFC'`, border `1px solid #E2E8F0`, `borderRadius: 18`, padding 12px 16px).
      - Left: Outline phone icon (`Ionicons name="phone-portrait-outline" size={24}`) + label `"Your phone number"` (11.5px) + formatted phone `+60 {phone}` (15px bold).
      - Right: `[ ✓ Verified ]` green badge (interactive hit-slop returns to phone input).
    - **Password Input & Security**:
      - Header Row: Uppercase bold label `PASSWORD` on left + `"Forgot Password?"` link on right.
      - Input Box: Rounded squircle (`height: 52`, `borderRadius: 16`, border `1.5px solid #E2E8F0`, focus `#000000`) with show/hide eye toggle.
      - Cloudflare Turnstile human verification container cleanly integrated.
    - **Primary Action CTA & Reassurance**:
      - Solid Pure Black capsule button `"Sign In  →"` (`height: 56`, `borderRadius: 999`, `#000000`).
      - Bottom link: `"← Change Phone Number"` (`13px PlusJakartaSans_700Bold`).
      - Trust Badge: Yellow shield badge + `"256-bit encrypted · Official Risev protocol"`.

- **Progressive Human-Touch Registration Wizard (One-by-One)**:
  - Eliminated monolithic long registration forms in favor of an Apple 3-step segment progress bar `[ ▬▬▬ ] [ ─── ] [ ─── ]` and verified phone chip `[✓ +60 {phone}]`.
- **Step 1: Identity & Profile Creation (`register-name` — "Let's make it yours")**:
    - **Header Composition**:
      - Top Left Brand: Official `risev` logo (`width: 135, height: 40`, `marginBottom: 16`, Pure Black) replacing the previous yellow WELCOME badge per user direction.
      - Top Right Hero Asset: 3D floating rewards illustration (`@/assets/login-reward-hero.png`, `width: 210, height: 230`, `zIndex: 1`), text layered on top (`zIndex: 2`).
      - Headline: `"Let’s make\nit yours."` (31px, `PlusJakartaSans_800ExtraBold`, Pure Black).
      - Subtitle: `"Just one more step before\ncollecting your stamps."` (14px, `#64748B`).
    - **Unified Natural Flow & Proportional Spacing (Option 1 Implementation)**:
      - Eliminated `justifyContent: 'space-between'` which previously created an unnatural ~250px dead white void on tall iPhone displays.
      - Container uses natural linear flow (`mainCardBorderlessPhone: { justifyContent: 'flex-start' }`).
      - Header `heroSectionRegister` has `minHeight: 220, marginBottom: 8`, providing clean vertical clearance for the floating 3D reward asset and title.
      - Form `registerNameSection` connects smoothly with `marginTop: 6, gap: 14`, pulling the phone verified card, name input, and birthday card directly underneath the header.
    - **Phone Verified Card with Explicit Change Action**:
      - Squircle container (`backgroundColor: '#F8FAFC'`, `borderRadius: 18`, border `1px solid #E2E8F0`, padding 14px).
      - Left: Outline mobile phone icon (`Ionicons name="phone-portrait-outline" size={24}`) + `"Phone verified"` (14px bold) + masked phone `+60 •••• {last4}` (13px, `#64748B`).
      - Right: Clear rounded badge with `"Change ›"` (`phoneChangeBadge`), tapping it instantly returns to phone login step (`setStep('phone')`).
    - **Name Input Group**:
      - Section label: `"WHAT SHOULD WE CALL YOU?"` (11px, `PlusJakartaSans_800ExtraBold`, uppercase, letter spacing 0.8px).
      - Input container: Rounded box (`height: 58`, `borderRadius: 18`, `borderWidth: 1.5`, `#000000`, placeholder `"e.g. Alex Tan"`).
    - **Birthday Celebration Card (Strictly Required)**:
      - Yellow border squircle (`backgroundColor: '#FFFFFF'`, `borderRadius: 18`, `borderWidth: 1.5`, `borderColor: '#FFCC00'`, padding 16px).
      - Top row: Bright yellow squircle (`50×50px`, `borderRadius: 16`, `#FFCC00`) with black gift icon + Title `"Your birthday deserves a little extra."` (14.5px bold) + description `"Add your birthday to discover special treats from participating stores."` (12px, `#64748B`).
      - Bottom row: Left subtext `"Required · Day and month only"` (12px bold, `#0F172A`) + interactive `"Add birthday ›"` (or `"🎉 {formattedDate} ›"` with clear button when selected).
      - **Universal Birthday Picker Modal (`datePickerModalVisible`)**:
        - The entire birthday card is an interactive `TouchableOpacity` that immediately triggers the modal, ensuring seamless tapping on any mobile screen.
        - Modal design system:
          - Brand yellow gift squircle header with title `"Select Your Birthday"`.
          - 3 interactive column counter boxes for DAY (1–31), MONTH (Jan–Dec), and YEAR.
          - 12 quick Month chips (Jan–Dec) with pure black active indicator.
          - Pure black confirmation capsule button `"Confirm ({day} {month} {year}) →"`.
        - 100% cross-platform reliability on iOS Safari, mobile web, and native React Native environments (eliminates WebKit hidden input blockers).
    - **Primary Action CTA**:
      - Solid Pure Black capsule `"Continue  →"` (`height: 58`, `borderRadius: 999`, `#000000`).
      - Strictly disabled until **both** valid name ($\ge 2$ chars) and valid birthday are entered.
    - **Back Navigation (Bottom Action)**:
      - Dedicated action button: `"← Change phone number"` (`13px PlusJakartaSans_700Bold`) below the primary CTA, elevated upwards from the bottom edge (`marginTop: 10`, `marginBottom: 20`).
      - Eliminated redundant Terms and Privacy Policy repeat on this step (already consented on the initial phone screen).

  - **Step 2: Digital Wallet & Mandatory Email (`register-email` — "Your rewards, wherever you go")**:
    - **Header Composition**:
      - Top Bar: Official `risev` brand logo top-left (`width: 115, height: 34`, left-aligned). No skip button.
      - Centered 3D Asset: Transparent open yellow envelope with heart card and paper airplane badge (`@/assets/email-envelope-hero.png`, `width: 145, height: 115`).
      - Headline: `"Your rewards,\nwherever you go."` (26px, `PlusJakartaSans_800ExtraBold`, Pure Black `#000000`, centered).
      - Subtitle: `"We’ll send your digital stamps, booking passes,\nand exclusive treats directly here."` (13px, `#64748B`, centered).
    - **Email Card Group**:
      - Container: Pure white squircle card (`backgroundColor: '#FFFFFF'`, border `1px solid #E2E8F0`, `borderRadius: 20`, padding 14px).
      - Section label: `"EMAIL ADDRESS"` (11px, `PlusJakartaSans_800ExtraBold`, Pure Black, letter-spacing 0.8px, strictly required).
      - Input: Squircle text box (`height: 52`, `borderRadius: 16`, border `1.5px solid #000000`, placeholder `"you@example.com"`).
      - Smart Typo Correction: Live suggestion pill for misspelled domains (`Did you mean @gmail.com? Tap to fix`).
      - Benefit Rows:
        1. 📄 `"Receive booking receipts"` — *"Get your appointment details by email."*
        2. 🎁 `"Keep a copy of special offers"` — *"We’ll email selected rewards, only with your consent."*
    - **Primary Action CTA**:
      - Solid Pure Black capsule: `"Continue  →"` (`height: 56`, `borderRadius: 999`, `#000000`).
      - Disabled/muted state when empty or invalid format; activates when valid email is entered.
    - **Back Navigation**:
      - Centered link: `"← Back to Name & Birthday"` (13px bold, `#000000`).

  - **Step 3: Security & Account Creation (`register-password` — "Create a Secure Password")**:
    - **Header Composition**:
      - Top Bar: Official `risev` logo on left (`width: 130, height: 38`) + Green verified status pill badge `[ ✓ Phone verified ]` on right (`#DCFCE7`, `#15803D`, 12px bold).
      - Centered 3D Hero Asset: High-resolution transparent 3D security & rewards illustration (`@/assets/password-security-hero.png`, `155×155px`, golden yellow security shield with black padlock, crown diploma/certificate, star coin, and gift box).
      - Headline: `"Create a Secure Password"` (26px, `PlusJakartaSans_800ExtraBold`, Pure Black `#000000`, centered, letter-spacing -0.5px).
      - Subtitle: `"Protect your vouchers, stamps, and points\nbalance with a secure password."` (13.5px, `PlusJakartaSans_500Medium`, `#64748B`, centered, line-height 19px).
    - **Phone Verified Confirmation Card**:
      - Squircle container (`backgroundColor: '#F8FAFC'`, border `1px solid #E2E8F0`, `borderRadius: 18`, padding: 14px 16px, `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'`).
      - Left: Outline mobile phone icon (`Ionicons name="phone-portrait-outline" size={24}`) + text column with label `"Your phone number"` (11.5px, `#64748B`) + formatted number `+60 {phone}` (15px bold, `#000000`).
      - Right: Clean verified chip badge `[ ✓ Verified ]` (`#DCFCE7`, green checkmark icon, `#15803D` 11.5px bold).
    - **Password Input Group**:
      - `CREATE PASSWORD`: Uppercase bold label (11px, letter-spacing 0.8px) + Squircle input (`height: 52`, `borderRadius: 16`, border `1.5px solid #E2E8F0`, focus `#000000`, placeholder `"Min. 8 characters"`, eye toggle icon).
      - Helper Guidance: `ⓘ Use a unique password to keep your account safe.` (11.5px, `#64748B`, subtle info icon).
      - `CONFIRM PASSWORD`: Uppercase bold label (11px) + Squircle input (`placeholder: "Re-enter password"`, eye toggle icon, live match feedback).
    - **Primary Action CTA**:
      - Solid Pure Black capsule: `"Create account & continue  →"` (`height: 56`, `borderRadius: 999`, `#000000`, shadow radius 14).
      - Strictly disabled until both passwords meet the minimum 8-character requirement and match.
    - **Back Navigation**:
      - Centered bottom link: `"← Back to Email Address"` (`13px PlusJakartaSans_700Bold`, `#0F172A`).

  - **Step 4: Real-time Email Verification & Activation (`verify-email` — "Check your email.")**:
    - **Visual Hierarchy & Header**:
      - Top Bar: Official `risev` brand logo top-left (`width: 115, height: 34`, `alignSelf: 'flex-start'`).
      - Centered 3D Hero Asset: High-resolution transparent 3D yellow envelope with pop-up white checkmark card and yellow radiating sparkle rays (`@/assets/email-verify-hero.png`).
      - Headline: `"Check your email."` (28px, `PlusJakartaSans_800ExtraBold`, Pure Black `#000000`, tight line-height).
      - Subtitle: `"We’ve sent you a verification link. Open your email and tap the link to confirm your address."` (13.5px, `#475569`, centered).
    - **Unified Status Card**:
      - Container: Pure white squircle card (`backgroundColor: '#FFFFFF'`, border `1.5px solid #E2E8F0`, `borderRadius: 20`, padding: 14–16px).
      - Row 1 (Email): Solid black squircle mail badge (`width: 28, height: 22`) + registered email address (`16px`, `PlusJakartaSans_700Bold`, `#000000`).
      - Subtle Divider: Thin line (`height: 1`, `#F1F5F9`).
      - Row 2 (Live Polling): Risev Yellow animated spinner (`#FFCC00`) + `"Waiting for confirmation..."` (`14.5px`, `PlusJakartaSans_500Medium`, `#1E293B`).
    - **Clean Interactive Actions**:
      - `"Didn’t receive it? Resend link"` (with live 60-second cooldown handler).
      - `"Wrong email? Change address"` (smoothly navigates back to Step 2 to edit email without losing user inputs).
    - **Security & Reassurance**:
      - Risev Yellow shield badge (`#FFCC00`) with bold black checkmark + vertical divider + `"Your account stays protected."` (`12.5px`, `#475569`).
    - **Instant Auto-Login**: Background polling immediately detects verification webhook and transitions to green celebration before seamless dashboard entry.
### 5.8 Email Verification Landing Page (`app/confirm-email/[token].tsx`)
- **Aesthetic Overhaul (Option 1 Implementation)**:
  - Eliminated legacy dark black background (`#09090B`) and isolated floating yellow card.
  - Upgraded to modern Pure White `#FFFFFF` native full-height canvas (borderless on mobile, elegant card with subtle shadow on desktop).
- **Branding & Visual Assets**:
  - Centered official `risev` logo top header (`width: 145, height: 44`).
  - Centered 3D celebration asset: `@/assets/email-verify-hero.png` (transparent 3D envelope with checkmark card and radiating rays, `170×160px`).
- **Typography & Status Feedback**:
  - Headline: `"You’re all set! 🎉"` (`28px PlusJakartaSans_800ExtraBold`, Pure Black `#000000`).
  - Subtitle: `"Your email address has been successfully verified. Your digital stamps and rewards are ready to collect."` (`14px PlusJakartaSans_500Medium`, `#475569`).
  - Status pill: `[ ✓ Email verified & account active ]` (`#F0FDF4`, border `#BBF7D0`, green text `#15803D`).
- **Primary Action CTA & Seamless Transition**:
  - Solid Pure Black capsule: `"Continue to Risev  →"` (`height: 58`, radius 999, `#000000`).
  - Auto-redirect countdown: `"Redirecting automatically in 4s · Tap to continue now"`, transitioning smoothly to login/dashboard.
### 5.9 Customer Push Notification Modal (`components/CustomerPushNotificationModal.tsx`)
- **iOS Bottom Sheet Architecture**:
  - Replaced legacy centered floating box with an authentic native iOS Bottom Sheet on mobile (`borderTopLeftRadius: 36`, `borderTopRightRadius: 36`, `justifyContent: 'flex-end'`).
  - Native drag handle bar (`#CBD5E1`, 38×4.5px) and subtle top-right close circle `(X)`.
  - Desktop responsive: Gracefully centers as an elegant dialog (`maxWidth: 440`, `borderRadius: 32`).
- **3D Hero Visual Asset & Animation**:
  - High-resolution transparent 3D glossy yellow ringing bell with calendar date badge (`@/assets/notification-bell-hero.png`, 120×120px).
  - Subtle breathing pulse loop animation (`pulseAnim`).
- **Header & Value Proposition**:
  - Pill badge: `IMPORTANT REMINDER` (`#FEF3C7`, dark amber text `#92400E`, 11px ExtraBold).
  - Title: `"Enable Appointment & Reward Notifications"` (22px PlusJakartaSans_800ExtraBold, Pure Black `#000000`, 28px line-height).
  - Subtitle: `"Never miss your appointment! Get automated reminders and instant alerts directly on your phone screen without WhatsApp."` (13px `#475569`).
- **Streamlined 2-Benefit Grouped Card**:
  - Unified light card container (`#F8FAFC`, border `#E2E8F0`, `borderRadius: 20`, padding 14px):
    1. 🕒 **Appointment Reminders**: Yellow icon squircle (`#FEF3C7`) + `"Get notified 2 hours and 30 minutes before your visit."`
    2. 🎁 **Rewards & NFC Stamps**: Yellow icon squircle (`#FEF3C7`) + `"Instant alerts when stamps are added and vouchers are ready to redeem."`
- **Dual Action Button Hierarchy**:
  - Primary CTA: Pure Black solid capsule `[ 🔔 Enable Notifications Now ]` (height 54px, radius 999, `#FFFFFF` text).
### 5.10 Risev Tap Stand Activation & Pairing Screen (`app/nfc.tsx`)
- **Aesthetic Overhaul (Pure White Apple-Grade Aesthetic)**:
  - Replaced legacy dark black background (`#000000`) and dark card list with an Apple-grade Pure White `#FFFFFF` canvas.
- **Top Header**:
  - Left: Official `risev` black brand logo (`width: 105, height: 32`).
  - Right: `))) Tap Activation` status indicator with radio wave icon.
- **Hero Visual Section**:
  - High-resolution physical Risev acrylic counter stand + smartphone tapping mockup (`@/assets/imej nfc.png`, height 240px) surrounded by radiating gold accents.
- **Typography**:
  - Headline: `"Activate Your Risev Tap"` (26px PlusJakartaSans_800ExtraBold, Pure Black).
  - Subtitle: `"Pair this physical NFC counter stand to your store to start collecting customer visits and loyalty stamps instantly."` (13.5px, `#64748B`, max-width 340).
- **Unified Serial & Hardware Specs Card**:
  - Light gray squircle card (`#F8FAFC`, border `#E2E8F0`, `borderRadius: 22`, padding 18px).
  - Top Row: Label `STAND ACTIVATION SERIAL` + Code `{unclaimedStand.code}` + Pill badge `✓ Official Hardware` (`#DCFCE7`, `#15803D`).
  - Divider: Thin line `#E2E8F0`.
  - Bottom 3-Column Grid:
    1. 👥 `500` · `Customer Capacity`
    2. ♾️ `Lifetime` · `Hardware License`
    3. ⚡ `Instant` · `Tap & QR Access`
- **Dual Action Button Hierarchy**:
  - Primary CTA: Golden Yellow Risev capsule `[ Store Owner Log In  → ]` (`backgroundColor: '#FFCC00'`, text black `#000000`, height 54, radius 999).
  - Secondary CTA: Outlined White capsule `[ Create New Store Account (2 min) ]` (`backgroundColor: '#FFFFFF'`, border `1.5px solid #000000`, text black, height 52, radius 999).
  - Clean footer link: `(?) Need help setting up?` (opens WhatsApp support without cluttered floating FAB).
