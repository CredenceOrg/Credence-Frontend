# Error UI Pattern Guide

This document defines the standardized error surfaces in the Credence Frontend application. It is written for **frontend contributors** building or modifying UI components, forms, and pages.

For general state priority (loading/empty/error), refer to the [UI States Guide](./UI_STATES_GUIDE.md). For copy and microcopy phrasing guidelines, see the [Copy Tone Guide](./COPY_TONE.md).

---

## Decision Matrix: Which Surface to Use?

Choose the error surface based on **scope**, **user impact**, and **persistence**:

| Surface                  | Scope               | Typical Trigger                                                          | Persistence                              | Component / API                                        |
| :----------------------- | :------------------ | :----------------------------------------------------------------------- | :--------------------------------------- | :----------------------------------------------------- |
| **Inline Form Error**    | Single input field  | Real-time or submit input validation failure                             | Persistent until input is corrected      | [`FormField`](./COMPONENTS.md#formfield)               |
| **Banner Alert**         | Section or page     | Contextual condition (network mismatch, read-only mode, API degradation) | Persistent or dismissible within section | [`Banner`](./COMPONENTS.md#banner)                     |
| **Toast Notification**   | Global overlay      | Result of user action (transaction failure, network error on click)      | Auto-dismissing or manual dismiss        | `useToast()` / [`Toast`](./COMPONENTS.md#toast)        |
| **Section / Page Error** | Whole panel or page | Failed data fetch, 404, or unhandled UI crash                            | Persistent until retry succeeds          | [`ErrorState`](./UI_STATES_GUIDE.md) / `ErrorBoundary` |

---

## 1. Inline Form Errors (`FormField`)

### Use Case

Use inline form errors when user input fails validation (e.g., an invalid Stellar public key, out-of-range USDC amount, or missing required field).

### Accessibility & Behavior

- Error message is linked to the input via `aria-describedby`.
- Sets `aria-invalid="true"` on the form control.
- Renders with `role="alert"` so screen readers announce the validation message immediately.
- Styled using danger CSS design tokens (`var(--credence-color-danger-text)`).
- For successful validation confirmations, use `FormField`'s `success` prop instead: it links `${id}-success` via `aria-describedby`, uses `role="status"`, and does not set `aria-invalid`. If both `error` and `success` are provided, error takes precedence.

### Code Example

```tsx
import { useState } from 'react'
import { FormField } from '../components/forms/FormField'
import { isValidStellarAddress } from '../lib/stellar'

export function RecipientAddressField() {
  const [address, setAddress] = useState('')
  const [touched, setTouched] = useState(false)

  const isValid = isValidStellarAddress(address)
  const errorMessage =
    touched && !isValid && address.length > 0
      ? 'Enter a valid 56-character Stellar public key starting with G.'
      : undefined

  return (
    <FormField
      id="recipient-address"
      label="Recipient Address"
      hint="Must be a valid G... public key"
      error={errorMessage}
    >
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="G..."
        className="form-input"
      />
    </FormField>
  )
}
```

---

## 2. Banner Alerts (`Banner`)

### Use Case

Use banners for page-level or container-level contextual messages that require user attention but do not prevent the rest of the layout from rendering (e.g., wallet network mismatch, unconfirmed pending transactions, or read-only status).

### Accessibility & Behavior

- Critical (`severity="critical"`) and warning (`severity="warning"`) banners set `role="alert"`.
- Information and success banners set `role="status"`.
- Banners support inline actions (`action={{ label: 'Switch Network', onClick: handleSwitch }}`).
- Dismissible banners support focus restoration via `returnFocusRef` and keyboard escape (`Escape` key).

### Code Example

```tsx
import { useRef } from 'react'
import Banner from '../components/Banner'
import { useWallet } from '../hooks/useWallet'

export function NetworkCheckBanner() {
  const { network, switchNetwork } = useWallet()
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (network === 'mainnet') return null

  return (
    <Banner
      severity="warning"
      title="Testnet Active"
      dismissible
      returnFocusRef={triggerRef}
      action={{
        label: 'Switch to Mainnet',
        onClick: switchNetwork,
      }}
    >
      You are connected to Soroban Testnet. Actions will not affect live USDC balances.
    </Banner>
  )
}
```

---

## 3. Toast Notifications (`Toast` / `useToast`)

### Use Case

Use toasts for short, non-blocking feedback following an asynchronous user action (e.g., wallet submission failed, link copied to clipboard, or settings saved).

### Accessibility & Behavior

- Injected into the top-right overlay stack via `ToastProvider`.
- Critical/Danger toasts set `role="alert"` and require manual dismissal or a longer auto-dismiss duration.
- Auto-dismiss timer automatically **pauses on hover and focus**, resuming when focus or pointer leaves.
- Accessible dismiss button includes hidden screen-reader label (`sr-only`).

### Code Example

```tsx
import { useToast } from '../context/ToastContext'

export function BondActionButton() {
  const { addToast } = useToast()

  const handleCreateBond = async () => {
    try {
      await submitBondTransaction()
      addToast({
        severity: 'success',
        message: 'USDC bond successfully created.',
      })
    } catch (err) {
      addToast({
        severity: 'danger',
        message: err instanceof Error ? err.message : 'Transaction failed to broadcast.',
      })
    }
  }

  return (
    <button type="button" onClick={handleCreateBond} className="btn-primary">
      Create Bond
    </button>
  )
}
```

---

## 4. Page & Section Error States (`ErrorState` & `ErrorBoundary`)

### Use Case

Use section or full-page error states when data failed to load completely or a component unhandled exception occurred, rendering content unusable.

### Accessibility & Behavior

- Displays a prominent error icon, error heading, detailed description, and an actionable retry CTA button.
- Wrapped around route hierarchies via `ErrorBoundary` to prevent white-screen crashes.
- Styled using standard `--credence-color-danger-*` variables and centered layout panels.

### Code Example

```tsx
import { useState, useEffect } from 'react'
import ErrorState from '../components/states/ErrorState'
import { apiFetch } from '../api/client'

export function AccountTrustPanel() {
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState(null)

  const loadData = async () => {
    setError(null)
    try {
      const res = await apiFetch('/account/trust-score')
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load trust score'))
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (error) {
    return (
      <ErrorState
        type="network"
        title="Unable to load Trust Score"
        message={error.message}
        action={{
          label: 'Try Again',
          onClick: loadData,
        }}
      />
    )
  }

  return <div>{/* Render content */}</div>
}
```

---

## Design Tokens & Styling Rules

Always use Credence design tokens for error surfaces. **Never hardcode hex colors or pixel radii.**

- **Danger Surface**: `var(--credence-color-danger-surface)`
- **Danger Surface Strong**: `var(--credence-color-danger-surface-strong)`
- **Danger Text**: `var(--credence-color-danger-text)`
- **Danger Action Button**: `var(--credence-color-danger-action)`
- **Border Radius**: `var(--credence-radius-lg)`, `var(--credence-radius-xl)`

For the full reference of available variables, consult [Design Tokens](./DESIGN_TOKENS.md).

---

## Cross-References

- [UI States Guide](./UI_STATES_GUIDE.md) — Loading, empty, and general error state rules.
- [Copy Tone Guide](./COPY_TONE.md) — Voice, tone, and microcopy guidelines for error messages.
- [Shared Components Catalog](./COMPONENTS.md) — Component props reference for `Banner`, `Toast`, and `FormField`.
- [Form Inputs & Variants](./FORMS_AND_INPUTS.md) — Input state contracts and validation patterns.
- [Design Tokens](./DESIGN_TOKENS.md) — Token variables reference for CSS styling.
