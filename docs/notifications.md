# Credence Frontend — Notification Patterns

Rules for notifications, banners, and toasts across the Credence UI.

## Component Types

### Banner (`src/components/Banner.tsx`)

Inline, persistent notification for contextual or global alerts.

- Renders inside page content flow
- Stays visible until dismissed (if `dismissible`) or permanently
- Use for: page-level context, global protocol alerts, form guidance

### Toast (`src/components/Toast.tsx` + `ToastProvider.tsx`)

Ephemeral overlay notification triggered by user actions or system events.

- Renders fixed top-right on desktop, and **bottom-center** on mobile
- Stays safe from covering primary CTAs on small screens
- Auto-dismisses based on severity timeout
- Supports "Dismiss All" when multiple toasts are active
- Use for: action confirmations, transient status updates

## Severity Levels

| Severity | Use case | Example events |
|----------|----------|---------------|
| `info` | Neutral context | Bond lock period reminder, score epoch note |
| `success` | Positive outcome | Bond created, score retrieved, vote submitted |
| `warning` | Non-critical concern | Bond nearing slash threshold, low balance |
| `danger` | Critical / destructive | Bond slashed, protocol paused, transaction failed |

> [!TIP]
> **Visuals**: Toasts use HSL-based color palettes with glassmorphism (backdrop-blur) and high-quality SVG icons to ensure a premium look and feel.

## Placement Rules

| Type | Position | Scope |
|------|----------|-------|
| Global banner | Between header and `<main>` in Layout | Protocol-wide alerts (e.g. "Protocol paused") |
| Contextual banner | Inline within page content | Page-specific guidance or warnings |
| Toast | Fixed Overlay | **Desktop**: Top-Right. **Mobile**: Bottom-Center. |

## Timeouts

| Severity | Auto-dismiss | Rationale |
|----------|-------------|-----------|
| `info` | 5 seconds | Low urgency, informational |
| `success` | 5 seconds | Confirmation — user can move on |
| `warning` | 8 seconds | Needs attention but not blocking |
| `danger` | Manual only | Must be acknowledged explicitly |

## Stacking Rules

- Maximum **3** toasts visible simultaneously
- When a 4th toast arrives, the oldest is removed (FIFO)
- A "**Dismiss All**" button appears when more than one toast is visible
- Each toast can also be manually dismissed via the (X) button

## Accessibility

- Banners use `role="alert"` for `warning`/`danger` and `role="status"` for `info`/`success`
- Toast container uses `aria-live="polite"` so screen readers announce new toasts
- Dismiss buttons have `aria-label` text
- Icons are marked `aria-hidden="true"` (decorative)
- Dismiss buttons are keyboard-focusable and respond to Enter/Space
- Supports `prefers-reduced-motion` for simplified entrance animations

## Event → Notification Mapping

| Event | Type | Severity |
|-------|------|----------|
| Bond created | Toast | `success` |
| Bond slashed | Banner (contextual) + Toast | `danger` |
| Score updated | Toast | `success` |
| Score lookup completed | Toast | `info` |
| Governance vote submitted | Toast | `success` |
| Protocol paused | Banner (global, sticky) | `danger` |
| Low wallet balance | Banner (contextual) | `warning` |
| Transaction failed | Toast | `danger` |

## Usage

### Banner

```tsx
import Banner from '@/components/Banner'

<Banner severity="warning" dismissible onDismiss={() => {}}>
  Your bond is approaching the slash threshold.
</Banner>
```

### Toast

```tsx
import { useToast } from '@/components/ToastProvider'

const { addToast } = useToast()
addToast('success', 'Bond created successfully.')
```

## Guidelines

- Avoid showing more than one banner per page section
- Toasts are for transient feedback — do not use for persistent state
- Danger-severity toasts require manual dismiss to ensure acknowledgment
- Keep toast messages under ~80 characters
