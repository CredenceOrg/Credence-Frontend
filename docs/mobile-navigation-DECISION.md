# Mobile Navigation Pattern Decision Matrix — Issue #77

**Date:** 2026-04-29  
**Project:** Credence-Frontend  
**Decision:** HYBRID RESPONSIVE PATTERN (Hamburger Mobile + Horizontal Desktop)  
**Status:** ✅ APPROVED FOR IMPLEMENTATION

---

## 🎯 Executive Summary

After comprehensive IA analysis of Credence-Frontend (4 pages, flat hierarchy, web application), we have selected a **Hybrid Responsive Navigation Pattern**:

- **Mobile (< 640px):** Hamburger menu with slide-in drawer
- **Tablet/Desktop (≥ 640px):** Horizontal header navigation (current pattern)

This decision optimizes for:
1. **Mobile usability** (thumb-friendly, accessible)
2. **Desktop familiarity** (preserve working pattern)
3. **Accessibility compliance** (WCAG 2.1 AA)
4. **Scalability** (supports future page additions)

---

## 📊 DECISION MATRIX

| Criterion | Hamburger Only | Bottom Tab Bar | Hybrid (Selected) | Horizontal Only |
|-----------|----------------|----------------|-------------------|-----------------|
| **Mobile Usability** | ✅ Good | ✅ Excellent | ✅ Excellent | ❌ Poor |
| **Desktop Usability** | ⚠️ Unnecessary | ❌ Awkward | ✅ Excellent | ✅ Excellent |
| **Discoverability** | ⚠️ Hidden | ✅ Always visible | ✅ Contextual | ✅ Always visible |
| **Screen Count (3 pages)** | ✅ Scales well | ✅ Perfect fit | ✅ Perfect fit | ✅ Works |
| **Thumb Reachability** | ⚠️ Top-left | ✅ Bottom (ideal) | ✅ Top-left mobile | ❌ Top (hard) |
| **Web Conventions** | ✅ Standard | ⚠️ Uncommon | ✅ Standard | ✅ Standard |
| **Accessibility** | ✅ WCAG compliant | ✅ WCAG compliant | ✅ WCAG compliant | ⚠️ Mobile issues |
| **Implementation Effort** | 🟡 Medium | 🟡 Medium | 🟠 Medium-High | 🟢 Low (current) |
| **Maintenance** | 🟢 Single pattern | 🟢 Single pattern | 🟡 Two patterns | 🟢 Single pattern |
| **Gesture Conflicts** | ⚠️ Swipe-back | ✅ None | ⚠️ Swipe-back | ✅ None |
| **Future Scalability** | ✅ 10+ pages | ⚠️ Max 5 pages | ✅ 10+ pages | ⚠️ 5-7 pages |

### Scoring Summary
- **Hamburger Only:** 7/11 ✅ (good mobile, awkward desktop)
- **Bottom Tab Bar:** 8/11 ✅ (excellent mobile, uncommon on web)
- **Hybrid (Selected):** 10/11 ✅✅ (best of both worlds)
- **Horizontal Only:** 5/11 ⚠️ (current state, mobile broken)

---

## 🏆 OFFICIAL DECISION: HYBRID RESPONSIVE PATTERN

### Pattern Definition

#### Mobile Navigation (< 640px)
```
┌─────────────────────────┐
│ ☰  Credence      [Theme]│ ← Hamburger trigger
└─────────────────────────┘
│                         │
│   [Page Content]        │
│                         │
└─────────────────────────┘

Drawer (when open):
┌─────────────────┐
│ ✕ Menu          │
│                 │
│ 🏠 Home         │ ← Active state highlighted
│ 🔒 Bond         │
│ ⭐ Trust Score  │
│                 │
│ ─────────────── │
│ [Theme Toggle]  │
└─────────────────┘
```

#### Desktop Navigation (≥ 640px)
```
┌─────────────────────────────────────────────┐
│ Credence    Home    Bond    Trust    [Theme]│ ← Horizontal (current)
└─────────────────────────────────────────────┘
```

---

## 📐 DETAILED SPECIFICATIONS

### Mobile Drawer Component

#### Visual Design
```css
Drawer Container:
- Width: 280px (max 70vw)
- Height: 100vh
- Background: var(--bg-card)
- Border-right: 1px solid var(--border-default)
- Box-shadow: 4px 0 12px rgba(0,0,0,0.15)
- Z-index: 1000
- Position: fixed, left: 0, top: 0

Backdrop:
- Background: rgba(0,0,0,0.5)
- Z-index: 999
- Position: fixed, covers viewport
- Backdrop-filter: blur(2px) (optional)

Animation:
- Transition: transform 300ms ease-in-out
- Transform: translateX(-100%) → translateX(0)
```

