# Requirements Document

## Introduction

The Credence frontend currently provides mobile navigation only through a hamburger + slide-in drawer component (`MobileNav`) that activates below 640 px. Research and UX review indicate that a **fixed bottom navigation bar** is a superior primary-navigation pattern for mobile dApps: it is permanently visible, reduces tap distance, and matches the interaction models users expect from web3 mobile experiences.

This feature adds a `BottomNav` component to the `src/components/navigation/` directory. The bar is fixed to the bottom of the viewport, shows exactly 5 primary route tabs (Dashboard, Bond, Trust Score, Attestations, Transactions), and is visible only on viewports ≤ 768 px wide. The existing hamburger drawer continues to serve as the entry point for the Settings page and any other overflow items not promoted to the bottom bar. The `<main>` element in `Layout` gains a corresponding `padding-bottom` so page content is never obscured by the bar.

All route link data is migrated out of inline component definitions and into a shared `src/config/navLinks.ts` module that becomes the single source of truth for both the bottom bar and the existing `MobileNav` drawer. The 768 px breakpoint threshold is sourced exclusively from the `BREAKPOINTS.MD` constant already defined in `src/config/breakpoints.ts` — no magic numbers.

---

## Glossary

- **BottomNav**: The new fixed bottom navigation bar component (`src/components/navigation/BottomNav.tsx`).
- **MobileNav**: The existing hamburger + slide-in drawer component (`src/components/navigation/MobileNav.tsx`). Continues to exist and handle Settings / overflow links.
- **Layout**: The shell component (`src/components/Layout.tsx`) that wraps all pages via `<Outlet />`.
- **BREAKPOINTS.MD**: The canonical 768-pixel breakpoint constant exported from `src/config/breakpoints.ts`.
- **navLinks**: The shared navigation-link configuration module at `src/config/navLinks.ts`.
- **Primary routes**: The five routes promoted to the bottom bar — Dashboard (`/dashboard`), Bond (`/bond`), Trust Score (`/trust`), Attestations (`/attestations`), Transactions (`/transactions`).
- **Secondary routes**: Routes that are not in the bottom bar — Home (`/`), Settings (`/settings`). These remain accessible via the hamburger drawer.
- **Design tokens**: CSS custom properties prefixed with `--credence-*` defined by the Credence design system. No hard-coded colours, spacing, radii, or motion values are permitted.
- **Active tab**: The tab whose route matches the current browser location, indicated visually and semantically.
- **Tab item**: A single navigation entry inside `BottomNav`, consisting of a label and an optional icon, rendered as a focusable `<a>` element via React Router `NavLink`.
- **Bottom safe area**: Padding applied to `<main>` equal to the height of `BottomNav` when the bar is visible, preventing content from being hidden behind it.
- **i18n key**: A translation key in `src/i18n/locales/en.json` under the `nav.*` namespace.
- **Vitest / RTL**: The test stack — Vitest as test runner, React Testing Library for rendering and interaction.

---

## Requirements

### Requirement 1: Shared Navigation Link Configuration

**User Story:** As a developer, I want a single source of truth for primary navigation link data, so that I can add, remove, or reorder links in one place without editing multiple components.

#### Acceptance Criteria

1. THE `navLinks` module SHALL export a `PRIMARY_NAV_LINKS` constant containing exactly 5 entries, each with a `to` path, a `labelKey` referencing an `nav.*` i18n key, and an `ariaLabel` string.
2. THE `PRIMARY_NAV_LINKS` constant SHALL include entries for `/dashboard`, `/bond`, `/trust`, `/attestations`, and `/transactions`, in that order.
3. THE `navLinks` module SHALL export a `SECONDARY_NAV_LINKS` constant containing entries for routes not promoted to the bottom bar (at minimum `/` and `/settings`).
4. WHEN `BottomNav` renders its tab items, THE `BottomNav` SHALL source all link data from `PRIMARY_NAV_LINKS` in `navLinks`.
5. WHEN `MobileNav` renders its drawer links, THE `MobileNav` SHALL source all link data from the combined `navLinks` exports rather than from its own inline `NAV_LINKS` constant.

---

### Requirement 2: BottomNav Component Rendering

**User Story:** As a mobile user, I want a permanently visible bottom navigation bar, so that I can reach any primary section of the app with a single tap without first opening a drawer.

#### Acceptance Criteria

