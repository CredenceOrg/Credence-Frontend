# Button System

## Overview

The Credence button system provides consistent, accessible button variants with clear visual hierarchy and interactive states.

## Variants

### Primary

- **Use for**: Main CTAs, primary actions
- **Visual**: Solid background with brand color
- **Examples**: "Create bond", "Submit", "Confirm"

### Secondary

- **Use for**: Alternative actions, cancel operations
- **Visual**: Outlined with card background
- **Examples**: "Cancel", "Go back", "Learn more"

### Ghost

- **Use for**: Tertiary actions, subtle interactions
- **Visual**: Transparent background, colored text
- **Examples**: "Skip", "Dismiss", "View details"

## States

### Default

All variants have clear hover and active states with smooth transitions.

### Disabled

- Reduced opacity (50%)
- Cursor changes to `not-allowed`
- No hover effects
- Maintains visual hierarchy between variants

### Loading

- Shows animated spinner
- Button remains disabled during loading
- Content visibility hidden but layout preserved
- `aria-busy="true"` for screen readers

## Usage

```tsx
import Button from '../components/Button'

// Primary button
<Button variant="primary" onClick={handleSubmit}>
  Submit
</Button>

// Secondary button
<Button variant="secondary" onClick={handleCancel}>
  Cancel
</Button>

// Ghost button
<Button variant="ghost" onClick={handleSkip}>
  Skip
</Button>

// Loading state
<Button variant="primary" isLoading={isSubmitting}>
  Creating bond...
</Button>

// Disabled state
<Button variant="primary" disabled>
  Unavailable
</Button>

// Full width
<Button variant="primary" fullWidth>
  Continue
</Button>
```

## Accessibility

- Keyboard navigable with visible focus indicators
- Focus ring uses brand color with 2px offset
- Loading state announced via `aria-busy`
- Disabled state prevents interaction
- Meets WCAG 2.1 AA contrast requirements
- Active state provides tactile feedback (1px translateY)

## Design Tokens

All button styles use Credence design tokens:

- Colors: `--credence-color-primary`, `--credence-color-primary-strong`
- Spacing: `--credence-space-3`, `--credence-space-6`
- Typography: `--credence-font-weight-semibold`, `--credence-font-size-base`
- Radius: `--credence-radius-lg`
- Focus: `--credence-focus-ring`

## Dark Mode

All button variants automatically adapt to dark mode via CSS custom properties:

- Secondary buttons use darker backgrounds
- Ghost buttons adjust hover states
- Focus indicators remain visible
- Contrast ratios maintained

## Responsive Behavior

On mobile (< 768px):

- Reduced padding for better touch targets
- Slightly smaller font size
- Full-width buttons recommended for primary actions

## Best Practices

### Do

✅ Use primary for the main action on a page  
✅ Limit to one primary button per section  
✅ Use secondary for alternative paths  
✅ Use ghost for low-priority actions  
✅ Show loading state during async operations  
✅ Disable buttons when action is unavailable

### Don't

❌ Use multiple primary buttons in the same context  
❌ Use ghost buttons for critical actions  
❌ Nest buttons inside other interactive elements  
❌ Override button styles with inline CSS  
❌ Use buttons for navigation (use links instead)

## Examples

### Form Actions

```tsx
<div style={{ display: 'flex', gap: 'var(--credence-space-3)' }}>
  <Button variant="secondary" onClick={handleCancel}>
    Cancel
  </Button>
  <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
    Create bond
  </Button>
</div>
```

### Card Actions

```tsx
<Button variant="primary" fullWidth onClick={handleAction}>
  Get started
</Button>
```

### Inline Actions

```tsx
<Button variant="ghost" onClick={handleDismiss}>
  Dismiss
</Button>
```

## Testing Checklist

- [ ] All variants render correctly
- [ ] Hover states work on all variants
- [ ] Active states provide visual feedback
- [ ] Focus indicators are visible
- [ ] Disabled state prevents interaction
- [ ] Loading spinner animates smoothly
- [ ] Loading state hides content but preserves layout
- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Screen reader announces loading state
- [ ] Dark mode styles apply correctly
- [ ] Responsive styles work on mobile
- [ ] Full-width prop works correctly

## Home page CTA link-buttons

The landing page (`src/pages/Home.tsx`) uses React Router `<Link role="button">` elements for client-side navigation. Styles live in `src/pages/Home.css` (`.home__cta`, `.home__cta--primary`, `.home__cta--secondary`) and mirror the interactive states defined in `Button.css`:

| State | Primary | Secondary |
| --- | --- | --- |
| **Default** | `--credence-color-primary` fill, white text | Card surface, default border |
| **Hover** | `--credence-color-primary-strong` fill | `--credence-color-slate-100` fill |
| **Active** | Strong fill + 1px `translateY` press | Slate-200 fill + press |
| **Focus-visible** | 3px focus ring + page-colour halo | Same |
| **Disabled** | Slate-400 fill, 50% opacity, `not-allowed` | Slate muted palette, 50% opacity |

Apply `aria-disabled="true"` on a `<Link>` when a CTA must appear inactive (e.g. feature flag). Disabled links should also omit or neutralise `to` navigation in the component layer.

**Recommendation:** Keep `<Link>` CTAs on Home for routing semantics. A future `Button` `as="link"` prop could compose these same CSS classes rather than duplicating rules in `Button.css`.

## Future Enhancements

- Icon support (leading/trailing icons)
- Size variants (small, medium, large)
- Danger variant for destructive actions
- Button groups for related actions
- Tooltip support for disabled states
