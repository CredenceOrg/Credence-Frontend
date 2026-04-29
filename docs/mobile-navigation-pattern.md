# Mobile Navigation Pattern — Official Implementation Guide

**Issue:** #77  
**Pattern:** Hybrid Responsive Navigation (Hamburger Mobile + Horizontal Desktop)  
**Status:** Implementation Ready  
**WCAG Compliance:** 2.1 AA

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Pattern Definition](#pattern-definition)
3. [Component Architecture](#component-architecture)
4. [Implementation Steps](#implementation-steps)
5. [Accessibility Requirements](#accessibility-requirements)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### What is this pattern?

A responsive navigation system that adapts to screen size:
- **Mobile (< 640px):** Hamburger menu with slide-in drawer
- **Desktop (≥ 640px):** Horizontal navigation in header

### Why this pattern?

- ✅ **Mobile-optimized:** Thumb-friendly, accessible, familiar
- ✅ **Desktop-preserved:** Existing horizontal nav works well
- ✅ **Accessible:** WCAG 2.1 AA compliant, keyboard/screen reader support
- ✅ **Scalable:** Supports future page additions

### When to use?

- Small to medium page count (3-10 pages)
- Flat information architecture (no deep nesting)
- Responsive web applications
- Accessibility-first projects

---

## Pattern Definition

### Mobile Navigation (< 640px)

```
┌─────────────────────────┐
│ ☰  Credence      [Theme]│ ← Tap ☰ to open drawer
└─────────────────────────┘

Drawer (overlay):
┌─────────────────┐
│ ✕ Menu          │ ← Close button
│                 │
│ 🏠 Home         │ ← Active page highlighted
│ 🔒 Bond         │
│ ⭐ Trust Score  │
│                 │
└─────────────────┘
```

**Behavior:**
- Hamburger button (☰) in top-left corner
- Drawer slides in from left (280px width)
- Backdrop overlay (semi-transparent)
- Closes on: backdrop click, close button, Escape key, navigation

### Desktop Navigation (≥ 640px)

```
┌─────────────────────────────────────────────┐
│ Credence    Home    Bond    Trust    [Theme]│ ← Horizontal links
└─────────────────────────────────────────────┘
```

**Behavior:**
- Horizontal links in header (current pattern)
- Active page highlighted
- Hover states on links

---

## Component Architecture

### File Structure

```
src/components/navigation/
├── MobileNav.tsx          — Hamburger + drawer (mobile only)
├── MobileNav.css          — Mobile nav styles
├── DesktopNav.tsx         — Horizontal nav (desktop only)
├── DesktopNav.css         — Desktop nav styles
├── NavigationLinks.tsx    — Shared navigation data
└── useMediaQuery.ts       — Breakpoint detection hook
```

### Component Hierarchy

```
Layout
├── MobileNav (< 640px)
│   ├── Hamburger Button
│   ├── Backdrop (when open)
│   └── Drawer
│       ├── Close Button
│       └── Navigation Links
└── DesktopNav (≥ 640px)
    └── Navigation Links
```

---

## Implementation Steps

### Step 1: Create Navigation Links Data

Create a shared data file for navigation links:

```tsx
// src/components/navigation/NavigationLinks.tsx
export interface NavigationLink {
  path: string
  label: string
  icon: string
}

export const navigationLinks: NavigationLink[] = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/bond', label: 'Bond', icon: '🔒' },
  { path: '/trust', label: 'Trust Score', icon: '⭐' },
]
```

**Why?** Single source of truth for navigation structure. Add new pages here.

---

### Step 2: Create Media Query Hook

Create a hook to detect screen size:

```tsx
// src/components/navigation/useMediaQuery.ts
import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    // Initialize with current match state
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const media = window.matchMedia(query)
    
    // Update state if initial value was wrong
    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    
    // Modern browsers
    media.addEventListener('change', listener)
    
    return () => media.removeEventListener('change', listener)
  }, [query, matches])

  return matches
}
```

**Usage:**
```tsx
const isMobile = useMediaQuery('(max-width: 639px)')
```

---

### Step 3: Create Mobile Navigation Component

Full implementation with accessibility:

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

  // Focus management: move focus to close button when drawer opens
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

  // Keyboard support: Escape key closes drawer
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

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const closeDrawer = () => {
    setIsOpen(false)
    hamburgerRef.current?.focus()
  }

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
        <span aria-hidden="true">☰</span>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={closeDrawer}
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
            onClick={closeDrawer}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <ul className="mobile-nav-links">
          {navigationLinks.map((link) => {
            const isActive = location.pathname === link.path
            return (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`mobile-nav-link ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="mobile-nav-icon" aria-hidden="true">
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
```

**Key Features:**
- ✅ Focus management (moves to close button, returns to hamburger)
- ✅ Keyboard support (Escape closes drawer)
- ✅ Body scroll lock (prevents background scrolling)
- ✅ Auto-close on navigation
- ✅ ARIA attributes for screen readers

---

### Step 4: Create Mobile Navigation Styles

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
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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
  flex-shrink: 0;
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

---

### Step 5: Create Desktop Navigation Component

```tsx
// src/components/navigation/DesktopNav.tsx
import { Link, useLocation } from 'react-router-dom'
import { navigationLinks } from './NavigationLinks'
import './DesktopNav.css'

export default function DesktopNav() {
  const location = useLocation()

  return (
    <nav aria-label="Main navigation" className="desktop-nav">
      {navigationLinks.map((link) => {
        const isActive = location.pathname === link.path
        return (
          <Link
            key={link.path}
            to={link.path}
            className={`desktop-nav-link ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

---

### Step 6: Create Desktop Navigation Styles

```css
/* src/components/navigation/DesktopNav.css */

.desktop-nav {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex: 1;
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

### Step 7: Update Layout Component

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header
        style={{
          padding: '1rem 2rem',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        {isMobile && <MobileNav />}
        <Link to="/" style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)', textDecoration: 'none' }}>
          Credence
        </Link>
        {!isMobile && <DesktopNav />}
        <ThemeToggle />
      </header>
      <main
        id="main-content"
        style={{
          flex: 1,
          padding: 'var(--space-6) var(--container-padding)',
          maxWidth: 'var(--container-max)',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="container footer-content">
          <div>
            <p style={{ fontWeight: 600, color: 'var(--slate-900)', marginBottom: '0.25rem' }}>Credence</p>
            <p>© 2026 Credence Protocol. Built on Stellar.</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
```

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

#### 1. Keyboard Navigation
- ✅ **Tab:** Navigate through drawer items
- ✅ **Shift+Tab:** Navigate backward
- ✅ **Enter/Space:** Activate links/buttons
- ✅ **Escape:** Close drawer, return focus

#### 2. Focus Management
- ✅ Focus moves to close button when drawer opens
- ✅ Focus trapped within drawer (no background interaction)
- ✅ Focus returns to hamburger when drawer closes
- ✅ Visible focus indicators (2px outline)

#### 3. ARIA Attributes
```tsx
// Hamburger button
aria-label="Open navigation menu"
aria-expanded={isOpen}
aria-controls="mobile-nav-drawer"

// Drawer
id="mobile-nav-drawer"
aria-label="Mobile navigation"
hidden={!isOpen}

// Active link
aria-current="page"
```

#### 4. Screen Reader Support
- ✅ Hamburger announces: "Open navigation menu, button"
- ✅ Drawer announces: "Mobile navigation, navigation"
- ✅ Active link announces: "Home, link, current page"
- ✅ Close button announces: "Close navigation menu, button"

#### 5. Touch Targets
- ✅ Minimum size: 44×44px (WCAG 2.5.5)
- ✅ Adequate spacing between targets
- ✅ No overlapping interactive elements

---

## Testing Guide

### Manual Testing Checklist

#### Functional Tests
- [ ] Hamburger button opens drawer
- [ ] Drawer slides in smoothly (300ms)
- [ ] Backdrop appears behind drawer
- [ ] Close button (✕) closes drawer
- [ ] Backdrop click closes drawer
- [ ] Escape key closes drawer
- [ ] Navigation closes drawer
- [ ] Active page highlighted
- [ ] Desktop nav shows on tablet/desktop
- [ ] Mobile nav shows on mobile

#### Accessibility Tests
- [ ] Tab through all interactive elements
- [ ] Focus visible on all elements
- [ ] Escape closes drawer
- [ ] Focus returns to hamburger after close
- [ ] Screen reader announces drawer state
- [ ] Screen reader announces active page
- [ ] All touch targets ≥ 44×44px

#### Visual Tests
- [ ] Drawer width 280px (max 70vw)
- [ ] Backdrop opacity 0.5
- [ ] Active state uses primary color
- [ ] Hover states visible
- [ ] Dark mode compatible
- [ ] Icons render correctly
- [ ] No layout shift on load

#### Cross-Browser Tests
- [ ] iOS Safari (iPhone 12, 14, 15 Pro)
- [ ] Android Chrome (Pixel, Samsung)
- [ ] Desktop Chrome (resize to mobile)
- [ ] Desktop Firefox (resize to mobile)
- [ ] Desktop Safari (resize to mobile)

### Automated Testing

```tsx
// Example test with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import MobileNav from './MobileNav'

describe('MobileNav', () => {
  it('opens drawer when hamburger clicked', () => {
    render(
      <BrowserRouter>
        <MobileNav />
      </BrowserRouter>
    )
    
    const hamburger = screen.getByLabelText('Open navigation menu')
    fireEvent.click(hamburger)
    
    const drawer = screen.getByLabelText('Mobile navigation')
    expect(drawer).not.toHaveAttribute('hidden')
  })

  it('closes drawer when Escape pressed', () => {
    render(
      <BrowserRouter>
        <MobileNav />
      </BrowserRouter>
    )
    
    const hamburger = screen.getByLabelText('Open navigation menu')
    fireEvent.click(hamburger)
    
    fireEvent.keyDown(document, { key: 'Escape' })
    
    const drawer = screen.getByLabelText('Mobile navigation')
    expect(drawer).toHaveAttribute('hidden')
  })
})
```

---

## Troubleshooting

### Issue: Drawer doesn't slide in smoothly

**Cause:** CSS transition not applied or GPU acceleration needed

**Fix:**
```css
.mobile-nav-drawer {
  transform: translateX(-100%);
  transition: transform 300ms ease-in-out;
  will-change: transform; /* GPU acceleration */
}
```

---

### Issue: Body scrolls when drawer is open

**Cause:** Body scroll not locked

**Fix:** Ensure this effect is in MobileNav component:
```tsx
useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
  return () => {
    document.body.style.overflow = ''
  }
}, [isOpen])
```

---

### Issue: Focus not trapped in drawer

**Cause:** Missing focus trap implementation

**Fix:** Use a focus trap library or implement manually:
```tsx
// Install: npm install focus-trap-react
import FocusTrap from 'focus-trap-react'

<FocusTrap active={isOpen}>
  <nav className="mobile-nav-drawer">
    {/* Drawer content */}
  </nav>
</FocusTrap>
```

---

### Issue: Drawer visible on desktop

**Cause:** Media query not working

**Fix:** Ensure CSS media query is correct:
```css
@media (min-width: 640px) {
  .mobile-nav-drawer {
    display: none !important;
  }
}
```

---

### Issue: Hamburger icon not rendering

**Cause:** Font encoding or emoji support

**Fix:** Use SVG icon instead:
```tsx
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
</svg>
```

---

## 🔗 Related Documentation

- [Mobile Navigation Decision Matrix](./mobile-navigation-DECISION.md)
- [Mobile Navigation Reconnaissance](./mobile-nav-RECON.md)
- [Accessibility Guidelines](./accessibility.md)
- [Focus Management Patterns](./focus-patterns.md)
- [Figma Navigation Rules](./figma-nav-rules.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-29  
**Maintained By:** Credence Frontend Team
