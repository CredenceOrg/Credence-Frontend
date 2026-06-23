# UI States Design Guide

## Overview

This guide defines the empty states, error states, and loading patterns for the Credence Frontend application. These states ensure a consistent, helpful user experience across all views.

---

## Empty States

Empty states appear when there's no data to display. They should be encouraging and guide users toward their next action.

### Design Principles

- **Clear & Concise**: Use simple language that explains why the state is empty
- **Actionable**: Provide a clear next step when possible
- **Visual**: Include relevant icons or illustrations
- **Tone**: Friendly, encouraging, never blaming the user

### Core Empty States

#### 1. No Bond Yet

**When**: User has not created any bond
**Location**: Bond page, Home highlights

```tsx
<EmptyState
  illustration="bond"
  title="No bond created yet"
  description="Lock USDC into Credence to build your economic reputation and unlock trust-based opportunities."
  action={{
    label: 'Create your first bond',
    onClick: () => navigate('/bond'),
  }}
/>
```

**Microcopy Guidelines**:

- Title: 4-6 words, state the fact
- Description: 1-2 sentences, explain the benefit
- CTA: Action-oriented verb + outcome

---

## Bond page onboarding

This section defines the first-run help pattern for the Bond page. The goal is to guide new users through their first bond creation without interrupting expert users.

### Pattern

- Show a dismissible coach mark on first Bond page visit when the user has no existing bond.
- Anchor the coach mark to the bond form area and primary CTA, not as a modal overlay.
- Provide a complementary inline helper text in the form header or description so the experience is accessible and lightweight.
- Avoid blocking expert users: the coach mark is optional and can be closed immediately.

### Copy and structure

- Title: "Create your first bond"
- Description: "Lock USDC into Credence to build your economic reputation. Start with a small amount and your bond will show up in your dashboard."
- Primary action: "Got it" or "Start bond"
- Secondary action: "Not now" or close icon
- Optional inline helper: "Bonds are locked for a minimum of 30 days; early withdrawal may incur a penalty."

### Accessibility requirements

- The coach mark must be reachable by keyboard and screen readers.
- It must not trap focus. Focus should remain in the main form flow or move naturally to the close button.
- Use an accessible label and descriptive text, e.g. `aria-describedby="bond-onboarding-desc"`.
- Support dismissal via keyboard (`Tab`, `Enter`, `Space`, `Escape`).
- If the coach mark is visible, the page remains fully navigable and the user can interact with the form behind it.

### Dismissal and persistence

- Allow users to dismiss the coach mark with a close button or primary acknowledgment action.
- Persist dismissal state only after legal/privacy review. For design purposes, the recommended implementation is localStorage with a namespaced key such as `credence.bondOnboardingDismissed`.
- Do not show the coach mark again after dismissal, unless the user explicitly resets onboarding in settings or clears site data.
- Do not persist dismissal for authenticated preferences unless privacy requirements allow it.

### When to show it

- First time a wallet user lands on `/bond` and has no active bonds recorded.
- Do not show on subsequent visits after dismissal.
- Do not show after the user has already created a bond.
- On page refresh, if the coach mark was previously dismissed, keep it hidden.

### Developer guidance (design-only)

- Prefer a non-modal toast-like coach mark positioned near the bond amount field and create button.
- If a static prototype is desired, use a simple page overlay callout on the Bond page in the design doc rather than implementing runtime behavior.
- Keep the bond form usable while the coach mark is visible.

---

#### 2. No Trust Score Yet

**When**: Address has no trust score data
**Location**: Trust Score page

```tsx
<EmptyState
  illustration="trust"
  title="No trust score found"
  description="This address hasn't established a trust score yet. Create a bond and gather attestations to build reputation."
  action={{
    label: 'Learn how trust scores work',
    onClick: () => window.open('/docs/trust-score', '_blank'),
    variant: 'secondary',
  }}
/>
```

---

#### 3. No Disputes

**When**: No disputes exist for the user
**Location**: Activity/Governance page

```tsx
<EmptyState
  illustration="dispute"
  title="No disputes"
  description="You have no active or past disputes. Your reputation remains intact."
/>
```

**Note**: No action needed - this is a positive state

---

#### 4. No Attestations

**When**: User has no attestations
**Location**: Trust Score details, Profile

```tsx
<EmptyState
  illustration="attestation"
  title="No attestations yet"
  description="Attestations from trusted parties strengthen your reputation. Complete transactions and request attestations to build trust."
  action={{
    label: 'Request attestation',
    onClick: () => navigate('/attestations/request'),
  }}
/>
```

---

#### 5. No Activity

**When**: No governance or activity history
**Location**: Activity/Governance page

