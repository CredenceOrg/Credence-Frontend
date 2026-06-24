# CSS Class Reference – Bond & CreateBondFlow

Quick reference guide for the token-driven CSS classes used in migrated components.

---

## Bond.tsx Classes

### Layout

```css
.bond__container
  ├─ display: grid
  ├─ gap: var(--credence-space-8)
  └─ Use: Root container for entire Bond page
```

```css
.bond__headerSection
  ├─ display: grid
  ├─ gap: var(--credence-space-3)
  └─ Use: Header area with title + description
```

```css
.bond__cardGrid
  ├─ display: grid
  ├─ grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr))
  ├─ gap: var(--credence-space-6)
  ├─ align-items: start
  └─ Use: Responsive grid layout for action cards
```

### Typography

```css
.bond__title
  ├─ color: var(--credence-text-primary)
  ├─ font-size: var(--credence-font-size-xl)
  ├─ font-weight: var(--credence-font-weight-bold)
  └─ Use: Page heading (h1)
```

```css
.bond__description
  ├─ color: var(--credence-text-secondary)
  ├─ max-width: 42rem
  ├─ line-height: var(--credence-line-height-relaxed)
  └─ Use: Description paragraph below title
```

### Bond Row

```css
.bond__row
  ├─ display: grid
  ├─ gap: var(--credence-space-2)
  ├─ paddingBlock: var(--credence-space-3)
  ├─ border-bottom: 1px solid var(--credence-border-default)
  └─ Use: Individual bond list item (li)
```

```css
.bond__rowHeader
  ├─ display: flex
  ├─ flex-wrap: wrap
  ├─ justify-content: space-between
  ├─ align-items: center
  ├─ gap: var(--credence-space-3)
  └─ Use: Header area of bond row (amount + badge + actions)
```

```css
.bond__amountColumn
  ├─ display: flex
  ├─ flex-direction: column
  ├─ gap: var(--credence-space-1)
  └─ Use: Amount and status badge column
```

```css
.bond__amount
  ├─ font-weight: var(--credence-font-weight-semibold)
  ├─ color: var(--credence-text-primary)
  └─ Use: Formatted USDC amount text
```

### Bond Actions

```css
.bond__actionRow
  ├─ display: flex
  ├─ gap: var(--credence-space-2)
  ├─ flex-wrap: wrap
  ├─ align-items: center
  └─ Use: Container for penalty toggle + withdraw button
```

```css
.bond__penaltyToggle
  ├─ background: none
  ├─ border: 1px solid var(--credence-border-default)
  ├─ border-radius: var(--credence-radius-sm)
  ├─ padding: var(--credence-space-1) var(--credence-space-2)
  ├─ cursor: pointer
  ├─ color: var(--credence-text-secondary)
  ├─ font-size: 0.8rem
  ├─ transition: all var(--credence-motion-duration-base) var(--credence-motion-easing-standard)
  ├─ :hover { background: var(--credence-surface-page); color: var(--credence-text-primary); }
  ├─ :focus-visible { outline: var(--credence-focus-ring); outline-offset: 2px; }
  └─ Use: "Show/Hide penalty" button
```

### Penalty Breakdown

```css
.bond__penaltyPanel
  ├─ display: grid
  ├─ gap: var(--credence-space-1)
  ├─ padding: var(--credence-space-3)
  ├─ background: var(--credence-color-warning-surface)
  ├─ border-radius: var(--credence-radius-sm)
  ├─ font-size: 0.85rem
  ├─ color: var(--credence-text-primary)
  ├─ [hidden] { display: none; }
  └─ Use: Expanded penalty breakdown panel
```

```css
.bond__penaltyRow
  ├─ display: flex
  ├─ justify-content: space-between
  └─ Use: Individual penalty breakdown row
```

```css
.bond__penaltyRowTotal
  ├─ display: flex
  ├─ justify-content: space-between
  ├─ font-weight: var(--credence-font-weight-semibold)
  └─ Use: "You receive" total row (bold)
```

```css
.bond__noPenaltyNotice
  ├─ margin: 0
  ├─ font-size: 0.85rem
  ├─ color: var(--credence-color-success-text)
  └─ Use: "No early-withdrawal penalty" message
```

---

## CreateBondFlow.tsx Classes

### Step Indicator

```css
.createBondFlow__stepIndicator
  ├─ display: flex
  ├─ gap: var(--credence-space-2)
  ├─ margin-bottom: var(--credence-space-4)
  └─ Use: Container for step progress bars
```

```css
.createBondFlow__stepBar
  ├─ flex: 1
  ├─ height: 4px
  ├─ border-radius: var(--credence-radius-full)
  ├─ background: var(--credence-border-default)
  ├─ transition: background var(--credence-motion-duration-fast) var(--credence-motion-easing-standard)
  └─ Use: Individual step progress bar (inactive)
```

```css
.createBondFlow__stepBar--active
  ├─ background: var(--credence-color-primary)
  └─ Use: Modifier for completed/current step
```

### Step Container & Heading

