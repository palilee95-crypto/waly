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
| **Risev Yellow** | `#FFCC00` | Status & Accent | Selected states, active dots, badges (`CONFIRMED`, `ACTIVE`), progress markers, and **Executive Rule Hero Cards** (kad ringkasan aturan di atas studio). |

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

### 5.1B. NFC Tap Loyalty Hub & Milestone Celebration Modal (`app/nfc.tsx`)
- **NFC Tap Interface**:
  - Anchored lowered white squircle card (`borderRadius: 24`, `padding: 20px 18px`) that preserves wallpaper visibility.
  - Adaptive contrast header (`Welcome to` + store title + `risev` logo adapt to light/dark wallpaper luminance).
  - Mint green status pill: `● NFC tap successful` (`#ECFDF5` / `#047857`).
  - High-impact headline: `Collect your stamp.` + subtitle.
  - Dual-tone phone input with Malaysian prefix pill `🇲🇾 +60 ⌄`.
  - Risev Yellow `#FFCC00` action CTA `Collect My Stamp ➔` + streamlined Walk-In Appointment button underneath.
- **Milestone Celebration Modal**:
  - Apple-grade floating pure white modal card (`#FFFFFF`, `borderRadius: 28`, `shadowOpacity: 0.18`, top-right `✕` dismiss).
  - 3D open white gift box asset with golden ribbon bow and exploding confetti sparks.
  - Stamp progress box: `Your stamp progress` with fraction `X / Y` and `#FFCC00` track fill.
  - Horizontal Boarding Pass Ticket:
    - Left orange stub (`#EA580C`) with vertical `[STORE] REWARD PASS` text.
    - Middle: Progress bar (e.g. `50%`), `YOUR REWARD` title, stamps collected fraction, and milestone pill tag.
    - Semicircle cutout notches and dashed tear-off perforation line.
    - Right orange stub with merchant circular logo and store name.
  - Next Milestone retention teaser card (trophy icon, next reward threshold, and chevron).
  - High-contrast solid black action CTA: `Log In & Save Voucher ➔` with `Maybe later` link below.

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

### 5.11 Risev NFC Stand Marketplace & Activation Screen (`app/(merchant)/nfc-marketplace.tsx`)
- **Aesthetic Overhaul (Pure White Apple-Grade Aesthetic)**:
  - Replaced legacy pitch-black `#000000` dark theme with a clean, high-contrast `#FFFFFF` canvas.
  - Eliminated dark gradient overlays over the hero mockup (`assets/imej nfc.png`) so the physical Risev acrylic counter stand and smartphone appear vivid and ultra-crisp.
  - Replaced dark close button with a light squircle (`#F1F5F9`, border `#E2E8F0`, black icon).
- **Brand Header & Trust Badges**:
  - Official `risev` logo top-left paired with a `#FFCC00` `NFC BUNDLE` pill badge.
  - High-impact headline: `"Turn walk-ins into regulars."` (28px PlusJakartaSans_800ExtraBold, Pure Black).
  - Subtitle: `"Physical smart stands that reward customers on tap. Zero hardware monthly fees."`
  - Trust Badges: Dual pills (`Lifetime Customer Quota` & `Zero Monthly Fees`) with green checkmarks.
- **Stand Code Activation Card**:
  - Light squircle container (`backgroundColor: '#F8FAFC'`, border `1.5px solid #E2E8F0`, `borderRadius: 22`, padding 18px).
  - Stand icon squircle (`#FFCC00` yellow background, radio/nfc icon) + title `"Already have a Stand?"` + subtitle `"Enter the unique serial code printed on your acrylic stand."`
  - Monospace uppercase code input (`#FFFFFF`, border `#E2E8F0`, `placeholder: "e.g. RSV-8MBE-VG5D"`).
  - Golden Yellow Risev redeem button `[ Redeem Stand ]` (`backgroundColor: '#FFCC00'`, black text).
- **Pricing Packages (Apple-Grade Tiered Selection)**:
  - Package Cards: Pure White (`#FFFFFF`, border `#E2E8F0`, selected border `2px solid #000000`).
  - Top Badge: `"POPULAR CHOICE"` pill on highlighted bundle.
  - Clean typography: Package name (`PlusJakartaSans_800ExtraBold`), quota indicator, strike-through original price, and bold current price.
  - Feature checklist with green checkmark circles.
- **Curiosity Capsule & Support Navigation**:
  - Solid Pure Black capsule: `"Don't have a stand? Get Your Stand Now 🎁"` (`height: 52`, radius 999).
  - Clean inline setup/help support link: `(?) Need help setting up or ordering? Chat with us` above the footer links.
  - Excluded `nfc-marketplace` route in `app/(merchant)/_layout.tsx` so the global floating customer support FAB (`Need Help?`) does not overlap bottom CTAs or checkout drawers.

---

## 21. Merchant Profile & Settings (`app/(merchant)/profile.tsx` — Fresha × Apple iOS × Risev Accent Standard)

- **Pure Fresha × Apple iOS × Risev Accent Alignment**:
  - Adheres strictly to **The Rule of Three** (`#FFFFFF` Pure White, `#000000` Pure Black, `#FFCC00` Risev Accent).
  - Eliminates legacy dark background void (`#050505`) in favor of **Pure Daylight Clarity** with native iOS typography and scannability.
  - Zero rainbow/pastel candy backgrounds: All grouped row icon backgrounds use neutral `#F8FAFC` surfaces with high-contrast `#050505` glyphs.

- **Apple iOS Pure Daylight Header (`headerContainer`)**:
  - Pure white background (`#FFFFFF`, border bottom `1px solid #F1F5F9`).
  - Left: Official `risev` brand lockup (`@/assets/risev logo.png`, `width: 90, height: 26`) + vertical divider (`#E2E8F0`) + Large Title `"Store Settings"` / `"Tetapan Kedai"` (`18px PlusJakartaSans_800ExtraBold`, `#000000`).
  - Right: Dual circular tactile action buttons (`36×36px`, `#F8FAFC`, border `#E2E8F0`, black icon) for `Edit Profile` (`create-outline`) and `Help & Support` WhatsApp quick link (`help-buoy-outline`).

- **Executive Store Identity Card (`storeCard` — Compact & Refined Reference Style)**:
  - Container: High-end squircle card (`backgroundColor: '#FFFFFF'`, border `1px solid #E2E8F0`, `borderRadius: 20`, padding 15px, subtle shadow `radius: 8`).
  - **Tappable Header Row (`storeProfileRow`)**:
    - Avatar: Squircle profile image (`62×62px`, `borderRadius: 16`, border `#E2E8F0`, radiant yellow background).
    - Store Name: Large bold title (`18.5px PlusJakartaSans_800ExtraBold`, Pure Black `#000000`).
    - Location Row: Solid location pin icon (`Ionicons name="location-sharp" size={12}`) + address string (`12px PlusJakartaSans_500Medium`, `#475569`).
    - Location Row: Solid location pin icon (`Ionicons name="location-sharp" size={12}`) + address string (`12px PlusJakartaSans_500Medium`, `#64748B`).
    - Executive Tier & Expiry Row (`storeTierRow` — Option 2 Executive Black & Gold Pill):
      - Replaced the awkward 4th orphan line with an aligned horizontal row (`flexDirection: 'row'`, `gap: 7`, `flexWrap: 'wrap'`).
      - VIP Capsule Pill (`storeVipBadge`): Pure Black surface (`#000000`, border `rgba(255, 204, 0, 0.35)`, `borderRadius: 99`) containing:
        - Gold crown icon (`MaterialCommunityIcons name="crown-outline" size={12} color="#FFCC00"`)
        - Gold tier text (`PRO`, 10px `PlusJakartaSans_800ExtraBold`, `#FFCC00`)
        - Subtle bullet separator (`•`, `rgba(255, 255, 255, 0.35)`)
        - Live green dot (`#22C55E`) + Pure White status text (`Active`, 10px `PlusJakartaSans_700Bold`, `#FFFFFF`)
      - Inline Expiry Label (`storeExpInlineText`): `"Exp: 31 Dec 2099"` (`11px PlusJakartaSans_500Medium`, `#94A3B8`) sitting cleanly beside the pill.
    - Navigational Chevron: Right chevron (`Ionicons name="chevron-forward" size={18} color="#000000"`) indicating the header is interactive and opens store profile editing.
  - **Hairline Divider (`storeCardDivider`)**: Clean 1px horizontal line (`#F1F5F9`, `marginVertical: 12`).
  - **3-Column Modern Squircle Metric Tiles (`statTile` — Apple Health / Stripe Style)**:
    - 3 distinct, soft squircle tiles (`backgroundColor: '#F8FAFC'`, border `1px solid #F1F5F9`, `borderRadius: 14`, padding 10px, `gap: 8`):
    - Top Row: White squircle icon container (`28×28px`, `#FFFFFF`, border `rgba(0,0,0,0.05)`) on the left + subtle micro-chevron disclosure indicator (`Ionicons name="chevron-forward" size={12} color="#CBD5E1"`) on the top right.
    - Value & Label: Big bold metric number (`16px PlusJakartaSans_800ExtraBold`, Pure Black / Green for active alerts) + crisp descriptive label (`10.5px PlusJakartaSans_600SemiBold`, `#64748B`).
    - Tile 1 (NFC Stand): Radio icon `((•))` + count `1` + label `"NFC Stand"` (tap navigates to NFC Marketplace).
    - Tile 2 (Customers): People icon `👥` + count `34` + label `"Customers"` (tap navigates to Customer Management).
    - Tile 3 (Tap Alerts): Bell icon `🔔` with active green notification dot + status `"On"` / `"Off"` + label `"Tap Alerts"` (tap toggles push notification state).
    - Completely eliminates floating lines and awkwardly placed chevrons in favor of a cohesive, modern executive dashboard look.


- **Ultra-Slim Horizontal Risev Yellow Switch Bar (`merchantSlimCard`)**:
  - Replaced the bulky stacked card with an **Ultra-Slim Horizontal Banner** (~54px height):
  - Left: Black squircle (`#000000`, 34×34px, radius 10) with yellow person icon (`#FFCC00`) + `"Personal Account?"` / `"Akaun Peribadi?"` + 1-line subtitle `"Switch to view loyalty cards & rewards"`.
  - Right: Tactile Pure Black capsule button `[ Switch → ]` (`#000000`, height 32px, radius 999, white text, `#FFCC00` arrow).
  - Saves over 85px of vertical space, instantly revealing the top 3-4 setting items in `STORE & OPERATIONS` above the fold on mobile viewports.

- **Apple Black & Gold Luxury Tier Badging (`getSubscriptionBadgeInfo`)**:
  - Strictly eliminated all legacy cobalt/indigo blue badges (`#4F46E5` / `#2563EB` / `#0284C7`).
  - Active `PRO` badge is styled in Apple Centurion Black & Gold: Pure Black surface (`#000000`), gold star icon (`#FFCC00`), `#FFCC00` text, and subtle golden border (`rgba(255, 204, 0, 0.4)`).
  - Consistent across both Store Identity Card and Account & Security Subscription cell.

- **Apple Indented Dividers (`groupedDivider`)**:
  - Standard Apple iOS indented dividers (`height: 1, backgroundColor: '#F1F5F9', marginLeft: 64`).
  - Dividers start strictly under the text block, maintaining clean breathing room under the 36px icon squircles.
  - Eliminated confusing double locks: rows now use standard subtle Apple chevrons (`#CBD5E1`) unless strictly locked by permissions.

- **Apple-Style Human Outcome Copywriting (Store & Operations Subtitles)**:
  - Eliminated repetitive robotic IT terminology and awkward paragraph truncations:
  - `Manage Branches`: `"Expand to new outlets & assign managers"` (BM: *"Buka cawangan baharu & tetapkan pengurus"*).
  - `Manage Staff`: `"Cashier PINs, roles & daily permissions"` (BM: *"Akses PIN juruwang, peranan & had staf"*).
  - `Smart Booking Management`: `"Client appointments & service calendar"` (BM: *"Temu janji pelanggan & kalendar servis"*).
  - `Manage Rewards`: `"Stamp cards, point rules & voucher perks"` (BM: *"Kad setem digital, mata ganjaran & baucar"*).
  - `NFC Claim Alerts`: `"Instant chime & alert when stands are tapped"` (BM: *"Bunyi loceng & amaran bila stand diimbas"*).
  - Every description is concise (<45 characters), fits on one line without truncation, and clearly communicates the merchant benefit.

- **Apple-Style Human Outcome Copywriting (Growth & Marketing Subtitles)**:
  - Replaced technical catalog jargon with business outcome value propositions:
  - `NFC Marketplace`: `"Order official acrylic counter stands & bundles"` (BM: *"Tempah stand akrilik rasmi & pakej perkakasan"*).
  - `Google Reviews Integration`: `"Turn walk-ins into 5-star Google ratings"` (BM: *"Tukar pelanggan walk-in kepada ulasan 5-bintang"*).
  - `Onboarding Setup`: `"Brand logo, welcome message & store banner"` (BM: *"Logo kedai, ucapan aluan & sepanduk jenama"*).
  - `Risev Academy & Video Guides`: `"Quick video playbooks to maximize repeat visits"` (BM: *"Video panduan pantas gandakan pelanggan setia"*).

- **Sleek Docked Support FAB & Clearance**:
  - The global WhatsApp support button (`💬 Need Help?`) in `_layout.tsx` is docked cleanly at `bottom: 82, right: 16` (just above the 56px bottom tab bar) with a compact pill format (`paddingVertical: 9, paddingHorizontal: 15`).
  - Completely eliminates content obstruction while remaining 100% accessible to merchants.
  - Generous bottom scroll clearance (`paddingBottom: 160`) ensures full comfortable scrolling.

---

## 22. Edit Store Profile Standardisation (`app/(merchant)/edit-profile.tsx`)

- **Full Screen Focus & Navigation De-cluttering**:
  - Hides the bottom tab bar (`tabBarStyle: { display: 'none' }`) and the floating WhatsApp FAB on `edit-profile` route.
  - Eliminates overlap conflicts where the FAB previously covered phone and target inputs.
- **Apple Pure White Sticky Header**:
  - Pure White `#FFFFFF` sticky header with hairline divider (`#F1F5F9`).
  - Left: Clean back navigation link (`< Profil` / `< Profile`, `14.5px PlusJakartaSans_700Bold #000000`).
  - Center: Headline `"Sunting Profil Kedai"` / `"Edit Store Profile"` (`16px PlusJakartaSans_800ExtraBold #000000`).
  - Right: Tactile Pure Black capsule pill `[ ✓ Simpan ]` (`#000000`, gold checkmark, `#FFCC00` 12.5px bold text, live spinner when saving). No need to scroll to the bottom of the page to save.
