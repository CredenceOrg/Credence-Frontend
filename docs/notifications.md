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

- Renders fixed top-right on desktop, and **bottom-center** on mobile
- Stays safe from covering primary CTAs on small screens
- Auto-dismisses based on severity timeout
- Shows a countdown ring while the toast is auto-dismissing so the remaining time is visible at a glance
- Supports "Dismiss All" when multiple toasts are active
- Use for: action confirmations, transient status updates

---

## Banner Severity Variants

| Severity   | Use case                                      | Example events                                    |
| ---------- | --------------------------------------------- | ------------------------------------------------- |
| `info`     | Neutral context / informational protocol note | Bond lock period reminder, score epoch note       |
| `success`  | Positive outcome                              | Bond created, score retrieved, vote submitted     |
| `warning`  | Non-critical concern                          | Bond nearing slash threshold, low balance         |
| `critical` | Critical / destructive / incident             | Bond slashed, protocol paused, transaction failed |

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
  All bond operations are suspended. Monitor the <a href="/status">status page</a> for updates.
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

| Prop             | Type                                             | Required | Description                                                  |
| ---------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------ |
| `severity`       | `'info' \| 'success' \| 'warning' \| 'critical'` | ✓        | Visual and semantic severity                                 |
| `children`       | `ReactNode`                                      | ✓        | Message body content                                         |
| `title`          | `string`                                         |          | Short bold heading above the message                         |
| `dismissible`    | `boolean`                                        |          | Renders close button; makes banner dismissible               |
| `onDismiss`      | `() => void`                                     |          | Called when close button is activated                        |
| `action`         | `{ label, href?, onClick? }`                     |          | Inline CTA link or button after the message                  |
| `returnFocusRef` | `RefObject<HTMLElement>`                         |          | Element to focus after dismiss (defaults to `document.body`) |

---

> [!TIP]
> **Visuals**: Toasts use HSL-based color palettes with glassmorphism (backdrop-blur) and high-quality SVG icons to ensure a premium look and feel.

## Placement Rules

| Type              | Position                              | Scope                                              |
| ----------------- | ------------------------------------- | -------------------------------------------------- |
| Global banner     | Between header and `<main>` in Layout | Protocol-wide alerts (e.g. "Protocol paused")      |
| Contextual banner | Inline within page content            | Page-specific guidance or warnings                 |
| Toast             | Fixed Overlay                         | **Desktop**: Top-Right. **Mobile**: Bottom-Center. |

## Severity Levels (Toast)

| Severity  | Auto-dismiss | Quieted by Quiet hours? | Rationale                                        |
| --------- | ------------ | ----------------------- | ------------------------------------------------ |
| `info`    | 5 seconds\*  | Yes                     | Low urgency, informational                       |
| `success` | 5 seconds\*  | Yes                     | Confirmation — user can move on                  |
| `warning` | 8 seconds\*  | Yes                     | Needs attention but not blocking                 |
| `danger`  | Manual only  | **No**                  | Must be acknowledged explicitly — never silenced |

_\* Timers pause while the pointer is hovering over the toast or while keyboard focus is inside it._

## Quiet Hours

Users can opt into a configurable window during which non-critical toasts (`info`, `success`, `warning`) are silenced. Critical `danger` toasts always surface so incident, slashing, and failed-transaction events are never lost.

### Default behaviour

