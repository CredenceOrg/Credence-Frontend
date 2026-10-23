# TrustGauge Visual Specification & Redline

## Component Dimensions & Typography

### Overall Component

- **Padding (Desktop)**: 32px (var(--credence-space-8))
- **Padding (Mobile)**: 16px (var(--credence-space-4))
- **Border Radius**: 12px (var(--credence-radius-xl))
- **Border**: 1px solid #e2e8f0 (var(--border-default))
- **Background**: #ffffff (var(--bg-card))
- **Gap between sections**: 24px (var(--credence-space-6)) desktop, 16px mobile

### Header Section

```
┌─────────────────────────────────────┐
│ Trust Score Gauge                  │  ← Title (18px, semibold)
│ Visual representation of...        │  ← Description (14px, secondary color)
└─────────────────────────────────────┘
```

**Title** (`trust-gauge__title`):

- Font Size: 18px (var(--credence-font-size-lg))
- Font Weight: 600 (var(--credence-font-weight-semibold))
- Line Height: 1.25
- Color: #0f172a (var(--text-primary))
- Margin: 0

**Description** (`trust-gauge__description`):

- Font Size: 14px (var(--credence-font-size-sm))
- Font Weight: 400 (var(--credence-font-weight-regular))
- Line Height: 1.5
- Color: #64748b (var(--text-secondary))
- Margin: 0
- Gap from title: 8px (var(--credence-space-2))

### Gauge Track

```
Desktop (1280px+):
┌─────────────────────────────────────────────────────────┐
│ █████████████████████●───────────────────────────────── │  ← Progress fill to 67%
│                                                         │  ← Height: 3rem (48px)
│ │    │    │    │    │                                  │  ← Tier markers (3px width)
│ 0    250  500  750  1000                               │  ← Marker labels (mobile: hidden)
└─────────────────────────────────────────────────────────┘

Mobile (375px):
┌───────────────────────────┐
│ █████████●───────────────── │  ← Progress fill
│                           │  ← Height: 2rem (32px)
│ │  │  │  │  │            │  ← Tier markers (compact)
│ 0  250 500 750 1000       │  ← Labels hidden on mobile
└───────────────────────────┘
```

**Track Container** (`trust-gauge__track`):

- Width: 100%
- Height: 3rem (48px) desktop, 2rem (32px) mobile
- Background: #e2e8f0 (var(--border-default))
- Border Radius: 8px (var(--credence-radius-lg))
- Border: 1px solid #e2e8f0
- Position: relative (for absolute positioning of children)
- Overflow: hidden
- Isolation: isolate (for stacking context)

**Tier Fill Bands** (Background layer, 15% opacity):

