# Figma-to-Code Parity Checklist

Use this checklist to verify that implemented screens match the approved Figma designs. Run through every section for each key screen before merging a UI/UX PR.

---

## How to use

1. Open the Figma frame side-by-side with the running app.
2. Walk through each item in the relevant screen section below.
3. Tick every box that passes; leave unchecked items as review comments in the PR.
4. Record the Figma frame URL or screenshot link at the top of your PR description for traceability.

---

## Global design token verification

Confirm these before checking individual screens. All screens inherit these values from `src/index.css`.

### Spacing (`--credence-space-*`)

- [ ] `--credence-space-1` (4px) through `--credence-space-12` (48px) match the Figma spacing scale.
- [ ] `--credence-container-padding` (`clamp(1rem, 2vw, 2rem)`) produces the same effective padding as Figma at 360px, 768px, and 1280px widths.
- [ ] No hardcoded pixel values for margins, paddings, or gaps appear in changed files. Use `--credence-space-*` tokens instead.

### Border radius (`--credence-radius-*`)

- [ ] `--credence-radius-sm` (4px), `--credence-radius-md` (8px), `--credence-radius-lg` (12px), and `--credence-radius-full` (9999px) match Figma corner radii.
- [ ] Card, input, button, and badge radii in code correspond to the Figma component radius property.

### Typography

- [ ] Heading sizes (`h1`-`h6`) and weights match Figma type styles.
- [ ] Body text size (typically 14px / 16px) and line-height (1.5) match Figma.
- [ ] Font family in code matches the Figma typeface specification.
- [ ] Font weights (400 regular, 500 medium, 600 semibold, 700 bold) are applied correctly per Figma layer style.

### Colors and surfaces

- [ ] All background, text, border, and accent colors reference CSS custom properties from `:root` / `[data-theme='dark']` — no hardcoded hex values in new or changed styles.
- [ ] Light mode values match the Figma light frame.
- [ ] Dark mode values match the Figma dark frame (or `[data-theme='dark']` override sheet).
- [ ] Status colors (info, success, warning, danger) use the saturated token set in dark mode.

### Motion

- [ ] Transitions use `--credence-motion-duration-fast` (150ms), `--credence-motion-duration-base` (250ms), or `--credence-motion-duration-slow` (400ms) — not ad-hoc duration values.
- [ ] Easing functions reference `--credence-motion-easing-standard`, `--credence-motion-easing-decelerate`, or `--credence-motion-easing-accelerate`.
- [ ] `prefers-reduced-motion: reduce` disables or reduces all non-essential animation.

---

## Screen-by-screen checklist

### Home (`/`)

**Files:** `src/pages/Home.tsx`, `src/pages/Home.css`

- [ ] Hero section layout and vertical rhythm match Figma.
- [ ] CTA button row wraps correctly on narrow mobile (< 640px) per Figma mobile frame.
- [ ] Card grid spacing uses `--credence-space-6` gap.
- [ ] Empty state (no bonds) matches Figma empty-state frame.
- [ ] Loading skeleton matches the Figma skeleton layout for this screen.
- [ ] Responsive reflow: single column on mobile, multi-column on desktop, matching Figma breakpoints.

### Bond (`/bond`)

**Files:** `src/pages/Bond.tsx`, `src/pages/Bond.css`

- [ ] Page header title and subtitle match Figma typography.
- [ ] Card grid reflows via `repeat(auto-fit, minmax(min(100%, 22rem), 1fr))` and matches Figma column count at each breakpoint.
- [ ] Active bond list row layout (status badge, amount, action buttons) matches Figma row spec.
- [ ] Row header wrapping on mobile matches Figma mobile frame.
- [ ] Empty state matches Figma empty-state variant for bonds.
- [ ] Tier badge colors (bronze, silver, gold, platinum) match Figma.

### Bond Detail (`/bond/:id`)

**Files:** `src/pages/BondDetail.tsx`, `src/pages/BondDetail.css`

- [ ] Bond information card layout matches Figma (amount, status, lock dates, slash penalty).
- [ ] Action cards (Extend, Withdraw, Top Up) match Figma card dimensions and spacing.
- [ ] Confirm withdrawal dialog matches Figma modal spec (title, message, button layout).
- [ ] Warning banner for lock expiry matches Figma warning frame.
- [ ] Responsive stacking on mobile matches Figma mobile layout.
- [ ] Typography and spacing of date/time values match Figma.