1. THE `BottomNav` component SHALL render a `<nav>` element with `aria-label="Bottom navigation"`.
2. WHEN the viewport width is ≤ `BREAKPOINTS.MD` (768 px), THE `BottomNav` SHALL be visible and positioned fixed to the bottom of the viewport.
3. WHEN the viewport width is > `BREAKPOINTS.MD` (768 px), THE `BottomNav` SHALL be hidden via `display: none` in CSS.
4. THE `BottomNav` SHALL render exactly 5 tab items corresponding to `PRIMARY_NAV_LINKS`.
5. WHEN rendered on a ≤ 768 px viewport, THE `BottomNav` SHALL fill the full horizontal width of the viewport.
6. THE `BottomNav` SHALL sit above page content in the stacking order (z-index higher than `<main>`) without overlapping the application header.

---

### Requirement 3: Active State and Routing

**User Story:** As a mobile user, I want to see which section I am currently viewing highlighted in the bottom bar, so that I always know my location within the app.

#### Acceptance Criteria

1. WHEN the current browser location matches a tab item's `to` path, THE `BottomNav` SHALL apply a visually distinct active style to that tab item using only `--credence-*` design tokens.
2. WHEN the current browser location matches a tab item's `to` path, THE `BottomNav` SHALL set `aria-current="page"` on that tab item's `<a>` element.
3. WHEN the current browser location does not match a tab item's `to` path, THE `BottomNav` SHALL not set `aria-current` on that tab item.
4. WHEN a user taps a tab item, THE `BottomNav` SHALL navigate to the corresponding route using the React Router `NavLink` mechanism without a full page reload.
5. WHEN the active route changes (e.g., from a link outside `BottomNav`), THE `BottomNav` SHALL update the active tab to reflect the new location without requiring user interaction.

---

### Requirement 4: Keyboard Accessibility

**User Story:** As a keyboard user on a mobile or tablet device, I want to navigate between primary sections using the Tab key, so that I can use the app without relying on pointer input.

#### Acceptance Criteria

1. THE `BottomNav` SHALL make each tab item reachable via sequential Tab key navigation.
2. WHEN a tab item receives keyboard focus, THE `BottomNav` SHALL display a visible focus indicator using `var(--credence-focus-ring)`.
3. WHEN a focused tab item is activated with Enter or Space, THE `BottomNav` SHALL navigate to the corresponding route.
4. THE `BottomNav` tab items SHALL be reachable in the same document Tab order as other focusable elements — no custom `tabindex` that skips or traps focus.

---

### Requirement 5: Design Token Compliance

**User Story:** As a UI developer, I want `BottomNav` to use only design tokens for visual properties, so that it automatically adapts to theme changes (light/dark) and any future design-system updates without manual token mapping.

#### Acceptance Criteria

1. THE `BottomNav` CSS SHALL use `var(--credence-surface-card)` for the bar's background colour.
2. THE `BottomNav` CSS SHALL use `var(--credence-border-default)` for the top border separating the bar from the page content above it.
3. THE `BottomNav` CSS SHALL use `var(--credence-color-primary)` to indicate the active tab (colour, underline, or equivalent).
4. THE `BottomNav` CSS SHALL use `var(--credence-text-secondary)` for inactive tab label text.
5. THE `BottomNav` CSS SHALL use `var(--credence-text-primary)` or `var(--credence-color-primary)` for active tab label text.
6. THE `BottomNav` CSS SHALL use `var(--credence-space-*)` tokens for all padding and gap values.
7. THE `BottomNav` CSS SHALL use `var(--credence-font-size-*)` and `var(--credence-font-weight-*)` tokens for label typography.
8. THE `BottomNav` CSS SHALL use `var(--credence-motion-duration-*)` and `var(--credence-motion-easing-*)` tokens for any transition effects.
9. IF a border-radius is applied to any element within `BottomNav`, THEN THE `BottomNav` CSS SHALL use `var(--credence-radius-*)` tokens for those values.
10. THE `BottomNav` CSS SHALL NOT contain any hard-coded colour values, pixel-based spacing literals, or unitless radius values.

---

### Requirement 6: Breakpoint Sourcing

**User Story:** As a developer, I want the ≤ 768 px visibility threshold to come from `BREAKPOINTS.MD`, so that the breakpoint stays consistent with the rest of the codebase and is changed in exactly one place.

#### Acceptance Criteria

1. THE CSS media query that hides `BottomNav` at wider viewports SHALL use a value derived from `BREAKPOINTS.MD` (768) as its breakpoint threshold, not a hard-coded literal.
2. THE `BottomNav` component or its associated CSS SHALL NOT contain the numeric literal `768` anywhere in the source file.
3. WHEN `BREAKPOINTS.MD` is updated in `src/config/breakpoints.ts`, THE `BottomNav` visibility behaviour SHALL automatically reflect the new value without requiring separate edits in other files.

