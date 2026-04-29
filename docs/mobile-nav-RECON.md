# Mobile Navigation Reconnaissance Report — Issue #77

**Date:** 2026-04-29  
**Project:** Credence-Frontend  
**Platform:** Web Application (React + Vite + react-router-dom)  
**Audit Scope:** Information Architecture & Mobile Navigation Pattern Decision

---

## 🔍 CRITICAL DISCOVERY

**This is a RESPONSIVE WEB APPLICATION, not a React Native mobile app.**

- **Framework:** React 18.2 + Vite 5.1
- **Routing:** react-router-dom v6.22 (web routing, not React Navigation)
- **Target:** Mobile web browsers (iOS Safari, Android Chrome)
- **Current State:** Desktop-first horizontal header navigation

**Implication:** Navigation pattern must be mobile-responsive web patterns (hamburger menu, bottom nav bar, etc.), NOT React Navigation native components.

---

## 📊 SCREEN INVENTORY

### Primary Pages (4 total)
```
├── Home (/)                    — Landing, overview, CTAs
├── Bond (/bond)                — Create bond, view active bonds
├── Trust Score (/trust)        — Lookup identity, view activity
└── ToastTest (/toast-test)     — Component testing page (dev only)
```

### Current Navigation Structure
```
App (BrowserRouter)
└── Layout (header + footer wrapper)
    ├── Header Navigation (horizontal links)
    │   ├── Home (logo link)
    │   ├── Bond
    │   └── Trust Score
    └── Routes (react-router-dom)
        ├── / → Home
        ├── /bond → Bond
        └── /trust → TrustScore
```

**Screen Depth:** Flat (1 level) — no nested routes or deep flows currently

---

## 🎯 INFORMATION ARCHITECTURE ANALYSIS

### Primary Tasks (80% Usage — Estimated)
1. **Home** — Entry point, understand product, navigate to features
2. **Bond** — Create bond, view active bonds (core transaction)
3. **Trust Score** — Lookup identity, view reputation activity

### Secondary Tasks (15% Usage)
- Theme toggle (dark/light mode)
- Footer links (docs, terms, privacy)

### Tertiary Tasks (5% Usage)
- Toast notifications (system feedback)
- Dev/test pages

### User Flow Patterns
```
Home → Bond (create) → Success toast → View active bonds
Home → Trust Score (lookup) → View activity
Any page → Theme toggle → Persist preference
```

**Flow Depth:** Shallow (1-2 steps max)  
**Navigation Frequency:** High (users switch between Bond/Trust frequently)

---

## 📱 CURRENT MOBILE EXPERIENCE (PROBLEMS)

### Desktop Navigation (Current)
```
┌─────────────────────────────────────────────┐
│ Credence    Bond    Trust Score    [Theme]  │ ← Header (horizontal)
└─────────────────────────────────────────────┘
```

### Mobile Issues (< 640px)
1. **Horizontal nav wraps awkwardly** — no responsive breakpoint handling
2. **Small touch targets** — links too close together
3. **No mobile-optimized pattern** — desktop nav shrinks, doesn't adapt
4. **Poor thumb reachability** — header at top (hard to reach on large phones)

---

## 🏗️ PLATFORM & TECHNICAL CONTEXT

### Dependencies
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.22.0"  ← Web routing (NOT React Navigation)
}
```

### Design System Status
- ✅ CSS custom properties (design tokens)
- ✅ Responsive breakpoints documented (mobile < 640px, tablet 640-1024px, desktop > 1024px)
- ✅ Accessibility foundation (WCAG 2.1 AA compliant)
- ✅ Dark mode support
- ❌ No mobile navigation components
- ❌ No gesture support library

### Browser Targets
- iOS Safari 15+ (iPhone)
- Android Chrome 90+ (Android phones)
- Responsive web (not native app)

---

## 📐 DESIGN SYSTEM CONSTRAINTS

### Existing Patterns (from docs/FIGMA_DESIGN_SPECS.md)
- **Color System:** Established (primary #0284c7, backgrounds, borders)
- **Spacing:** CSS custom properties (`--space-6`, `--container-padding`)
- **Typography:** 14-18px range, 600 weight for emphasis
- **Accessibility:** Focus visible, ARIA labels, semantic HTML

### Responsive Breakpoints
```css
Mobile:   < 640px   (1 column, compact spacing)
Tablet:   640-1024px (2 columns)
Desktop:  > 1024px  (3+ columns, full header)
```

---

## 🎨 NAVIGATION PATTERN OPTIONS (WEB)

### Option A: Hamburger Menu (Drawer)
```
Mobile:
┌─────────────────────────┐
│ ☰  Credence      [Theme]│ ← Tap ☰ opens drawer
└─────────────────────────┘

