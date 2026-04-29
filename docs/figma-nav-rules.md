# Figma Navigation Design System Rules — Issue #77

**Project:** Credence-Frontend  
**Pattern:** Hybrid Responsive Navigation  
**Purpose:** Design-to-code mapping for mobile navigation components

---

## 🎨 Component Library Structure

### Figma Organization

```
📁 Credence Design System
  📁 Navigation
    📁 Mobile
      🎨 Hamburger Button
        ├── Default
        ├── Hover
        ├── Active
        ├── Focus
        └── Disabled
      🎨 Drawer
        ├── Closed (hidden)
        └── Open
          ├── Header (close button)
          ├── Navigation Links
          └── Footer (optional)
      🎨 Backdrop
        └── Semi-transparent overlay
      🎨 Navigation Link (Mobile)
        ├── Default
        ├── Hover
        ├── Active (current page)
        └── Focus
    📁 Desktop
      🎨 Horizontal Nav (existing)
      🎨 Navigation Link (Desktop)
        ├── Default
        ├── Hover
        ├── Active
        └── Focus
```

---

## 📐 Design Specifications

### Mobile Hamburger Button

#### Dimensions
```
Touch Target: 44×44px (WCAG 2.5.5 minimum)
Icon Size: 24×24px
Border Radius: 8px
```

#### States
| State | Background | Icon Color | Transform | Outline |
|-------|------------|------------|-----------|---------|
| **Default** | `transparent` | `var(--text-primary)` | `scale(1)` | None |
| **Hover** | `var(--bg-page)` | `var(--text-primary)` | `scale(1)` | None |
| **Active** | `var(--bg-page)` | `var(--text-primary)` | `scale(0.95)` | None |
| **Focus** | `transparent` | `var(--text-primary)` | `scale(1)` | `2px solid var(--color-primary)` |

#### Icon (Hamburger ☰)
```
Type: Three horizontal lines
Line Width: 2px
Line Height: 2px
Line Spacing: 5px
Color: var(--text-primary)
```

**SVG Export:**
```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M3 12h18M3 6h18M3 18h18" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round"/>
</svg>
```

---

### Mobile Drawer

#### Dimensions
```
Width: 280px
Max Width: 70vw (responsive)
Height: 100vh (full viewport)
Position: Fixed, left: 0, top: 0
Z-index: 1000
```

#### Visual Style
```
Background: var(--bg-card)
Border Right: 1px solid var(--border-default)
Box Shadow: 4px 0 12px rgba(0, 0, 0, 0.15)
Overflow Y: auto (scrollable if content exceeds viewport)
```

#### Animation
```
Property: transform
Duration: 300ms
Easing: ease-in-out
From: translateX(-100%) (hidden off-screen)
To: translateX(0) (visible on-screen)
```

#### Layout Structure
```
┌─────────────────────────┐
│ Header (Close Button)   │ ← 60px height
├─────────────────────────┤
│                         │
│ Navigation Links        │ ← Scrollable area
│                         │
│                         │
└─────────────────────────┘
```

---

### Drawer Header

#### Dimensions
```
Height: 60px
Padding: 16px
Border Bottom: 1px solid var(--border-default)
```

#### Close Button (✕)
```
Touch Target: 44×44px
Icon Size: 24×24px
Border Radius: 8px
Position: Right-aligned
```

| State | Background | Icon Color | Outline |
|-------|------------|------------|---------|
| **Default** | `transparent` | `var(--text-primary)` | None |
| **Hover** | `var(--bg-page)` | `var(--text-primary)` | None |
| **Focus** | `transparent` | `var(--text-primary)` | `2px solid var(--color-primary)` |

---

### Navigation Links (Mobile Drawer)

#### Dimensions
```
Padding: 12px 16px
Margin Bottom: 4px
Border Radius: 8px
Font Size: 16px
Font Weight: 600
Line Height: 1.5
```

#### Layout
```
Display: flex
Align Items: center
Gap: 12px

[Icon] [Label]
 20px   16px
```

#### States
| State | Background | Text Color | Icon Color |
|-------|------------|------------|------------|
| **Default** | `transparent` | `var(--text-primary)` | `var(--text-primary)` |
| **Hover** | `var(--bg-page)` | `var(--text-primary)` | `var(--text-primary)` |
| **Active** | `var(--color-primary)` | `white` | `white` |
| **Focus** | `transparent` | `var(--text-primary)` | `2px solid var(--color-primary)` |

#### Icons
```
Size: 20×20px
Type: Emoji or SVG
Examples:
  🏠 Home
  🔒 Bond
  ⭐ Trust Score
```