```css
.createBondFlow__step
  ├─ display: grid
  ├─ gap: var(--credence-space-4)
  └─ Use: Container for step content
```

```css
.createBondFlow__heading
  ├─ outline: none
  ├─ color: var(--credence-text-primary)
  ├─ margin: 0
  ├─ font-size: var(--credence-font-size-xl)
  ├─ font-weight: var(--credence-font-weight-semibold)
  └─ Use: Step h2 heading with focus management
```

### Duration Selection (Step 2)

```css
.createBondFlow__durationRow
  ├─ display: flex
  ├─ gap: var(--credence-space-3)
  ├─ flex-wrap: wrap
  ├─ @media (max-width: 480px) { flex-direction: column; }
  └─ Use: Container for duration buttons (30/90/180 days)
```

```css
.createBondFlow__durationButton
  ├─ flex: 1
  ├─ min-width: 0
  ├─ padding: var(--credence-space-4)
  ├─ background: var(--credence-surface-page)
  ├─ color: var(--credence-text-primary)
  ├─ border: 1px solid var(--credence-border-default)
  ├─ border-radius: var(--credence-radius-lg)
  ├─ font-weight: var(--credence-font-weight-semibold)
  ├─ font-size: var(--credence-font-size-base)
  ├─ cursor: pointer
  ├─ transition: all var(--credence-motion-duration-fast) var(--credence-motion-easing-standard)
  ├─ :hover:not(:disabled) { border-color: var(--credence-color-primary); }
  ├─ :focus-visible { outline: var(--credence-focus-ring); outline-offset: 2px; }
  └─ Use: Duration option button (unselected)
```

```css
.createBondFlow__durationButton--active
  ├─ background: var(--credence-color-primary)
  ├─ color: var(--credence-surface-page)
  ├─ border-color: var(--credence-color-primary)
  └─ Use: Modifier for selected duration
```

```css
.createBondFlow__error
  ├─ color: var(--credence-color-danger)
  ├─ font-weight: var(--credence-font-weight-semibold)
  └─ Use: Error alert text styling
```

### Review Card (Step 3)

```css
.createBondFlow__reviewCard
  ├─ padding: var(--credence-space-4)
  ├─ border: 1px solid var(--credence-border-default)
  ├─ border-radius: var(--credence-radius-lg)
  ├─ background: var(--credence-surface-page)
  ├─ display: grid
  ├─ gap: var(--credence-space-3)
  └─ Use: Bond summary and terms review container
```

```css
.createBondFlow__reviewRow
  ├─ display: flex
  ├─ justify-content: space-between
  ├─ align-items: center
  ├─ gap: var(--credence-space-2)
  └─ Use: Label + value row in review card
```

```css
.createBondFlow__reviewLabel
  ├─ color: var(--credence-text-secondary)
  ├─ font-size: var(--credence-font-size-base)
  └─ Use: Field label text
```

```css
.createBondFlow__reviewValue
  ├─ color: var(--credence-text-primary)
  ├─ font-weight: var(--credence-font-weight-semibold)
  └─ Use: Field value text
```

```css
.createBondFlow__reviewDivider
  ├─ height: 1px
  ├─ background: var(--credence-border-default)
  ├─ margin: var(--credence-space-2) calc(-1 * var(--credence-space-4))
  └─ Use: Section divider in review card
```

```css
.createBondFlow__reviewBadgeLabel
  ├─ font-size: var(--credence-font-size-sm)
  ├─ font-weight: var(--credence-font-weight-semibold)
  ├─ color: var(--credence-text-secondary)
  ├─ text-transform: uppercase
  ├─ letter-spacing: 0.05em
  ├─ margin-bottom: var(--credence-space-1)
  └─ Use: Section label ("If you withdraw early")
```

### Penalty Details

```css
.createBondFlow__penaltyRow
  ├─ display: flex
  ├─ justify-content: space-between
  ├─ align-items: center
  ├─ gap: var(--credence-space-2)
  └─ Use: Penalty amount row
```

```css
.createBondFlow__penaltyLabel
  ├─ color: var(--credence-text-secondary)
  ├─ font-size: var(--credence-font-size-base)
  └─ Use: Penalty label text
```

```css
.createBondFlow__penaltyAmount
  ├─ color: var(--credence-color-danger)
  ├─ font-weight: var(--credence-font-weight-semibold)
  └─ Use: Penalty amount text (red)
```

### Result Panel

```css
.createBondFlow__resultPanel
  ├─ display: flex
  ├─ justify-content: space-between
  ├─ align-items: center
  ├─ gap: var(--credence-space-3)
  ├─ padding: var(--credence-space-2) var(--credence-space-3)
  ├─ border-radius: var(--credence-radius-md)
  ├─ background: var(--credence-surface-page)
  ├─ border: 1px solid var(--credence-border-default)
  └─ Use: "You would receive" result box
```

```css
.createBondFlow__resultLabel
  ├─ color: var(--credence-text-secondary)
  ├─ font-weight: var(--credence-font-weight-semibold)
  ├─ font-size: var(--credence-font-size-base)
  └─ Use: Result label
```