- **Disabled by default.** Users have to opt in.
- **Severity filter.** Only `info`, `success`, and `warning` toasts are silenced. `danger` always surfaces visually _and_ via the visually-hidden assertive `aria-live` region — see [Accessibility](#accessibility).
- **Screen reader silence.** When a toast is suppressed, its `announce()` call is also skipped so the polite `aria-live` region stays quiet during the user's selected window.
- **Local time.** The current minute is computed from `new Date().getHours() * 60 + new Date().getMinutes()` so the window follows the user's clock.
- **Inclusive endpoints.** Both `start` and `end` are inclusive; a 22:00–07:00 window silences the minute starting at 22:00 and the minute ending at 07:00.

### Window semantics

The window is interpreted on the user's local clock:

| Configuration   | Interpretation                                               |
| --------------- | ------------------------------------------------------------ |
| `start < end`   | Active for the same-day window, e.g. `13:00–15:00`           |
| `start > end`   | Cross-midnight window, e.g. `22:00–07:00` covers both halves |
| `start === end` | Degenerate; treat as disabled (silences nothing)             |

### Settings payload

Quiet hours live in the same `credence:settings` payload as the rest of the user preferences. Three fields are persisted:

- `quietHoursEnabled` — boolean master toggle.
- `quietHoursStart` — inclusive `HH:mm` start of the window.
- `quietHoursEnd` — inclusive `HH:mm` end of the window.

Defaults: `false`, `'22:00'`, `'07:00'`. Legacy exports missing the three keys continue to import cleanly — `validateAndNormalize` fills them with defaults. Invalid `HH:mm` strings fail the import with a descriptive error.

### Where the logic lives

- **Constants** — `src/config/notifications.ts` (`DEFAULT_QUIET_HOURS_START`, `DEFAULT_QUIET_HOURS_END`, `QUIET_HOURS_TIME_PATTERN`).
- **Pure-function helpers** — `src/lib/quietHours.ts` (`parseHHmm`, `isWithinQuietHours`, `isQuietHoursActive`, `QUIET_HOURS_DEFAULTS`).
- **Evaluation hook** — `ToastProvider` reads `quietHoursEnabled/Start/End` from settings, evaluates `isQuietHoursActive` at the moment `addToast` fires, and bails out (skipping both the toast and its aria-live announcement) when active and severity is not `danger`.
- **UI** — Settings page → Notifications section → Quiet hours block with the master toggle and two `<input type="time">` controls (step 5 minutes). A live "Quiet hours active now" / "Quiet hours inactive" hint reflects the current minute.

### Tests

- Pure-function coverage lives in `src/lib/quietHours.test.ts` and exercises same-day, cross-midnight, degenerate (`start === end`), boundary equality, and malformed-input cases.
- Integration coverage in `src/components/ToastProvider.test.tsx` (Quiet hours suite) confirms that non-danger toasts are suppressed during the active window, danger toasts still surface and announce assertively, and disabled quiet hours let every toast through.

---

## Stacking Rules (Toast)

- Maximum **3** toasts visible simultaneously
- When a 4th toast arrives, the oldest is removed (FIFO)
- A "**Dismiss All**" button appears when more than one toast is visible
- Each toast can also be manually dismissed via the (X) button

---

## Accessibility

- Banners use `role="alert"` for `warning`/`critical` and `role="status"` for `info`/`success`
- `aria-label` on the banner root announces severity to screen readers
- Toast container splits toasts across two sibling live regions to avoid double-announcing:
  - `aria-live="polite"` (labelled "Notifications") for `info`, `success`, and `warning` — announced when the screen reader is idle
  - `aria-live="assertive"` (labelled "Error notifications") for `danger` — interrupts and announces immediately, matching the sticky, must-acknowledge nature of error feedback
- Individual toast elements use `role="alert"` for `danger` and `role="status"` for all other severities
- Dismiss buttons have `aria-label` text
- Icons are marked `aria-hidden="true"` (decorative)
- Dismiss buttons are keyboard-focusable and respond to Enter/Space
- Toasts automatically pause their auto-dismiss timer on mouse hover or when keyboard focus moves inside them, satisfying WCAG 2.2.1 (Timing Adjustable)
- The countdown ring respects the same pause/resume behavior and remains accurate while the toast is hovered or focused
- Supports `prefers-reduced-motion` for simplified entrance animations

## Event → Notification Mapping

| Event                     | Type                             | Severity   |
| ------------------------- | -------------------------------- | ---------- |
| Bond created              | Toast                            | `success`  |
| Bond slashed              | Banner (contextual) + Toast      | `critical` |
| Score updated             | Toast                            | `success`  |
| Score lookup completed    | Toast                            | `info`     |
| Governance vote submitted | Toast                            | `success`  |
| Protocol paused           | Banner (global, persistent)      | `critical` |
| Low wallet balance        | Banner (contextual, dismissible) | `warning`  |
| Transaction failed        | Toast                            | `danger`   |
| Incident active           | Banner (global, persistent)      | `critical` |
| Maintenance window        | Banner (global, dismissible)     | `info`     |

---

## Usage Examples

### Persistent critical (incident / protocol paused)

```tsx
import Banner from '@/components/Banner'
;<Banner severity="critical" title="Protocol Paused">
  All bond operations are suspended pending governance resolution.{' '}
  <a href="/governance">View proposal →</a>
</Banner>
```

### Dismissible warning with action

```tsx
const triggerRef = useRef<HTMLButtonElement>(null)
const [show, setShow] = useState(true)

{
  show && (
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
  )
}
```

### Informational with link

```tsx
<Banner severity="info" action={{ label: 'Learn more', href: '/docs/epochs' }}>
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

---

## Dev-only Toast QA Harness

`src/pages/ToastTest.tsx` is a manual QA harness for verifying toast appearance and behaviour. It is **not a user-facing page**.

- **Dev access**: navigate to `/dev/toasts` when running the Vite dev server (`npm run dev`).
- **Production**: the route and module are absent from the production bundle. Vite replaces `import.meta.env.DEV` with `false` at build time; Rollup eliminates the dead branch, so `ToastTest` is never included in `dist/`.
- **Do not delete**: the harness is useful for checking glassmorphism, SVG icons, stacking, mobile placement, and accessibility during development.

The harness covers the design-verification checklist: glassmorphism, SVG icons, mobile bottom-center placement, 3-toast stack limit, "Dismiss All", and `prefers-reduced-motion`.
