# Error Handling

This document defines when to use Credence's loading, empty, error, banner,
toast, and error-boundary surfaces. It complements the existing
[`UI_STATES_GUIDE.md`](./UI_STATES_GUIDE.md) and
[`notifications.md`](./notifications.md) docs by turning those component details
into a single decision contract.

Related source:

- `src/components/states/LoadingSkeleton.tsx`
- `src/components/states/EmptyState.tsx`
- `src/components/states/ErrorState.tsx`
- `src/components/Banner.tsx`
- `src/components/Toast.tsx`
- `src/components/ToastProvider.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/pages/RouteErrorPage.tsx`
- `src/pages/Bond.tsx`
- `src/pages/Dashboard.tsx`

## Decision Flow

Use the most local surface that explains the state and gives the user the right
next step.

```text
Is data still loading?
  -> Use LoadingSkeleton with the shape that matches the final content.

Did the request succeed but return no usable content?
  -> Use EmptyState for the affected section or page.

Is there a recoverable request, validation, or service error?
  -> Use ErrorState in the affected section.
  -> Wrap it in role="alert" when the error appears dynamically.

Is there persistent context, guidance, or a warning the user should see while
continuing on the page?
  -> Use Banner.

Did a user action just succeed, fail, or produce transient feedback?
  -> Use Toast through useToast().

Did a render/lifecycle crash escape the route or component?
  -> Let ErrorBoundary or RouteErrorPage render the fallback.
```

## Surface Contract

| Surface                            | Use for                                                                                                                       | Avoid for                                                                | Accessibility contract                                                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LoadingSkeleton`                  | Placeholder layout while content is being fetched or lazily prepared.                                                         | Errors, empty results, or blocking progress that needs explanatory copy. | If the loading state appears dynamically, wrap the skeleton in a status region such as `role="status"` with `aria-live="polite"` and an accessible label.               |
| `EmptyState`                       | Successful zero-result states: no bonds, no dashboard data, no activity, filtered-empty views.                                | Failures, validation errors, or cases where data may still arrive.       | The component renders a visible heading and descriptive text. Icons are decorative when provided by illustration variants.                                              |
| `ErrorState`                       | Recoverable page or section errors: network, backend, validation, generic.                                                    | Transient action feedback or persistent protocol context.                | `ErrorState` itself is a visual panel; wrap it in `role="alert"`/`aria-live` at the call site when it is inserted as a dynamic error.                                   |
| `Banner`                           | Inline persistent or dismissible context: protocol notices, slash exposure warnings, one-time guidance, low-balance warnings. | One-off success confirmations after an action.                           | `warning` and `critical` render `role="alert"`; `info` and `success` render `role="status"`. Dismissible banners restore focus via `returnFocusRef` or `document.body`. |
| `Toast`                            | Transient action feedback: saved settings, created bond, dismissed state, transaction failure.                                | Content the user must keep visible to complete a task.                   | `ToastProvider` splits toasts into polite and assertive live regions. Individual `danger` toasts use `role="alert"`; other severities use `role="status"`.              |
| `ErrorBoundary` / `RouteErrorPage` | Render crashes, lazy route failures, and route-level exceptions.                                                              | Expected empty/error states from fetches or form validation.             | Default fallback uses `ErrorState` with a retry action and home link. Route-level fallback uses `RouteErrorPage`.                                                       |

## LoadingSkeleton

`LoadingSkeleton` supports these variants:

| Variant     | Use when                                           |
| ----------- | -------------------------------------------------- |
| `text`      | Paragraphs, descriptions, or small text blocks.    |
| `card`      | One card-like region is loading.                   |
| `form`      | A form section or stacked form fields are loading. |
| `table`     | Tabular or repeated row content is loading.        |
| `dashboard` | A dashboard grid of summary cards is loading.      |

Props:

```ts
{
  variant?: 'text' | 'card' | 'form' | 'table' | 'dashboard'
  rows?: number
  width?: string
  height?: string
}
```

Example:

```tsx
<section role="status" aria-live="polite" aria-label="Loading dashboard">
  <LoadingSkeleton variant="dashboard" rows={3} />
</section>
```

`src/pages/Dashboard.tsx` already uses the dashboard variant when it is loading
summary content.

## EmptyState

Use `EmptyState` when the app has completed the work and the correct result is
"nothing to show." The user should know whether this is a neutral state, a first
step, or a filtered-empty result.

Props:

```ts
{
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  illustration?: 'bond' | 'trust' | 'dispute' | 'attestation' | 'activity'
}
```

Examples:

```tsx
<EmptyState
  illustration="bond"
  title="No bonds yet"
  description="Create a bond to start building your Credence reputation."
  action={{ label: 'Create bond', onClick: openCreateBond }}
/>
```

```tsx
<EmptyState
  title="No results"
  description="Adjust the filters or search for another address."
  action={{ label: 'Clear filters', onClick: clearFilters, variant: 'secondary' }}
