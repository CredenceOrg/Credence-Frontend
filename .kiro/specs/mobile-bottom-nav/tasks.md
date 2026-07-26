# Implementation Tasks — Mobile Bottom Navigation Bar

## Tasks

- [ ] 1. Create shared nav-link config
  - Create `src/config/navLinks.ts` exporting `NavLink` interface, `PRIMARY_NAV_LINKS` (5 entries: /dashboard, /bond, /trust, /attestations, /transactions), and `SECONDARY_NAV_LINKS` (/ and /settings)
  - Add `"home": "Home"` under the `nav` key in `src/i18n/locales/en.json`
  - **Verify**: TypeScript compiles without errors; all labelKey values match existing/new `nav.*` keys
  - _Requirements: 1_

- [ ] 2. Create BottomNav component and styles
  - Create `src/components/navigation/BottomNav.tsx`: `<nav aria-label="Bottom navigation">` with 5 `NavLink` tabs sourced from `PRIMARY_NAV_LINKS`; inject `--credence-bottom-nav-breakpoint` CSS custom property via `useEffect`; use `useTranslation` for labels; rely on React Router v6 `NavLink` automatic `aria-current="page"` on active route
  - Create `src/components/navigation/BottomNav.css`: `display: none` by default; `display: block; position: fixed; bottom: 0; left: 0; right: 0; z-index: 900` inside `@media (max-width: 768px)`; all colours/spacing/typography via `var(--credence-*)` tokens only; active tab uses `border-top: 2px solid var(--credence-color-primary)` and `color: var(--credence-color-primary)`; `prefers-reduced-motion` rule removes transitions
  - **Verify**: No hard-coded colour/spacing/radius literals in the CSS file; `768` appears only once (in the media query) with a comment linking it to `BREAKPOINTS.MD`
  - _Requirements: 2, 3, 4, 5, 6_

- [ ] 3. Update MobileNav to use shared nav-link config
  - In `src/components/navigation/MobileNav.tsx`: remove the inline `NAV_LINKS` constant; import `SECONDARY_NAV_LINKS` from `../../config/navLinks`; add `useTranslation` import; update the drawer `ul` map to use `{ to, labelKey }` destructuring with `t(labelKey)` for labels
  - **Verify**: Drawer still renders Home and Settings links; existing `MobileNav.test.tsx` tests all pass
  - _Requirements: 1, 8_

- [ ] 4. Update Layout to render BottomNav and add safe-area padding
  - In `src/components/Layout.tsx`: add `import BottomNav from './navigation/BottomNav'`; add `import { useProductUpdates } from '../hooks/useProductUpdates'` (fix missing import); render `<BottomNav />` as a direct child of `.appShell` after `<BackToTop />`
  - In `src/components/Layout.css`: add a `@media (max-width: 768px)` block setting `padding-bottom: calc(var(--credence-space-16, 4rem) + var(--credence-space-4))` on `.appMain`
  - **Verify**: No TypeScript errors; existing Layout tests pass; `<nav aria-label="Bottom navigation">` present in rendered DOM
  - _Requirements: 7_

- [ ] 5. Write BottomNav unit tests
  - Create `src/components/navigation/BottomNav.test.tsx` with a `MemoryRouter`-wrapped render helper and these test cases:
    1. `renders exactly 5 tab items`
    2. `renders nav with aria-label "Bottom navigation"`
    3. `marks the active route with aria-current="page"` (render at `/bond`, assert Bond tab has `aria-current`)
    4. `does not set aria-current on inactive tabs` (assert other 4 tabs lack `aria-current`)
    5. `each tab links to the correct href`
    6. `active tab has bottomNav-tab--active CSS class`
  - **Verify**: All 6 tests green; `npx vitest run src/components/navigation/BottomNav.test.tsx` exits 0
  - _Requirements: 10_

- [ ] 6. Extend Layout tests for BottomNav presence
  - In `src/components/Layout.test.tsx`: add two tests inside the existing `describe('Layout Integration')` block:
    1. `renders BottomNav inside the layout` — asserts `getByRole('navigation', { name: /bottom navigation/i })` is in the document
    2. `BottomNav element is present in the DOM` — asserts the element exists (CSS controls visibility; DOM presence is always true)
  - **Verify**: All existing Layout tests still pass; two new tests green
  - _Requirements: 10_

- [ ] 7. Update docs
  - In `docs/components.md`: add `BottomNav` row to the styling ownership table (`src/components/navigation/BottomNav.css`); add a `## BottomNav` section documenting: no public props, `aria-label="Bottom navigation"`, tokens consumed (`--credence-surface-card`, `--credence-border-default`, `--credence-color-primary`, `--credence-text-secondary`, `--credence-space-*`, `--credence-font-size-xs`, `--credence-font-weight-*`, `--credence-motion-*`, `--credence-focus-ring`), visibility breakpoint (`≤ BREAKPOINTS.MD / 768 px`), and a usage example
  - In `docs/MOBILE_NAV_README.md`: update the implementation status section to mark "Phase 3: Implementation" complete; add a paragraph describing the two-component mobile nav architecture (`BottomNav` for primary routes at ≤768 px + `MobileNav` hamburger drawer for secondary/overflow routes)
  - _Requirements: 11_