- **Hero Storefront Live Preview Card (`heroCard`)**:
  - Full-width banner preview frame (`145px` height, `borderRadius: 14`, border `#E2E8F0`) with translucent camera chip `[ 📷 Tukar Banner ]` (`rgba(0,0,0,0.72)`).
  - Overlapping squircle avatar logo (`68×68px`, `borderRadius: 18`, 3px white border, shadow) with Risev Yellow `#FFCC00` camera badge.
  - Live preview metadata: real-time store name, category badge pill, and address snippet.
  - Micro-reassurance note: `"Pratonton langsung profil kedai yang dilihat oleh pelanggan."`
- **Apple Inset Grouped Sections (`groupedCard`)**:
  - **Group 1: Store Identity (`IDENTITI KEDAI`)**:
    - Store Name (squircle input with storefront icon).
    - Business Category (`categorySelectCard` — Option 1):
      - Replaced legacy 6 flat chips with an executive Apple Category Selector Card displaying the active category with its custom icon, background pill, category name, and industry group.
      - Tapping the card opens `<AllCategoriesModal mode="merchant" selectedCategoryId={selectedCategoryId} />` (Option 2 Implementation):
        - Tailored for merchant context: Replaces customer marketplace copywriting ("XX merchants") with rich bilingual business scope descriptions (e.g., Barber: *"Gunting rambut, janggut & dandanan lelaki"*, Cafe: *"Kopi, pastri, kek & sarapan santai"*).
        - Apple Inset Grouped cards with clean hairline dividers across 5 industry groups.
        - Active radio button indicator with Pure Black `#000000` circle and Risev signature gold `#FFCC00` checkmark plus `[ DIPILIH ]` / `[ SELECTED ]` micro-badge on the active store category.
        - Preserves customer mode compatibility for customer exploration pages.
      - Automatically maps the sub-category (`dessert`, `cafe`, `barber`, etc.) to the base database category (`food`, `beauty`, etc.) via `mapSubCategoryToBase()` while saving `sub_category` and `sub_category_name` in `metadata`.
    - Structured Full Address & Postcode:
      - Street Address (Jalan / Lot / Unit) squircle input with location pin icon.
      - 2-Column row: 5-Digit numeric Postcode (Poskod) with mail icon + City / Area (Bandar) with business icon.
      - State (Negeri) squircle input with map icon.
      - Automatically formats `getFullAddress()` (`{address}, {postcode} {city}, {state}`) to synchronize with storefront preview, PocketBase `description`, and `store_locations`.
  - **Group 2: Contact & Notifications (`HUBUNGAN & NOTIFIKASI`)**:
    - Business Email with helper: *"Digunakan untuk ringkasan bil, laporan bulanan, dan notifikasi keselamatan."*
    - Phone Number with helper: *"Nombor rasmi kedai untuk pertanyaan pelanggan dan resit digital WhatsApp."*
  - **Group 3: Business Goals & Loyalty (`SASARAN BISNES & KESETIAAN`)**:
    - Monthly Sales Goal with black `RM` currency badge + helper: *"Menetapkan penanda aras kemajuan pada papan pemuka hasil bulanan anda."*
    - Customer Win-Back Alert / Had Amaran Pelanggan Sepi (Minimalist & Compact Standard Form Row):
      - Clean label row: `"Customer Win-Back Alert"` / `"Had Amaran Pelanggan Sepi"` with subtle right metadata: `"Default: 30 days"` / `"Piawaian: 30 hari"`.
      - Conforms 100% to Risev standard `inputFieldWrapper` (matching `Monthly Sales Goal`, `Phone Number`, etc.):
        - Left icon: `Ionicons name="time-outline"` (`#64748B`, 17px).
        - Direct numeric input (`keyboardType="numeric"`).
        - Inline unit label: `"Days"` / `"Hari"`.
        - Integrated micro-stepper capsule: Quiet, Apple-grade `[ − | + ]` squircle pill right inside the input field wrapper (tactile 26×26px touch targets, increments/decrements in 5-day intervals, 7–180 days).
      - Compact micro-chips row:
        - Sleek horizontal chips: `[ 14d (F&B) ]  [ 30d ★ ]  [ 60d ]  [ 90d ]`.
        - Height 24px, quiet `#F1F5F9` background, turns Pure Black `#000000` with Risev Gold `#FFCC00` text when selected.
      - Standard 1-line helper text: *"Customers without visits in this period will be flagged for re-engagement perks."*
      - Perfectly balanced visual rhythm that eliminates visual bulk while preserving both stepper and 1-tap shortcut functionality.
      - Synchronized with `merchants.inactive_threshold_days` in PocketBase and powers the "Pelanggan Sepi" filter tab in `customers.tsx`.
  - **Group 4: Daily Operating Hours (`WAKTU OPERASI HARIAN`)**:
    - Inset card with Monday - Sunday schedule.
    - Each row contains day name, Open/Closed toggle with Risev Yellow track, and compact time input or disabled `"Tutup"` badge.
  - **Group 5: Store Map & GPS Location (`LOKASI PETA & GPS`)**:
    - Header with Pure Black `[ ⌖ Kesan Lokasi GPS ]` button (`#000000`, gold navigation icon, white text).
    - 2-column Latitude & Longitude inputs.
    - Leaflet interactive map with custom grayscale styling and yellow pin marker.
- **Redundant Bottom Action Bar (`bottomActionsRow`)**:
  - Cancel button (`#FFFFFF`, border `#E2E8F0`, grey text) + Primary Save button (`#000000`, height 48px, `#FFCC00` checkmark & white text) at the bottom for natural closure on mobile.

### 23. Branch Management Redesign & Standardisation (`app/(merchant)/branches.tsx`)
- **Design Paradigm**: **Konsep A ("Apple Inset Grouped Standard")** — Aligned with `profile.tsx` and `edit-profile.tsx`.
- **Structural Improvements & Clean Layout Canvas**:
  - **Removed Bleed & Clutter**: Eliminated the jarring dark header bleed (`#050505`) and the heavy stacked dark promotional banners (`Multi-Branch Engine` & `Brand-Wide Outlets Summary`). Replaced with a unified pure light canvas (`#F8FAFC`).
  - **Full-Screen Immersion & Overlap Elimination**:
    - Bottom merchant navigation tab bar suppressed via `CustomMerchantTabBar` route check in `app/(merchant)/_layout.tsx` (`currentRoute === 'branches'`), ensuring complete vertical view real estate.
    - Floating customer support WhatsApp FAB hidden on `/branches` route to prevent button collisions with registered outlet action cards.
  - **Apple Pure White Sticky Header**:
    - Edge-to-edge top bar (`backgroundColor: '#FFFFFF'`, border bottom `#F1F5F9`, `zIndex: 30`, safe area insets).
    - Left: Quiet tactile back button `[ < Profil ]` / `[ < Profile ]` (`#000000`, 14.5px bold) returning to `/(merchant)/profile`.
    - Center: Bold, centered screen title `"Pengurusan Cawangan"` / `"Branch Management"` (16px `PlusJakartaSans_800ExtraBold`, `#000000`).
    - Right: Pure Black action capsule `[ + Tambah ]` / `[ + Add ]` (`#000000`, Risev Gold `#FFCC00` icon and text, 12.5px ExtraBold, radius 999) launching the Add Branch modal.
- **Executive Brand KPI Summary Card (The Rule of Three)**:
  - Clean light card (`#FFFFFF`, border `1px solid #E2E8F0`, radius 20, subtle elevation).
  - Header Row:
    - Left: Pure Black business icon squircle (`#000000`, Risev Gold `#FFCC00` icon) + Merchant Brand Name (dynamic from `merchants.name` or HQ branch) + active location count subtitle.
    - Right: Quota badge pill `[ X / Y Cawangan ]` (with infinity `∞` symbol for Business/Enterprise tier).
  - 3-Column Metrics Grid (Clean divider-separated columns):
    - `JUMLAH JUALAN`: Aggregated gross sales in RM across all registered branches.
    - `JUMLAH STAMP`: Combined loyalty stamps issued brand-wide.
    - `STAF BERTUGAS`: Total active staff count across all outlets.
  - Multi-Branch Revenue Distribution Track:
    - Horizontal segmented progress bar dynamically rendered with curated grayscale + Risev Gold palette (`['#000000', '#FFCC00', '#475569', '#94A3B8', '#CBD5E1']`).
    - Color dot legend displaying percentage distribution per outlet.
- **Section Header & Registered Outlet Cards**:
  - Section Header: `"SENARAI CAWANGAN"` with black count pill `[ N ]` (gold text) and a refresh icon button.
  - Apple Inset Outlet Card Architecture (`#FFFFFF`, border `1px solid #E2E8F0`, radius 20):
    - Card Header: Branch icon squircle (Pure Black with gold icon for HQ, clean light for branch outlets) + outlet name + amber `[ HQ / UTAMA ]` badge + city/area subtitle.
    - Quick Action Buttons: Squircle Edit button (`Feather name="edit-2"`) and subtle danger Delete button (`Feather name="trash-2"`) for secondary branches.
    - **Apple Unified Grouped Inset Box (`unifiedInsetGroup` — Pilihan 1 Implementation)**:
      - Replaced legacy fragmented box-inside-box stacking and isolated pills with a single, sleek unified inset container (`backgroundColor: '#F8FAFC'`, border `#E2E8F0`, `borderRadius: 16`, hairline dividers):
      - **Row 1 (Location & Contact)**:
        - Interactive address link: Location pin icon + full address (or subtle clickable `+ Tetapkan alamat cawangan` / `+ Set outlet address` placeholder opening edit modal) + chevron icon.
        - Manager & official phone row: `👤 Pengurus: {name}` · `📞 {phone}` in a neat horizontal metadata line.
      - *Hairline Divider (`#E2E8F0`)*
      - **Row 2 (Hardware & Review Integrations)**:
        - Clean Smart Stands badge: `[ ⚡ {N} Stand Aktif ]` (displays active count instead of cryptic raw serial numbers; tapping pops up a clean alert list of assigned stand serials).
        - Google Review pill: Amber pill `[ ★ Google Review ↗ ]` (direct URL launcher) or quiet `[ + Google Review ]` shortcut.
      - *Hairline Divider (`#E2E8F0`)*
      - **Row 3 (Customer Onboarding Link & Touchpoints)**:
        - Left: Link icon + title `"Pautan Onboarding"` / `"Customer Onboarding"` + subtitle `"Pendaftaran NFC & Kod QR"`.
        - Right: 2 compact tactile buttons — Pure Black pill `[ 📋 SALIN ]` / `[ 📋 COPY ]` (Risev Gold `#FFCC00` text) + Squircle `[ 🔲 QR ]` code button.
    - 4-Column Live Performance Strip (Bottom hairline divider):
      - 4 balanced columns: `Staf`, `Pelawat` (Footfall), `Jualan` (Sales), and `Stamp` with vertical separators.
- **Branch Manager Selection from Staff Management**:
  - Replaced legacy blind manual text input with an interactive **Apple Staff Manager Picker**:
  - **Unified Staff Aggregation**: Fetches active staff members across `/api/risev/merchant/staff`, `merchant_staff` collection, and registered app users (`users`), automatically including the Store Owner (`👑 Owner`).
  - **Selected Manager Card & Quick Chips**:
    - Trigger card displaying manager initials avatar, name, role badge (`OWNER` or role title), and official phone number.
    - Horizontal quick-selection chips for 1-tap switching between staff members.
    - Auto-populates the branch contact phone number when a staff member with a registered phone is selected.
  - **Full Staff Picker Modal (`StaffPickerModal`)**:
    - Bottom sheet modal listing all registered staff members with role descriptions, contact numbers, and gold checkmark indicators.
    - Includes option to toggle manual/custom name input (`+ Tulis Nama Manual`) for external managers not registered in staff management.
- **Bottom Primary CTA**:
  - Solid Pure Black capsule button `[ + Tambah Cawangan Baru ]` (`backgroundColor: '#000000'`, Risev Gold `#FFCC00` icon and text, height 54, radius 16) at the bottom of the scroll view.
### 24. Staff Management Redesign & Standardisation (`app/(merchant)/staff.tsx`)
- **Design Paradigm**: **Konsep A ("Apple Inset Team Hub")** — Harmonised with `profile.tsx`, `edit-profile.tsx`, and `branches.tsx`.
- **Structural Improvements & Clean Layout Canvas**:
  - **Removed Bleed & Clutter**: Eliminated the legacy dark bleed overlay (`#050505` box) and sticky split headers. Adopted the standard Pure Light canvas (`#F8FAFC`).
  - **Full-Screen Immersion & Overlap Elimination**:
    - Bottom merchant navigation tab bar suppressed via `CustomMerchantTabBar` route check in `app/(merchant)/_layout.tsx` (`currentRoute === 'staff'`).
    - Customer support WhatsApp floating FAB suppressed on `/staff` route, ensuring complete zero-obstruction view of staff cards and action buttons.
  - **Apple Pure White Sticky Header**:
    - Edge-to-edge top bar (`backgroundColor: '#FFFFFF'`, border bottom `#F1F5F9`, `zIndex: 10`, shadow elevation).
    - Left: Tactile back button `[ < ]` returning to `/(merchant)/profile` with screen title `"Pengurusan Staf"` / `"Manage Staff"` and subtitle `"Hab Pasukan & Operasi"` / `"Team Hub & Operations"`.
    - Right: Pure Black action capsule `[ + Tambah Staf ]` / `[ + Add Staff ]` (`#0F172A`, Risev Gold `#FFCC00` icon, white text) that triggers the Apple Add Staff Modal.
- **Executive Team KPI Summary Card (The Rule of Three)**:
  - Clean inset card (`#FFFFFF`, border `#E2E8F0`, `borderRadius: 20`, subtle elevation):
    - `JUMLAH STAF` / `TOTAL STAFF`: Total registered team members.
    - `SEDANG BERTUGAS` / `ON DUTY`: Live count with green dot indicator (`#16A34A`) and roster status note.
    - `KOMISEN BULANAN` / `COMMISSION`: Aggregated month-to-date staff commission in RM with active billing month label.
