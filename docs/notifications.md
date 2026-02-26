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

- Renders fixed top-right, stacked vertically
- Auto-dismisses based on severity timeout
- Use for: action confirmations, transient status updates

## Severity Levels

| Severity | Use case | Example events |
|----------|----------|---------------|
| `info` | Neutral context | Bond lock period reminder, score epoch note |
| `success` | Positive outcome | Bond created, score retrieved, vote submitted |
| `warning` | Non-critical concern | Bond nearing slash threshold, low balance |
| `danger` | Critical / destructive | Bond slashed, protocol paused, transaction failed |

## Placement Rules

| Type | Position | Scope |
|------|----------|-------|
| Global banner | Between header and `<main>` in Layout | Protocol-wide alerts (e.g. "Protocol paused") |
| Contextual banner | Inline within page content | Page-specific guidance or warnings |
| Toast | Fixed top-right overlay | Action confirmations and transient feedback |

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
- Each toast can also be manually dismissed

## Accessibility

- Banners use `role="alert"` for `warning`/`danger` and `role="status"` for `info`/`success`
- Toast container uses `aria-live="polite"` so screen readers announce new toasts
- Dismiss buttons have `aria-label` text
- Icons are marked `aria-hidden="true"` (decorative)
- Dismiss buttons are keyboard-focusable and respond to Enter/Space

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