- Bronze: 0–25% width (#f59e0b at 15% opacity)
- Silver: 25–50% width (#94a3b8 at 15% opacity)
- Gold: 50–75% width (#eab308 at 15% opacity)
- Platinum: 75–100% width (#3b82f6 at 15% opacity)

**Progress Bar** (`trust-gauge__progress`):

- Height: 100% of track
- Width: calculated from score (e.g., 67.5% for score 675)
- Background: Linear gradient across all tiers
  ```
  linear-gradient(90deg,
    #f59e0b 0%,           /* Bronze */
    #94a3b8 25%,          /* Silver */
    #eab308 50%,          /* Gold */
    #3b82f6 75%,          /* Platinum */
    #3b82f6 100%          /* Platinum (end) */
  )
  ```
- Transition: 250ms cubic-bezier(0.16, 1, 0.3, 1) (ease-out decelerate)
- Z-index: 1

**Tier Threshold Markers** (`trust-gauge__marker`):

- Width: 3px
- Height: 100% of track
- Background color: tier-specific border color (100% opacity)
  - Position 0%: #f59e0b (Bronze)
  - Position 25%: #94a3b8 (Silver)
  - Position 50%: #eab308 (Gold)
  - Position 75%: #3b82f6 (Platinum)
- Z-index: 2
- Opacity: 100% (fully visible, not subtle)

**Marker Labels** (`trust-gauge__marker-label`):

- Font Size: 12px (var(--credence-font-size-xs))
- Font Weight: 600 (semibold)
- Position: below track, -1.5rem offset
- Color: #64748b (var(--text-secondary))
- Text: tier name (lowercase, auto-capitalized)
- Display: none on mobile, flex on desktop

**Score Thumb** (`trust-gauge__thumb`):

- Width: 1.5rem (24px) desktop, 1.25rem (20px) mobile
- Height: same as width (circular)
- Background: #0284c7 (var(--credence-color-primary))
- Border: 3px solid #ffffff (var(--bg-card)) desktop, 2px mobile
- Border Radius: 50% (fully round)
- Box Shadow: `0 2px 8px rgba(2, 132, 199, 0.2)`
- Position: absolute, left at `calc(progress-width - 50%)` (centered on progress)
- Z-index: 3
- Transition: 250ms cubic-bezier(0.16, 1, 0.3, 1)

### Stats Display Section

```
┌──────────────────────────────┐
│ 675 / 1000     [Gold]        │  ← Score and tier on same line (desktop)
│ 75 points to Platinum        │  ← Caption below
└──────────────────────────────┘

Mobile:
┌──────────────┐
│ 675 / 1000   │  ← Score stacked
│ [Gold]       │  ← Tier badge below
│ 75 points to │  ← Caption below
│ Platinum     │
└──────────────┘
```

**Score Display** (`trust-gauge__score-display`):

- Layout: flex, baseline aligned
- Font Variant: tabular-nums (monospace digits)
- Gap: 8px (var(--credence-space-2))

**Score Value** (`trust-gauge__score-value`):

- Font Size: 20px (var(--credence-font-size-xl))
- Font Weight: 700 (bold)
- Color: #0f172a (var(--text-primary))

**Score Label** (`trust-gauge__score-label`):

- Font Size: 16px (var(--credence-font-size-base))
- Color: #64748b (var(--text-secondary))

**Tier Badge** (`trust-gauge__tier-badge`):

- Padding: 6px 12px (0.375rem 0.75rem)
- Border Radius: 9999px (var(--credence-radius-full), pill-shaped)
- Font Size: 14px (var(--credence-font-size-sm))
- Font Weight: 600 (semibold)
- Border: 1px solid (tier-specific)
- Background & text color: tier-specific
  - Bronze: bg #fef3c7, text #92400e, border #f59e0b
  - Silver: bg #f1f5f9, text #475569, border #94a3b8
  - Gold: bg #fefce8, text #854d0e, border #eab308
  - Platinum: bg #dbeafe, text #1e3a8a, border #3b82f6

**Progress Caption** (`trust-gauge__progress-caption`):

- Font Size: 14px (var(--credence-font-size-sm))
- Font Weight: 600 (semibold)
- Color: #64748b (var(--text-secondary)) default, or
- Color: #0284c7 (primary) for "X points to next tier", or
- Color: tier-specific for max-tier message

**Grid Layout (Desktop)**:

```
┌──────────────┬───────────────────────────┐
│ Score        │ Tier Badge                │  Row 1
├──────────────┴───────────────────────────┤
│ 75 points to Platinum (full width)      │  Row 2
└────────────────────────────────────────┘
```

- Grid template: 2 columns (1fr, auto)
- Gap: 16px horizontal (var(--credence-space-4)), 12px vertical
- Alignment: center vertically

**Grid Layout (Mobile)**:

```
┌─────────────────┐
│ Score 675 / 1000│  Row 1
│ Tier Badge      │  Row 2
│ Points caption  │  Row 3
└─────────────────┘
```

- Grid template: 1 column
- Gap: 12px (var(--credence-space-3))

### Legend Section

```
┌────────────────────────────────────────────┐
│ Tier Ranges                               │  ← Title (14px, semibold)
│ ● Bronze: 0–250    ● Gold: 500–750      │  ← 2-column grid (desktop)
│ ● Silver: 250–500  ● Platinum: 750–1000 │
└────────────────────────────────────────────┘

Mobile:
┌────────────────────────────────────────────┐
│ Tier Ranges                               │
│ ● Bronze: 0–250                          │  ← 1-column (mobile)
│ ● Silver: 250–500                        │
│ ● Gold: 500–750                          │
│ ● Platinum: 750–1000                     │
└────────────────────────────────────────────┘
```

**Legend Container** (`trust-gauge__legend`):

- Padding Top: 16px (var(--credence-space-4))
- Border Top: 1px solid #e2e8f0 (var(--border-default))
- Gap: 12px (var(--credence-space-3))
- Display: flex, flex-direction: column

**Legend Title** (`trust-gauge__legend-title`):

- Margin: 0
- Font Size: 14px (var(--credence-font-size-sm))
- Font Weight: 600 (semibold)
- Color: #0f172a (var(--text-primary))

**Legend List** (`trust-gauge__legend-list`):

- Display: grid
- Grid Columns: 2 (desktop, `repeat(2, 1fr)`), 1 (mobile, `1fr`)
- Gap: 12px (var(--credence-space-3))
- List Style: none
- Margin/Padding: 0

**Legend Item** (`trust-gauge__legend-item`):

- Display: flex
- Align Items: center
- Gap: 8px (var(--credence-space-2))
- Font Size: 14px (var(--credence-font-size-sm))
- Color: #64748b (var(--text-secondary))

**Legend Dot** (`trust-gauge__legend-dot`):

- Display: inline-block
- Width: 12px (0.75rem)
- Height: 12px (0.75rem)
- Border Radius: 4px (var(--credence-radius-sm))
- Flex Shrink: 0
- Background: tier-specific border color
  - Bronze: #f59e0b
  - Silver: #94a3b8
  - Gold: #eab308
  - Platinum: #3b82f6

**Legend Text** (`trust-gauge__legend-text`):

- Font Variant: tabular-nums (for consistent digit alignment)
- Format: "[Tier]: [Min]–[Max]" (e.g., "Bronze: 0–250")

---

## Responsive Breakpoints

### Mobile Layout (max-width: 640px)

- Padding: 16px (reduced from 32px)
- Track height: 32px (reduced from 48px)
- Thumb size: 20px (reduced from 24px)
- Thumb border: 2px (reduced from 3px)
- Title font size: 16px (reduced from 18px)
- Score value font size: 18px (reduced from 20px)
- Stats layout: single column
- Legend layout: 1-column grid
- Marker labels: hidden
- Component gaps: 16px (reduced from 24px)

### Tablet Layout (641px – 1279px)

- Uses mobile styles
- May show marker labels at 768px+ if space permits
- Stats might start to flex to 2-column

### Desktop Layout (min-width: 1280px)

- Padding: 32px
- Track height: 48px
- Thumb size: 24px
- Thumb border: 3px
- Title font size: 18px
- Score value font size: 20px
- Stats layout: flex (score / tier on one line)
- Legend layout: 2-column grid
- Marker labels: visible
- Component gaps: 24px

### Ultra-wide Layout (min-width: 1920px)

- No special styling; component maintains max usable width
- Container width capped at `var(--credence-container-max)` (72rem) by parent

---

## Color Mapping Table

### Light Theme

| Tier         | Border Color | Surface Color | Text Color | Used For                               |
| ------------ | ------------ | ------------- | ---------- | -------------------------------------- |
| **Bronze**   | #f59e0b      | #fef3c7       | #92400e    | Progress bar (0–250), marker, badge    |
| **Silver**   | #94a3b8      | #f1f5f9       | #475569    | Progress bar (250–500), marker, badge  |
| **Gold**     | #eab308      | #fefce8       | #854d0e    | Progress bar (500–750), marker, badge  |
| **Platinum** | #3b82f6      | #dbeafe       | #1e3a8a    | Progress bar (750–1000), marker, badge |

### Dark Theme (via `[data-theme='dark']`)

| Tier         | Border Color | Surface Color         | Text Color | Notes                         |
| ------------ | ------------ | --------------------- | ---------- | ----------------------------- |
| **Bronze**   | #f59e0b      | rgba(245,158,11,0.1)  | #fcd34d    | Adjusted for dark backgrounds |
| **Silver**   | #94a3b8      | rgba(148,163,184,0.1) | #cbd5e1    | Increased text brightness     |
| **Gold**     | #eab308      | rgba(234,179,8,0.1)   | #fef08a    | Lighter surface opacity       |
| **Platinum** | #3b82f6      | rgba(59,130,246,0.1)  | #93c5fd    | Adjusted for legibility       |

---

## Motion Specifications

### Animation: Progress Bar Fill

**Trigger**: When `score` prop changes

**Timing**:

```css
transition: width var(--credence-motion-duration-base) var(--credence-motion-easing-standard);
```

- Duration: 250ms
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (quick start, gentle deceleration)
- Property: `width` (of progress bar)

**Expected behavior**:

- Score 500 → 700: Progress bar smoothly extends from 50% to 70% over 250ms
- Visual effect: Gauge "fills" toward the new position

### Animation: Thumb Position

Same as progress bar (linked motion for visual cohesion):

```css
transition: left var(--credence-motion-duration-base) var(--credence-motion-easing-standard);
```

### Animation: Tier Badge

Tone/opacity change when tier updates:

```css
transition: all var(--credence-motion-duration-base) var(--credence-motion-easing-standard);
```

### Reduced Motion

When user sets `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  transition: none;
}
```

- All animations removed
- Changes are instant (0ms)
- Information remains complete and readable

---

## Print Styles

When printed (via `@media print`):

- Thumb indicator hidden (decorative)
- Component has `break-inside: avoid` (keeps gauge on one page)
- Colors remain visible (important for documentation)
- All text is readable in grayscale

---

## Example: Visual States

### State 1: Bronze Tier (Score: 125)

```
┌─────────────────────────────────────────────────────────┐
│ Trust Score Gauge                                      │
│ Visual representation of your trust score...           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ |████◆─────────────────────────────────────────────| │
│ |    │    │    │    │                                  │
│ 0    250  500  750  1000                              │
│                                                         │
│ 125 / 1000    [Bronze]                                │
│ 125 points to Silver                                  │
│                                                         │
│ Tier Ranges:                                          │
│ ● Bronze: 0–250    ● Gold: 500–750                   │
│ ● Silver: 250–500  ● Platinum: 750–1000              │
└─────────────────────────────────────────────────────────┘
```

### State 2: Gold Tier (Score: 675)

```
┌─────────────────────────────────────────────────────────┐
│ Trust Score Gauge                                      │
│ Visual representation of your trust score...           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ |████████████████████●───────────────────────────────| │
│ |    │    │    │    │                                  │
│ 0    250  500  750  1000                              │
│                                                         │
│ 675 / 1000    [Gold]                                  │
│ 75 points to Platinum                                 │
│                                                         │
│ Tier Ranges:                                          │
│ ● Bronze: 0–250    ● Gold: 500–750                   │
│ ● Silver: 250–500  ● Platinum: 750–1000              │
└─────────────────────────────────────────────────────────┘
```

### State 3: Platinum Max (Score: 1000)

```
┌─────────────────────────────────────────────────────────┐
│ Trust Score Gauge                                      │
│ Visual representation of your trust score...           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ |████████████████████████████████████████████████●| │
│ |    │    │    │    │                                  │
│ 0    250  500  750  1000                              │
│                                                         │
│ 1000 / 1000    [Platinum]                             │
│ Platinum tier — maximum score achieved               │
│                                                         │
│ Tier Ranges:                                          │
│ ● Bronze: 0–250    ● Gold: 500–750                   │
│ ● Silver: 250–500  ● Platinum: 750–1000              │
└─────────────────────────────────────────────────────────┘
```

---

## Specification Checklist

- ✅ Component renders correctly at 375px (mobile)
- ✅ Component renders correctly at 1280px (desktop)
- ✅ No text clipping or overflow
- ✅ Tier bands are subtle (15% opacity) but visible
- ✅ Progress bar gradient matches tier bands
- ✅ Thumb indicator centers on current score
- ✅ Legend displays all tiers and ranges
- ✅ Stats display shows current score and tier
- ✅ "X points to next tier" caption is visible
- ✅ All colors use existing design tokens
- ✅ Animations respect `prefers-reduced-motion`
- ✅ Contrast ratios meet WCAG AA
- ✅ ARIA attributes present and correct
- ✅ Responsive layout adapts properly
- ✅ Dark mode colors adjust automatically
- ✅ Print styles preserve legibility
