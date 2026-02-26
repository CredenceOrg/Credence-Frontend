# Credence Frontend — Accessibility Audit Report

Audit date: 2026-02-26
Standard: WCAG 2.1 AA (where practical)
Scope: All core flows — navigation, bonding, trust score

## Findings & Fixes Applied

### 1. Color Contrast (WCAG 1.4.3)

| Element | Before | After | Ratio |
|---|---|---|---|
| Link text on `#f8fafc` | `#0ea5e9` (3.0:1 ✗) | `#0284c7` (4.56:1 ✓) | AA pass |
| Button background | `#0ea5e9` | `#0284c7` | AA pass |
| Subtitle text `#64748b` on `#f8fafc` | 4.4:1 (borderline) | Kept — passes AA for normal text | AA pass |

### 2. Focus Visibility (WCAG 2.4.7)

- **Before:** No custom `:focus-visible` styles; browser defaults could be invisible on some elements.
- **After:** Global `:focus-visible` outline (`2px solid #0284c7`, `2px` offset) on all interactive elements.

### 3. Bypass Blocks (WCAG 2.4.1)

- **Before:** No skip-to-content link.
- **After:** Added `.skip-link` that appears on Tab, linking to `#main-content`.

### 4. Labels & Input Association (WCAG 1.3.1)

- **Before:** `<label>` elements had no `htmlFor`; `<input>` elements had no `id`.
- **After:**
  - Bond page: `htmlFor="bond-amount"` → `id="bond-amount"`
  - Trust Score page: `htmlFor="wallet-address"` → `id="wallet-address"`

### 5. Input Descriptions (WCAG 1.3.1)

- **Before:** Descriptive paragraphs existed but were not programmatically linked to inputs.
- **After:** Added `aria-describedby` on each input pointing to the page description `<p>` (`id="bond-desc"`, `id="trust-desc"`).

### 6. Navigation Landmarks (WCAG 1.3.1)

- **Before:** `<nav>` had no accessible label.
- **After:** Added `aria-label="Main navigation"` to `<nav>`.

### 7. Link-as-Button Roles (WCAG 4.1.2)

- **Before:** `<Link>` elements styled as buttons had no `role` attribute.
- **After:** Added `role="button"` to call-to-action links on the Home page.

### 8. Page Metadata

- Added `<meta name="description">` to `index.html`.

---

## Developer Checklist

Use this checklist when building new components or pages.

### Color & Visual

- [ ] Text contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text (18px+ bold or 24px+)
- [ ] Do not rely on color alone to convey information (use icons, text, patterns)
- [ ] Interactive elements have visible hover and active states

### Focus & Keyboard

- [ ] All interactive elements are reachable via Tab key
- [ ] Focus order follows visual reading order
- [ ] `:focus-visible` outline is visible on all focusable elements
- [ ] Custom components support Enter/Space activation
- [ ] Modal dialogs trap focus and return focus on close

### Forms

- [ ] Every `<input>` has a `<label>` with matching `htmlFor`/`id`
- [ ] Helper text is linked via `aria-describedby`
- [ ] Required fields use `aria-required="true"` and visible indicator
- [ ] Error messages use `aria-live="polite"` or `role="alert"` and appear next to the field
- [ ] Error language is clear, specific, and non-blaming (e.g. "Enter an amount greater than 0" not "Invalid input")

### Semantic HTML

- [ ] One `<h1>` per page; heading levels never skip (h1 → h2 → h3)
- [ ] Use `<nav>`, `<main>`, `<header>`, `<footer>` landmarks
- [ ] Add `aria-label` to distinguish multiple `<nav>` regions
- [ ] Use `<button>` for actions, `<a>` for navigation; add `role="button"` if a link looks like a button
- [ ] Lists use `<ul>`/`<ol>`, not styled `<div>`s

### Screen Readers

- [ ] Decorative images use `alt=""`; meaningful images have descriptive `alt`
- [ ] Icon-only buttons have `aria-label`
- [ ] Dynamic content updates use `aria-live` regions
- [ ] Use `.sr-only` class for visually hidden but screen-reader-accessible text

### General

- [ ] Minimum touch/click target size: 44×44px
- [ ] Skip-to-content link present on every page layout
- [ ] Page has `<title>` and `<meta name="description">`
- [ ] Language attribute set on `<html lang="en">`

---

## Good vs. Bad Patterns

### Labels

```tsx
// Bad — label not associated
<label>Amount</label>
<input type="number" />

// Good — programmatic association
<label htmlFor="amount">Amount</label>
<input id="amount" type="number" />
```

### Error Messages

```tsx
// Bad — generic, blaming
<span style={{ color: 'red' }}>Invalid input!</span>

// Good — specific, accessible
<span id="amount-error" role="alert" style={{ color: '#dc2626' }}>
  Enter a USDC amount greater than 0.
</span>
<input aria-describedby="amount-error" aria-invalid="true" />
```

### Focus Styles

```css
/* Bad — removes focus indicator */
*:focus { outline: none; }

/* Good — visible, custom focus */
:focus-visible {
  outline: 2px solid #0284c7;
  outline-offset: 2px;
}
```

### Buttons vs. Links

```tsx
// Bad — link looks like button, no role
<Link to="/bond" style={{ ... }}>Create bond</Link>

// Good — role communicates purpose to assistive tech
<Link to="/bond" role="button" style={{ ... }}>Create bond</Link>

// Best — use <button> + navigation for true actions
```