```tsx
<EmptyState
  illustration="activity"
  title="No activity yet"
  description="Your governance participation and transaction history will appear here."
/>
```

---

## Error States

Error states inform users when something goes wrong and help them recover.

### Design Principles

- **Honest**: Clearly state what went wrong
- **Helpful**: Explain what the user can do
- **Non-technical**: Avoid jargon and error codes in primary message
- **Tone**: Apologetic but solution-focused

### Core Error States

#### 1. Network Failure

**When**: Unable to connect to Stellar network or backend
**Trigger**: Network timeout, offline, DNS failure

```tsx
<ErrorState
  type="network"
  action={{
    label: 'Try again',
    onClick: () => refetch(),
  }}
/>
```

**Default Message**: "Unable to connect to the network. Check your internet connection and try again."

---

#### 2. Backend Error

**When**: API returns 500, service unavailable
**Trigger**: Server error, maintenance

```tsx
<ErrorState
  type="backend"
  title="Service temporarily unavailable"
  message="We're experiencing technical difficulties. Please try again in a few moments."
  action={{
    label: 'Retry',
    onClick: () => refetch(),
  }}
/>
```

---

#### 3. Invalid Address

**When**: User enters malformed Stellar address
**Trigger**: Validation failure on trust score lookup

```tsx
<ErrorState
  type="validation"
  title="Invalid wallet address"
  message="Please enter a valid Stellar address starting with 'G' and containing 56 characters."
  action={{
    label: 'Go back',
    onClick: () => reset(),
  }}
/>
```

---

#### 4. Transaction Failed

**When**: Blockchain transaction fails
**Trigger**: Insufficient funds, rejected transaction

```tsx
<ErrorState
  type="generic"
  title="Transaction failed"
  message="Your transaction could not be completed. Please check your wallet balance and try again."
  action={{
    label: 'Try again',
    onClick: () => retryTransaction(),
  }}
/>
```

---

## Loading States

Loading states provide feedback during asynchronous operations.

### Design Principles

- **Immediate**: Show loading state instantly
- **Contextual**: Match the content being loaded
- **Smooth**: Use subtle animations
- **Consistent**: Same patterns across the app

### Loading Patterns

#### 1. Form Loading

**When**: Submitting bond creation, attestation request
**Usage**:

```tsx
{
  isLoading ? <LoadingSkeleton variant="form" rows={3} /> : <BondForm />
}
```

---

#### 2. Card/Dashboard Loading

**When**: Loading home highlights, stats cards
**Usage**:

```tsx
{
  isLoading ? <LoadingSkeleton variant="dashboard" rows={3} /> : <DashboardCards />
}
```

---

#### 3. Table Loading

**When**: Loading activity history, dispute list
**Usage**:

```tsx
{
  isLoading ? <LoadingSkeleton variant="table" rows={5} /> : <ActivityTable />
}
```

---

#### 4. Text/Content Loading

**When**: Loading descriptions, details
**Usage**:

```tsx
{
  isLoading ? <LoadingSkeleton variant="text" rows={3} /> : <TrustScoreDetails />
}
```

---

## Implementation Guidelines

### For Developers

1. **State Priority**: Check states in this order:
   - Loading → Error → Empty → Content

2. **Composition Pattern**:

```tsx
function MyComponent() {
  const { data, isLoading, error } = useQuery()

  if (isLoading) return <LoadingSkeleton variant="card" />
  if (error) return <ErrorState type="network" />
  if (!data || data.length === 0) return <EmptyState {...emptyConfig} />

  return <Content data={data} />
}
```

3. **Accessibility**:
   - Loading states should have `role="status"` and `aria-live="polite"`
   - Error states should have `role="alert"`
   - Empty states should be keyboard navigable if they have actions

4. **Testing**:
   - Test each state independently
   - Verify transitions between states
   - Check responsive behavior

---

## Microcopy Guidelines

### Tone & Voice

- **Friendly**: Use conversational language
- **Clear**: Avoid ambiguity
- **Concise**: Respect user's time
- **Helpful**: Always suggest next steps

### Length Guidelines

- **Titles**: 3-6 words
- **Descriptions**: 1-2 sentences (max 140 characters)
- **CTAs**: 2-4 words, action verb + object

### Examples

✅ Good:

- "No bonds yet" / "Create your first bond"
- "Connection lost" / "Check your network and retry"

❌ Avoid:

- "You haven't created any bonds in the system yet" (too wordy)
- "Error 500" (too technical)
- "Oops! Something went wrong!" (overused, not helpful)

---

## Figma Design Specs

### Color Palette

**Empty States**:

- Background: Contextual (blue for bond, purple for trust, etc.)
- Text: #0f172a (title), #64748b (description)

**Error States**:

