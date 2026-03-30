# Credence Frontend — Notification Patterns

Rules for notifications, banners, and toasts across the Credence UI.

## Component Types

### Banner (`src/components/Banner.tsx`)

Inline notification for contextual or global alerts. Can be persistent or dismissible.

- Renders inside page content flow
- Stays visible until dismissed (if `dismissible`) or permanently (if persistent)
- Use for: page-level context, global protocol alerts, form guidance, incident messaging

### Toast (`src/components/Toast.tsx` + `ToastProvider.tsx`)

Ephemeral overlay notification triggered by user actions or system events.

- Renders fixed top-right, stacked vertically
- Auto-dismisses based on severity timeout
- Use for: action confirmations, transient status updates

---

## Banner Severity Variants

| Severity   | Use case                                      | Example events                                      |
|------------|-----------------------------------------------|-----------------------------------------------------|
| `info`     | Neutral context / informational protocol note | Bond lock period reminder, score epoch note         |
| `success`  | Positive outcome                              | Bond created, score retrieved, vote submitted       |
| `warning`  | Non-critical concern                          | Bond nearing slash threshold, low balance           |
| `critical` | Critical / destructive / incident             | Bond slashed, protocol paused, transaction failed   |

> Note: `critical` replaces the former `danger` severity for banners to align with incident messaging language.

---

## Dismissible vs Persistent Patterns

These two patterns are visually distinct and carry different user expectations.

### Persistent banners

- Left border is **6px** (thicker) — signals "this is not going away"
- No close button rendered
- Used for: active protocol incidents, paused state, ongoing degraded conditions
- The user must resolve the underlying condition for the banner to disappear (controlled by parent state)

```tsx
<Banner severity="critical" title="Protocol Paused">
  All bond operations are suspended. Monitor the{' '}
  <a href="/status">status page</a> for updates.
</Banner>
```

### Dismissible banners

- Left border is **4px** (standard) — signals "you can acknowledge and move on"
- Close button (×) rendered top-right
- Pressing `Escape` while the dismiss button is focused also triggers dismiss
- Focus returns to `returnFocusRef` element (or `document.body`) after dismiss
- Used for: one-time guidance, soft warnings, informational nudges

```tsx
const triggerRef = useRef<HTMLButtonElement>(null)

<Banner
  severity="warning"
  title="Low Balance"
  dismissible
  onDismiss={() => setShowBanner(false)}
  returnFocusRef={triggerRef}
>
  Your wallet balance is below the recommended bond threshold.
</Banner>
```

---

## Banner Props

| Prop             | Type                          | Required | Description                                                    |
|------------------|-------------------------------|----------|----------------------------------------------------------------|
| `severity`       | `'info' \| 'success' \| 'warning' \| 'critical'` | ✓ | Visual and semantic severity |
| `children`       | `ReactNode`                   | ✓        | Message body content                                           |
| `title`          | `string`                      |          | Short bold heading above the message                           |
| `dismissible`    | `boolean`                     |          | Renders close button; makes banner dismissible                 |
| `onDismiss`      | `() => void`                  |          | Called when close button is activated                          |
| `action`         | `{ label, href?, onClick? }`  |          | Inline CTA link or button after the message                    |
| `returnFocusRef` | `RefObject<HTMLElement>`      |          | Element to focus after dismiss (defaults to `document.body`)   |

---

## Placement Rules

| Type               | Position                                  | Scope                                          |
|--------------------|-------------------------------------------|------------------------------------------------|
| Global banner      | Between header and `<main>` in Layout     | Protocol-wide alerts (e.g. "Protocol paused")  |
| Contextual banner  | Inline within page content                | Page-specific guidance or warnings             |
| Toast              | Fixed top-right overlay                   | Action confirmations and transient feedback    |

### Copy width

Banners cap their content at `max-width: 72ch` to keep line lengths readable on ultra-wide screens. Do not override this with `width: 100%` on the banner itself — let the parent container control horizontal placement.

---

## Severity Levels (Toast)

| Severity  | Auto-dismiss | Rationale                                      |
|-----------|-------------|------------------------------------------------|
| `info`    | 5 seconds   | Low urgency, informational                     |
| `success` | 5 seconds   | Confirmation — user can move on                |
| `warning` | 8 seconds   | Needs attention but not blocking               |
| `danger`  | Manual only | Must be acknowledged explicitly                |

---

## Stacking Rules (Toast)

- Maximum **3** toasts visible simultaneously
- When a 4th toast arrives, the oldest is removed (FIFO)
- Each toast can also be manually dismissed

---

## Accessibility

- Banners use `role="alert"` for `warning`/`critical` and `role="status"` for `info`/`success`
- `aria-label` on the banner root announces severity to screen readers
- Toast container uses `aria-live="polite"` so screen readers announce new toasts
- Dismiss buttons have `aria-label="Dismiss banner"`
- Icons are SVG with `aria-hidden="true"` (decorative)
- Dismiss buttons are keyboard-focusable and respond to `Enter`, `Space`, and `Escape`
- After dismiss, focus returns to `returnFocusRef` or `document.body`
- Action links and buttons have `:focus-visible` outlines using `currentColor`

---

## Event → Notification Mapping

| Event                    | Type                              | Severity   |
|--------------------------|-----------------------------------|------------|
| Bond created             | Toast                             | `success`  |
| Bond slashed             | Banner (contextual) + Toast       | `critical` |
| Score updated            | Toast                             | `success`  |
| Score lookup completed   | Toast                             | `info`     |
| Governance vote submitted| Toast                             | `success`  |
| Protocol paused          | Banner (global, persistent)       | `critical` |
| Low wallet balance       | Banner (contextual, dismissible)  | `warning`  |
| Transaction failed       | Toast                             | `danger`   |
| Incident active          | Banner (global, persistent)       | `critical` |
| Maintenance window       | Banner (global, dismissible)      | `info`     |

---

## Usage Examples

### Persistent critical (incident / protocol paused)

```tsx
import Banner from '@/components/Banner'

<Banner severity="critical" title="Protocol Paused">
  All bond operations are suspended pending governance resolution.{' '}
  <a href="/governance">View proposal →</a>
</Banner>
```

### Dismissible warning with action

```tsx
const triggerRef = useRef<HTMLButtonElement>(null)
const [show, setShow] = useState(true)

{show && (
  <Banner
    severity="warning"
    title="Bond Threshold Warning"
    dismissible
    onDismiss={() => setShow(false)}
    returnFocusRef={triggerRef}
    action={{ label: 'Top up balance', onClick: () => openTopUp() }}
  >
    Your bond is approaching the slash threshold.
  </Banner>
)}
```

### Informational with link

```tsx
<Banner
  severity="info"
  action={{ label: 'Learn more', href: '/docs/epochs' }}
>
  Trust scores are recalculated at the start of each epoch.
</Banner>
```

### Toast

```tsx
import { useToast } from '@/components/ToastProvider'

const { addToast } = useToast()
addToast('success', 'Bond created successfully.')
```

---

## Guidelines

- Avoid showing more than one banner per page section
- Toasts are for transient feedback — do not use for persistent state
- Danger-severity toasts require manual dismiss to ensure acknowledgment
- Keep toast messages under ~80 characters
- Persistent banners should only be removed when the underlying condition resolves — never auto-dismiss them
- Dismissible banners should always restore focus on close
