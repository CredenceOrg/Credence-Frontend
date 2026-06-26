# Motion Guidelines

These guidelines define motion and micro-interactions for Credence Frontend while respecting `prefers-reduced-motion`.

## Why motion tokens

Motion should feel subtle, consistent, and intentional. Tokens let the product team standardize timing and easing across components while making it easy to switch to reduced motion.

## Token definitions

Motion values are defined in `src/index.css` with the `--credence-motion-*` prefix.

- `--credence-motion-duration-instant` — 0ms for reduced or immediate state changes
- `--credence-motion-duration-fast` — 150ms for quick hover / focus interactions
- `--credence-motion-duration-base` — 250ms for common transitions
- `--credence-motion-duration-slow` — 400ms for entrance/exit motion
- `--credence-motion-easing-standard` — cubic-bezier(0.16, 1, 0.3, 1)
- `--credence-motion-easing-decelerate` — ease-out for natural entrance motion
- `--credence-motion-easing-accelerate` — ease-in for exits or quick reveals
- `--credence-motion-easing-linear` — linear timing for loops and progress indicators
- `--credence-motion-skeleton` — shorthand for the shimmer skeleton animation

## When to use motion

Use motion for:

- state changes that clarify UI hierarchy
- transient notifications and alerts
- hover or focus feedback on interactive controls
- skeleton loading and placeholder shimmer

Avoid motion for:

- primary content layout shifts
- essential user interactions when `prefers-reduced-motion` is enabled
- long or attention-grabbing animations that do not add functional clarity

## Reduced motion defaults

The application includes a global reduced-motion fallback:

- `prefers-reduced-motion: reduce` forces animation durations to effectively zero
- transition durations become near-instant
- `scroll-behavior` falls back to `auto`
- decorative, looping motion like shimmer is stopped

## Implementation examples

### Toast notifications

Use the quick entrance token with a decelerating curve:

```css
.toast {
  animation: toast-in var(--credence-motion-duration-fast) var(--credence-motion-easing-decelerate);
}
```

### Theme toggle

Use the base motion duration for color and background changes:

```tsx
transition: 'all var(--credence-motion-duration-base) var(--credence-motion-easing-standard)'
```

### Loading skeletons

Use the shared skeleton animation token:

```tsx
animation: 'var(--credence-motion-skeleton)'
```

### React / JavaScript components

For components that set inline styles or animate state via JavaScript, query and subscribe to motion preferences using the `useReducedMotion` hook:

```tsx
import { useReducedMotion } from '../hooks/useReducedMotion'

export default function MyComponent() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div
      style={{
        transition: prefersReducedMotion ? 'none' : 'all 0.2s ease',
      }}
    />
  )
}
```

#### TrustGauge integration

The TrustGauge progress fill and current-score thumb use inline-styled transitions to animate the new score into place. The component reads `useReducedMotion` and overrides the inline `transition` to `'none'` when reduced motion is preferred, so the gauge snaps to the new position rather than animating:

```tsx
const prefersReducedMotion = useReducedMotion()
const reducedMotionTransition = prefersReducedMotion ? 'none' : undefined

// Later in JSX:
<div
  className="trust-gauge__progress"
  style={{
    '--progress-width': `${percentage}%`,
    ...(reducedMotionTransition ? { transition: reducedMotionTransition } : {}),
  }}
/>
```

The CSS `@media (prefers-reduced-motion: reduce)` rule in `TrustGauge.css` remains in place as the safety net for first paint and for any element that does not consume the hook. The JS hook is the canonical signal for any component that drives animation through inline styles (including future imperative animation logic).

#### LoadingSkeleton integration

The LoadingSkeleton sets `animation: var(--credence-motion-skeleton)` on every shimmer block. When `useReducedMotion()` returns `true` the component omits the animation entirely from the inline style, complementing the global CSS override in `src/index.css`:

```tsx
const prefersReducedMotion = useReducedMotion()
const baseStyle = {
  background: 'var(--credence-skeleton-gradient)',
  backgroundSize: '200% 100%',
  ...(prefersReducedMotion ? {} : { animation: 'var(--credence-motion-skeleton)' }),
  borderRadius: 'var(--credence-radius-lg)',
}
```

Components covered by the JS-level hook today: `TrustGauge`, `LoadingSkeleton`, `CreateBondFlow`. Components still relying solely on the CSS layer: `MobileNav`, `ThemeToggle`, and the link/footer transitions in `src/index.css` (acceptable because they only swap colors, not transform in space).