```css
.createBondFlow__resultValue
  ├─ font-weight: var(--credence-font-weight-bold)
  ├─ font-size: var(--credence-font-size-lg)
  └─ Use: Result value (base color)
```

```css
.createBondFlow__resultValue--danger
  ├─ color: var(--credence-color-danger)
  └─ Use: Modifier when result is reduced by penalty
```

```css
.createBondFlow__resultValue--normal
  ├─ color: var(--credence-text-primary)
  └─ Use: Modifier when no penalty applied
```

### Acknowledgment (Step 4)

```css
.createBondFlow__ackLabel
  ├─ display: flex
  ├─ align-items: center
  ├─ gap: var(--credence-space-2)
  ├─ cursor: pointer
  ├─ color: var(--credence-text-primary)
  ├─ margin-top: var(--credence-space-2)
  ├─ user-select: none
  └─ Use: Acknowledgment checkbox + label container
```

### Navigation

```css
.createBondFlow__nav
  ├─ display: flex
  ├─ gap: var(--credence-space-3)
  ├─ margin-top: var(--credence-space-4)
  ├─ flex-wrap: wrap
  ├─ @media (max-width: 480px) { flex-direction: column; }
  └─ Use: Navigation buttons container (Back/Next/Confirm/Cancel)
```

```css
.createBondFlow__navButton
  ├─ flex: 1
  ├─ min-width: 0
  ├─ padding: var(--credence-space-3) var(--credence-space-4)
  ├─ border-radius: var(--credence-radius-lg)
  ├─ cursor: pointer
  ├─ font-weight: var(--credence-font-weight-semibold)
  ├─ font-size: var(--credence-font-size-base)
  ├─ transition: all var(--credence-motion-duration-base) var(--credence-motion-easing-standard)
  ├─ border: none
  ├─ :focus-visible { outline: var(--credence-focus-ring); outline-offset: 2px; }
  └─ Use: Base shared styles for all nav buttons
```

```css
.createBondFlow__backButton
  ├─ background: transparent
  ├─ color: var(--credence-text-primary)
  ├─ border: 1px solid var(--credence-border-default)
  ├─ :hover { background: var(--credence-surface-page); }
  └─ Use: "Back" button styling
```

```css
.createBondFlow__nextButton
  ├─ background: var(--credence-color-primary)
  ├─ color: var(--credence-surface-page)
  ├─ border: none
  ├─ font-weight: var(--credence-font-weight-semibold)
  ├─ :hover { background: var(--credence-color-primary-strong); }
  └─ Use: "Next" button styling
```

```css
.createBondFlow__confirmButton
  ├─ background: var(--credence-border-default)
  ├─ color: var(--credence-text-secondary)
  ├─ border: none
  ├─ font-weight: var(--credence-font-weight-semibold)
  ├─ cursor: not-allowed
  ├─ :disabled { opacity: 1; }
  ├─ :not(:disabled) { background: var(--credence-color-primary); color: var(--credence-surface-page); cursor: pointer; }
  ├─ :not(:disabled):hover { background: var(--credence-color-primary-strong); }
  └─ Use: "Confirm & Create Bond" button (enabled/disabled states)
```

```css
.createBondFlow__cancelButton
  ├─ padding: var(--credence-space-3) var(--credence-space-4)
  ├─ background: var(--credence-surface-page)
  ├─ color: var(--credence-color-danger)
  ├─ border: 1px solid var(--credence-border-default)
  ├─ border-radius: var(--credence-radius-lg)
  ├─ cursor: pointer
  ├─ :hover { background: var(--credence-color-danger-surface); }
  └─ Use: "Cancel" button styling
```

---

## Token Aliases Used

All classes use canonical `--credence-*` tokens. No legacy aliases (`--bg-card`, `--text-primary`, etc.) in CSS.

**Color mapping example:**

```
--credence-text-primary → dark mode: #f8fafc, light mode: #0f172a
--credence-text-secondary → dark mode: #94a3b8, light mode: #64748b
--credence-border-default → dark mode: #334155, light mode: #e2e8f0
```

All theme switching is automatic via `data-theme="dark"` attribute.

---

## Usage Tips

1. **Extend a class:** Add new modifiers with `--modifier` suffix

   ```css
   .bond__row--highlighted {
     background: var(--credence-color-info-surface);
   }
   ```

2. **Responsive variants:** Use media queries in CSS, not inline styles

   ```css
   @media (max-width: 768px) {
     .bond__cardGrid {
       grid-template-columns: 1fr;
     }
   }
   ```

3. **Add state classes:** Use conditional classNames in JSX

   ```tsx
   className={`bond__penaltyToggle${open ? ' bond__penaltyToggle--open' : ''}`}
   ```

4. **Preserve prefers-reduced-motion:** Still check hook and conditionally apply transitions
   ```tsx
   style={{ transition: prefersReducedMotion ? 'none' : undefined }}
   ```