- **Apple Segmented Control Tab Bar**:
  - Inset segmented bar (`backgroundColor: '#F1F5F9'`, `borderRadius: 14`, padding 4, border `#E2E8F0`):
    - 4 balanced tabs:
      1. `Pasukan` / `Team` (`Ionicons name="people"`)
      2. `Prestasi` / `Rankings` (`Ionicons name="trophy"`)
      3. `Komisen` / `Commission` (`Ionicons name="cash"`)
      4. `Kebenaran` / `Permissions` (`Ionicons name="shield-checkmark"`)
    - Zero text truncation on any mobile screen width.
    - Active tab highlighted in Pure White with soft shadow and bold dark text.
- **Apple Inset Grouped Staff Cards (`staffCard`)**:
  - Clean card container (`#FFFFFF`, border `#E2E8F0`, `borderRadius: 18`, padding 16, shadow elevation):
    - **Top Row**:
      - High-res avatar with camera overlay badge (tapping triggers photo upload/sync).
      - Staff name, dynamic customer rating pill (`★ X.X (N)`), amber branch badge (`#FEF3C7` / `#B45309`), designation role badge, and employment type pill (`Full-Time` / `Part-Time`).
      - Right: 1-Tap Attendance Toggle Pill:
        - `Bertugas` (green dot, light green background `#DCFCE7`, chevron icon) vs `Cuti` (amber dot, light amber background `#FEF3C7`, reason code e.g. `Cuti (MC)`, refresh icon).
    - **Middle Row**:
      - Official phone number with phone icon.
      - Commission model pill (`10% Komisen` or `RM5.00/job`).
      - Data privacy polish: Automatically suppresses internal generated shadow emails (e.g. `shadow_staff_...`), displaying only genuine staff emails when present.
    - **Bottom Action Bar**:
      - Hairline divider with 3 tactile action buttons:
        - `[ ✏️ Sunting ]`: Opens Edit Profile & Compensation Tier Modal.
        - `[ 🛡️ Had Kuasa ]`: Quick shortcut to Permissions tab.
        - `[ 🗑️ Padam ]`: Triggers custom Remove Staff Confirmation Modal.
- **Dedicated Apple Add Staff Modal (`addStaffModalVisible`)**:
  - Replaces the legacy 50%-height form pinned to the screen top.
  - Dedicated pop-up modal featuring:
    - Pure Black header pill with Risev Gold person-add icon.
    - Outlet assignment horizontal chip selector (`All Branches (HQ)` + registered branch outlets).
    - Formatted phone number input with call icon and auto-focus.
    - Optional staff full name input.
    - Action buttons: Cancel and `[ + Daftar Staf ]` with loading spinner.
- **Performance & Rankings Tab Standardisation (Konsep A — "Apple Inset Podium & Unified Filter")**:
  - **Eliminated Navy Bleed Card**: Removed the dark `#1E293B` spotlight card completely, restoring 100% adherence to Risev's Pure Light canvas (`#F8FAFC`).
  - **Zero Duplication**: Eliminated the redundant top performer duplicate card. Rank #1 now prestigiously leads the leaderboard directly as the Champion Hero Card.
  - **Executive Metric Strip (`perfExecutiveCard`)**:
    - Compact pure white card with mini gold trophy pill (`#FEF3C7`, `#B45309`), active timeframe tag, and 3 clean columns: `COP` (stamps issued), `JUALAN` (RM gross volume), and `DILAYAN` (customers served) with hairline dividers.
  - **Unified Filter Controls (`perfFilterCard`)**:
    - Replaced the 2 bulky stacked filter rows with:
      - Apple Timeframe Segmented Control (`Hari Ini`, `Minggu`, `Bulan Ini`, `Semua`).
      - Minimalist Sort Chips row: `[ 🏷️ Cop ]`, `[ 💰 Jualan (RM) ]`, `[ 👥 Pelanggan ]` with tactile dark selection state.
  - **Champion Hero Podium Card (`championCard`)**:
    - Prestigious Apple Inset Card (`#FFFFFF`, border `#FDE68A`, soft golden shadow).
    - Top pill badge: `[ 👑 #1 STAF TERBAIK ]` / `[ 👑 #1 TOP PERFORMER ]` (`#FEF3C7` / `#B45309`).
    - 48x48 avatar with `#FFC700` gold ring border and mini `[ 1 ]` badge.
    - Staff name, star rating pill, branch badge, and role title.
    - 3-metric achievement strip: Stamps Issued, Sales Handled (RM), and Customers.
  - **Rankings #2+ Cards (`perfStaffCard`)**:
    - Clean white cards with `🥈 #2`, `🥉 #3`, `#4+` pills, avatar, branch, star rating, stamps, and sales metrics.
    - Security audit chevron preserved for any staff flagged by Fraud & Unusual Activity Guard.
- **Commission Tab Standardisation (Konsep A — "Apple Fintech Ledger & Executive Payout Strip")**:
  - **Executive Payout Strip (`commExecutiveCard`)**:
    - Compact pure white Apple Inset Card (`#FFFFFF`, border `#E2E8F0`, rounded 20px, soft elevation).
    - Top row: Mini wallet badge (`#FEF3C7`, `#B45309`), titles, and **Apple Month Navigator Capsule (`monthNavRow`)** (`‹ Okt 2026 ›`) with tactile month switcher.
    - 4-Column Financial Metric Strip (`commExecutiveStrip`): `SERVIS` (completed jobs), `JUALAN` (RM gross volume), `KOMISEN` (RM total due in `#059669`), and `TERTUNGGAK / DIBAYAR` with color-coded alerts.
  - **Quick Status Filter Chips (`commFilterChipsRow`)**:
    - Instant 1-tap filtering: `[ Semua (X) ]`, `[ ⏳ Belum Bayar (Y) ]`, and `[ ✓ Selesai (Z) ]` with counts.
  - **Apple Inset Staff Ledger Cards (`commStaffCard`)**:
    - Profile row: Initials avatar (`#F8FAFC`, border `#E2E8F0`), bold name, `[ Tetap ]` / `[ Sambilan ]` employment pill, and formula pill (`⚡ 10% daripada harga servis` / `💵 RM 5.00 tetap`).
    - Status pills: `[ ✓ Selesai Dibayar ]` (emerald `#DCFCE7`), `[ ⏳ Belum Bayar ]` (amber `#FEF3C7`), or `[ RM 0.00 ]`.
    - Inner 3-column metric grid (`commInnerMetricsGrid`): Servis Siap, Jualan Staf, Komisen Layak with hairline dividers.
    - Smart action bar:
      - Pending balance highlighted in amber with high-contrast tactile button `[ 💵 Tanda Selesai Bayar ]` (`#059669` / `#050505`).
      - Settled state displays a clean confirmation note: `✓ Semua bayaran bagi bulan [Bulan] telah selesai.`
- **Staff Management UX & Flow Refinements (Mobile Optimization)**:
  - **Contextualized KPI Card**: Moved the top `executiveKpiCard` (`TOTAL STAFF`, `ON DUTY`, `COMMISSION`) to be rendered exclusively within the `Team` tab. Reclaims ~90px of vertical viewport space on Rankings, Commission, and Permissions tabs.
  - **Top-Down Filter Causality (Rankings Tab)**:
    - Reordered the layout hierarchy so the **Unified Filter Capsule (`perfFilterCard`)** sits at the top of the tab directly under the tab switcher.
    - Placed the **Executive Metric Strip (`perfExecutiveCard`)** directly below the filter, ensuring users immediately recognize that changing the timeframe updates the metrics.
    - Eliminated the redundant `perfPeriodTag` (*[ This Month ]*) and `championPeriodPill` (*[ This Month ]*), completely resolving triple-badge repetition.
  - **Multi-Branch Competition Filter (`branchFilterScroll`)**:
    - Automatic horizontal chip selector (`[ Semua Cawangan ]`, `[ Cawangan 1 ]`, etc.) rendered when merchant has registered outlets, enabling per-branch leaderboard analysis.
  - **Interactive Champion Hero Card**:
    - Wrapped in an interactive card with active opacity feedback and direct tap-to-manage capabilities.
- **Permissions View**:
  - Fully preserved and visually aligned with Apple Inset card styling:
    - Granular staff permission toggles (Financial Analytics, WhatsApp Blasts, Rewards, CRM stamp adjustments, Store Profile).
    - Fraud & Unusual Activity Guard with alert thresholds.

---

### 25. Rewards & Loyalty Studio Redesign (Konsep A: "Apple Wallet Studio & Daylight Loyalty Hub")
- **Route**: `app/(merchant)/rewards.tsx`
- **Design Philosophy**: Adheres strictly to the Risev "Rule of Three" (Pure White `#FFFFFF`, Pure Black `#050505`/`#0F172A`, Risev Gold `#FFCC00`) on a daylight canvas (`#F8FAFC`). Replaces dark carnival ticket aesthetics with an executive Apple Wallet & Daylight Loyalty Studio.
- **Architectural Enhancements**:
  1. **Daylight Studio Header (`headerRow`)**:
     - Removed the legacy 210px pitch-black bleed (`top: -30, height: 210, backgroundColor: '#050505'`).
     - Pure `#0F172A` title with daylight back button (`#FFFFFF` squircle, border `#E2E8F0`, subtle shadow) and Risev Logo (`tintColor: '#050505'`).
  2. **Compact Loyalty Modules Status Capsule (`programModuleCapsule`)**:
     - Replaced the 220px-tall bright yellow billboard (`modulesConfigCard`) with an Apple Inset dual-capsule status container (`64px` height).
     - Live module indicators for `Stamps` (emerald green `#10B981`) and `Points` (amber `#D97706`) with active toggle switches.
     - Preserves full validation logic ensuring at least one loyalty engine remains active.
  3. **Apple Segmented Tab Switcher (`segmentedTabBar`)**:
     - Replaced the pitch-black capsule pill bar with an Apple Segmented Control (`#F1F5F9` background, `#FFFFFF` active tab card with micro-shadow, `#0F172A` active bold typography).
     - Smooth 1-tap switching between `Katalog Ganjaran`, `Reka Bentuk Kad`, `Mata & Tahap`, and `Birthday`.
  4. **The Boarding Pass Reward Card (Shared Architecture from Image 2 / `app/nfc.tsx`)**:
     - Menggunakan seni bina format **Boarding Pass Ticket** yang sama seperti paparan pelanggan di `app/nfc.tsx`:
       - **(1) Jalur Jenama Menegak Kiri (`boardingPassBrandBand`, 44px)**: Latar belakang mengikut warna jenama kedai (`merchant.onboarding_primary_color` / `pwa_brand_color`). Teks diputarkan `-90°` memaparkan nama kedai dalam huruf besar tebal dan subteks `REWARD PASS`.
       - **(2) Badan Utama Putih Tulen (`boardingPassMainBody`)**: Latar belakang `#FFFFFF` dengan padding kemas:
         - *Baris Atas*: Lencana sedia tebus `[ 🎁 Ready to redeem ]` (`#FFFBEB`, border `#FDE68A`, teks `#B45309`) + tag jenis `[ FREE ITEM ]` / `[ DISCOUNT ]`.
         - *Baris Tengah*: Label mikro `YOUR REWARD` (huruf besar `#9CA3AF`), tajuk ganjaran hitam pekat `#111827` (`PlusJakartaSans_800ExtraBold`), deskripsi slate `#6B7280`. (Nota: Progress bar hanya dipaparkan pada paparan pelanggan di onboarding/NFC seperti yang disyaratkan).
         - *Baris Bawah*: Lencana sumber ganjaran (Setem/Mata) + status stok di sebelah kiri, dipadankan dengan butang tindakan squircle Apple iOS `[ ✏️ Sunting ]` dan `[ 🗑️ Padam ]` di sebelah kanan.
       - **(3) Tiang Berlubang Tiket (`boardingPassPerforationCol`, 18px)**: Takuk potongan separa bulat atas & bawah berlatar kanvas `#F8FAFC` berserta garisan putus-putus berlubang putih (*dashed line*).
       - **(4) Stub Jenama Kanan (`boardingPassRightStub`, 100px)**: Latar belakang warna jenama kedai, avatar bulat putih (`52×52px`) mengandungi logo rasmi kedai, dan nama kedai dalam huruf besar tebal berpusat di bawah logo.
  5. **Modal Live Customer Voucher Previews Refined (Daylight Studio Stage)**:
     - Both `modalVisible` and `showInlineCreateModal` wrap the preview card inside a dedicated Daylight Studio Stage (`#F8FAFC`, `borderRadius: 20`, border `#E2E8F0`).
     - Refined proportions: Left band `38px`, center body `flex: 1` (~200px), right stub `82px` with a `44px` circular logo frame.
     - Resolved button clipping: The bottom row cleanly houses `[ 💳 STAMP REWARD ]` and `[ Use Voucher ➔ ]` with over 40px of clearance, ensuring zero clipping or text wrapping on narrow mobile modal dialogs.
     - Cutout notch color matches `#F8FAFC`, creating crisp, realistic circular ticket cutouts.
  6. **WhatsApp FAB Suppression**:
     - Updated `app/(merchant)/_layout.tsx` to hide the global floating WhatsApp FAB on `/rewards`, resolving touch and visual collisions with bottom controls and cards.
  7. **Zero Backend Disruption**:
     - 100% backend synchronization with PocketBase `loyalty_programs`, `rewards`, and `birthday_rewards`.
     - Zero TypeScript errors (`npx tsc --noEmit` = 0).
  8. **Customer Vouchers Page (`app/(customer)/vouchers.tsx`) Synchronized**:
     - Upgraded the customer active/history voucher cards list from the legacy pitch-black card (`#0B0F17`) to the standardized 4-part **Boarding Pass Reward Pass** architecture:
       - Left brand vertical strip (`44px`) with rotated store name & `REWARD PASS`.
       - Pure white body (`#FFFFFF`) with status tags, `YOUR REWARD` uppercase label, bold title, subtitle, source badge, expiry date, and `Use Voucher ➔` CTA button.
       - Ticket cutout perforation column (`18px`) with dashed line and pure white cutout notches.
       - Right brand stub (`100px`) with white circle logo (`52px`) and bold store name.
     - Automatically derives brand color from `merchant.onboarding_primary_color` / `pwa_brand_color` / `brand_color`.

---

### 26. Card Design Studio Sub-Tabs Optimization (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (`activeTab === 'card_design'`)
- **Context & Motivation**:
  - Sebelumnya, penyuntingan kad setem digital (`card_design`) memaparkan semua tetapan (aturan setem, tamat tempoh, had belanja minimum, pilihan ganjaran tebusan, imej latar depan & belakang, palet warna kad/setem/fon, dan pemilih ikon setem kustom) dalam satu lajur menegak yang sangat panjang (>1,300px tinggi).
  - Ini menyebabkan *scroll fatigue* yang ketara dan menyukarkan peniaga melihat pratonton langsung kad 3D di bahagian atas semasa membuat pengubahsuaian warna atau ikon.