### Create Bond (`/bond/new`)

**Files:** `src/pages/CreateBondPage.tsx`, `src/components/CreateBondFlow.tsx`, `src/components/CreateBondFlow.css`

- [ ] Step indicator / progress bar matches Figma stepper spec.
- [ ] Form field layout (label, input, helper text, error) matches Figma form spec.
- [ ] AmountInput component renders at the Figma-specified height (44px) and radius.
- [ ] AddressInput component matches Figma input spec.
- [ ] Button layout (primary / secondary) matches Figma action row.
- [ ] Form validation error states match Figma error frame (red text, red border, error icon).
- [ ] Step transitions animate per Figma prototype (or are instant if Figma has no transition).
- [ ] Success state after bond creation matches Figma success frame.

### Trust Score (`/trust`)

**Files:** `src/pages/TrustScore.tsx`, `src/pages/TrustScore.css`

- [ ] TrustGauge arc/semicircle rendering matches Figma visual spec (size, stroke width, tier coloring).
- [ ] Trust score number display (font size, weight, position) matches Figma.
- [ ] Tier label and badge match Figma tier-badge frame.
- [ ] TierLadder step visualization matches Figma (active step highlight, inactive step dimming).
- [ ] Activity timeline list items match Figma row spec.
- [ ] Empty state (no trust data) matches Figma empty frame.
- [ ] Grid layout reflows at 300px minmax and matches Figma tablet/mobile frames.

### Trust Summary (`/trust/summary`)

**Files:** `src/pages/TrustSummary.tsx`, `src/pages/TrustSummary.css`

- [ ] Summary card layout matches Figma.
- [ ] Score breakdown sections match Figma spacing and typography.
- [ ] Responsive reflow matches Figma mobile and tablet frames.

### Dashboard (`/dashboard`)

**Files:** `src/pages/Dashboard.tsx`, `src/pages/Dashboard.css`

- [ ] Widget grid layout matches Figma dashboard grid (auto-fit, minmax 250px).
- [ ] Individual widget cards match Figma card spec (padding, border, radius, shadow).
- [ ] Widget refresh button placement and size match Figma.
- [ ] Onboarding tour overlay matches Figma onboarding frame.
- [ ] Loading skeleton for dashboard matches Figma skeleton frame.
- [ ] Empty dashboard state matches Figma empty frame.
- [ ] Responsive column count: 1 on mobile, 2 on tablet, 3+ on desktop — matching Figma.

### Settings (`/settings`)

**Files:** `src/pages/Settings.tsx`, `src/pages/Settings.css`

- [ ] Two-column sidebar layout appears at 900px+ per Figma desktop frame.
- [ ] Single-column stacked layout on mobile/tablet matches Figma mobile frame.
- [ ] Form controls (Select, Toggle) match Figma control dimensions and states.
- [ ] Auto-save indicator pill ("Saved just now") matches Figma position and styling.
- [ ] Backup action row wrapping on narrow screens matches Figma.
- [ ] Narrow mobile (< 374px) outer padding shrinks correctly.

### Attestations (`/attestations`)

**Files:** `src/pages/Attestations.tsx`

- [ ] Attestation list item layout matches Figma row spec.
- [ ] Status badges use correct tier/status colors from Figma.
- [ ] Empty state matches Figma empty-state attestation variant.
- [ ] Loading skeleton matches Figma skeleton frame for attestation list.

### Transactions (`/transactions`)

**Files:** `src/pages/Transactions.tsx`, `src/pages/Transactions.css`

- [ ] Table layout on desktop matches Figma table spec.
- [ ] Card-based list on mobile (< 640px) matches Figma mobile frame.
- [ ] Transaction row content (hash, amount, date, status) matches Figma.
- [ ] CopyableHash component rendering matches Figma.
- [ ] Horizontal scroll behavior on narrow screens matches Figma.

### Sign In (`/signin`)

**Files:** `src/pages/SignIn.tsx`

- [ ] Sign-in card layout matches Figma centered card frame.
- [ ] Wallet connection options match Figma button styles and spacing.
- [ ] Loading state during wallet connection matches Figma.
- [ ] Error state for failed connection matches Figma error frame.

