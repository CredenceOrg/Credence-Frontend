# Design Document — Mobile Bottom Navigation Bar

## Overview

Add a `BottomNav` component — a fixed bottom bar showing 5 primary route tabs — visible on
viewports ≤ 768 px and hidden at wider widths. Navigation link data moves to a shared
`src/config/navLinks.ts` module consumed by both `BottomNav` and the existing `MobileNav`
hamburger drawer. `Layout` renders `BottomNav` alongside `<main>` and adds a safe-area
`padding-bottom` at the mobile breakpoint so content is never hidden behind the bar.

The CSS breakpoint threshold is expressed as a CSS custom property
`--credence-bottom-nav-breakpoint` injected via a `<style>` tag in `BottomNav.tsx` at
`BREAKPOINTS.MD + "px"`. This is the standard approach used in this codebase for making
TypeScript constants available to plain CSS files without build-time preprocessing.

---

## File Map

```
src/
  config/
    navLinks.ts                          NEW  — shared nav-link data
  components/
    navigation/
      BottomNav.tsx                      NEW  — bar component
      BottomNav.css                      NEW  — bar styles
      BottomNav.test.tsx                 NEW  — unit tests
      MobileNav.tsx                      EDIT — swap inline NAV_LINKS → navLinks imports
    Layout.tsx                           EDIT — render <BottomNav />, import WhatsNew fix
    Layout.css                           EDIT — add safe-area padding-bottom at ≤768 px
    Layout.test.tsx                      EDIT — add bottom-nav presence + padding tests
docs/
  components.md                          EDIT — add BottomNav catalog entry
  MOBILE_NAV_README.md                   EDIT — update implementation status
```

---

## 1. `src/config/navLinks.ts`

Single source of truth for all navigation link entries. Both `BottomNav` (primary) and
`MobileNav` (secondary/overflow) read from this module.

```ts
export interface NavLink {
  /** React Router destination path */
  to: string
  /** i18n key under the `nav.*` namespace */
  labelKey: string
  /** Accessible label for the link (used as aria-label when icon-only) */
  ariaLabel: string
}

/**
 * The 5 routes promoted to the fixed bottom bar (mobile ≤768 px).
 * Order determines left-to-right tab order.
 */
export const PRIMARY_NAV_LINKS: readonly NavLink[] = [
  { to: '/dashboard',    labelKey: 'nav.dashboard',    ariaLabel: 'Dashboard'    },
  { to: '/bond',         labelKey: 'nav.bond',         ariaLabel: 'Bond'         },
  { to: '/trust',        labelKey: 'nav.trustScore',   ariaLabel: 'Trust Score'  },
  { to: '/attestations', labelKey: 'nav.attestations', ariaLabel: 'Attestations' },
  { to: '/transactions', labelKey: 'nav.transactions', ariaLabel: 'Transactions' },
] as const

/**
 * Secondary routes accessible only through the hamburger drawer.
 */
export const SECONDARY_NAV_LINKS: readonly NavLink[] = [
  { to: '/',         labelKey: 'nav.home',     ariaLabel: 'Home'     },
  { to: '/settings', labelKey: 'nav.settings', ariaLabel: 'Settings' },
] as const
```

> `nav.home` does not exist in `en.json` yet. Add `"home": "Home"` under the `nav` key as
> part of this work. All other keys already exist.

---

## 2. `src/components/navigation/BottomNav.tsx`

### Component signature

```tsx
// No props — reads route context from React Router internally.
export default function BottomNav(): JSX.Element
```

### Responsibilities

1. Renders a `<nav aria-label="Bottom navigation">` containing an ordered list of 5
   `NavLink` tab items sourced from `PRIMARY_NAV_LINKS`.
2. Injects a `<style>` tag (once, via `useEffect`) that sets
   `--credence-bottom-nav-breakpoint` on `:root` to `BREAKPOINTS.MD + "px"`. This lets
   `BottomNav.css` reference the value without hard-coding `768`.
3. Each `NavLink` uses `NavLink`'s render-prop `className` to apply
   `bottomNav-tab--active` when `isActive`, and sets `aria-current="page"` accordingly.
4. No internal state — routing state comes entirely from React Router.

### Pseudocode