#### Navigation Links
```css
Link Item:
- Padding: 12px 16px
- Font-size: 16px
- Font-weight: 600
- Border-radius: 8px
- Margin-bottom: 4px

States:
- Default: color var(--text-primary)
- Hover: background var(--bg-page)
- Active: background var(--color-primary), color white
- Focus: outline 2px solid var(--color-primary), offset 2px
```

#### Hamburger Icon
```css
Button:
- Size: 44×44px (touch target)
- Icon: 24×24px (☰ three horizontal lines)
- Color: var(--text-primary)
- Background: transparent
- Border: none
- Border-radius: 8px

States:
- Hover: background var(--bg-page)
- Active: scale 0.95
- Focus: outline 2px solid var(--color-primary)
```

### Desktop Navigation (Unchanged)

Current horizontal navigation in header works well for tablet/desktop. No changes required.

---

## ♿ ACCESSIBILITY REQUIREMENTS

### ARIA Attributes

#### Hamburger Button
```tsx
<button
  aria-label="Open navigation menu"
  aria-expanded={isOpen}
  aria-controls="mobile-nav-drawer"
  onClick={toggleDrawer}
>
  ☰
</button>
```

#### Drawer Container
```tsx
<nav
  id="mobile-nav-drawer"
  aria-label="Mobile navigation"
  role="navigation"
  hidden={!isOpen}
>
  {/* Navigation links */}
</nav>
```

#### Close Button
```tsx
<button
  aria-label="Close navigation menu"
  onClick={closeDrawer}
>
  ✕
</button>
```

### Keyboard Support

| Key | Action |
|-----|--------|
| **Tab** | Move focus through drawer items |
| **Shift+Tab** | Move focus backward |
| **Enter/Space** | Activate focused link/button |
| **Escape** | Close drawer, return focus to hamburger |

### Focus Management

1. **Open drawer:** Focus moves to close button (✕)
2. **Tab navigation:** Focus trapped within drawer
3. **Close drawer:** Focus returns to hamburger button
4. **Backdrop click:** Close drawer, restore focus

### Screen Reader Announcements

```
User taps hamburger:
→ "Navigation menu, expanded"

User navigates to link:
→ "Home, link, current page" (if active)
→ "Bond, link" (if not active)

User closes drawer:
→ "Navigation menu, collapsed"
```

---

## 🎨 FIGMA DESIGN SYSTEM RULES

### Component Structure (Figma)

```
📁 Navigation
  📁 Mobile
    🎨 Hamburger Button
      ├── Default
      ├── Hover
      ├── Active
      └── Focus
    🎨 Drawer
      ├── Closed (hidden)
      └── Open
        ├── Header (close button)
        ├── Navigation Links
        └── Footer (theme toggle)
    🎨 Backdrop
  📁 Desktop
    🎨 Horizontal Nav (existing)
```

### Design Tokens

```json
{
  "mobile-nav": {
    "drawer-width": "280px",
    "drawer-max-width": "70vw",
    "backdrop-opacity": "0.5",
    "animation-duration": "300ms",
    "animation-easing": "ease-in-out",
    "z-index-backdrop": "999",
    "z-index-drawer": "1000"
  },
  "touch-targets": {
    "minimum-size": "44px",
    "icon-size": "24px",
    "padding": "12px 16px"
  },
  "spacing": {
    "drawer-padding": "24px 16px",
    "link-margin": "4px",
    "header-padding": "16px"
  }
}
```

### Responsive Breakpoints

```css
/* Mobile: Hamburger drawer */
@media (max-width: 639px) {
  .desktop-nav { display: none; }
  .mobile-nav { display: block; }
}

/* Tablet/Desktop: Horizontal nav */
@media (min-width: 640px) {
  .mobile-nav { display: none; }
  .desktop-nav { display: flex; }
}
```

---

## 🛠️ IMPLEMENTATION GUIDE

### Component Architecture

```
src/components/navigation/
├── MobileNav.tsx          — Hamburger + drawer (mobile only)
├── DesktopNav.tsx         — Horizontal nav (tablet/desktop)
├── NavigationLinks.tsx    — Shared link data
└── useMediaQuery.ts       — Breakpoint detection hook
```

### Code Structure