/>
```

Use the zero-result copy guidance in [`zero-states-copy.md`](./zero-states-copy.md)
when naming new empty states.

## ErrorState

Use `ErrorState` for recoverable failures where the user can retry, edit input,
or wait for service recovery.

Types:

| Type         | Default use                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `network`    | Connection failure, timeout, offline state, or Stellar network reachability.                        |
| `backend`    | Backend/API service unavailable or server failure.                                                  |
| `validation` | Invalid user input that belongs at a section/page level. Field-level errors stay next to the field. |
| `generic`    | A recoverable failure that does not fit the other types.                                            |

Props:

```ts
{
  type?: 'network' | 'backend' | 'validation' | 'generic'
  title?: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: ReactNode
}
```

Examples:

```tsx
<div role="alert" aria-live="assertive">
  <ErrorState type="network" action={{ label: 'Try again', onClick: refetch }} />
</div>
```

```tsx
<ErrorState
  type="validation"
  title="Invalid wallet address"
  message="Enter a valid Stellar public key before looking up trust history."
  action={{ label: 'Edit address', onClick: focusAddressInput }}
/>
```

`ErrorState` does not currently add `role="alert"` on its root. Add the alert
wrapper at the call site when the error appears after user action or async work.

## Banner

Use `Banner` for information that should remain in the page flow. It can be
persistent or dismissible.

Severity:

| Severity   | Role     | Use when                                                   |
| ---------- | -------- | ---------------------------------------------------------- |
| `info`     | `status` | Neutral context, policy reminders, epoch notes.            |
| `success`  | `status` | Positive inline state that should stay visible in context. |
| `warning`  | `alert`  | Recoverable risk or condition that needs attention.        |
| `critical` | `alert`  | Protocol incidents, destructive warnings, paused states.   |

Examples:

```tsx
<Banner severity="info">Bonds are locked for a minimum period before withdrawal.</Banner>
```

```tsx
<Banner severity="warning" title="Slash exposure on early withdrawal">
  Withdrawing now may reduce the returned balance.
</Banner>
```

Dismissible banners should be reserved for guidance the user may acknowledge and
move past. Persistent banners should disappear only when the underlying
condition resolves.

## Toast

Use toasts for brief feedback caused by an action. Trigger them through
`useToast()`:

```tsx
const { addToast } = useToast()
addToast('success', 'Settings saved successfully')
```

Severity:

| Severity  | Default timeout | Use when                         |
| --------- | --------------- | -------------------------------- |
| `info`    | 5 seconds       | Neutral transient update.        |
| `success` | 5 seconds       | Completed action.                |
| `warning` | 8 seconds       | Non-blocking warning.            |
| `danger`  | Manual dismiss  | Error that must be acknowledged. |

`ToastProvider` reads settings before enqueueing:

- `toastsEnabled=false` suppresses new toasts.
- `autoDismiss='off'` disables auto-dismiss for severities that otherwise time
  out.
- `autoDismiss='3s'`, `'5s'`, or `'8s'` overrides the timeout in seconds.
- The queue keeps only the three newest toasts.

Toasts should not carry information needed to finish a task. If the user needs
the message while editing or deciding, use `Banner` or inline field feedback.

## Error Boundaries

Use error boundaries for unexpected render failures, not for ordinary data
states. The app has two layers:

| Boundary            | Source                                     | Handles                                          |
| ------------------- | ------------------------------------------ | ------------------------------------------------ |
| Root boundary       | `src/main.tsx` wrapping `<App />`          | Provider bootstrap and full-app render failures. |
| Route tree boundary | `src/App.tsx` wrapping `<Suspense>`/routes | Lazy route failures and route render crashes.    |

The default `ErrorBoundary` fallback renders `ErrorState type="generic"` with a
`Try again` action and a home link. `src/pages/RouteErrorPage.tsx` is the route
error page used by React Router.

Do not catch expected fetch errors by throwing into an error boundary. Render a
section-level `ErrorState` so the user can retry without losing the page.

## Page Guidance

### Bond

`src/pages/Bond.tsx` uses:

- `Banner severity="info"` for lock-period context.
- `Banner severity="warning"` for slash-exposure context.
- `EmptyState illustration="bond"` when there are no bonds.
- `useToast()` for withdrawal success/failure feedback.

Keep that split: banners explain ongoing bond context; toasts report action
results; empty state handles the no-bond case.

### Trust Score

Trust lookup and score surfaces should use:

- Field-level validation next to the address input for malformed addresses.
- `LoadingSkeleton` while lookup results are loading.
- `ErrorState type="network"` or `type="backend"` for recoverable lookup
  failures.
- `EmptyState illustration="trust"` when a valid address has no trust history.
- Toasts only for transient confirmations, not for the lookup result itself.

## Quick Checklist

Before adding a new state surface, confirm:

- The user can tell whether the app is loading, empty, failed, or merely warning.
- The component choice matches the decision flow above.
- Dynamic loading has a status region when needed.
- Dynamic errors are announced with `role="alert"` or an assertive live region.
- Persistent information is not hidden inside a toast.
- Toasts stay short and are safe to miss.
- Error boundaries are reserved for unexpected render failures.
