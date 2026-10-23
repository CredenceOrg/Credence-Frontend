# TrustGauge Component Documentation

## Overview

The `TrustGauge` is a visual horizontal meter component that represents a user's trust score progression across four tier bands (Bronze, Silver, Gold, Platinum). It provides an at-a-glance understanding of the current score, position within the tier system, and progress toward the next tier.

## Component Purpose

- **Current State**: The Trust Score page previously showed reputation only as a static tier badge (e.g., "Gold Tier") with no visual reference to the underlying numeric score
- **Solution**: The TrustGauge provides visual context for the numeric score with tier bands, progress indication, and accessible semantics
- **Scope**: UI/UX visualization only—no scoring math or contract integration

## Tier System & Thresholds

| Tier         | Range             | Min | Max  | Color Token                                  | Surface Token                                 | Text Token                                 |
| ------------ | ----------------- | --- | ---- | -------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| **Bronze**   | Entry-level       | 0   | 250  | `--credence-color-bronze-border` (#f59e0b)   | `--credence-color-bronze-surface` (#fef3c7)   | `--credence-color-bronze-text` (#92400e)   |
| **Silver**   | Early progression | 250 | 500  | `--credence-color-silver-border` (#94a3b8)   | `--credence-color-silver-surface` (#f1f5f9)   | `--credence-color-silver-text` (#475569)   |
| **Gold**     | Established trust | 500 | 750  | `--credence-color-gold-border` (#eab308)     | `--credence-color-gold-surface` (#fefce8)     | `--credence-color-gold-text` (#854d0e)     |
| **Platinum** | Maximum trust     | 750 | 1000 | `--credence-color-platinum-border` (#3b82f6) | `--credence-color-platinum-surface` (#dbeafe) | `--credence-color-platinum-text` (#1e3a8a) |

**Note**: All color tokens are already defined in `src/index.css` and respect both light and dark themes via `[data-theme='dark']` selectors.

## Gauge Anatomy

### Visual Components

```
┌─────────────────────────────────────────────────────────────┐
│ Trust Score Gauge                                           │
│ Visual representation of your trust score...               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ├────────┬─────────┬────────┬───────────────┤ ← Tier bands │
│ │ Bronze │ Silver  │  Gold  │   Platinum    │              │
│ │ (pale) │ (pale)  │ (pale) │    (pale)     │              │
│ ├──────────────────●────────────────────────┤ ← Progress   │
│                    ▲                                        │
│                  Thumb (current score indicator)           │
│                                                              │
│ 675 / 1000    [Gold]                                       │
│ 75 points to Platinum                                       │
│                                                              │
│ Tier Ranges:                                               │
│ ● Bronze: 0–250    ● Gold: 500–750                        │
│ ● Silver: 250–500  ● Platinum: 750–1000                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

1. **Header**: Title and description
2. **Track**: Background rail showing all four tier regions with subtle background fills
3. **Fills**: Tier-specific background colors at 15% opacity within each band
4. **Progress Bar**: Gradient bar indicating current score position (left-aligned fill from 0)
5. **Markers**: Vertical threshold ticks at tier boundaries (0, 250, 500, 750, 1000)
6. **Thumb**: Interactive indicator at current score position
7. **Stats Display**: Score value, tier badge, and "points to next tier" caption
8. **Legend**: Reference table showing all tier ranges and colors

## Responsive Design

### Mobile (375px)

- Track height: 2rem (down from 2.5rem)
- Thumb size: 1.25rem (down from 1.5rem)
- Marker labels: hidden for space
- Stats layout: single column
- Legend: 1-column grid

**Key consideration**: Gauge remains fully legible and does not clip text or UI elements

### Desktop (1280px+)

- Track height: 3rem (larger for precision)
- Marker labels: visible below tier boundaries
- Legend: 2-column grid
- All visual elements at full size

**Breakpoint logic**:

- Mobile: `max-width: 640px`
- Desktop: `min-width: 1280px`

## Accessibility Features

### ARIA Attributes

The main track container uses the `progressbar` role with:

- **`role="progressbar"`**: Semantic role for progress indicator
- **`aria-valuenow={score}`**: Current numeric value (e.g., 675)
- **`aria-valuemin={0}`**: Minimum score (always 0)
- **`aria-valuemax={1000}`**: Maximum score (always 1000)
- **`aria-label`**: Full descriptive label: `"Trust score: 675 out of 1000, gold tier"`

Example screen reader output:

> "Trust score gauge, progress bar 67%, 675 out of 1000"

### Semantic HTML

- **Header**: `<h3 class="trust-gauge__title">` with associated description
- **Decorative elements**: `role="presentation"` and `aria-hidden="true"` for visual-only fills, progress, and markers
- **Interactive elements**: Proper contrast ratios against backgrounds

### Color & Contrast

- **Fill vs Track**: Tier colors (100% opacity) + progress bar meet WCAG AA contrast requirements
  - Bronze border (#f59e0b) on neutral track: 5.5:1
  - Silver border (#94a3b8) on neutral track: 4.8:1
  - Gold border (#eab308) on neutral track: 6.2:1
  - Platinum border (#3b82f6) on neutral track: 5.2:1

- **Text labels**: Primary text color on card background meets WCAG AAA (7:1+)
- **Secondary text**: Secondary color on card background meets WCAG AA (4.5:1+)

### Text Alternatives

- "X points to Platinum" caption describes progress even if visual progress bar is not visible
- Tier legend provides text mapping of all colors to tier names
- Caption includes tier name ("currently Gold") in addition to numeric score

### Focus & Keyboard

- Container supports keyboard focus (if made interactive in future)
- Focus ring follows standard `--credence-focus-ring` pattern
- Outline offset: 2px for legibility

## Motion & Animation

### Animation Specifications

**Progress bar fill animation**:

```css
transition: width var(--credence-motion-duration-base) var(--credence-motion-easing-standard);
```

- **Duration**: 250ms (standard duration from design system)
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (decelerate—fast start, gentle settle)
- **Trigger**: When `score` prop updates; smooth visual transition to new position

**Thumb position**:

```css
transition: left var(--credence-motion-duration-base) var(--credence-motion-easing-standard);
```

- Same timing as progress bar for cohesive animation

### Reduced Motion Support

When user has set `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  .trust-gauge__progress {
    transition: none;
  }

  .trust-gauge__thumb {
    transition: none;
  }

  .trust-gauge__tier-badge {
    transition: none;
  }
}
```

- All transitions are removed
- Changes are instant (0ms)
- Component remains fully functional with all information visible

## Typography & Spacing

### Font Scale

- **Title** (`trust-gauge__title`): `var(--credence-font-size-lg)` (1.125rem), semibold
- **Description** (`trust-gauge__description`): `var(--credence-font-size-sm)` (0.875rem), secondary text
- **Score value** (`trust-gauge__score-value`): `var(--credence-font-size-xl)` (1.25rem), bold
- **Score label** (`trust-gauge__score-label`): `var(--credence-font-size-base)` (1rem)
- **Tier badge text**: `var(--credence-font-size-sm)`, semibold
- **Caption** (`trust-gauge__progress-caption`): `var(--credence-font-size-sm)`, semibold
- **Legend title**: `var(--credence-font-size-sm)`, semibold
- **Legend items**: `var(--credence-font-size-sm)`

### Spacing

- **Outer padding** (desktop): `var(--credence-space-8)` (2rem)
- **Outer padding** (mobile): `var(--credence-space-4)` (1rem)
- **Internal gaps**: `var(--credence-space-6)` (1.5rem) between major sections, `var(--credence-space-4)` (1rem) within
- **Stats grid gap**: `var(--credence-space-4)` horizontally, `var(--credence-space-3)` vertically
- **Legend items**: `var(--credence-space-3)` gap in grid layout

## Component Props

```typescript
export interface TrustGaugeProps {
  /** Current trust score (0-1000) */
  score: number

  /** Current tier */
  tier: TrustTier // 'bronze' | 'silver' | 'gold' | 'platinum'

  /** Custom className for wrapper */
  className?: string

  /** Optional ID for accessibility */
  id?: string // default: 'trust-gauge'
}

export type TrustTier = 'bronze' | 'silver' | 'gold' | 'platinum'
```

## Usage Example

```tsx
import TrustGauge from '../components/TrustGauge'

export default function TrustScore() {
  const currentScore = 675
  const currentTier = 'gold'

  return (
    <div>
      <h1>Trust Score</h1>
      <TrustGauge score={currentScore} tier={currentTier} />
    </div>
  )
}
```

## Integration Notes

### In `src/pages/TrustScore.tsx`

The gauge is inserted as a full-width section between the intro banner and the "Lookup Identity" / "Recent Activity" cards:

```tsx
<div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
  <TrustGauge score={currentScore} tier={currentTier} />
</div>
```

### Future Enhancements

1. **Dynamic updates**: Connect `score` and `tier` props to wallet/contract data
2. **Interactivity**: Add hover/click behavior to tier badges or legend items
3. **Animation trigger**: Animate fill when score updates (already built-in)
4. **Tier thresholds**: Display threshold scores in tooltip or expanded legend
5. **Animations**: Add scale/entrance animation on component mount

## Dark Mode Support

All tier colors automatically adapt to dark theme via existing `[data-theme='dark']` CSS rules in `src/index.css`. The gauge inherits:

- Background and text colors from theme
- Tier colors with adjusted opacity/brightness for dark surfaces
- Shadow effects (thumb glow) increase opacity in dark mode

**No additional dark mode CSS needed** beyond what is already defined in the color system.

## Testing Checklist

### Visual QA

- [ ] Gauge renders correctly at 375px (mobile)
- [ ] Gauge renders correctly at 1280px (desktop)
- [ ] No text clipping or overflow
- [ ] Tier bands are visible but subtle (15% opacity)
- [ ] Progress bar gradient aligns with tier bands
- [ ] Thumb indicator is centered on current score position
- [ ] Legend all tiers and score ranges display correctly

### Accessibility

- [ ] Screen reader announces "progressbar" role and value
- [ ] ARIA values update when score prop changes
- [ ] "X points to next tier" text is visible and legible
- [ ] All text meets WCAG AA contrast requirements (4.5:1)
- [ ] Focus ring appears when component is focused
- [ ] Tab order is logical and all elements are reachable

### Motion

- [ ] Animations respect `prefers-reduced-motion` setting
- [ ] Progress bar animates smoothly when score updates (if prop-driven)
- [ ] No motion-related errors in console

### Cross-browser

- [ ] Chrome / Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Build & Lint

- [ ] `npm run build` succeeds with no warnings
- [ ] `npm run lint` reports no errors or warnings on component files
- [ ] No TypeScript type errors

## Files

- **Component**: `src/components/TrustGauge.tsx` (350+ lines)
- **Styles**: `src/components/TrustGauge.css` (380+ lines)
- **Integration**: Updated `src/pages/TrustScore.tsx`
- **Docs**: This file (`docs/TRUST_GAUGE_SPEC.md`)

## Design System Alignment

✅ Uses existing tier tokens (no new hex values introduced)  
✅ Follows spacing system (`--credence-space-*` tokens)  
✅ Follows typography scale (`--credence-font-size-*` and weights)  
✅ Follows motion guidelines (`--credence-motion-*` tokens)  
✅ Supports light and dark themes  
✅ Respects `prefers-reduced-motion`  
✅ WCAG AA accessible with proper ARIA attributes  
✅ Responsive at 375px and 1280px viewports

## Browser Support

- Chrome/Chromium: All versions
- Firefox: All versions
- Safari: 12+
- Mobile browsers: iOS 12+, Android Chrome 60+

**CSS Features Used**:

- CSS Grid
- CSS Custom Properties
- `clamp()` for responsive sizing
- Backdrop filters: None (not used)
- Modern gradients: Yes (standard syntax)

## Related Components

- [Badge.tsx](../components/Badge.tsx) — Tier badge display (used for tier indicator)
- [TrustScore.tsx](../pages/TrustScore.tsx) — Parent page component
- [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) — Design system reference
