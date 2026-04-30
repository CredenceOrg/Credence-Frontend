# Credence Design Tokens

Credence design tokens are defined in `src/index.css` and use the `--credence-*` prefix.

## Usage Rules

- Prefer `var(--credence-...)` in component CSS and inline styles instead of raw hex values.
- Reuse the semantic tokens first, especially for surfaces, text, borders, and feedback states.
- Keep component-specific custom properties mapped back to the shared token set where possible.
- Preserve the current visual treatment unless a design change is explicitly requested.

## Core Token Groups

### Color

```css
--credence-surface-page
--credence-surface-card
--credence-text-primary
--credence-text-secondary
--credence-border-default
--credence-color-primary
--credence-color-primary-strong
--credence-color-primary-soft
--credence-color-info-*
--credence-color-success-*
--credence-color-warning-*
--credence-color-danger-*
```

### Spacing

```css
--credence-space-1: 0.25rem;
--credence-space-2: 0.5rem;
--credence-space-3: 0.75rem;
--credence-space-4: 1rem;
--credence-space-5: 1.25rem;
--credence-space-6: 1.5rem;
--credence-space-8: 2rem;
--credence-space-12: 3rem;
```

### Radius

```css
--credence-radius-sm: 0.25rem;
--credence-radius-md: 0.375rem;
--credence-radius-lg: 0.5rem;
--credence-radius-xl: 0.75rem;
--credence-radius-full: 9999px;
```

### Typography

```css
--credence-font-family-base
--credence-font-size-xs
--credence-font-size-sm
--credence-font-size-base
--credence-font-size-lg
--credence-font-size-xl
--credence-font-weight-regular
--credence-font-weight-semibold
--credence-font-weight-bold
--credence-line-height-tight
--credence-line-height-base
--credence-line-height-relaxed
```

### Motion

```css
--credence-motion-duration-instant
--credence-motion-duration-fast
--credence-motion-duration-base
--credence-motion-duration-slow
--credence-motion-easing-standard
--credence-motion-easing-decelerate
--credence-motion-easing-accelerate
--credence-motion-easing-linear
--credence-motion-skeleton
```

- Use motion tokens for transitions and animation timing across components.
- Prefer `--credence-motion-duration-fast` for hover/focus micro-interactions.
- Prefer `--credence-motion-duration-base` for common UI transitions.
- Respect `prefers-reduced-motion: reduce` by keeping motion subtle or removing non-essential animation.

## Example

```tsx
<button
  style={{
    padding: 'var(--credence-space-3) var(--credence-space-6)',
    background: 'var(--credence-color-primary)',
    color: 'var(--credence-color-white)',
    borderRadius: 'var(--credence-radius-lg)',
    fontSize: 'var(--credence-font-size-sm)',
    fontWeight: 'var(--credence-font-weight-semibold)',
  }}
>
  Continue
</button>
```

## Migration Notes

- Legacy variables such as `--bg-page`, `--text-primary`, and `--color-primary` still resolve through the new token layer for compatibility.
- New work should use the `--credence-*` names directly.
- When replacing one-off colors, prefer the closest semantic token instead of adding a new raw hex value.