### Not Found (`/404`)

**Files:** `src/pages/NotFound.tsx`, `src/pages/NotFound.css`

- [ ] Layout and illustration match Figma 404 frame.
- [ ] "Go Home" button matches Figma primary button spec.

---

## Component-level spot checks

For each key shared component touched by the PR, verify the Figma component instance matches the rendered output.

### Button

- [ ] Primary, secondary, and ghost variants match Figma.
- [ ] Hover, active, focus, disabled, and loading states match Figma.
- [ ] Border radius, padding, and font size match Figma.
- [ ] Full-width variant stretches correctly.

### Badge / StatusBadge

- [ ] Tier colors (bronze, silver, gold, platinum) match Figma.
- [ ] Status colors (active, locked, slashed, grace-period) match Figma.
- [ ] Border radius (full / pill shape) matches Figma.
- [ ] Font size and weight match Figma.

### Toast / Banner

- [ ] Info, success, warning, and danger severity colors match Figma.
- [ ] Auto-dismiss countdown ring animation matches Figma (if animated).
- [ ] Dark mode surface colors use saturated tokens, not pastels.

### TrustGauge

- [ ] Arc size, stroke width, and color transitions match Figma.
- [ ] Score number font size and position match Figma.
- [ ] Tier boundary markers match Figma.

### Modal / ConfirmDialog

- [ ] Overlay backdrop color and opacity match Figma.
- [ ] Modal card dimensions, padding, and radius match Figma.
- [ ] Button layout (primary left / secondary right, or stacked) matches Figma.
- [ ] Focus trap behavior is correct (manual check, not visual).

### AmountInput / AddressInput

- [ ] Input height (44px), border radius, and padding match Figma.
- [ ] Label and helper text positioning match Figma.
- [ ] Error state (red border, error message) matches Figma.

---

## Responsive breakpoint verification

For every changed screen, resize the browser and confirm layout matches Figma at each breakpoint.

| Breakpoint | Width | Expected behavior |
| :--- | :--- | :--- |
| Narrow mobile | 360px | Compact layout, reduced padding, no horizontal scroll |
| Mobile | < 640px | Single column, hamburger nav, stacked cards |
| Tablet | 640px–768px | Two-column grids, wider spacing |
| Desktop | ≥ 1024px | Full multi-column layout, horizontal nav |
| Widescreen | ≥ 1280px | Max-width containers centered, overlay modals |

- [ ] 360px — no content clipping or horizontal overflow.
- [ ] 640px — nav switches to hamburger drawer, cards stack.
- [ ] 768px — dashboard grids show 2 columns.
- [ ] 1024px — full desktop layout with horizontal nav.
- [ ] 1280px — content containers are centered and max-width bounded.

---

## Dark mode verification

For every changed screen, toggle to dark mode and confirm:

- [ ] Page background matches Figma dark frame.
- [ ] Card backgrounds use `--bg-card` dark value.
- [ ] Text colors use `--text-primary` and `--text-secondary` dark values.
- [ ] Borders use `--border-default` dark value.
- [ ] Status banners and toasts use saturated dark tokens (not pastel backgrounds).
- [ ] Focus rings remain visible on dark surfaces.
- [ ] Tier colors (bronze, silver, gold, platinum) remain legible on dark backgrounds.

---

## Accessibility visual checks

These are visual/layout checks only — full a11y testing belongs in the [Accessibility Checklist](../ACCESSIBILITY.md).

- [ ] All text contrast meets 4.5:1 (normal) or 3:1 (large) against its background.
- [ ] Focus ring outlines are visible and use `--color-focus` token.
- [ ] Touch targets are at least 44×44px on interactive elements.
- [ ] No information is conveyed by color alone (icons, text, or patterns supplement color).
- [ ] Reduced-motion preference disables shimmer, slide, and fade animations.

---

## Pre-merge sign-off

- [ ] Figma frame links added to PR description.
- [ ] All unchecked items have review comments explaining the deviation or planned follow-up.
- [ ] Dark mode and light mode screenshots attached to PR.
- [ ] Mobile (360px) and desktop (1280px) screenshots attached to PR.