Drawer (overlay):
┌─────────────────┐
│ ✕ Menu          │
│                 │
│ 🏠 Home         │
│ 🔒 Bond         │
│ ⭐ Trust Score  │
│                 │
│ [Theme Toggle]  │
└─────────────────┘
```

**Pros:**
- ✅ Familiar pattern (universal)
- ✅ Scales to many items
- ✅ Clean header (minimal clutter)

**Cons:**
- ❌ Hidden navigation (discoverability issue)
- ❌ Extra tap to access (2 taps vs 1)
- ❌ Drawer conflicts with swipe-back gestures

---

### Option B: Bottom Tab Bar (Mobile Web)
```
Mobile:
┌─────────────────────────┐
│ Credence         [Theme]│ ← Minimal header
│                         │
│   [Page Content]        │
│                         │
└─────────────────────────┘
│ 🏠    🔒    ⭐         │ ← Fixed bottom bar
│ Home  Bond  Trust       │
└─────────────────────────┘
```

**Pros:**
- ✅ Always visible (high discoverability)
- ✅ One-tap access (thumb-friendly)
- ✅ Mimics native app patterns (familiar)
- ✅ No gesture conflicts

**Cons:**
- ⚠️ Limited to 3-5 items (we have 3 ✓)
- ⚠️ Takes vertical space (acceptable for 3 items)
- ⚠️ Less common on web (but growing trend)

---

### Option C: Hybrid (Responsive)
```
Mobile (< 640px):
┌─────────────────────────┐
│ ☰  Credence      [Theme]│ ← Hamburger
└─────────────────────────┘

Tablet/Desktop (≥ 640px):
┌─────────────────────────────────────────────┐
│ Credence    Bond    Trust Score    [Theme]  │ ← Horizontal nav
└─────────────────────────────────────────────┘
```

**Pros:**
- ✅ Best of both worlds (responsive)
- ✅ Familiar desktop pattern preserved
- ✅ Mobile-optimized drawer

**Cons:**
- ⚠️ Two patterns to maintain
- ⚠️ Drawer still has discoverability issue on mobile

---

## 🏆 OFFICIAL DECISION: HYBRID RESPONSIVE PATTERN

**Rationale:**
1. **Small screen count (3 primary pages)** — manageable in drawer or tabs
2. **Flat IA (no deep nesting)** — no need for complex navigation
3. **Desktop pattern works well** — preserve for tablet/desktop
4. **Mobile needs optimization** — hamburger drawer is most practical for web
5. **Accessibility compliance** — both patterns support keyboard/screen readers

**Selected Pattern:**
- **Mobile (< 640px):** Hamburger menu (slide-in drawer)
- **Tablet/Desktop (≥ 640px):** Horizontal header navigation (current)

---

## 📋 IMPLEMENTATION REQUIREMENTS

### Mobile Hamburger Menu (< 640px)
- **Trigger:** ☰ icon (top-left, 44×44px touch target)
- **Drawer:** Slide-in from left, 280px width, overlay with backdrop
- **Animation:** 300ms ease-in-out
- **Close:** ✕ button, backdrop tap, or Escape key
- **Focus trap:** Focus stays in drawer while open
- **Accessibility:** `aria-expanded`, `aria-controls`, focus management

### Desktop Navigation (≥ 640px)
- **Current pattern:** Horizontal links in header
- **No changes needed** — already works well

### Shared Requirements
- **Active state:** Highlight current page
- **Theme toggle:** Accessible from both patterns
- **Keyboard navigation:** Tab, Enter, Escape support
- **Screen reader:** Proper ARIA labels and landmarks

---

## 🎨 VISUAL SPECIFICATIONS

### Mobile Drawer
```
Width: 280px (70% viewport max)
Background: var(--bg-card)
Border: 1px solid var(--border-default)
Shadow: 0 4px 12px rgba(0,0,0,0.15)
Padding: 24px 16px
Z-index: 1000

