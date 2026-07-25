# Design Tokens

This document lists all CSS custom properties (design tokens) used in the Credence Frontend and explains their semantic roles. By using these tokens rather than hardcoding values, we ensure consistent theming, accessibility (like dark mode and reduced motion), and maintainability.

**Audience**: Contributors (Frontend Engineers)

## Usage Example

Always prefer tokens over hard-coded values when writing custom CSS. This ensures that features like Dark Mode automatically adapt your UI without needing extra media queries.

### Do:
```css
.myComponent {
  padding: var(--credence-space-4);
  color: var(--credence-text-secondary);
  background-color: var(--credence-surface-card);
  border-radius: var(--credence-radius-md);
  transition: background-color var(--credence-motion-duration-fast) var(--credence-motion-easing-standard);
}
```

### Don't:
```css
/* Avoid hard-coded hex colors, px sizing, or generic easing */
.myComponent {
  padding: 16px;
  color: #64748b;
  background-color: #ffffff;
  border-radius: 6px;
  transition: background-color 150ms ease;
}
```

## Tokens Overview

### Typography
These control font families, sizing, weights, and line heights.
- `--credence-font-family-base`: The primary system font stack.
- `--credence-font-size-xs` to `--credence-font-size-xl`: Font scales (e.g. `xs` is `0.75rem`, `base` is `1rem`).
- `--credence-font-weight-regular`, `-semibold`, `-bold`: Font weights (400, 600, 700).
- `--credence-line-height-tight`, `-base`, `-relaxed`: Line heights (1.25, 1.5, 1.6).

### Spacing
Use these for padding, margins, and gaps.
- `--credence-space-1` to `--credence-space-12`: Consistent spacing scale (`-1` is `0.25rem`, `-4` is `1rem`, `-12` is `3rem`).

### Radius
Used for border-radius on containers and inputs.
- `--credence-radius-sm` to `--credence-radius-full`: Rounding options (`-sm` is `0.25rem`, `-full` is `9999px`).

### Motion
Timing and easing functions for animations and transitions. Automatically overridden to `0ms` when a user prefers reduced motion.
- `--credence-motion-duration-instant`, `-fast`, `-base`, `-slow`: Transition durations (0ms to 400ms).
- `--credence-motion-easing-standard`, `-decelerate`, `-accelerate`, `-linear`: Easing curves.
- `--credence-motion-skeleton`: Pre-defined animation for shimmer loading states.

### Overlays & Backdrops
Controls the transparency of modal backdrops. These automatically switch to opaque equivalents when users prefer reduced transparency.
- `--credence-backdrop-light`, `-dark`, `-mobile`: Context-aware backdrop overlays.

### Layout
Container restraints.
- `--credence-container-max`: Maximum width of the main layout (`72rem`).
- `--credence-container-padding`: Responsive padding for edges (`clamp(1rem, 2vw, 2rem)`).

### Colors & Theming
Our application features a robust token system that automatically flips to dark mode equivalents when `data-theme="dark"` is active.

**Neutrals**: 
- `--credence-color-white`, `--credence-color-black`
- `--credence-color-slate-50` through `--credence-color-slate-900`: Structural grays.

**Brand & Semantics**: 
These indicate state or primary actions.
- `--credence-color-primary`, `-primary-strong`, `-primary-soft`: Brand blue for primary interactive elements.
- `--credence-color-info-surface`, `-border`, `-text`: Blue informational messaging.
- `--credence-color-success-surface`, `-border`, `-text`: Green success indicators.
- `--credence-color-warning-surface`, `-border`, `-text`: Yellow warning indicators.
- `--credence-color-danger-surface`, `-surface-strong`, `-border`, `-action`, `-text`, `-text-muted`: Red error and destructive actions.

**Tier & Accent Colors**: 
Specific colors for user trust tiers or illustration highlights.
- `--credence-color-bronze-*`, `--credence-color-silver-*`, `--credence-color-gold-*`, `--credence-color-platinum-*`
- `--credence-color-grace-*`, `--credence-color-trust-*`, `--credence-color-attestation-*`

### Surface Aliases
These aliases abstract away the raw color tokens. Always try to use these first for components.
- `--credence-surface-page`: Background color of the main application (light gray, flips to dark slate).
- `--credence-surface-card`: Background for elevated containers (white, flips to dark navy).
- `--credence-text-primary`, `--credence-text-secondary`: Main and muted text colors.
- `--credence-border-default`: Default subtle border.

### Effects
- `--credence-color-focus-ring`, `--credence-focus-ring`: Standardized `2px` focus outline for accessibility.
- `--credence-shadow-toast`: Drop-shadow for floating notifications.
- `--credence-skeleton-gradient`: Gradient background used for loading skeletons.