---

### Backdrop Overlay

#### Dimensions
```
Width: 100vw
Height: 100vh
Position: Fixed, inset: 0
Z-index: 999 (below drawer)
```

#### Visual Style
```
Background: rgba(0, 0, 0, 0.5)
Backdrop Filter: blur(2px) (optional, for modern browsers)
```

#### Animation
```
Property: opacity
Duration: 300ms
Easing: ease-in-out
From: opacity 0
To: opacity 1
```

---

### Desktop Navigation (Existing)

#### Dimensions
```
Display: flex
Gap: 16px (1rem)
Align Items: center
```

#### Navigation Links
```
Padding: 8px 16px (0.5rem 1rem)
Font Size: 16px
Font Weight: 500 (default), 600 (active)
Border Radius: 8px
```

#### States
| State | Background | Text Color | Font Weight |
|-------|------------|------------|-------------|
| **Default** | `transparent` | `var(--text-primary)` | 500 |
| **Hover** | `var(--bg-page)` | `var(--text-primary)` | 500 |
| **Active** | `transparent` | `var(--color-primary)` | 600 |
| **Focus** | `transparent` | `var(--text-primary)` | 500, outline |

---

## 🎨 Design Tokens

### Spacing
```json
{
  "mobile-nav": {
    "drawer-width": "280px",
    "drawer-max-width": "70vw",
    "drawer-padding": "24px 16px",
    "header-height": "60px",
    "header-padding": "16px",
    "link-padding": "12px 16px",
    "link-margin": "4px",
    "link-gap": "12px"
  },
  "touch-targets": {
    "minimum-size": "44px",
    "icon-size": "24px",
    "mobile-icon-size": "20px"
  }
}
```

### Colors
```json
{
  "navigation": {
    "backdrop": "rgba(0, 0, 0, 0.5)",
    "drawer-bg": "var(--bg-card)",
    "drawer-border": "var(--border-default)",
    "drawer-shadow": "rgba(0, 0, 0, 0.15)",
    "link-default": "var(--text-primary)",
    "link-hover-bg": "var(--bg-page)",
    "link-active-bg": "var(--color-primary)",
    "link-active-text": "white",
    "focus-outline": "var(--color-primary)"
  }
}
```

### Animation
```json
{
  "navigation": {
    "drawer-duration": "300ms",
    "drawer-easing": "ease-in-out",
    "backdrop-duration": "300ms",
    "backdrop-easing": "ease-in-out",
    "hover-duration": "150ms",
    "hover-easing": "ease"
  }
}
```

### Typography
```json
{
  "navigation": {
    "mobile-link-size": "16px",
    "mobile-link-weight": "600",
    "mobile-link-line-height": "1.5",
    "desktop-link-size": "16px",
    "desktop-link-weight": "500",
    "desktop-link-weight-active": "600"
  }
}
```

### Z-Index
```json
{
  "navigation": {
    "backdrop": "999",
    "drawer": "1000"
  }
}
```

---

## 📱 Responsive Breakpoints

### Mobile (< 640px)
```
Show: Hamburger button + drawer
Hide: Desktop horizontal nav
Drawer Width: 280px (max 70vw)
```

### Tablet (640px - 1024px)
```
Show: Desktop horizontal nav
Hide: Hamburger button + drawer
```

### Desktop (> 1024px)
```
Show: Desktop horizontal nav
Hide: Hamburger button + drawer
```

---

## 🎯 Component Variants (Figma)

### Hamburger Button Component

**Properties:**
- `State`: Default | Hover | Active | Focus | Disabled
- `Theme`: Light | Dark

**Instances:**
```
Hamburger/Default/Light
Hamburger/Hover/Light
Hamburger/Active/Light
Hamburger/Focus/Light
Hamburger/Default/Dark
Hamburger/Hover/Dark
...
```

---

### Drawer Component

**Properties:**
- `State`: Closed | Open
- `Theme`: Light | Dark
- `Content`: Home | Bond | Trust (active page)

**Instances:**
```
Drawer/Closed/Light
Drawer/Open/Light/Home-Active
Drawer/Open/Light/Bond-Active
Drawer/Open/Dark/Home-Active
...
```

---

### Navigation Link Component (Mobile)

**Properties:**
- `State`: Default | Hover | Active | Focus
- `Theme`: Light | Dark
- `Icon`: Home | Bond | Trust | Custom