Backdrop:
Background: rgba(0,0,0,0.5)
Z-index: 999
```

### Hamburger Icon
```
Size: 24×24px icon, 44×44px touch target
Color: var(--text-primary)
Position: 16px from left edge
Hover: opacity 0.7
Active: scale 0.95
```

### Navigation Links (Drawer)
```
Font-size: 16px
Font-weight: 600
Padding: 12px 16px
Border-radius: 8px
Hover: background var(--bg-page)
Active: background var(--color-primary), color white
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Component Development
- [ ] Create `MobileNav.tsx` component (hamburger + drawer)
- [ ] Create `useMediaQuery` hook (detect breakpoint)
- [ ] Update `Layout.tsx` to conditionally render mobile/desktop nav
- [ ] Add drawer open/close state management
- [ ] Implement focus trap for drawer

### Phase 2: Styling
- [ ] Add mobile nav CSS (drawer, backdrop, animations)
- [ ] Add responsive breakpoint media queries
- [ ] Test dark mode compatibility
- [ ] Verify touch target sizes (44×44px minimum)

### Phase 3: Accessibility
- [ ] Add ARIA attributes (`aria-expanded`, `aria-controls`, `aria-label`)
- [ ] Implement keyboard support (Tab, Enter, Escape)
- [ ] Test with VoiceOver (iOS) and TalkBack (Android)
- [ ] Verify focus management (trap, restore)

### Phase 4: Testing
- [ ] Test on iOS Safari (iPhone 12, 14, 15 Pro)
- [ ] Test on Android Chrome (Pixel, Samsung)
- [ ] Test responsive breakpoints (resize browser)
- [ ] Test landscape orientation
- [ ] Verify no layout shift or flicker

### Phase 5: Documentation
- [ ] Update Figma with mobile nav designs
- [ ] Document component API and props
- [ ] Add usage examples to docs
- [ ] Update accessibility.md with mobile nav patterns

---

## 📸 SCREENSHOTS REQUIRED (Before/After)

### Before (Current)
1. Desktop navigation (works well)
2. Mobile navigation (broken/awkward)

### After (Proposed)
1. Mobile hamburger menu (closed state)
2. Mobile drawer (open state)
3. Desktop navigation (unchanged)
4. Tablet navigation (breakpoint transition)

---

## 🚀 MIGRATION PLAN

### Zero Regression Strategy
1. **Feature flag:** Implement behind `ENABLE_MOBILE_NAV` flag
2. **A/B test:** 50% mobile users see new nav (1 week)
3. **Monitor:** Track navigation usage, error rates
4. **Rollout:** 100% if metrics stable
5. **Fallback:** Revert flag if issues detected

### Rollback Plan
- Feature flag can disable mobile nav instantly
- Desktop nav unchanged (no risk)
- No database migrations or API changes

---

## 📊 SUCCESS METRICS

### Quantitative
- Mobile navigation usage rate (target: 80%+ users navigate successfully)
- Time to navigate (target: < 2 seconds)
- Error rate (target: < 1%)

### Qualitative
- User feedback (survey after 2 weeks)
- Accessibility audit (WCAG 2.1 AA compliance)
- Cross-browser compatibility (iOS Safari, Android Chrome)

---

## 🔗 RELATED DOCUMENTATION

- [Accessibility Guidelines](./accessibility.md)
- [Figma Design Specs](./FIGMA_DESIGN_SPECS.md)
- [Focus Management Patterns](./focus-patterns.md)
- [Dark Mode Implementation](./dark-mode.md)

---

## 📝 NEXT STEPS

1. **Review this recon report** with product/design team
2. **Create Figma mockups** for mobile drawer pattern
3. **Implement components** per checklist above
4. **Test thoroughly** on real devices
5. **Document final implementation** in `docs/mobile-navigation-pattern.md`

---

**Report prepared by:** Kiro AI  
**Status:** Ready for decision & implementation  
**Estimated effort:** 2-3 days (component + testing + docs)