- Background: #fef2f2
- Border: #fee2e2
- Text: #991b1b (title), #7f1d1d (description)
- Button: #dc2626

**Loading States**:

- Base: #f1f5f9
- Shimmer: #e2e8f0

### Spacing

- Icon/Illustration: 64px diameter
- Icon margin-bottom: 16px
- Title margin-bottom: 8px
- Description margin-bottom: 24px (if action present)
- Padding: 48px 24px

### Typography

- Title: 18px, font-weight 600
- Description: 14px, line-height 1.5
- Button: 14px, font-weight 600

---

## Validation Checklist

Before shipping, validate:

- [ ] All empty states have clear CTAs (where appropriate)
- [ ] Error messages are user-friendly (no technical jargon)
- [ ] Loading skeletons match content layout
- [ ] All states are responsive (mobile, tablet, desktop)
- [ ] Microcopy follows tone guidelines
- [ ] Accessibility attributes are present
- [ ] States transition smoothly
- [ ] Product team has approved CTAs and messaging

---

---

## Error Boundary Strategy

### Architecture

Two boundaries protect the app from white-screen crashes:

| Layer            | Component        | Location                         | Catches                                  |
| ---------------- | ---------------- | -------------------------------- | ---------------------------------------- |
| Root (outermost) | `ErrorBoundary`  | `main.tsx` wrapping `<App />`    | Provider bootstrap errors                |
| Route tree       | `ErrorBoundary`  | `App.tsx` wrapping `<Suspense>`  | Lazy-chunk failures, route render errors |
| Router-level     | `RouteErrorPage` | `errorElement` on root `<Route>` | Loader errors (data-router)              |

### Class ErrorBoundary (`src/components/ErrorBoundary.tsx`)

```tsx
import ErrorBoundary from './components/ErrorBoundary'

// Default fallback (ErrorState + retry + home link)
<ErrorBoundary>
  <SomeSubtree />
</ErrorBoundary>

// Custom fallback via render prop
<ErrorBoundary fallback={(error, reset) => (
  <div>
    <p>{error.message}</p>
    <button onClick={reset}>Retry</button>
  </div>
)}>
  <SomeSubtree />
</ErrorBoundary>
```

**Retry behaviour:** clicking "Try again" calls `setState({ hasError: false, error: null })`.
React re-renders the children without a hard reload. If they throw again the boundary
catches once more.

**Telemetry hook:** `componentDidCatch` currently logs to `console.error`. Replace the
`console.error` call with your error monitoring SDK (Sentry, Datadog, etc.) before shipping.

### RouteErrorPage (`src/pages/RouteErrorPage.tsx`)

Registered as `errorElement` on the root route. In the current `BrowserRouter` setup this
serves as forward-compatible scaffolding; it becomes fully active if the app is migrated to
`createBrowserRouter`. Handles 404 (route miss) and generic router errors with the same
`ErrorState` visual.

### Accessibility

- The fallback renders an `<h3>` heading from `ErrorState` — screen readers announce the error.
- A `<a href="/">Go to home page</a>` link ensures keyboard-only users have a navigation escape hatch even if JavaScript is broken.
- The retry `<button>` is `focus-visible` styled via the shared class.

---

## Bond Row Inline Slash-Exposure Disclosure

Each bond row in the Active Bonds list surfaces penalty exposure inline — before the user commits to withdrawing — via an accessible disclosure.

### States per row

| Bond status | Disclosure control | Panel content |
|---|---|---|
| `locked` | "Show penalty" button (`aria-expanded`) | Bond amount, 20% penalty amount, resulting balance |
| `grace-period` | "Show penalty" button (`aria-expanded`) | Bond amount, 10% penalty amount, resulting balance |
| `active` | None (no expander) | Static "No early-withdrawal penalty" message |

### Behaviour

- The toggle button carries `aria-expanded="false"` when collapsed and `aria-expanded="true"` when open, pointing to the panel via `aria-controls`.
- The panel uses `role="region"` with an `aria-label` identifying the bond.
- The breakdown values (bond amount, penalty %, penalty USDC, resulting balance) are computed by `computeWithdrawBreakdown` — the same function used in the `ConfirmDialog` — so numbers are identical at both stages.
- Active bonds show a "No early-withdrawal penalty" message in place of the expander to make the safe state explicit.
- The row layout uses `flexWrap: wrap` so it reflows cleanly on narrow viewports.

### Disclaimer placement

The existing page-level slash-exposure `Banner` remains above the bond list as a summary callout. The per-row disclosure is the detailed, bond-specific complement to that banner — not a replacement.

---

## Future Enhancements

- Custom illustrations for each empty state
- Animated loading states
- Progressive loading (show partial content)
- Contextual help links in error states
- A/B test different microcopy variations
