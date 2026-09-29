# Themes

## Accessibility (WCAG Compliance)

All primary interactive elements (such as links, buttons, and focus rings) must meet **WCAG 2.1 AAA** contrast requirements, which mandates a minimum contrast ratio of **7:1** against standard background surfaces.

### Light Theme Contrast Targets

- **Background (`--credence-surface-card`)**: `#ffffff` (White)
- **Primary (`--credence-color-primary`)**: `#075985` (Tailwind `sky-800`) — Contrast Ratio > 7:1 against white
- **Primary Strong (`--credence-color-primary-strong`)**: `#0c4a6e` (Tailwind `sky-900`) — Contrast Ratio > 8.5:1 against white
- **Primary Soft (`--credence-color-primary-soft`)**: `#0284c7` (Tailwind `sky-600`) — _(Used for non-text or large text where 4.5:1 AA is sufficient)_

### Dark Theme Contrast Targets

- **Background (`--credence-surface-card`)**: `#1e293b` (Tailwind `slate-800`)
- **Primary (`--credence-color-primary`)**: `#7dd3fc` (Tailwind `sky-300`) — Contrast Ratio > 7:1 against slate-800
- **Primary Strong (`--credence-color-primary-strong`)**: `#bae6fd` (Tailwind `sky-200`) — Contrast Ratio > 10:1 against slate-800

### Notes

- Do not hard-code colors in components. Always use the semantic CSS variables (`var(--credence-color-primary)`, etc.).
- Ensure that text resting on these primary colors (e.g. text inside a primary button) also maintains appropriate contrast. We default to using white text on light mode primary buttons and dark text on dark mode primary buttons.
- These tokens apply directly to focus indicators (`--credence-focus-ring`) to ensure focus states are clearly visible for keyboard users.