- **Architectural Solution — 3 Apple Inset Studio Sub-Tabs**:
  - Diletakkan terus di bawah pratonton kad 3D langsung (`cardFlipContainer`) menggunakan Apple Inset Segmented Control (`#F1F5F9`, border `#E2E8F0`, `borderRadius: 14`):
    1. **Aturan (`cardSubTab === 'rules'`)**:
       - Tetapan teras kad: Jumlah setem yang diperlukan (2–30 setem dengan butang `−` / `+`), tempoh tamat kad (hari), toggle had belanja minimum (`RM`) dan input jumlah belanja minima.
       - Pemilih ganjaran penamat (Completion Reward selector) berstatus aktif.
    2. **Warna & Ikon (`cardSubTab === 'colors'`)**:
       - Sistem warna 3-dalam-1: Latar belakang kad (Card Background Color), bulatan slot setem (Stamp Slot Color), dan warna fon/teks (Font / Text Color) dengan palet pratetap pantas dan input kod Hex tersuai.
       - Pemilih ikon setem tersuai: Grid 6 ikon popular (`star`, `checkmark`, `heart`, `trophy`, `gift`, `flame`) berserta pemilih warna ikon setem.
    3. **Imej / Artwork (`cardSubTab === 'images'`)**:
       - Pengurus muat naik imej latar tersuai: Bahagian depan kad (*Front Face Artwork*) dan bahagian belakang kad (*Back Face Artwork*).
       - Pratonton visual mini dengan butang padam serta kotak tip resolusi cadangan (1000 × 600 px).
- **Universal Single-Tap Action Bar**:
  - Butang utama simpan `[ ✓ Simpan Reka Bentuk ]` (`saveSubmitBtn`, latar belakang `#000000`, ikon dan teks `#FFCC00`, `borderRadius: 16`) diletakkan di luar suis sub-tab tepat di bawah kandungan aktif setiap sub-tab.
  - Peniaga boleh menekan simpan dengan serta-merta tanpa perlu menatal jauh ke bawah.
- **Verification**:
  - 100% lulus semakan jenis TypeScript (`npx tsc --noEmit` = 0).
  - Semua pengendali sedia ada (`flipCard`, `setRequiredStamps`, `setExpiryDays`, `setEnableMinSpend`, `setMinSpendAmount`, `setLinkedRewardId`, `handlePickCardBg`, `handlePickCardBgBack`, `handleSaveCardConfig`) dipelihara sepenuhnya tanpa sebarang perubahan skema pangkalan data PocketBase.

---

### 27. Stamp Rules Separation & Card Design Streamlining (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx`
- **Context & Motivation**:
  - Logik aturan cop (bilangan cop, tempoh luput kad, had belanja minimum, dan pautan ganjaran tamat) sebelum ini tersumbat di bawah tab *Reka Bentuk Kad*.
  - Ini bercanggah dengan prinsip *separation of concerns*, di mana *Points Rules* mempunyai tab khususnya sendiri (`points_tiers`).
  - Pengguna mencadangkan agar *Stamp Rules* diasingkan sebagai tab tersendiri, menjadikan tab *Card Design* 100% fokus kepada estetika visual kad sahaja.
- **Architectural Implementation**:
  1. **Apple Segmented Tab Switcher with Horizontal Scroll**:
     - Ditukar kepada bekas `ScrollView horizontal` dengan `showsHorizontalScrollIndicator={false}` dan `segmentedTabBarScroll` (`#F1F5F9`, border `#E2E8F0`, `borderRadius: 14`).
     - Menyokong 5 tab tersusun kemas tanpa terhimpit atau terpotong pada skrin telefon sempit (iPhone SE hingga Pro Max):
       - `Reward` (`catalogue`) — *bersyarat mengikut `enablePoints`*
       - `Stamp Rules` (`stamp_rules`) — *bersyarat mengikut `enableStamps`*
       - `Card Design` (`card_design`) — *bersyarat mengikut `enableStamps`*
       - `Points Rules` (`points_tiers`) — *bersyarat mengikut `enablePoints`*
       - `Birthday` (`birthday`)
  2. **Dedicated Tab 2: `Stamp Rules` (`stamp_rules`)**:
     - **Executive Hero Banner Card** (`#0F172A`, border hairline emas & putih):
       - Memaparkan rumusan langsung aturan: `{requiredStamps} Cop = 1 Ganjaran`, nama ganjaran yang dipautkan, tempoh tamat tempoh kad, dan syarat belanja minimum.
     - **Total Stamps Required Card**:
       - Pilihan bilangan cop: 5, 8, 10, 12, 15 cop dengan selector aktif.
     - **Card Expiry & Lifecycle Card**:
       - Quick chips (30d, 60d, 90d, 180d, 365d) berserta input hari tersuai.
     - **Minimum Spend Requirement Card**:
       - Toggle aktif/tidak berserta quick presets RM (5, 10, 15, 20, 30) dan input RM tersuai.
     - **Completion Reward Link Card**:
       - Selector baucar daripada katalog berserta butang `[ + Create New ]` inline modal.
     - **Dedicated Save Action**:
       - Butang pantas `[ ✓ Simpan Aturan Cop ]` (`saveSubmitBtn`).
  3. **Streamlined Tab 3: `Card Design` (`card_design`)**:
     - 100% fokus kepada visual:
       - **Live 3D Flip Card Studio** di bahagian atas dengan butang pusing `[ Tap card to flip ]`.
       - **2 Sub-Tabs Sahaja**:
         1. `Colors & Icons` (`'colors'`): Warna kad, warna slot cop, warna fon teks, pilihan 6 ikon cop (*Star, Check, Heart, Trophy, Gift, Flame*), dan warna ikon cop.
         2. `Artwork` (`'images'`): Muat naik imej depan & belakang kad berserta panduan resolusi.
       - Butang simpan visual khusus: `[ ✓ Simpan Reka Bentuk Kad ]`.
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.
  - Pengekalan logik pensuisan tab automatik apabila modul setem atau mata dihidupkan/dimatikan.

---

### 28. Apple 2-Row Compact Segmented Tab Bar (Full Width, Zero Scroll) (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx`
- **Context & Motivation**:
  - Dengan penambahan tab ke-5 (`Birthday`), bar tab berasaskan teks 1 baris sebelum ini melimpah (*overflow*) dan menyebabkan tab `Birthday` terpotong di sebelah kanan, memerlukan peniaga menatal secara mendatar.
  - Peniaga meminta susunan tepat: `Reward` ➔ `Card Design` ➔ `Stamp Rule` ➔ `Point Rule` ➔ `Birthday`, dan mahukan kesemua 5 tab kelihatan penuh (*full width*) serentak tanpa perlu skrol.
- **Implementation (Pilihan 2: Apple Dual-Deck Micro-Icon + Typography)**:
  - Menggantikan `ScrollView` mendatar dengan **Apple Inset Full-Width Container** (`compactTabBarContainer`):
    - `flexDirection: 'row'`, `backgroundColor: '#F1F5F9'`, `borderRadius: 16`, `border: 1px solid #E2E8F0`.
    - Setiap tab mempunyai `flex: 1` membahagikan ruang skrin 100% sama rata pada sebarang resolusi telefon (iPhone SE, standard, hingga Pro Max).
  - **Seni Bina Setiap Tab (`compactTabBtn`)**:
    - **Baris 1 (Ikon Mikro 16px)**: Ikon Apple iOS berkontras tajam (`#0F172A` apabila aktif, `#64748B` apabila tidak aktif):
      1. `Reward`: `gift` / `gift-outline`
      2. `Card Design`: `card` / `card-outline`
      3. `Stamp Rule`: `checkbox` / `checkbox-outline`
      4. `Point Rule`: `star` / `star-outline`
      5. `Birthday`: `balloon` / `balloon-outline`
    - **Baris 2 (Teks Mikro 10px)**: Teks padat dengan `numberOfLines={1}`, `adjustsFontSizeToFit`, dan `minimumFontScale={0.85}`:
      - `Reward` · `Card Design` · `Stamp Rule` · `Point Rule` · `Birthday`
  - **Kesan Aktif (*Active State*)**:
    - Pill putih terapung (`#FFFFFF`) dengan bayang mikro iOS (`shadowRadius: 3`, `elevation: 2`), ikon hitam pekat `#0F172A`, dan teks `PlusJakartaSans_800ExtraBold`.
- **Verification**:
  - 100% lulus semakan jenis TypeScript (`npx tsc --noEmit` = 0).
  - Kesemua 5 tab kini kelihatan sepenuhnya dalam satu pandangan (*at a single glance*) dengan sifar skrol mendatar.

---

### 29. Stamp Rules Studio Refinement — Risev Standard Design System (Rule of Three Compliance) (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (`activeTab === 'stamp_rules'`)
- **Context & Motivation**:
  - Berdasarkan audit visual terperinci daripada tangkapan skrin pengguna:
    1. **Teks Terpotong (*Text Truncation*)**: Subteks pada kad 10 cop *"Industry benchm..."* terpotong pada skrin telefon sempit.
    2. **Pertindihan Lencana (*Badge Collision*)**: Lencana `POPULAR ★` di bucu atas bertembung dengan lencana tanda semak (*checkmark pill*).
    3. **Penyimpangan Sistem Warna (*Color System Violation*)**: Penggunaan rona biru luar sistem (`#0284C7`, `#F0F9FF`), hijau (`#34D399`), dan navy gelap (`#0F172A`) yang melanggar piawaian **Rule of Three** Risev.
    4. **Butang Terkeluar Skrin (*Clipped CTA*)**: Tajuk *"Stamp completion reward description"* yang terlalu panjang menolak butang `+ Create New` sehingga terpotong menjadi `+ Create N...`.
