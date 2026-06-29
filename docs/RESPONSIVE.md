# Credence Responsive Layout Contract

This document codifies the responsive layout rules, viewport breakpoints, and styling token contracts for the Credence frontend. Contributors must align all new and modified layouts with this contract to ensure consistent user experience across device screen widths.

---

## 📱 Breakpoint Thresholds

The Credence frontend targets several key viewport thresholds to adapt layouts from narrow mobile viewports up to large desktop displays.

| Breakpoint Threshold | CSS Rule / Media Query | Layout Target & Expected Behavior | Key Code Reference |
| :--- | :--- | :--- | :--- |
| **Narrow Mobile** (360px) | `max-width: 374px` | Minimum supported viewport width. Avoids horizontal scroll; reduces paddings to keep layout compact. | [Settings.css:L74-L78](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Settings.css#L74-L78) |
| **Mobile / Tablet** (640px) | `max-width: 639px`<br>`min-width: 640px` | Navigation menu transforms from desktop inline tabs to mobile hamburger drawer. Tables collapse into individual card rows. | [Layout.css:L118-L126](file:///c:/Users/opulencechuks/Credence-Frontend/src/components/Layout.css#L118-L126)<br>[Transactions.css:L98-L146](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Transactions.css#L98-L146) |
| **Tablet / Desktop** (768px) | `max-width: 767px` | Primary split-column grids stack vertically (e.g. Dashboard layout). Flex rows wrap or columnize. Footer links switch to vertical stack. | [Dashboard.css:L123-L135](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Dashboard.css#L123-L135)<br>[index.css:L325-L329](file:///c:/Users/opulencechuks/Credence-Frontend/src/index.css#L325-L329)<br>[BondDetail.css:L197-L206](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/BondDetail.css#L197-L206) |
| **Settings Grid Split** (900px) | `min-width: 900px` | Transitions Settings page layout from a single-column block to a two-column sidebar layout (`1fr 360px`). | [Settings.css:L63-L72](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Settings.css#L63-L72) |
| **Desktop Base** (1024px) | (Design spec target) | Core desktop design grid. Dynamic layout cards extend to maximum grid column configurations. | [FIGMA_DESIGN_SPECS.md](file:///c:/Users/opulencechuks/Credence-Frontend/docs/FIGMA_DESIGN_SPECS.md#L242-L280) |
| **Widescreen Desktop** (1280px) | `min-width: 1280px` | Keyboard shortcuts help, confirm dialogs, and trust score gauges transition to centered overlay states. | [ConfirmDialog.css:L238-L242](file:///c:/Users/opulencechuks/Credence-Frontend/src/components/ConfirmDialog.css#L238-L242)<br>[TrustGauge.css:L362-L373](file:///c:/Users/opulencechuks/Credence-Frontend/src/components/TrustGauge.css#L362-L373) |

---

## 🧭 Primary Route Layout Reflow Rules

### 1. Home Route
- **Files**: [Home.tsx](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Home.tsx) \| [Home.css](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Home.css)
- **Grid Structure**: Built using a grid layout with a token-driven gap (`gap: var(--credence-space-6)`).
- **Reflow Behavior**: 
  - Call-To-Action (CTA) button row uses `.home__ctaRow` with `display: flex; flex-wrap: wrap; gap: var(--credence-space-4);` to naturally wrap primary/secondary action buttons on narrow mobile views without requiring explicit media query blocks.

### 2. Bond Route
- **Files**: [Bond.tsx](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Bond.tsx) \| [Bond.css](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Bond.css)
- **Grid Structure**: Main layout uses `.bond__container` grid with a gap of `var(--credence-space-8)`.
- **Reflow Behavior**:
  - The card layout grid (`.bond__cardGrid`) reflows dynamically using CSS Grid auto-fit and minmax formulas: `grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: var(--credence-space-6);`.
  - When container space is narrower than 22rem (~352px), cards reflow into a single column. Otherwise, they display side-by-side.
  - Active bond list items (`.bond__rowHeader`) wrap buttons below status badges using flex-wrap rules [Bond.css:L64-L70](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Bond.css#L64-L70).

### 3. Trust Score Route
- **Files**: [TrustScore.tsx](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/TrustScore.tsx) \| [TrustScore.css](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/TrustScore.css)
- **Grid Structure**: Main content layouts reflow through `.trustScore__grid`.
- **Reflow Behavior**:
  - Main panel blocks (Lookup card and Activity timeline) use `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--credence-space-8);`.
  - This allows side-by-side display on tablet/desktop sizes and cleanly stacks into a single column on mobile screen widths under ~632px.

### 4. Settings Route
- **Files**: [Settings.tsx](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Settings.tsx) \| [Settings.css](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Settings.css)
- **Grid Structure**: Main section layout wraps within `.settings-page`.
- **Reflow Behavior**:
  - Single-column stacked block layout on mobile/tablet widths.
  - Converts to a two-column grid at `min-width: 900px` (`grid-template-columns: 1fr 360px;`).
  - Adapts to narrow viewports (`max-width: 374px`) by shrinking outer layout padding to `0.5rem` to prevent visual truncation.
  - Action row for backup buttons (`.settings-backup-row`) wraps natively on narrow screens using flex-wrap properties [Settings.css:L50-L60](file:///c:/Users/opulencechuks/Credence-Frontend/src/pages/Settings.css#L50-L60).

---

## 📐 Layout Spacing & Radius Tokens

To maintain visual consistency and support high-quality dark/light mode adjustments, **all layout spacing, margins, paddings, and border-radii must be driven by custom variables defined in [src/index.css](file:///c:/Users/opulencechuks/Credence-Frontend/src/index.css). Hardcoded pixel values for layout structure are strictly prohibited.**

### Spacing Tokens (`--credence-space-*`)
These tokens drive grid gaps, margin blocks, and component padding rules:

| Token Name | Value | Rem Equivalent | Pixel Equivalent |
| :--- | :--- | :--- | :--- |
| `--credence-space-1` | `0.25rem` | 0.25rem | 4px |
| `--credence-space-2` | `0.5rem` | 0.5rem | 8px |
| `--credence-space-3` | `0.75rem` | 0.75rem | 12px |
| `--credence-space-4` | `1rem` | 1.0rem | 16px |
| `--credence-space-5` | `1.25rem` | 1.25rem | 20px |
| `--credence-space-6` | `1.5rem` | 1.5rem | 24px |
| `--credence-space-8` | `2rem` | 2.0rem | 32px |
| `--credence-space-12` | `3rem` | 3.0rem | 48px |
| `--credence-container-padding` | `clamp(1rem, 2vw, 2rem)` | Dynamic | Dynamic (16px to 32px) |

### Radius Tokens (`--credence-radius-*`)
These tokens define component border-radii for visual cards, controls, and elements:

| Token Name | Value | Rem Equivalent | Pixel Equivalent | Usage Context |
| :--- | :--- | :--- | :--- | :--- |
| `--credence-radius-sm` | `0.25rem` | 0.25rem | 4px | Small toggles, badges, status labels |
| `--credence-radius-md` | `0.375rem` | 0.375rem | 6px | Buttons, dropdowns, input elements |
| `--credence-radius-lg` | `0.5rem` | 0.5rem | 8px | Form fields, minor container panels |
| `--credence-radius-xl` | `0.75rem` | 0.75rem | 12px | Major layout cards, visual components |
| `--credence-radius-full` | `9999px` | 9999px | 9999px | Circular icons, pill toggles, tags |

---

## ⚡ Edge Cases & Overflow Prevention

Layout code must proactively address common mobile edge cases to meet the layout contract requirements:

1. **Grid Column Collapse**
   - Grids displaying side-by-side options (like active bonds, lookups, settings forms) must automatically transition to single-column stacking layout on viewports narrower than `768px` or when width bounds are constrained (via `repeat(auto-fit, minmax(...))` or `@media (max-width: 767px)` rules).

2. **Mobile Header Reflow**
   - The header area transitions layout structures at `639px/640px` boundaries:
     - Under `640px`, desktop links hide (`display: none`), and the accessible hamburger drawer button triggers.
     - The sliding mobile menu drawer (`.mobileNav-drawer`) limits its max width to `70vw` (280px) and traps focus to maintain touch control safety on narrow viewports.

3. **Prevention of Horizontal Scroll**
   - To prevent horizontal overflow on the narrow `360px` threshold:
     - Long hashes and wallet addresses are truncated with ellipses (`text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`) or wrap natively.
     - Flex buttons and links must use `flex-wrap: wrap`.
     - Tables must stack vertically under `< 640px` to avoid horizontal scrollbar overrides.

---

## 🧪 Contributor Responsive QA Checklist

Before submitting a pull request, manually verify the visual layout behavior at the following target dimensions:

### 📱 1. Narrow Mobile Check (360px viewport width)
- [ ] **No Horizontal Scroll**: Ensure the page has no horizontal scrollbars.
- [ ] **Spacing Compression**: Spacing collapses smoothly (Settings page matches `0.5rem` spacing; main containers clamp to `1rem`).
- [ ] **Flexible Buttons**: Buttons inside cards and backup lists wrap neatly; no text overflows button borders.
- [ ] **Ellipsis Verification**: Long wallet addresses or transaction hashes are truncated cleanly with an ellipsis.
- [ ] **Interactive Elements**: Input elements and selectors scale to fill the viewport width safely.

### 📟 2. Tablet View Check (768px viewport width)
- [ ] **Stacked Grids**: Double-column dashboard panels and layout cards stack vertically into a single column.
- [ ] **Hamburger Menu Toggle**: Desktop links are hidden; hamburger menu correctly opens the focus-trapped sliding menu.
- [ ] **Table Reflow**: Transaction tables transition from horizontal headers into vertical card blocks.
- [ ] **Footer Alignment**: Footer contents align vertically in a single stacked block without overlapping text.

### 💻 3. Desktop View Check (1280px+ viewport width)
- [ ] **Container Bounds**: Page layouts respect the maximum container width limit (`--credence-container-max: 72rem`) and align centrally on the screen.
- [ ] **Side-by-Side Columns**: Cards and sidebar elements display in their multi-column layouts.
- [ ] **Overlays**: Interactive dialogs and shortcuts windows are centered overlays with proper screen backdrops.

---

## 🔗 Cross-References & Design Resources

To avoid duplicate documentation, refer to the following background notes for specific styling context:
- [FIGMA_DESIGN_SPECS.md](file:///c:/Users/opulencechuks/Credence-Frontend/docs/FIGMA_DESIGN_SPECS.md#L242-L280) — Pixel specs for mobile, tablet, and desktop skeletons and empty states.
- [figma-nav-rules.md](file:///c:/Users/opulencechuks/Credence-Frontend/docs/figma-nav-rules.md) — Specifications for interactive states, drawer dimensions, and backdrop layers.
- [mobile-navigation-pattern.md](file:///c:/Users/opulencechuks/Credence-Frontend/docs/mobile-navigation-pattern.md) — Technical details regarding focus traps, ARIA properties, and transition timings.
- [uiux/inline-style-migration.md](file:///c:/Users/opulencechuks/Credence-Frontend/docs/uiux/inline-style-migration.md) — Guidelines on migrating legacy inline style declarations to token-driven CSS classes.
