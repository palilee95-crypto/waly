---
name: Waly Visual Language
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#525657'
  on-tertiary: '#ffffff'
  tertiary-container: '#6b6e70'
  on-tertiary-container: '#eff1f3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 20px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  touch-target-min: 48px
---

## Brand & Style

The design system is anchored in a high-fidelity fintech aesthetic that balances professional reliability with a vibrant, modern energy. It is designed for a fast-paced retail environment where "time-to-reward" is the primary metric of success. The interface prioritizes clarity and immediate recognition of value.

The chosen style is **Minimalist / High-Contrast**, leaning on heavy whitespace and a restricted color palette to drive focus toward action-oriented elements. The emotional response is one of efficiency and premium status; users should feel that their loyalty is being tracked with the same precision and security as a high-end banking application. Visual noise is aggressively eliminated to support a "1-2 click" usability model, ensuring that physical merchant interactions remain seamless.

## Colors

The palette is functional and high-contrast, designed to pass AAA accessibility standards for critical loyalty data.

- **Primary (Vibrant Blue):** Reserved for high-intent actions, active reward states, and brand-critical touchpoints.
- **Secondary (Deep Black):** Used for primary headings and "Elevated" surface states to create a strong visual anchor.
- **Tertiary (Slate White):** A soft off-white used for background surfaces to reduce eye strain while maintaining a "Pure White" appearance for card elements.
- **Neutral (Slate Greys):** A multi-step scale used for secondary metadata, borders, and inactive states.

Emphasis is placed on the interaction between Deep Black and Pure White to create a premium, editorial feel that distinguishes the product from more "playful" or "game-like" loyalty apps.

## Typography

This design system utilizes **Inter** for its systematic, neutral, and highly legible characteristics. The type hierarchy is intentionally "top-heavy," using bold weights and tight letter-spacing for headings to command attention.

- **Display & Headlines:** Use negative letter-spacing to maintain a "tight" professional look.
- **Labels:** Small labels use increased letter-spacing and semi-bold weights to ensure legibility on mobile screens at small sizes.
- **Body:** Standardized on a 16px base for optimal readability during movement (e.g., standing at a checkout counter).

## Layout & Spacing

The layout philosophy follows a **Fixed-Margin Fluid Grid**. The content is contained within a 20px safe area on mobile devices to prevent accidental touches near the edge of the screen.

- **Spacing Rhythm:** Based on an 8px linear scale. All components and layouts must use multiples of 8px.
- **Touch Targets:** A strict minimum of 48x48px for all interactive elements, though primary loyalty buttons are encouraged to be 56px or taller for high-speed use.
- **Mobile First:** The layout reflows from a single-column stack on mobile to a multi-column dashboard on desktop, where the maximum content width is capped at 1200px.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** supplemented by ultra-soft ambient shadows. 

- **Level 0 (Background):** Slate Tertiary (#F8FAFC).
- **Level 1 (Cards/Surfaces):** Pure White (#FFFFFF) with a 2px stroke in Slate 100 or a 4% opacity black shadow (Blur: 12px, Y: 4px).
- **Level 2 (Active/Modals):** Pure White with a 12% opacity black shadow (Blur: 24px, Y: 8px) to indicate high priority.

Shadows should never appear "muddy." They are used sparingly to lift interactive cards off the background, maintaining the minimalist ethos.

## Shapes

The design system uses a **Rounded** shape language to feel approachable and modern, contrasting with the "hard" precision of the typography.

- **Component Radius:** 16px (0.5rem base in variables).
- **Container Radius:** 24px (1.5rem for `rounded-xl`) is the standard for primary loyalty cards and merchant hero sections.
- **Inputs & Small Buttons:** Use 12px to maintain a slightly more structured appearance within larger containers.

## Components

### Loyalty Cards (Stamps)
Cards are the centerpiece. Use a 24px corner radius. The "Stamp" area should use high-contrast circles with a Primary Blue fill for "Earned" states and a soft Slate Grey dashed border for "Empty" states.

### Primary Action Buttons
These must be prominent. Height should be 56px. Background is Primary Blue or Deep Black with White text. Bold typography (Label-MD). No gradients; use flat fills only.

### Data Visualizations
For merchant dashboards, use "Sparklines" and simplified bar charts. Use Primary Blue for the data line and Slate Grey for grid lines. Avoid complex legends; use inline labels.

### Input Fields
Minimalist style. A 1px border that shifts to 2px Primary Blue on focus. Labels sit above the field in Label-SM style.

### Chips & Tags
Used for reward categories (e.g., "Food", "Fashion"). Pill-shaped (32px radius) with a light Slate background and Deep Black text.