- **Architectural Enhancements & Rule of Three Implementation**:
  1. **Executive Hero Banner Card (Risev Yellow `#FFCC00` Signature Standard)**:
     - **Latar Belakang Kuning Emas Rasmi (`#FFCC00`)**: Sentiasa gunakan warna kuning `#FFCC00` khusus untuk kad ringkasan aturan (*hero highlight card*) seperti ini (bukan untuk semua kad, kad input/tetapan kekal putih).
     - **Kontras Hitam Pekat (`#000000`)**:
       - Tipografi tajuk 16.5px `PlusJakartaSans_800ExtraBold` berona `#000000` dengan `adjustsFontSizeToFit` (menghalang teks *"10 Stamps = 1 Free Reward"* terpotong).
       - Squircle ikon reben: Latar belakang **Pure Black `#000000`** dengan ikon emas `#FFCC00`.
       - Lencana Luput (*Expiry Badge*): Pil **Pure Black `#000000`** dengan teks emas bold `#FFCC00`.
       - Syarat Belanja Minima: Label `rgba(0, 0, 0, 0.65)` dan nilai bold `#000000`.
  2. **3-Pillar Squircle Stamp Goal Cards (5, 10, 15 Cop)**:
     - **Sifar Pemotongan Teks**: Subteks dipendekkan secara elegan kepada *"Fast Goal / Cepat Capai"* (5), *"Recommended / Pilihan Ramai"* (10), dan *"High Value / Nilai Tinggi"* (15) dengan ketinggian seragam `minHeight: 116`.
     - **Penyelesaian Pertindihan Lencana**: Lencana `★ POPULAR` diposisikan secara simetri di bahagian tengah atas kad (`top: -10, left: 0, right: 0, alignItems: 'center'`), menghapuskan sepenuhnya pertembungan dengan lencana tanda semak di sudut kanan atas.
     - **Pilihan Aktif**: Menggunakan **Pure Black `#000000`**, nombor putih pekat `#FFFFFF`, label cop **Risev Gold `#FFCC00`**, dan tanda semak hitam berlatar belakang `#FFCC00`. Kad tidak aktif kekal **Pure White `#FFFFFF`** dengan sempadan `rgba(0, 0, 0, 0.08)`.
  3. **Completion Reward Header & Unclipped CTA**:
     - Tajuk dipendekkan kepada *"Completion Reward / Ganjaran Lengkap Cop"* dengan `flexShrink: 1`, menghalang sebarang tolakan butang ke luar skrin.
     - Butang `Create New` dibina semula sebagai pil **Pure Black `#000000`** dengan ikon tambah `#FFCC00` dan teks putih bold `#FFFFFF` yang 100% tampak penuh pada sebarang resolusi.
  4. **Active Completion Reward Spotlight Card (Penyingkiran Biru #0284C7)**:
     - Menggantikan rona biru dengan **Pure White `#FFFFFF`** permukaan berkontras, sempadan hitam pekat `2px solid #000000`, squircle ikon **Pure Black `#000000`** dengan ikon **Risev Gold `#FFCC00`**, dan lencana status **Pure Black `#000000`** dengan teks **`DIPILIH ✓`** berona `#FFCC00`.
  5. **Cip Pratetap Tempoh Luput & Belanja Minima**:
     - Kesemua cip pratetap yang dipilih menggunakan **Pure Black `#000000`** dengan teks **Risev Gold `#FFCC00`**, manakala cip tidak aktif menggunakan `#F8FAFC`.
  6. **Simplifikasi Subteks Ganjaran (*Reward Subtitle Simplification*)**:
     - Ayat panjang `"Reward for completing [Nama Kad]..."` yang sebelum ini terpotong (*truncated*) telah dipermudahkan kepada **`Stamp Card Reward`** (EN) / **`Ganjaran Kad Cop`** (BM).
     - Dikemas kini merentasi paparan kad katalog ([rewards.tsx](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/rewards.tsx)), pratonton modal, halaman pelanggan ([slug.tsx](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/b/%5Bslug%5D.tsx)), dan hook penyelarasan backend ([sync_program_reward.pb.js](file:///Users/fazlihadir/Desktop/risev%20app/waly/pb_hooks/sync_program_reward.pb.js)).
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.
  - Paparan menepati 100% falsafah **Rule of Three** Risev: *Pure White `#FFFFFF`, Pure Black `#000000`, dan Risev Gold `#FFCC00`*.

---

### 30. Native Full-Page Form Standard (Eliminating Modal Overlays Entirely) (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (`modalVisible` & `showInlineCreateModal`)
- **Context & Motivation**:
  - Sebelum ini, borang *Create Reward* dan *Edit Reward* menggunakan komponen `<Modal>` React Native. Pada pelayar Web (React Native Web / Chrome), `<Modal>` menyuntik portal berlatar belakang kelabu gelap dan kotak terapung (*floating dialog box* berpusat) dengan `maxWidth: 440px` dan `borderRadius: 28px`.
  - Ini menghalang borang daripada memenuhi 100% skrin seperti halaman penuh (*full page*).
- **Architectural Enhancements (Pure Full-Page Architecture via `StyleSheet.absoluteFill`)**:
  1. **Penyingkiran Penuh `<Modal>`**:
     - Komponen `<Modal>` dimansuhkan sepenuhnya daripada aliran borang *Create / Edit Reward*.
     - Digantikan dengan paparan halaman penuh tulen `{showInlineCreateModal && (<View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', zIndex: 9999 }]}> ... </View>)}`.
     - **Hasil**: Sifar latar belakang gelap, sifar kotak terapung bertirai, 100% memenuhi skrin (*edge-to-edge*) pada Web, iOS, dan Android.
  2. **Native Full-Page Top Navigation Bar**:
     - **Kiri**: Butang Apple Back Arrow (`←`) berbentuk bulatan `#F8FAFC` dengan sempadan halus `rgba(0,0,0,0.08)`.
     - **Tengah**: Tajuk berkontras tajam `Create Reward` / `Edit Reward` (17px `PlusJakartaSans_800ExtraBold`) berserta sub-label kategori.
     - **Kanan**: Butang pangkah (*close icon*) untuk fleksibiliti navigasi segera.
  3. **Full-Height Scrollable Form**:
     - Menghapuskan kekangan `maxHeight: 520px` agar borang dapat berkembang secara natural dengan `paddingBottom: 130` untuk mengelakkan pertembungan dengan bar bawah.
  4. **Sticky Bottom Action Bar**:
     - Bar tindakan melekat (*sticky action bar*) di bahagian bawah skrin dengan latar putih dan bayang halus ke atas.
     - Butang Batal (*Cancel*) di sebelah kiri (pil `#F8FAFC`) dan Butang Utama Cipta/Simpan (*Risev Primary Black Pill*) di sebelah kanan: `#000000`, teks putih bold `#FFFFFF`, dan ikon tanda semak emas `#FFCC00`.
     - Sentiasa kelihatan tanpa memerlukan pengguna skrol ke bahagian paling bawah untuk menghantar borang.
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.
  - Paparan kini 100% halaman penuh tulen (*real full page*) tanpa sebarang kotak modal terapung.

---

### 31. Two-Sided Points Loyalty Loop & Cash Redemption Standard (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (`activeTab === 'points_tiers'`)
- **Database Schema Enhancements (`pb_migrations/1782807076_add_points_redemption_to_loyalty_programs.js`)**:
  - `points_per_rm` (number, default: 100): Bilangan mata ganjaran yang diperlukan untuk potongan tunai RM 1.00 pada bil.
  - `min_redeem_points` (number, default: 0): Had minima mata yang perlu dikumpul pelanggan sebelum layak memulakan penebusan.
  - `max_redeem_percent` (number, default: 0): Had peratusan potongan maksimum daripada jumlah bil (cth: 50% bil, 0 = tanpa had).
- **Executive Design Architecture (Risev Rule of Three: `#FFCC00`, `#000000`, `#FFFFFF`)**:
  1. **Executive Yellow Hero Summary Card (`#FFCC00`)**:
     - Memaparkan kitaran penuh kesetiaan (*Two-Sided Loyalty Loop*) secara serentak di bahagian atas tab:
       - **Kiri (Kadar Dapat Mata)**: Kotak hitam `#000000` dengan nombor putih `RM [X] = 1 Mata`.
       - **Kanan (Kadar Tebus Tunai)**: Kotak hitam `#000000` dengan nombor putih `[Y] Mata = RM 1.00 Diskaun`.
       - Cip mikro status `AKTIF` berlatar hitam dan teks kuning `#FFCC00`.
       - Kapsul tip cerapan pintar di bawah kad kuning untuk penerangan segera.
  2. **Card 1: Kadar Dapatkan Mata (Points Earning Rate)**:
     - Latar putih `#FFFFFF` pada kanvas siang `#F8FAFC`.
     - Pilihan pantas (*Quick chips*): `RM 1 = 1 Mata`, `RM 2 = 1 Mata`, `RM 5 = 1 Mata`, `RM 10 = 1 Mata`.
     - Medan input kustom dengan imbuhan `RM [ ] = 1 Mata`.
     - Kad simulasi kiraan kutipan mata kaunter masa nyata (`RM 20`, `RM 50`, `RM 100`).
  3. **Card 2: Nilai Penebusan Mata / Claimable Points (Points Redemption Value)**:
     - Mengkonfigurasi nilai mata kepada potongan tunai ringgit.
     - Pilihan pantas (*Quick chips*):
       - `100 Mata = RM 1.00` (★ Disyorkan Standard Malaysia / 1 pt = 1 sen).
       - `50 Mata = RM 1.00` (Ganjaran Tinggi / 1 pt = 2 sen).
       - `20 Mata = RM 1.00` (Sangat Lumayan / 1 pt = 5 sen).
       - `200 Mata = RM 1.00` (Ekonomi / 1 pt = 0.5 sen).
     - Input kustom: `[ ★ ] [ Y ] = RM 1.00 Diskaun`.
     - **Kalkulator Simulasi Penebusan Masa Nyata**:
       - Mengira nilai potongan serta-merta untuk `100 Mata`, `500 Mata`, dan `1,000 Mata` berasaskan kadar yang ditaip oleh peniaga.
  4. **Card 3: Syarat & Had Perlindungan Penebusan (Redemption Safeguards)**:
     - **Minima Mata Untuk Tebus**: Cip pilihan `0 (Tiada Minima)`, `50 Pts`, `100 Pts`, `200 Pts` + input kustom.
     - **Had Maksima Diskaun Bil (%)**: Cip pilihan `Tanpa Had (100%)`, `Maks 50% Bil`, `Maks 30% Bil`, `Maks 20% Bil` + input kustom.
     - **Butang Simpan Utama**: Pil `#000000` penuh dengan ikon tanda semak emas `#FFCC00` dan teks putih `Simpan Semua Aturan Mata`.
  5. **Kad Nasihat Strategi (Strategy Tip Card)**:
     - Panduan standard industri Malaysia bagi membantu peniaga memilih nisbah mata yang seimbang antara kepuasan pelanggan dan margin keuntungan kedai.
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.
  - Persistensi data lengkap ke koleksi PocketBase `loyalty_programs`.

---

### 32. Context-Aware Reward Creation & Clean Non-Pro Catalog Decoupling (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (`modalVisible` & `showInlineCreateModal`)
- **Issue Solved**:
  - Peniaga percuma (*Free Plan*) atau peniaga tanpa katalog servis dalam talian sebelum ini terpaksa melihat kad ungu berstatus terkunci (`Link Product or Service — PRO`) atau teks ralat kosong (`No active products or services found in your catalog`). Ini memberi persepsi bahawa ganjaran tidak boleh digunakan tanpa melanggan PRO atau tanpa mengisi katalog terlebih dahulu.
- **Architectural Enhancements (Context-Aware Logic)**:
  1. **Logik Kontekstual `Free item` (Item Percuma)**:
     - Disediakan medan **Nama Item Percuma / Perincian** (`applicable_items_text`), cth: `"1x Kopi O Ais"`, `"Karipap 3 Ketul"`, atau `"Servis Cuci Luar"`.
     - Peniaga Free tidak perlu memautkan ke pangkalan data servis/produk.
     - Kad ungu PRO dan pautan katalog disembunyikan sepenuhnya bagi peniaga Free / tiada katalog bagi mengelakkan kekusutan visual.
  2. **Logik Kontekstual `Discount` (Diskaun % atau RM)**:
     - Disediakan pemilih **Skop Diskaun (`discount_scope`)**:
       - **Pilihan 1: `Semua Pesanan (Seluruh Bil)` (`'all'`)** *(Lalai / Default)*:
         - Diskaun dipotong daripada keseluruhan bil kaunter tanpa sebarang kekangan katalog.
       - **Pilihan 2: `Item / Menu Khusus` (`'specific'`)**:
         - Medan teks manual untuk peniaga Free memasukkan syarat terma item (cth: `"Sah untuk minuman sahaja"`, `"Menu sarapan sahaja"`).
  3. **Penyembunyian Bersyarat Kad Katalog (`isPro && merchantServicesList.length > 0`)**:
     - Kad pautan katalog PRO hanya dipaparkan jika peniaga adalah pelanggan PRO **DAN** mempunyai senarai produk aktif dalam katalog.
     - Tiada lagi kotak amaran kosong atau kekangan yang mengelirukan peniaga asas.
  4. **Penyelarasan Merentas Sistem (Customer Wallet & NFC Counter)**:
     - **Kad Baucar Pelanggan (`app/(customer)/vouchers.tsx`)**: Memaparkan terma item secara langsung pada tiket (cth: *"Percuma: Kopi O Ais"*, *"Sah untuk: Minuman Sahaja"*, *"Sah untuk semua pesanan"*).
     - **Skrin Kaunter NFC (`components/NfcClaimModal.tsx`)**: Staf kaunter serta-merta melihat tag penunjuk item (cth: `📌 Item: Kopi O Ais` atau `📌 Sah: Minuman Sahaja`) semasa imbasan kaunter.
- **Database Schema (`pb_migrations/1782807077_add_applicable_items_text_and_scope_to_rewards.js`)**:
  - `applicable_items_text` (text): Teks manual nama item percuma atau terma item khusus.
  - `discount_scope` (select: `["all", "specific"]`): Skop pemakaian diskaun.
  - Penyelarasan snapshot metadata pada cangkuk `stamp_complete.pb.js`.
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.

### 33. Points Studio Zero-Scroll Apple Sub-Tabs Architecture (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (`activeTab === 'points_tiers'`)
- **Issue Solved**:
  - Pada paparan mudah alih (cth: lebar 417px pada skrin telefon), tab Aturan Mata sebelum ini memaparkan Kad Hero, Kad 1 (Kadar Kutipan Mata), Kad 2 (Kadar Penebusan Diskaun Tunai), Kad 3 (Syarat Minima & Had Maksima Diskaun Bil), butang Simpan, serta Kad Tip Strategi dalam satu aliran menegak yang sangat panjang. Ini memaksa peniaga membuat terlalu banyak penatalan (*excessive vertical scrolling*) semata-mata untuk mengkonfigurasi atau mencari butang simpan.
- **Architectural Enhancements**:
  1. **Kad Hero Kuning Eksekutif Dwi-Fungsi Interaktif**:
     - Mengekalkan kad warna kuning tema Risev (`#FFCC00`) di bahagian atas sebagai ringkasan pantas aliran mata.
     - Kotak **DAPAT MATA** (kiri) dan **TEBUS DISKAUN** (kanan) di dalam Kad Hero kini boleh ditekan (`TouchableOpacity`).
     - Menekan kotak secara langsung mengaktifkan sub-tab yang berkaitan berserta penunjuk sempadan putih dan dot kuning aktif.
  2. **Bar Sub-Tab Tersegmen Gaya Apple (Segmented Sub-Tabs)**:
     - Diletakkan kemas tepat di bawah Kad Hero dengan latar `#F1F5F9`, bucu `borderRadius: 14`, dan 3 butang fokus:
       - **Sub-Tab 1: `Dapat Mata` (`'earn'`)**: Ikon `arrow-down-circle`, mengandungi konfigurasi belanja per mata, pilihan pantas (RM 1, RM 2, RM 5, RM 10), dan simulasi kutipan kaunter.
       - **Sub-Tab 2: `Tebus Tunai` (`'redeem'`)**: Ikon `pricetag`, mengandungi konfigurasi mata per RM 1.00 diskaun, pilihan pantas (100 Pts standard, 50 Pts ganjaran tinggi, 20 Pts, 200 Pts), dan jadual simulasi nilai mata.
       - **Sub-Tab 3: `Syarat & Had` (`'limits'`)**: Ikon `shield-checkmark`, mengandungi had minima penebusan mata (0, 50, 100, 200) serta had siling potongan bil (Tanpa Had, 50%, 30%, 20%) dan Kad Tip Strategi Penebusan Tunai.
  3. **Butang Simpan Terbina Dalam Setiap Sub-Tab (`renderSaveButton()`)**:
     - Setiap sub-tab dilengkapi dengan butang simpan `[ ✓ Simpan Aturan Mata ]` (`#000000`, teks putih, ikon emas `#FFCC00`) tepat di bawah kad masing-masing.
     - Peniaga boleh menyimpan terus aturan sebaik sahaja mengubah nilai tanpa perlu menatal ke bawah.
  4. **Pengalaman Pengguna (Zero Unnecessary Scrolling)**:
     - Seluruh konfigurasi kini muat dengan selesa pada skrin peranti mudah alih tanpa perlu skrol panjang.
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.

### 34. Apple & FinTech Executive Refinement of Points Loyalty Loop (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (`activeTab === 'points_tiers'`)
- **Visual Polish & Ergonomic Upgrades**:
  1. **Kad Hero Kuning Eksekutif `#FFCC00` (`borderRadius: 22`, Bayang Lembut Mewah)**:
     - **Header Kad**: Ikon *sparkles* dalam squircle hitam, tajuk tebal `PlusJakartaSans_800ExtraBold`, serta lencana status langsung dengan dot hijau bercahaya `● AKTIF` (`#10B981` + teks `#FFCC00`).
     - **Dua Kotak Sentuh Interaktif (Dapat Mata & Tebus Diskaun)**:
       - Menggantikan sempadan putih tebal yang kasar dan dot terapung dengan reka bentuk kad Apple Wallet berprofil tinggi.
       - **Keadaan Aktif**: Kotak hitam tulen `#000000` dengan sempadan tajam 2px, bayang taktil terangkat, dan mikropil emas `[ ✓ EDIT ]` (`#FFCC00`, teks hitam 8.5px) di sudut kanan atas.
       - **Keadaan Tidak Aktif**: Kotak gelap grafit berkelegapan tinggi `rgba(0,0,0,0.88)` dengan teks `TEKAN` / `TAP` halus, tipografi jelas, dan interaksi 1-sentuhan yang pantas.
     - **Jalur Kitaran Lengkap Hitam Tulen (`Pure Black Loop Banner`)**:
       - Menggantikan kotak perang kusam legap dengan kapsul hitam `#000000` berkontras tinggi berlatarkan kuning Risev.
       - Memaparkan lencana squircle emas `repeat` dan ayat aliran langsung dengan nilai dinamik yang ditonjolkan dalam teks tebal emas `#FFCC00`.
  2. **Grid Pilihan Pantas Seimbang 2x2 (`2x2 Preset Grid`)**:
     - Menggantikan paparan preset berbalut tak sekata (`flexWrap`) dengan grid 2x2 yang simetri (`flex: 1` per kad).
     - Preset terpilih menggunakan latar hitam tulen `#000000`, teks emas `#FFCC00`, dan penerangan kontras jelas.
  3. **Medan Input Angka Bernilai Tinggi**:
     - Input berketinggian standard 52px dengan bucu squircle `borderRadius: 14`, sempadan `#CBD5E1`, lencana ikon (RM atau Bintang), dan pil penunjuk sisi hitam-kuning `= 1 Mata` atau `= RM 1.00 Diskaun`.
  4. **Jadual Simulasi Baucar Tunai Gaya Apple Wallet**:
     - Memaparkan cip diskaun tunai hijau zamrud `[ -RM 1.00 ]` / `[ -RM 5.00 ]` (`#ECFDF5` + `#047857`) dan cip mata emas kaunter `[ +20 Mata ]` (`#FFFBEB` + `#B45309`).
  5. **Butang Simpan Taktil Eksekutif**:
     - Butang hitam tulen `#000000` berketinggian 52px, bucu `borderRadius: 16`, ikon semak bulat emas `#FFCC00`, dan teks tebal putih 14px.
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.

---

### 35. Tab Permanence & Loyalty Engine Decoupling Architecture (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx`
- **Context & Motivation**:
  - Apabila suis enjin kesetiaan `Points` ditutup (*Off*), sebelum ini tab `Reward` (`catalogue`) hilang dari bar segmen Apple 5-tab, menyebabkan peniaga yang hanya mengaktifkan kad cop (*Stamps*) tidak dapat melihat, mencipta, atau menguruskan ganjaran cop mereka.
- **Architectural Principle (Core Tab Permanence vs Dynamic Engine Tabs)**:
  1. **Tab Teras Kekal (Permanent Core Tabs - Tidak Pernah Hilang)**:
     - **`Reward`** (`catalogue`): Hub ganjaran kedai. Wajib sentiasa wujud kerana menyokong ganjaran kad cop (`STAMP REWARD`), ganjaran mata (`POINTS REWARD`), dan diskaun umum.
     - **`Card Design`** (`card_design`): Reka bentuk kad digital jenama kedai. Sentiasa boleh diakses bila-bila masa.
     - **`Birthday`** (`birthday`): Tetapan ganjaran hari lahir pelanggan. Sentiasa aktif.
  2. **Tab Enjin Bersyarat (Dynamic Engine-Governed Tabs)**:
     - **`Stamp Rule`** (`stamp_rules`): Ditadbir secara eksklusif oleh suis `Stamps`. Hanya hilang apabila `enableStamps === false`.
     - **`Point Rule`** (`points_tiers`): Ditadbir secara eksklusif oleh suis `Points`. Hanya hilang apabila `enablePoints === false`.
  3. **Peralihan Tab Selamat (*Safe Tab Fallback*)**:
     - Apabila `Points` dimatikan, hanya pengguna yang sedang berada di `points_tiers` akan beralih secara automatik ke tab `catalogue` (Reward). Pengguna yang berada di `catalogue` kekal di tab tersebut tanpa diganggu.
     - Apabila `Stamps` dimatikan, pengguna di `stamp_rules` beralih secara automatik ke tab `catalogue` (Reward).
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.
  - Apabila `Points` ditutup (*Off*): Bar tab memaparkan 4 tab (`Reward`, `Card Design`, `Stamp Rule`, `Birthday`) dengan tab `Reward` kekal 100% utuh.

---

### 36. Points Studio De-Cluttering & Apple FinTech Simplification (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (`activeTab === 'points_tiers'`)
- **Context & Motivation**:
  - Peniaga mendapati halaman *Point Rule* terlalu sarat (*crowded*) disebabkan kewujudan kotak berganda di dalam kad kuning, pertindihan navigasi antara kotak atas dan bar sub-tab di bawahnya, serta grid preset 2x2 yang memakan ruang menegak yang tinggi.
- **Implementation (Option 1: Apple FinTech Minimalist)**:
  1. **Sleek Slim Loop Hero Banner**:
     - Menggantikan kad kuning 195px bertingkat 3 dengan **Kad Formula Eksekutif Kompak (90px)** berlatarkan `#FFCC00`.
     - Kapsul hitam tulen `#000000` tunggal yang merumuskan kedua-dua belah kitaran kesetiaan secara simetri:
       `[ ⬇️ Kumpul: RM 1 = 1 Pt ]  ➔ (repeat) ➔  [ 🏷️ Tebus: 100 Pts = RM 1.00 ]`
     - Menghapuskan kotak sentuh berganda dan membiarkan bar sub-tab di bawahnya berfungsi sebagai satu-satunya pengawal tab yang sah.
  2. **Preset Pil 1-Baris Kompak (Single-Row Horizontal Segmented Pills)**:
     - Menggantikan grid 2x2 bertingkat (140px) dengan barisan pil sebaris kemas gaya Apple iOS (42px).
     - **Sub-tab Dapat Mata (`earn`)**: Pil pantas `[ RM 1 ] [ RM 2 ] [ RM 5 ] [ RM 10 ]`.
     - **Sub-tab Tebus Tunai (`redeem`)**: Pil pantas `[ 100 Mata (1¢) ] [ 50 Mata (2¢) ] [ 20 Mata (5¢) ] [ 200 Mata (0.5¢) ]`.
     - Keadaan terpilih menggunakan latar hitam `#000000` dengan tipografi emas Risev `#FFCC00`.
  3. **Penjimatan Ruang & Kelegaan Visual**:
     - Menjimatkan lebih 220px ruang menegak skrin.
     - Menghapuskan kekeliruan navigasi berganda (*dual-switching conflict*).
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.

---

### 37. Stand Merchant Reward Decoupling & Free/Discount Item Manual Entry (`app/(merchant)/rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (Form 1: `modalVisible` & Form 2: `showInlineCreateModal`)
- **Context & Motivation**:
  - Peniaga pakej Stand NFC (kuota tap sahaja, tanpa langganan PRO atau POS booking) tiada katalog servis/produk dalam `merchant_services`.
  - Sebelum ini, kewujudan seksyen *"Pautkan Produk Katalog (PRO Auto-Kira)"* memaparkan item pakej katering/servis besar secara mengelirukan dan tidak relevan untuk baucar kaunter kedai fizikal (cth: aiskrim kon, kopi, karipap).
- **Implementation (Option 1)**:
  1. **Pembuangan Blok Pautan Katalog PRO**:
     - Membuang seksyen *PRO Catalog Linking* daripada kedua-dua borang cipta/sunting ganjaran (`modalVisible` dan `showInlineCreateModal`).
     - Menghapuskan kekeliruan pemilihan produk katering dan membebaskan ruang borang.
  2. **Pengukuhan Input Manual Item (`applicable_items_text`)**:
     - **Item Percuma (`free_item`)**: Peniaga bebas menulis sebarang item/servis (cth: `1x Kon Aiskrim / Kopi Latte / Karipap 3 Ketul / Servis Cuci Luar`).
     - **Diskaun Khusus (`discount` + `specific`)**: Peniaga menetapkan item/syarat sah (cth: `Sah untuk minuman sahaja / Menu sarapan`).
     - Dilengkapi label jelas dan nota bantuan bahawa terma ini akan dicetak terus pada baucar pelanggan dan skrin semakan staf kaunter.
  3. **Kemaskini Pratonton Baucar Langsung (Live Boarding Pass Voucher Preview)**:
     - Keterangan baucar pada kad pratonton kedua-dua borang kini memaparkan teks item manual (`applicable_items_text`) secara dinamik dalam masa nyata sekiranya penerangan umum tidak diisi.
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.

---

### 38. Boarding Pass Color-Coded Vertical Spine & 10 Voucher Architecture (`theme/index.ts`, `rewards.tsx`, `vouchers.tsx`)
- **Routes**:
  - `theme/index.ts` (`getVoucherSpineTheme`)
  - `app/(merchant)/rewards.tsx` (Catalogue list card, Form 1 preview, Form 2 preview)
  - `app/(customer)/vouchers.tsx` (Customer Wallet Boarding Pass cards)
- **Context & Motivation**:
  - Sebelum ini, jalur tepi menegak (*vertical spine*) memaparkan nama peniaga yang sering kali terpotong (`RISEV OFFICIAL MERCHA...`). Memandangkan nama peniaga dan logo sudah sedia terpapar pada bahagian kanan kad (*Right Brand Stub*), ia adalah lewah (*redundant*).
  - Peniaga dan pelanggan memerlukan pengecaman visual serta-merta (*instant visual recognition*) untuk membezakan pelbagai kategori baucar (Free Item, Discount, BOGO, Happy Hour, Flash Sale, dll.) dengan identiti warna tiket penerbangan sebenar.
- **Implementation (Phase 1)**:
  1. **Enjin Tema Visual Berpusat (`theme/index.ts`)**:
     - Memperkenalkan `getVoucherSpineTheme(rewardType, title)` yang memetakan jenis dan kata kunci tajuk kepada 10 kod warna kurasi kontras tinggi:
       - `free_item` ➔ Emerald Green (`#059669`, teks: `FREE ITEM`)
       - `discount` ➔ Sunset Orange (`#EA580C`, teks: `DISCOUNT`)
       - `bogo` ➔ Crimson Ruby (`#E11D48`, teks: `BUY 1 FREE 1`)
       - `happy_hour` ➔ Royal Purple (`#7C3AED`, teks: `HAPPY HOUR`)
       - `flash_sale` ➔ Electric Amber (`#D97706`, teks: `FLASH SALE`)
       - `welcome_gift` ➔ Fresh Teal (`#0D9488`, teks: `WELCOME GIFT`)
       - `bring_friend` ➔ Electric Blue (`#0284C7`, teks: `BRING A FRIEND`)
       - `win_back` ➔ Velvet Rose (`#BE185D`, teks: `WE MISS YOU`)
       - `spend_save` ➔ Forest Green (`#15803D`, teks: `SPEND & SAVE`)
       - `festive` ➔ Luxury Gold (`#B45309`, teks: `FESTIVE PASS`)
  2. **Penggantian Jalur Tepi Boarding Pass Menyeluruh**:
     - Menghapuskan teks terpotong dan menggantikannya dengan teks tegak tebal `PlusJakartaSans_800ExtraBold #FFFFFF` yang bersih dan tidak terpotong.
     - Diselaraskan serentak di 4 lokasi:
       1. Kad katalog ganjaran peniaga (`rewards.tsx`).
       2. Kad pratonton langsung Borang 1 (`rewards.tsx`).
       3. Kad pratonton langsung Borang 2 (`rewards.tsx`).
       4. Kad dompet baucar pelanggan (`vouchers.tsx`).
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.

---

### 39. Phase 2: PRO Campaign Recipes Grid (8 Formula Pintar) & Upsell Paywall Integration (`theme/index.ts`, `rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (Form 1: `modalVisible` & Form 2: `showInlineCreateModal`)
- **Context & Motivation**:
  - Peniaga Stand NFC memerlukan aliran kerja asas (`free_item` & `discount`), manakala peniaga PRO memerlukan formula promosi siap-pakai untuk mengisi waktu lengang (*off-peak*), mencetuskan pembelian segera (*flash sale*), atau memanggil semula pelanggan lama (*win-back*).
  - Peniaga bukan PRO memerlukan pendedahan visual kepada kelebihan pelan berbayar (*growth flywheel*) dengan perlindungan paywall yang elegan.
- **Implementation (Phase 2)**:
  1. **Konfigurasi Formula Kempen Berpusat (`theme/index.ts`)**:
     - Memperkenalkan pemalar `PRO_CAMPAIGN_RECIPES` mengandungi 8 formula pintar:
       1. `bogo` (Buy 1 Free 1)
       2. `happy_hour` (Off-Peak 2pm - 5pm)
       3. `flash_sale` (Countdown 24h / 48h)
       4. `welcome_gift` (Hadiah Tap Pertama)
       5. `bring_friend` (Ganjaran Berdua)
       6. `win_back` (Pelanggan Sepi >30 Hari)
       7. `spend_save` (Belanja RM50 Jimat RM10)
       8. `festive` (Payday 25hb & Sambutan Pesta)
  2. **Grid Resepi 2-Kolum Bergaya Apple Inset Grouped**:
     - Dipaparkan tepat di bawah togol jenis ganjaran asas dalam Form 1 dan Form 2.
     - Lencana status dinamik: `[ 🔒 PRO ONLY ]` (untuk peniaga Stand) dan `[ PRO UNLOCKED ]` (untuk peniaga PRO).
     - Kad resepi interaktif (`minHeight: 82px`, `borderRadius: 14px`):
       - Latar putih `#FFFFFF` dengan ikon bertema warna khusus semasa belum dipilih.
       - Bertukar ke latar hitam pekat `#000000` dengan tipografi emas Risev `#FFCC00` dan teks putih semasa dipilih.
  3. **Tindakan Paywall & Pengisian Pintar 1-Sentuhan (*1-Click Smart Fill*)**:
     - **Peniaga Bukan PRO**: Sentuhan mana-mana satu daripada 8 kad membuka `UpgradeModal` secara serta-merta untuk memaparkan pakej naik taraf ke PRO.
     - **Peniaga PRO**: Sentuhan memilih formula, mengemas kini jenis asas (`free_item` / `discount`), mengisi cadangan teks dan nilai secara automatik, serta mengemas kini jalur warna Boarding Pass dan keterangan pada kad pratonton secara langsung dalam masa nyata.
- **Verification**:
  - `npx tsc --noEmit` melepasi semakan dengan **0 ralat**.

---

### 40. Phase 3: Dynamic Campaign Smart Controls & Live Preview Sync (`rewards.tsx`)
- **Route**: `app/(merchant)/rewards.tsx` (Form 1: `modalVisible` & Form 2: `showInlineCreateModal`)
- **Context & Motivation**:
  - Apabila peniaga PRO memilih mana-mana formula kempen pintar (cth: *Happy Hour*, *Flash Sale*, *Spend & Save*), mereka memerlukan tetapan pantas yang relevan (seperti slot waktu lengang atau jam undur) tanpa perlu menaip manual secara rumit.
- **Implementation (Phase 3)**:
  1. **Kad Kawalan Pintar Kempen Dinamik (`SmartCampaignControls`)**:
     - Dipaparkan tepat di antara grid kempen dan medan input jenis ganjaran dengan sempadan hitam berwibawa `#000000` (1.5px), bayang halus, dan lencana tag formula terpilih (cth: `OFF-PEAK`, `FOMO`, `HEMAT`).
     - Butang cepat `[ ✕ Batal Formula ]` untuk kembali ke ganjaran piawai Stand dengan satu sentuhan.
  2. **Kawalan Khusus Mengikut Resepi**:
     - **Happy Hour**:
       - *Quick Time Presets*: Pil masa pantas `[ 2:00 PM – 5:00 PM ] [ 3:00 PM – 6:00 PM ] [ 11:00 AM – 2:00 PM ]`. Sentuhan melaraskan `applicable_items_text` secara dinamik.
       - *Valid Days*: Pil segmen hari `[ Isnin – Khamis ] [ Isnin – Jumaat ] [ Setiap Hari ]` (latar `#000000` dengan teks emas `#FFCC00` semasa aktif).
     - **Flash Sale**:
       - *Urgency Duration*: Pil undur kilat `[ ⚡ 24 Jam ] [ ⚡ 48 Jam ] [ ⚡ 3 Hari ]` dengan penjelasan mengenai jam undur langsung (*live countdown*) pada baucar pelanggan.
     - **Spend & Save**:
       - Kad kalkulator penjimatan hijau lembut (`#F0FDF4`, sempadan `#BBF7D0`) yang memaparkan rumusan penjimatan dinamik `Belanja minima RM XX ➔ Jimat RM YY`.
     - **BOGO, Welcome Gift, Bring A Friend, We Miss You, Festive**:
       - Kotak panduan strategik Fresha (`#F8FAFC`, sempadan `#E2E8F0`) yang menerangkan sasaran automasi kempen.
  3. **Penyelarasan Kad Pratonton Masa Nyata**:
     - Perubahan parameter pintar mencerminkan jalur warna tiket, tajuk, dan keterangan baucar secara langsung dalam masa nyata.
- **Verification**:
---

### 41. Voucher Spine Harmonization to Merchant Brand Color
- **Files Modified**:
  - `theme/index.ts` (`getVoucherSpineTheme` enhanced with `brandColor` parameter & YIQ luminance text contrast)
  - `app/(merchant)/rewards.tsx` (Catalogue cards, Modal 1 live preview, and Modal 2 inline create live preview)
  - `app/(customer)/vouchers.tsx` (Customer voucher wallet cards)
- **Problem & Motivation**:
  - The vertical boarding pass spine previously used arbitrary category colors (e.g. green for free item, ruby for BOGO, purple for happy hour) which clashed with the right stub's merchant brand color, creating a visually noisy and mismatched card appearance.
  - Standardizing the vertical spine to the merchant's exact brand color creates an ultra-clean, unified, and cohesive branded boarding pass aesthetic where both left and right stubs celebrate the merchant's brand identity.
- **Solution & Architecture**:
  1. **Dynamic Theme Engine (`theme/index.ts`)**:
     - `getVoucherSpineTheme(rewardType, title, brandColor?)`: If `brandColor` is provided, `spineBg` seamlessly defaults to `brandColor`, while preserving the campaign category's vertical typography label (`FREE ITEM`, `BUY 1 FREE 1`, `HAPPY HOUR`, etc.).
     - Computes YIQ brightness contrast: light brand colors render `#0F172A` deep navy text, while dark/vibrant brand colors render crisp `#FFFFFF` white text with matching subtext opacity.
  2. **Synchronous Implementation Across 4 Touchpoints**:
     - Merchant Reward Catalogue List (`rewards.tsx`).
     - Modal 1 Creation/Edit Live Preview (`rewards.tsx`).
     - Modal 2 Inline Create Live Preview (`rewards.tsx`).
     - Customer Voucher Wallet Card List (`vouchers.tsx`).
- **Verification**:
  - Verified with `npx tsc --noEmit` yielding **0 errors**.

---

### 42. Copywriting Simplification & The Anti-Jargon Directive
- **Context & Motivation**:
  - Merchant feedback highlighted that marketing textbook acronyms such as "BOGO" (Buy One Get One), "FOMO Countdown", and "Basket Tier Incentive" are confusing, alienating, and unnatural to ordinary cafe, salon, and retail business owners.
  - The copywriting was overhauled to enforce crystal-clear, plain, conversational human phrasing.
- **Implemented Changes**:
  1. **`theme/index.ts` (`PRO_CAMPAIGN_RECIPES`)**:
     - `Buy 1 Free 1 (BOGO)` ➔ `Buy 1 Free 1` (Tag: `1+1 FREE`)
     - `Happy Hour (Off-Peak)` ➔ `Happy Hour` (Tag: `HAPPY HOUR`)
     - `Flash Sale (Countdown)` ➔ `Flash Sale` (Tag: `LIMITED TIME`)
     - `Welcome Gift (First Visit)` ➔ `Welcome Gift` (Tag: `NEW GUEST`)
     - `Bring A Friend` ➔ `Bring A Friend` (Tag: `WITH FRIEND`)
     - `We Miss You (>30 Days)` ➔ `We Miss You` (Tag: `COME BACK`)
     - `Spend & Save` ➔ `Spend & Save` (Tag: `SPEND & SAVE`)
     - `Payday & Festive Special` ➔ `Holiday & Payday Special` (Tag: `SPECIAL EVENT`)
  2. **`app/(merchant)/rewards.tsx`**:
     - `Tempoh Jam Undur (FOMO Countdown):` ➔ `Tempoh tawaran kilat:` (EN: `Limited-time deal duration:`)
     - `Basket Tier Incentive` ➔ `Spend & Save Summary` (BM: `Rumusan Belanja & Jimat`)
  3. **Multi-Agent Governance (`UI_UX_AGENTS.md`)**:
     - Added **"4. The Anti-Jargon & Plain Language Directive"** under Agent 5 (Apple-Style Copywriter) with a permanent Banned Jargon Table.
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

---

### 43. Elimination of Decorative Emojis & Eyebrow Heading Standardization
- **Context & Motivation**:
  - User feedback identified that emojis prefixing eyebrow headings (e.g., `🎫 LIVE CUSTOMER VOUCHER PREVIEW`, `💡`, `💰`) degrade the visual professionalism of the interface and conflict with native Apple iOS typography.
  - Section headers must remain purely typographic, uppercase, with subtle letter-spacing, and completely free of emojis or decorative stickers.
- **Implemented Changes**:
  1. **`app/(merchant)/rewards.tsx`**:
     - Stripped `🎫 ` from `Live Customer Voucher Preview` in both Form 1 (`modalVisible`) and Form 2 (`showInlineCreateModal`).
     - Removed `💡 ` and `💰 ` emoji prefixes from countdown, helper tips, and spend & save summary containers.
  2. **Multi-Agent Governance (`UI_UX_AGENTS.md`)**:
     - Embedded **Rule 5: Pure-Typography Section Heading Rule** into Section 1.3 and updated Agent 7's (Token Sentinel) Banned Pattern Matrix.
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

---

### 44. Birthday Rewards Studio Redesign (Complete Experience: Option A)
- **Route**: `app/(merchant)/rewards.tsx` (Tab 4: `birthday`)
- **Motivation & Philosophy**:
  - Birthday rewards represent a mandatory customer loyalty pillar for every Risev merchant (38%–52% redemption rate in retail/hospitality).
  - The previous screen was an uninspired blank form with no visual boarding pass preview and raw number inputs.
- **Implemented Architectural Enhancements**:
  1. **Top Automated Engine Status Banner**:
     - Highlights `AUTOMATED BIRTHDAY ENGINE` with an active pulsing status badge (`ALWAYS ACTIVE` `#ECFDF5` / `#10B981`).
     - Clarifies the value proposition: *"Turn Birthdays Into Guaranteed Visits"*.
  2. **Real-Time Live Customer Boarding Pass Ticket Preview**:
     - Exact replica of the customer's digital boarding pass ticket with the merchant's brand color vertical spine (`BIRTHDAY PASS` / `SPECIAL PASS`).
     - Shows dynamic gift title, validity window, celebration pill, perforation notches, and right brand stub with merchant logo.
  3. **3 Curated 1-Tap Presets (Zero Blank Slate Friction)**:
     - `Free Birthday Treat` (1x free drink, dessert, or service — 14 days validity).
     - `20% Birthday Discount` (20% off total birthday bill — 30 days validity).
     - `2 Bonus Stamps` (Directly credited to customer stamp card — 30 days validity).
  4. **Smart Validity Window Chips**:
     - Replaced raw text inputs with tactile Apple segmented chips: `[ 7 Days ]`, `[ 14 Days ]`, `[ 30 Days (Full Month) ]`.
  5. **Morning Delivery Schedule & Live Message Bubble Preview**:
     - Preset morning delivery time chips (`[ 09:00 AM ]`, `[ 10:00 AM ]`, `[ 12:00 PM ]`).
     - Live customer notification bubble preview demonstrating exact copy sent to customers on their birthday morning.
  6. **Zero Blank Slate Fallback**:
     - `fetchBirthdayReward` automatically populates turnkey defaults (`Free Birthday Treat`, 14 days) if no record exists yet, ensuring new merchants immediately see a live, ready-to-save pass.
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

### 44.1. 1-Tap Popular Presets: Removed per User Directive
- **Refinement**:
  - The `1-TAP POPULAR PRESETS` section was completely removed to achieve a clean, clutter-free configuration interface.
  - The form now flows seamlessly from the **Customer Birthday Boarding Pass** directly into the **Reward Mechanic** toggle (`Voucher Pass` vs `Bonus Stamps`), eliminating redundant UI elements and keeping all configuration direct and focused.
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

### 44.2. Voucher Validity Window: 3 Days Only Policy (Before, Ongoing, Next Day)
- **Business Rule & Loyalty Standard**:
  - Birthday vouchers in the Risev ecosystem are strictly valid for **3 days only**:
    1. **Before**: 1 day prior to birthday (anticipation & planning).
    2. **Ongoing**: Actual birthday celebration day.
    3. **Next Day**: 1 day after birthday (courtesy extension / final chance).
  - Replaced the arbitrary 7, 14, and 30-day preset chips with a connected 3-pillar executive visual widget:
    - Top badge: `3 DAYS ONLY` (solid black capsule).
    - Center pillar: `Ongoing` with balloon icon in executive black `#000000` + Risev yellow `#FFCC00` accent.
    - Flanking pillars: `Before` (arrow-back icon) and `Next Day` (arrow-forward icon).
  - Both the live **Customer Boarding Pass** and the **Customer Message Preview** reflect this exact 3-day window (`Valid for 3 days: Day before, Birthday, and Next day`).
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

### 44.3. Birthday Reward Gift Title: PRO Product & Service Catalog Selection
- **Feature & Workflow**:
  - Allows merchants with active **PRO** subscriptions to link real menu items (`merchant_services`) directly into the Birthday reward title and pass instead of typing freeform strings.
  - **PRO Header Trigger**:
    - Right of `OFFER / GIFT TITLE`, displays a badge button:
      - `PRO UNLOCKED`: `SELECT PRODUCT / SERVICE` with sparkles icon `#FFCC00`.
      - `NON-PRO`: `🔒 PRO ONLY` with lock icon `#B45309` (opens `UpgradeModal`).
  - **Inline Quick Horizontal Pills**:
    - Under the text input, displays a horizontal capsule list of services and products with icons, titles, and price badges (`RM35`).
    - 1-tap populates `title` (`Free ${item.name}`), `reward_value` (`${item.name} (RM${price})`), and customer notification message template.
  - **Linked Item Banner**:
    - Shows an active pill `Linked Item: [Name] (RM[Price])` with a clear `(x)` button to detach and revert to manual text input.
  - **Dedicated Full-Screen Catalog Modal (`BirthdayItemPickerModal`)**:
    - Supports real-time text search, category tags, duration display, and segmented filter tabs (`All Items` · `Services` · `Products`).
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

### 44.4. Zero Inline Text Bloat & On-Demand Help (?) Tooltip Standard
- **Design Problem & Solution**:
  - Permanently embedding 1–3 line explanatory sentences (`styles.helpText`) beneath every input field and toggle creates severe visual clutter ("serabut"), cognitive overload, and degrades executive scan density.
  - Replaced all permanent subtext with clean, unobtrusive **Question Mark Buttons** `(?)` (`help-circle-outline`, `13.5px`, `#94A3B8`) aligned next to section labels.
  - Tapping any `(?)` opens the executive **On-Demand Contextual Info Tooltip Modal** (`helpModalInfo`) with a crisp title, deep-dive explanation, and a high-contrast dismiss button ("Got It").
- **Implemented Screens**:
  - [app/(merchant)/rewards.tsx](file:///Users/fazlihadir/Desktop/risev%20app/waly/app/%28merchant%29/rewards.tsx) (Birthday tab: Status banner, Reward Mechanic, Offer / Gift Title, 3-Day Validity Window, and Morning Delivery Schedule).
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

### 44.5. Refined Airline Boarding Pass Customer Ticket Architecture
- **Root Cause of Clutter & Collision**:
  - The previous boarding pass ticket suffered from horizontal compression caused by a 44px rotated left spine, a 90px right stub, and multiple competing badges (`BIRTHDAY SPECIAL`, `BIRTHDAY GIFT`, `CELEBRATION GIFT`, and bottom `BIRTHDAY` tag).
  - This left only ~160px for the center content on mobile screens, causing the validity text `Valid: 3 Days (Before, Ongoing, Next Day)` to wrap into 6 cramped lines and collide underneath the `Use Pass ➔` button.
- **Refinement Implementation**:
  1. **Left Accent Bar (7px)**: Replaced the bulky 44px rotated spine with a sleek, rounded 7px brand-color vertical accent strip, freeing up ~37px of horizontal canvas.
  2. **Zero Badge Redundancy**: Unified multiple badges into a single, elegant pill (`[ 🎁 BIRTHDAY SPECIAL ]` / `[ ⭐ BIRTHDAY STAMPS ]`) and a micro status tag (`[ IN-STORE PASS ]` / `[ AUTO-CREDIT ]`).
  3. **Zero Text Wrapping & Collision**:
     - Validity text simplified to a clean single line: `Valid: 3 Days` (`#059669` green with `time-outline` icon).
     - Aligned horizontally opposite the black `[ Use Pass ➔ ]` CTA with ample margin, preventing any overlap or vertical stacking.
  4. **Crisp Right Tear-Off Stub**:
     - Circular merchant avatar badge with subtle shadow, merchant name (`numberOfLines={2}`), and a barcode `PASS` icon indicating physical counter redemption.
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

### 44.6. Apple Grouped List Drill-Down Configuration Standard (Image 1 Benchmark)
- **Design Philosophy**:
  - Eliminates "Box Inception" (nested cards inside grey container boxes with inline text inputs) in favor of modular, executive-grade iOS Settings style row cards with interactive drill-down chevrons (`›`).
- **Section Structure**:
  1. **Reward Type Row**:
     - Single white card (`borderRadius: 14`, `borderWidth: 1`, `#E2E8F0`).
     - Left: Label `Reward Type` + `(?)` info tooltip button.
     - Right: Capsule toggle `[ 🎁 Voucher ]  [ ⭐ Stamps ]`.
  2. **Gift Offer Row**:
     - Dedicated interactive row card with chevron (`›`).
     - Left: Rich media thumbnail (artisan ice cream / product image in rounded squircle `width: 52, height: 44, borderRadius: 10`) or bonus stamps badge.
     - Center: Primary item title (`Catering Aiskrim 300pax`, 14px bold) + Subtitle (`Linked menu item · RM850`, 12px `#64748B`).
     - Action: Opens `BirthdayItemPickerModal` (PRO menu catalog) or `showStampsPicker`.
  3. **Validity Window Row**:
     - Interactive row card with chevron (`›`).
     - Left: Calendar icon in squircle (`calendar-outline`, 24px).
     - Center: Primary value (`3 Days`, 14px bold) + Subtitle (`Day before · Birthday · Day after`, 12px `#64748B`).
     - Action: Opens `showValidityPicker` bottom sheet with quick 1-tap options (`3 Days (Recommended)`, `7 Days`, `30 Days`).
  4. **Send Schedule Row**:
     - Interactive row card with chevron (`›`).
     - Left: Clock icon in squircle (`time-outline`, 24px).
     - Center: Primary value (`09:00 AM`, 14px bold) + Subtitle (`Send on customer's birthday · Store local time`, 12px `#64748B`).
     - Action: Opens `showSchedulePicker` bottom sheet (`09:00 AM`, `10:00 AM`, `12:00 PM`).
  5. **Redemption Rules Row**:
     - Interactive row card with chevron (`›`).
     - Left: Document icon in squircle (`document-text-outline`, 24px).
     - Center: Primary value (`Standard rules`, 14px bold) + Subtitle (`Once per customer, per birthday year`, 12px `#64748B`).
     - Action: Opens `showRulesModal` bottom sheet detailing single redemption, counter QR verification, and auto-expiration safeguards.
  6. **Primary Save Action**:
     - Modern full-width black capsule button `[ Save Changes ]` (`height: 50`, `borderRadius: 9999`, bold white typography).
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

### 44.7. Points Loyalty Redesign: Unified Executive Feed (Image 1 Benchmark)
- **Route**: `app/(merchant)/rewards.tsx` (Tab 3: `points_tiers` / `Point Rule`)
- **Design Philosophy**:
  - Eliminates fragmented sub-tabs (`Earn Rate`, `Redeem Cash`, `Safeguards`) and heavy contrast yellow/black banners.
  - Consolidates all core loyalty mechanics into a clean, unified vertical feed of Apple Settings style modular white cards (`borderRadius: 16`, border `#E2E8F0`).
- **Pillar Sections**:
  1. **Earn Points Card**:
     - Squircle coin icon (`#FEF08A` yellow background).
     - Flat preset pills: `[ RM 1 ] [ RM 2 ] [ RM 5 ] [ RM 10 ]`.
     - Dual-metric split box (`Spend: RM 1` | `Earn: 1 Point`) separated by hairline vertical divider.
     - Drill-down sheet (`showEarnRateModal`) for custom decimal rates.
  2. **Redeem Value Card**:
     - Squircle gift icon (`#FEF08A` yellow background).
     - Dual-metric split box (`Points: 100 Pts` | `Discount Value: RM 1.00`).
     - Drill-down sheet (`showRedeemRateModal`) for instant 1%, 2%, or 0.5% cashback options.
  3. **Preview Example (Live Checkout Calculator)**:
     - Real-time interactive calculation using user test spend (default RM 100).
     - Creamy gold status strip (`#FEFCE8`) displaying:
       - `Points earned`: dynamic points based on spend.
       - `Discount value`: dynamic discount amount in RM.
       - `Reward rate`: instant percentage calculation (e.g. `1% of spending`).
  4. **Rules & Limits Card**:
     - Security shield squircle icon (`#F1F5F9`).
     - Drill-down sheet (`showPointsRulesModal`) for minimum redemption thresholds and max bill discount caps.
  5. **Primary Action**:
     - Full-width modern black capsule button `[ Save Changes ]` (`height: 52`, `borderRadius: 9999`, bold white `#FFFFFF`).
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

### 44.8. Subscription Header & Hero Cards Redesign (RiseV New Standard UI)
- **Route**: `app/(merchant)/subscription.tsx`
- **Design Philosophy**:
  - Eliminates the legacy pitch-black container block and negative margin sheet overlays in favor of **Pure Daylight Studio Clarity**.
  - Pairs a pure white daylight canvas with a high-prestige **Executive Black & Gold VIP Pass** and a **Daylight NFC Stand Squircle Card**, creating crisp contrast and professional scannability.
- **Components**:
  1. **Daylight Studio Pure White Header**:
     - Background: Pure White `#FFFFFF`, border bottom `1px solid #F1F5F9`.
     - Circle Daylight Close Button `(✕)` (`38×38px`, `#F8FAFC`, border `#E2E8F0`, black icon).
     - Title: `Subscription Plan` (`18px PlusJakartaSans_800ExtraBold`, `#0F172A`) + Subtitle `Manage store tier & quota` (`11px`, `#64748B`).
     - Right: Official RiseV logo (`@/assets/risev logo.png`, pure black tint).
  2. **Active Subscription Card (Clear White Compact Style + Dual-Bar Milestones)**:
     - Pure White `#FFFFFF` surface with subtle border `1px solid #E2E8F0` and diffuse elevation shadow.
     - Compact layout: padding reduced to `13px`, border radius `18px`.
     - Radiant yellow squircle (`#FFCC00`, `34×34px`, radius 10) with sparkle glyph.
     - Plan title (`PRO Plan` in bold `#0F172A`) + subtitle (`Executive VIP Membership` in `#64748B`).
     - Apple-style status capsule: `[ 🟢 ACTIVE VIP ]` in pastel mint (`#DCFCE7`, border `#86EFAC`, text `#15803D`).
     - **Dual Quota Milestones Box**:
       - Row 1: Customer Database (`${customerCount} / 300` or `Unlimited ♾️`).
       - Row 2: Monthly Bookings (`${monthlyBookingCount} / 30` or `Unlimited ♾️`).
     - Bottom row: Renewal date + interactive **`Usage Details ›`** triggering Apple-style Bottom Sheet with full feature breakdown (Customers, Bookings, Outlets, Staff, and Active Vouchers).
  3. **Daylight Stand Card with RiseV Yellow Accent (Card 2)**:
     - Pure White card (`#FFFFFF`, border `1px solid #E2E8F0`, `borderRadius: 18`).
     - Left: Signature RiseV Yellow squircle (`40×40px`, `#FFCC00`, `borderRadius: 12`) with black cart icon.
     - Title: `Don't have a Stand?` (`13.5px PlusJakartaSans_800ExtraBold`, `#0F172A`).
     - Subtitle: `Get RiseV NFC Bundle · Lifetime Quota` (`11px PlusJakartaSans_500Medium`, `#64748B`).
     - Right: High-contrast black pill button `[ Order ➔ ]` with gold arrow.
  4. **Explore Plans & Key Differences Table**:
     - Header Row: `Explore Plans` + `Compare benefits`.
     - Segmented Cadence Toggle: `#F1F5F9` capsule with active black pill for `Monthly` and `Annually (Save 20%)`.
     - Stacked Plan Selector Rows:
       - Starter (`RM 47` / `RM 38` /month): Radio unselected `⚪`, title & subtitle, dynamic pricing.
       - PRO (`RM 97` / `RM 78` /month): Radio selected `🔘`, RiseV yellow border `2px solid #FFCC00`, status tags (`Current` / `Popular`).
     - Key Differences Table:
       - Compact 6-row comparison table: Customer capacity (300 vs Unlimited ♾️), Booking engine (30/mo vs Unlimited), Business outlets (1 vs 5 Outlets), Staff accounts (Up to 5 vs 10 + Comm), Milestone loyalty (Standard vs All Engines 🎁), and Active vouchers (5 Max vs Unlimited).
- **Verification**:
  - Passed `npx tsc --noEmit` with **0 errors**.

---

### 53. Reward Modal Architecture: Real Voucher Standardization (`app/nfc.tsx`)
- **Context & Motivation**:
  - User requested: *"refine and use real voucher design"* for the unlocked milestone reward modal.
  - Previous implementation had an ad-hoc orange boarding pass container with clipped vertical text and non-standard layout.
- **Solution & Standardization**:
  1. Integrated the platform's core voucher design from `app/(customer)/vouchers.tsx` and `getVoucherSpineTheme` (`theme/index.ts`).
  2. **Left Vertical Spine**: 38px left color band adopting the merchant's exact brand color (`voucherBrandColor`), with clean `-90deg` rotated text (`MILESTONE REWARD` / `EXCLUSIVE PASS`) and YIQ brightness-based contrast text.
  3. **Center Zone**:
     - Top row: `🎁 Ready to redeem` amber badge + golden `FREE ITEM` / dark `DISCOUNT` tag.
     - Middle row: Uppercase `YOUR REWARD` tracking label + bold title + description.
     - Bottom row: `🕒 Sah 30 Hari` validity on the left + `[barcode] WV-...` voucher code pill on the right (removed redundant milestone pill for clean aesthetics).
  4. **Perforation Column**: Semicircular top and bottom notches (`width: 16, height: 16`) with crisp white dashed divider.
  5. **Right Stub**: Circular white logo avatar container with subtle shadow and uppercase merchant store name.
- **Verification**:
  - Tested on `http://localhost:8081/nfc?m=fywm62r7q3e29gd&preview_reward=milestone` on mobile viewport (410×711).
  - TypeScript checked with `npx tsc --noEmit` passing with **0 errors**.

---

### 54. Complete Stamp Card (100% Goal) Modal Architecture (`app/nfc.tsx`)
- **Context & Motivation**:
  - User requested: *"brainstorm for complete stamp iwant it like this to"*.
  - Standardized the 100% completed card modal to match the new Real Voucher aesthetics while adding celebration milestones and future visit retention loops.
- **Implemented Changes**:
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
- **Verification**:
  - Tested on `http://localhost:8081/nfc?m=fywm62r7q3e29gd&preview_reward=goal` on mobile viewport (410×711).
  - TypeScript checked with `npx tsc --noEmit` passing with **0 errors**.



---

### 55. State-Adaptive Smart Billing & Membership Hub (`app/(merchant)/subscription.tsx`)
- **Context & Motivation**:
  - User requested: *"now lets brainstorm this page design"* followed by *"create implementation plan"* for `localhost:8081/subscription`.
  - Replaced the cluttered one-size-fits-all upsell screen with an Apple/Shopify/Stripe-caliber State-Adaptive Billing & Membership Hub.
- **Implemented Changes**:
  1. **Dual State Visual Modes**:
     - **Active Subscriber Mode**: Displays an Executive VIP Black & Gold Membership Card with live plan tier, expiration/renewal status, and 3-column quota metrics (`Active Customers`, `Branches`, `Staff Access`).
     - **Non-Subscribed / Trial Mode**: Clean conversion hero, billing cycle toggle (Monthly vs Annual -20%), Starter vs PRO comparative tier cards, feature matrix checklist, and direct payment flow.
  2. **Merchant Quick Actions**:
     - Direct order shortcut for NFC hardware stands (`/hardware`).
     - TikTok Shop & Shopee Stand Activation Code redemption modal (`showCodeBox`).
     - Collapsible Plan Switcher accordion allowing active subscribers to seamlessly upgrade without visual clutter.
  3. **Global Layout Collision Fix**:
     - Updated `app/(merchant)/_layout.tsx` to exclude `subscription` route from the persistent floating yellow `Need Help?` chat bubble (`!pathname.includes("subscription")`), clearing obstructions from checkout and billing actions.
     - Bottom scroll padding increased to `140px` to guarantee zero thumb-zone clipping on mobile viewports.
- **Verification**:
  - TypeScript checked with `npx tsc --noEmit` passing with **0 errors**.
  - Dev server verified at `http://localhost:8081/subscription`.
---

### 56. Post-Approval Appointment Booking Card Daylight Redesign (`app/nfc.tsx`)
- **Context & Motivation**:
  - The post-approval booking prompt previously rendered in a dark translucent glass container (`rgba(15, 15, 24, 0.76)`) with a high-contrast green button, jarring against the clean daylight white card aesthetic of the onboarding and customer booking card.
  - Redesigned to match the clean, elevated aesthetic of Image 2 (walk-in customer booking card).
- **Implemented Changes**:
  1. **Daylight White Container (`postApprovalBookingCard`)**:
     - Upgraded from dark translucent background (`rgba(15, 15, 24, 0.76)`) to crisp daylight white (`#FFFFFF`) with 24px squircle border radius, subtle slate border (`#F1F5F9`), and soft ambient shadow (`shadowOpacity: 0.10, shadowRadius: 20`).
  2. **Mint Status Pill Badge (`postApprovalBookingTagPill`)**:
     - Mint badge (`#ECFDF5`) featuring live emerald indicator dot (`#10B981`) and bold label `Plan your next visit` (`#047857`).
  3. **High-Contrast Left-Aligned Typography Hierarchy**:
     - 20px ExtraBold dark heading (`#000000`): `Loved today's visit? Skip the line next time!`
     - 13px slate subtitle (`#64748B`): `Book your next appointment seamlessly from your phone.`
  4. **RiseV Yellow Primary Action Button (`postApprovalBookingBtn`)**:
     - High-impact yellow button (`#FFCC00`) with pitch black typography (`#000000`), calendar icon, and forward arrow for single-tap navigation to the merchant booking screen.
  5. **Secondary Walk-In Style Action Button (`postApprovalBookingSecondaryBtn`)**:
     - Daylight off-white pill (`#F8FAFC`, border `#E2E8F0`) for `View My Stamp Card` / `View My Points Balance` with right chevron.
  6. **Reassuring Trust Footnote**:
     - Subtle lock icon footnote: `Instant booking confirmation · Skip the queue`.
- **Verification**:
  - TypeScript checked with `npx tsc --noEmit` passing with **0 errors**.