#### 1. Navigation Links Data
```tsx
// src/components/navigation/NavigationLinks.tsx
export const navigationLinks = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/bond', label: 'Bond', icon: '🔒' },
  { path: '/trust', label: 'Trust Score', icon: '⭐' },
]
```

#### 2. Media Query Hook
```tsx
// src/components/navigation/useMediaQuery.ts
import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}
```

#### 3. Mobile Navigation Component
```tsx
// src/components/navigation/MobileNav.tsx
import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { navigationLinks } from './NavigationLinks'
import './MobileNav.css'

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  // Focus management
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

  // Keyboard support (Escape to close)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        hamburgerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Hamburger Button */}
      <button
        ref={hamburgerRef}
        className="mobile-nav-hamburger"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
        onClick={() => setIsOpen(true)}
      >
        ☰
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <nav
        id="mobile-nav-drawer"
        className={`mobile-nav-drawer ${isOpen ? 'open' : ''}`}
        aria-label="Mobile navigation"
        hidden={!isOpen}
      >
        <div className="mobile-nav-header">
          <button
            ref={closeButtonRef}
            className="mobile-nav-close"
            aria-label="Close navigation menu"
            onClick={() => {
              setIsOpen(false)
              hamburgerRef.current?.focus()
            }}
          >
            ✕
          </button>
        </div>

        <ul className="mobile-nav-links">
          {navigationLinks.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={`mobile-nav-link ${location.pathname === link.path ? 'active' : ''}`}
                aria-current={location.pathname === link.path ? 'page' : undefined}
              >
                <span className="mobile-nav-icon">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
```

#### 4. Desktop Navigation Component
```tsx
// src/components/navigation/DesktopNav.tsx
import { Link, useLocation } from 'react-router-dom'
import { navigationLinks } from './NavigationLinks'
import './DesktopNav.css'

export default function DesktopNav() {
  const location = useLocation()

  return (
    <nav aria-label="Main navigation" className="desktop-nav">
      {navigationLinks.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className={`desktop-nav-link ${location.pathname === link.path ? 'active' : ''}`}
          aria-current={location.pathname === link.path ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
```

#### 5. Updated Layout Component
```tsx
// src/components/Layout.tsx
import { Outlet, Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import MobileNav from './navigation/MobileNav'
import DesktopNav from './navigation/DesktopNav'
import { useMediaQuery } from './navigation/useMediaQuery'

export default function Layout() {
  const isMobile = useMediaQuery('(max-width: 639px)')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        {isMobile ? <MobileNav /> : null}
        <Link to="/" className="app-logo">
          Credence
        </Link>
        {!isMobile ? <DesktopNav /> : null}
        <ThemeToggle />
      </header>
      <main id="main-content" className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        {/* Footer content */}
      </footer>
    </div>
  )
}
```

---

## 🎨 CSS IMPLEMENTATION

### Mobile Navigation Styles
```css
/* src/components/navigation/MobileNav.css */

/* Hamburger Button */
.mobile-nav-hamburger {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 150ms ease;
}

.mobile-nav-hamburger:hover {
  background: var(--bg-page);
}

.mobile-nav-hamburger:active {
  transform: scale(0.95);
}

.mobile-nav-hamburger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Backdrop */
.mobile-nav-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  animation: fadeIn 300ms ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Drawer */
.mobile-nav-drawer {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  max-width: 70vw;
  height: 100vh;
  background: var(--bg-card);
  border-right: 1px solid var(--border-default);
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  transform: translateX(-100%);
  transition: transform 300ms ease-in-out;
  overflow-y: auto;
}

.mobile-nav-drawer.open {
  transform: translateX(0);
}

.mobile-nav-drawer[hidden] {
  display: none;
}

/* Drawer Header */
.mobile-nav-header {
  display: flex;
  justify-content: flex-end;
  padding: 16px;
  border-bottom: 1px solid var(--border-default);
}

.mobile-nav-close {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 150ms ease;
}

.mobile-nav-close:hover {
  background: var(--bg-page);
}

.mobile-nav-close:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Navigation Links */
.mobile-nav-links {
  list-style: none;
  padding: 24px 16px;
  margin: 0;
}

.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  border-radius: 8px;
  transition: background 150ms ease;
}

.mobile-nav-link:hover {
  background: var(--bg-page);
}

.mobile-nav-link.active {
  background: var(--color-primary);
  color: white;
}

.mobile-nav-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.mobile-nav-icon {
  font-size: 20px;
}

/* Responsive: Hide on desktop */
@media (min-width: 640px) {
  .mobile-nav-hamburger,
  .mobile-nav-backdrop,
  .mobile-nav-drawer {
    display: none;
  }
}
```