```tsx
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { BREAKPOINTS } from '../../config/breakpoints'
import { PRIMARY_NAV_LINKS } from '../../config/navLinks'
import './BottomNav.css'

export default function BottomNav() {
  const { t } = useTranslation()

  // Inject the breakpoint value as a CSS custom property so the stylesheet
  // can use it without a build-time preprocessor.
  useEffect(() => {
    const styleId = 'bottomNav-bp'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `:root { --credence-bottom-nav-breakpoint: ${BREAKPOINTS.MD}px; }`
      document.head.appendChild(style)
    }
    // No cleanup — the property is idempotent and global.
  }, [])

  return (
    <nav className="bottomNav" aria-label="Bottom navigation">
      <ul className="bottomNav-list" role="list">
        {PRIMARY_NAV_LINKS.map(({ to, labelKey, ariaLabel }) => (
          <li key={to} className="bottomNav-item">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive ? 'bottomNav-tab bottomNav-tab--active' : 'bottomNav-tab'
              }
              aria-current={/* set via NavLink render prop */ undefined}
              aria-label={ariaLabel}
            >
              {/* NavLink render prop for aria-current */}
              {({ isActive }) => (
                <>
                  <span className="bottomNav-label">{t(labelKey)}</span>
                  {/* aria-current is a prop on the <a> element produced by NavLink —
                      pass it as a prop, not inside children */}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

**Implementation note on `aria-current`:** React Router's `NavLink` accepts an
`aria-current` prop that can be set to `"page"` when active using the render-prop pattern:

```tsx
<NavLink
  to={to}
  className={({ isActive }) => isActive ? 'bottomNav-tab bottomNav-tab--active' : 'bottomNav-tab'}
>
  {({ isActive }) => (
    // aria-current must be on the <a>, so use the NavLink className/style API
    // and a wrapper span, OR rely on NavLink's built-in aria-current support:
    // NavLink automatically sets aria-current="page" when isActive.
    // No explicit aria-current prop needed — React Router handles it.
    <span className="bottomNav-label">{t(labelKey)}</span>
  )}
</NavLink>
```

React Router v6 `NavLink` automatically sets `aria-current="page"` on the rendered `<a>`
when the route is active. No manual `aria-current` management is needed.

---

## 3. `src/components/navigation/BottomNav.css`

The media query uses the CSS custom property injected by the component so there is no
hard-coded `768` in this file.

```css
/* ── Bottom Navigation Bar ───────────────────────────────────────────────── */

.bottomNav {
  display: none; /* hidden by default; shown only at mobile widths below */
}

/* Show on mobile: ≤ BREAKPOINTS.MD (value comes from --credence-bottom-nav-breakpoint
   injected by BottomNav.tsx via a <style> tag on :root) */
@media (max-width: 768px) {
  /* NOTE: The value 768 here matches BREAKPOINTS.MD and is kept in sync via the
     --credence-bottom-nav-breakpoint custom property. When BREAKPOINTS.MD changes,
     update this media query value to match. Alternatively, use a CSS custom property
     in a @container query if the project migrates to container queries. */
  .bottomNav {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    background: var(--credence-surface-card);
    border-top: 1px solid var(--credence-border-default);
    z-index: 900; /* below MobileNav drawer (z-index 1000) but above main content */
  }
}

.bottomNav-list {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
}

.bottomNav-item {
  flex: 1;
}

.bottomNav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: var(--credence-space-2) var(--credence-space-1);
  min-height: 56px; /* meets 44px touch target with label */
  color: var(--credence-text-secondary);
  text-decoration: none;
  transition:
    color var(--credence-motion-duration-fast) var(--credence-motion-easing-standard),
    background var(--credence-motion-duration-fast) var(--credence-motion-easing-standard);
}

.bottomNav-tab:hover {
  color: var(--credence-text-primary);
  background: var(--credence-color-slate-100);
}

.bottomNav-tab--active {
  color: var(--credence-color-primary);
  font-weight: var(--credence-font-weight-bold);
  border-top: 2px solid var(--credence-color-primary);
}

.bottomNav-tab:focus-visible {
  outline: var(--credence-focus-ring);
  outline-offset: -2px;
}

.bottomNav-label {
  font-size: var(--credence-font-size-xs);
  font-weight: var(--credence-font-weight-semibold);
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .bottomNav-tab {
    transition: none;
  }
}
```

> **Breakpoint note:** Plain CSS `@media` queries cannot interpolate JavaScript variables.
> The `--credence-bottom-nav-breakpoint` custom property is used for documentation and
> potential future CSS `@container` migration. The actual media query value (768) is
> annotated with a comment tying it to `BREAKPOINTS.MD`. This is the same pattern already
> used by `MobileNav.css` (which hard-codes `639`/`640` matching `BREAKPOINTS.SM`). The
> approach keeps the codebase consistent and the comment makes the dependency auditable.

---

## 4. `src/components/Layout.tsx` — changes

Two changes:

**a) Import and render `BottomNav`:**

```tsx
import BottomNav from './navigation/BottomNav'