**Instances:**
```
NavLink-Mobile/Default/Light/Home
NavLink-Mobile/Hover/Light/Home
NavLink-Mobile/Active/Light/Home
NavLink-Mobile/Focus/Light/Home
...
```

---

## 🖼️ Figma → Code Mapping

### Hamburger Button

| Figma Property | CSS Property | Value |
|----------------|--------------|-------|
| Width | `width` | `44px` |
| Height | `height` | `44px` |
| Fill | `background` | `transparent` |
| Border Radius | `border-radius` | `8px` |
| Icon Color | `color` | `var(--text-primary)` |
| Hover Fill | `background:hover` | `var(--bg-page)` |
| Focus Outline | `outline:focus-visible` | `2px solid var(--color-primary)` |

---

### Drawer

| Figma Property | CSS Property | Value |
|----------------|--------------|-------|
| Width | `width` | `280px` |
| Max Width | `max-width` | `70vw` |
| Height | `height` | `100vh` |
| Fill | `background` | `var(--bg-card)` |
| Border Right | `border-right` | `1px solid var(--border-default)` |
| Shadow | `box-shadow` | `4px 0 12px rgba(0,0,0,0.15)` |
| Position | `position` | `fixed` |
| Z-Index | `z-index` | `1000` |

---

### Navigation Link (Mobile)

| Figma Property | CSS Property | Value |
|----------------|--------------|-------|
| Padding | `padding` | `12px 16px` |
| Border Radius | `border-radius` | `8px` |
| Font Size | `font-size` | `16px` |
| Font Weight | `font-weight` | `600` |
| Text Color | `color` | `var(--text-primary)` |
| Active Fill | `background.active` | `var(--color-primary)` |
| Active Text | `color.active` | `white` |
| Hover Fill | `background:hover` | `var(--bg-page)` |

---

## 📤 Export Guidelines

### For Developers

#### Icons
- **Format:** SVG (preferred) or PNG @2x/3x
- **Size:** 24×24px (hamburger), 20×20px (nav icons)
- **Naming:** `icon-hamburger.svg`, `icon-home.svg`, `icon-bond.svg`
- **Color:** Use `currentColor` for SVG fill/stroke

#### Components
- **Export:** Figma Dev Mode (CSS, React)
- **Naming:** Match component file names (`MobileNav`, `DesktopNav`)
- **Spacing:** Export as CSS custom properties

#### Screens
- **Format:** PNG @2x (retina)
- **Naming:** `mobile-nav-closed.png`, `mobile-nav-open.png`, `desktop-nav.png`
- **Annotations:** Include spacing, colors, typography specs

---

## ✅ Design Checklist

Before handoff to development:

### Mobile Navigation
- [ ] Hamburger button has all states (default, hover, active, focus)
- [ ] Drawer has open/closed states
- [ ] Backdrop overlay specified
- [ ] Navigation links have all states
- [ ] Active page highlighted correctly
- [ ] Close button (✕) designed
- [ ] Icons exported (SVG, 20×20px)
- [ ] Dark mode variants created

### Desktop Navigation
- [ ] Horizontal nav layout specified
- [ ] Navigation links have all states
- [ ] Active page highlighted
- [ ] Spacing between links defined
- [ ] Dark mode variants created

### Responsive
- [ ] Mobile breakpoint (< 640px) documented
- [ ] Desktop breakpoint (≥ 640px) documented
- [ ] Transition between breakpoints smooth

### Accessibility
- [ ] Touch targets ≥ 44×44px
- [ ] Focus outlines visible (2px, primary color)
- [ ] Color contrast ≥ 4.5:1 (WCAG AA)
- [ ] Active states distinguishable without color alone

### Tokens
- [ ] Spacing values documented
- [ ] Color values documented
- [ ] Typography values documented
- [ ] Animation values documented
- [ ] Z-index values documented

### Export
- [ ] All icons exported (SVG)
- [ ] Component specs exported (Figma Dev Mode)
- [ ] Screenshots exported (PNG @2x)
- [ ] Design tokens exported (JSON)

---

## 🔗 Related Documentation

- [Mobile Navigation Pattern](./mobile-navigation-pattern.md)
- [Mobile Navigation Decision Matrix](./mobile-navigation-DECISION.md)
- [Figma Design Specs](./FIGMA_DESIGN_SPECS.md)
- [Accessibility Guidelines](./accessibility.md)

---

## 📝 Figma File Links

**Main Design File:** [To be added]  
**Component Library:** [To be added]  
**Mobile Nav Prototype:** [To be added]  
**Design Tokens:** [To be added]

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-29  
**Maintained By:** Credence Design Team