### Desktop Navigation Styles
```css
/* src/components/navigation/DesktopNav.css */

.desktop-nav {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.desktop-nav-link {
  padding: 0.5rem 1rem;
  font-weight: 500;
  color: var(--text-primary);
  text-decoration: none;
  border-radius: 8px;
  transition: background 150ms ease;
}

.desktop-nav-link:hover {
  background: var(--bg-page);
}

.desktop-nav-link.active {
  font-weight: 600;
  color: var(--color-primary);
}

.desktop-nav-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Responsive: Hide on mobile */
@media (max-width: 639px) {
  .desktop-nav {
    display: none;
  }
}
```

---

## ✅ VALIDATION CHECKLIST

### Functional Requirements
- [ ] Hamburger button opens drawer on mobile
- [ ] Drawer slides in from left with animation
- [ ] Backdrop closes drawer when clicked
- [ ] Close button (✕) closes drawer
- [ ] Escape key closes drawer
- [ ] Active page is highlighted in drawer
- [ ] Drawer closes automatically on navigation
- [ ] Desktop nav shows on tablet/desktop (≥ 640px)
- [ ] Mobile nav shows on mobile (< 640px)

### Accessibility Requirements
- [ ] Hamburger has `aria-label` and `aria-expanded`
- [ ] Drawer has `id` and `aria-label`
- [ ] Close button has `aria-label`
- [ ] Active link has `aria-current="page"`
- [ ] Focus moves to close button when drawer opens
- [ ] Focus returns to hamburger when drawer closes
- [ ] Tab navigation trapped in drawer
- [ ] Escape key closes drawer
- [ ] Screen reader announces drawer state
- [ ] All touch targets ≥ 44×44px

### Visual Requirements
- [ ] Drawer width 280px (max 70vw)
- [ ] Backdrop opacity 0.5
- [ ] Animation duration 300ms
- [ ] Active state uses primary color
- [ ] Hover states visible
- [ ] Focus outlines visible
- [ ] Dark mode compatible
- [ ] Icons render correctly

### Cross-Browser Testing
- [ ] iOS Safari (iPhone 12, 14, 15 Pro)
- [ ] Android Chrome (Pixel, Samsung)
- [ ] Desktop Chrome (resize to mobile)
- [ ] Desktop Firefox (resize to mobile)
- [ ] Desktop Safari (resize to mobile)

### Performance
- [ ] No layout shift on load
- [ ] Smooth animation (60fps)
- [ ] No scroll jank
- [ ] Body scroll locked when drawer open

---

## 🚀 MIGRATION PLAN

### Phase 1: Development (Day 1-2)
1. Create navigation components
2. Add media query hook
3. Update Layout component
4. Add CSS styles
5. Test locally

### Phase 2: Testing (Day 2-3)
1. Manual testing on real devices
2. Accessibility audit (VoiceOver, TalkBack)
3. Cross-browser testing
4. Performance profiling

### Phase 3: Documentation (Day 3)
1. Update Figma designs
2. Document component API
3. Add usage examples
4. Update accessibility.md

### Phase 4: Deployment (Day 4)
1. Deploy to staging
2. QA review
3. Deploy to production
4. Monitor analytics

### Rollback Plan
- If critical issues detected, revert Layout.tsx to previous version
- Desktop navigation unchanged (zero risk)
- Mobile users see desktop nav (degraded but functional)

---

## 📊 SUCCESS METRICS

### Quantitative
- **Navigation usage:** 80%+ mobile users successfully navigate
- **Time to navigate:** < 2 seconds from hamburger tap to page load
- **Error rate:** < 1% (drawer fails to open/close)
- **Accessibility score:** 100% WCAG 2.1 AA compliance

### Qualitative
- User feedback survey (2 weeks post-launch)
- Accessibility audit report
- Cross-browser compatibility report

---

## 🔗 RELATED DOCUMENTATION

- [Mobile Navigation Reconnaissance](./mobile-nav-RECON.md)
- [Accessibility Guidelines](./accessibility.md)
- [Focus Management Patterns](./focus-patterns.md)
- [Figma Design Specs](./FIGMA_DESIGN_SPECS.md)

---

## 📝 APPROVAL & SIGN-OFF

**Decision Approved By:** [Product/Design Team]  
**Date:** 2026-04-29  
**Implementation Owner:** [Developer Name]  
**Target Completion:** [Date]

---

**Document Status:** ✅ APPROVED FOR IMPLEMENTATION  
**Next Step:** Create Figma mockups → Implement components → Test → Deploy