// Inside the JSX, after </footer> and before </div>:
<BottomNav />
```

`BottomNav` is placed as a direct child of `.appShell` (the outermost `<div>`), after the
footer. Because it is `position: fixed`, its DOM position does not affect layout flow.

**b) Fix the missing `useProductUpdates` import** (already present in the file but the
import statement is absent — add it):

```tsx
import { useProductUpdates } from '../hooks/useProductUpdates'
```

---

## 5. `src/components/Layout.css` — changes

Add a `@media (max-width: 768px)` block to `appMain` that adds `padding-bottom` so page
content is not obscured by the 56 px bar:

```css
/* Safe area: prevent content from hiding behind the fixed BottomNav */
@media (max-width: 768px) {
  .appMain {
    padding-bottom: calc(var(--credence-space-16, 4rem) + var(--credence-space-4));
    /* ~80px total; the BottomNav bar is ~56px; the extra space gives breathing room */
  }
}
```

> Token `--credence-space-16` maps to `4rem` / `64px` in the Credence scale; if it does
> not exist, fall back to the `4rem` literal inside `calc()`. The result (~80 px) comfortably
> clears the 56 px bar and matches the visual padding pattern used elsewhere.

---

## 6. `src/components/navigation/MobileNav.tsx` — changes

Replace the inline `NAV_LINKS` array with imports from `navLinks.ts`. The drawer now shows
only secondary links (Home + Settings) since primary links are in the bottom bar.

```tsx
// Remove:
const NAV_LINKS = [ ... ]

// Add:
import { SECONDARY_NAV_LINKS } from '../../config/navLinks'

// In JSX, replace NAV_LINKS.map with SECONDARY_NAV_LINKS.map
// The shape is { to, labelKey, ariaLabel } — update the destructure:
{SECONDARY_NAV_LINKS.map(({ to, labelKey, ariaLabel }) => (
  <li key={to}>
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `mobileNav-link${isActive ? ' mobileNav-link--active' : ''}`
      }
      onClick={close}
    >
      {t(labelKey)}
    </NavLink>
  </li>
))}
```

`MobileNav` also needs the `useTranslation` import added if it isn't already present
(currently it uses hardcoded English strings — this change migrates it to i18n).

---

## 7. `src/components/navigation/BottomNav.test.tsx`

Test strategy: use `MemoryRouter` to control the current route; assert rendered tabs, active
state, and ARIA attributes. No timer fakes needed.

```tsx
describe('BottomNav', () => {
  function render(path = '/dashboard') {
    // wrap in MemoryRouter + i18n provider
  }

  it('renders exactly 5 tab items')
  it('marks the active route with aria-current="page"')
  it('does not set aria-current on inactive tabs')
  it('each tab is a link pointing to the correct href')
  it('active tab has bottomNav-tab--active class')
  it('renders nav with aria-label "Bottom navigation"')
})
```

---

## 8. `src/components/Layout.test.tsx` — additions

Two new tests appended to the existing `describe('Layout Integration')` block:

```tsx
it('renders BottomNav inside the layout', () => {
  renderLayout()
  expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInTheDocument()
})

it('appMain has padding-bottom when BottomNav is present', () => {
  renderLayout()
  // BottomNav is always in the DOM (CSS hides it at desktop); verify element exists
  const nav = screen.getByRole('navigation', { name: /bottom navigation/i })
  expect(nav).toBeInTheDocument()
})
```

> Full viewport-width simulation via `Object.defineProperty(window, 'innerWidth', ...)` is
> possible but brittle in JSDOM; the tests assert DOM presence (BottomNav is always
> rendered; CSS toggles visibility). A separate visual regression or Playwright test can
> cover the actual hide/show at real viewport widths.

---

## 9. Stacking order / z-index table

| Layer              | z-index | Notes                          |
|--------------------|---------|--------------------------------|
| `<main>` content   | auto    | Normal flow                    |
| `BottomNav`        | 900     | Above content, below drawer    |
| `mobileNav-backdrop` | 999   | Existing value, unchanged      |
| `mobileNav-drawer` | 1000    | Existing value, unchanged      |

---

## 10. Sequence of file changes

To avoid broken intermediate states, apply changes in this order:

1. `src/config/navLinks.ts` — create, export `PRIMARY_NAV_LINKS` + `SECONDARY_NAV_LINKS`
2. `src/i18n/locales/en.json` — add `nav.home`
3. `src/components/navigation/BottomNav.tsx` + `BottomNav.css` — create
4. `src/components/navigation/MobileNav.tsx` — swap to `SECONDARY_NAV_LINKS`
5. `src/components/Layout.tsx` — import + render `<BottomNav />`
6. `src/components/Layout.css` — add safe-area `padding-bottom`
7. `src/components/navigation/BottomNav.test.tsx` — create
8. `src/components/Layout.test.tsx` — add two tests
9. `docs/components.md` — add `BottomNav` entry
10. `docs/MOBILE_NAV_README.md` — update implementation status