---

### Requirement 7: Layout — Bottom Safe Area

**User Story:** As a mobile user, I want the page content to remain fully visible above the bottom navigation bar, so that I can read and interact with content without it being obscured.

#### Acceptance Criteria

1. WHEN the viewport width is ≤ `BREAKPOINTS.MD`, THE `Layout` SHALL apply a `padding-bottom` to `<main id="main-content">` that is at least equal to the rendered height of `BottomNav`.
2. WHEN the viewport width is > `BREAKPOINTS.MD`, THE `Layout` SHALL NOT apply any additional bottom padding to `<main>` attributable to `BottomNav`.
3. THE `padding-bottom` value applied to `<main>` in the mobile breakpoint SHALL use `var(--credence-space-*)` tokens or a CSS custom property derived from the bar height.
4. THE `BottomNav` SHALL be rendered inside `Layout` adjacent to (not inside) `<main>`, so it is not scrolled away with page content.

---

### Requirement 8: Coexistence with MobileNav Hamburger Drawer

**User Story:** As a mobile user, I want to still access Settings and other secondary routes via the hamburger drawer, so that the bottom bar addition does not remove any existing navigation paths.

#### Acceptance Criteria

1. WHEN the bottom bar is visible (viewport ≤ 768 px), THE `MobileNav` hamburger button SHALL remain visible in the application header.
2. THE `MobileNav` drawer SHALL continue to contain links to all secondary routes (at minimum Home and Settings) that are not present in `BottomNav`.
3. THE `MobileNav` drawer SHALL NOT duplicate the 5 primary route links already present in `BottomNav` — the drawer should show only secondary/overflow links when the bottom bar is active.
4. WHEN the viewport is > 768 px, THE `MobileNav` hamburger SHALL remain hidden per its existing CSS rules (the desktop inline nav handles navigation at that width).

---

### Requirement 9: i18n — Label Translations

**User Story:** As an internationalisation maintainer, I want `BottomNav` tab labels to use i18n keys, so that the component supports future locale additions without code changes.

#### Acceptance Criteria

1. THE `BottomNav` tab labels SHALL be resolved using the `useTranslation` hook from `react-i18next`.
2. EACH tab item in `PRIMARY_NAV_LINKS` SHALL reference an existing `nav.*` key from `src/i18n/locales/en.json` for its label.
3. THE existing `nav.*` keys (`nav.dashboard`, `nav.bond`, `nav.trustScore`, `nav.attestations`, `nav.transactions`) SHALL be reused without introducing duplicate or renamed keys.

---

### Requirement 10: Tests

**User Story:** As a developer, I want automated tests for `BottomNav` and the updated `Layout`, so that regressions are caught immediately in CI.

#### Acceptance Criteria

1. THE `BottomNav` test file (`src/components/navigation/BottomNav.test.tsx`) SHALL assert that the bar renders 5 tab items when given a mobile-width viewport.
2. THE `BottomNav` test file SHALL assert that the tab matching the current route receives `aria-current="page"`.
3. THE `BottomNav` test file SHALL assert that tabs for non-active routes do not carry `aria-current`.
4. THE `Layout` test file (`src/components/Layout.test.tsx`) SHALL include a test asserting that `BottomNav` is present in the DOM at a ≤ 768 px viewport width.
5. THE `Layout` test file SHALL include a test asserting that `<main>` has a non-zero `padding-bottom` style applied at a ≤ 768 px viewport width.
6. WHEN the full test suite is run, THE test runner SHALL report zero failing tests attributable to the addition of `BottomNav` or changes to `Layout`, `MobileNav`, or `navLinks`.

---

### Requirement 11: Documentation Updates

**User Story:** As a developer onboarding to the project, I want updated component and navigation documentation, so that I understand the full mobile navigation architecture without reading source code.

#### Acceptance Criteria

1. THE `docs/components.md` file SHALL contain a `BottomNav` entry in its styling ownership table listing `src/components/navigation/BottomNav.css` as the styling owner.
2. THE `docs/components.md` `BottomNav` entry SHALL document the component's props, ARIA attributes, design tokens consumed, and visibility breakpoint.
3. THE `docs/MOBILE_NAV_README.md` file SHALL be updated to reflect that `BottomNav` has been added and to describe the relationship between `BottomNav` (primary routes, ≤ 768 px) and `MobileNav` (secondary/overflow routes, hamburger drawer).
4. THE `docs/MOBILE_NAV_README.md` implementation status section SHALL mark the bottom-nav implementation phase as complete once the feature ships.
