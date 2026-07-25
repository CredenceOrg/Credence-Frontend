# Form validation timing

## Audience

This guide is for contributors implementing forms in the Credence frontend. It focuses on the practical question of when to validate: on blur, on change, or on submit.

## Rule of thumb

Use the three events for three different jobs:

- Use `onChange` for updating the field value and for lightweight, immediate feedback.
- Use `onBlur` for field-level validation that should trigger after a user has finished editing a specific input.
- Use `onSubmit` for the final, authoritative validation before sending data to the API or moving the user forward.

In practice, that means:

1. Keep the form state current with `onChange`.
2. Show field-specific feedback with `onBlur`.
3. Block submission and run the full validation pass with `onSubmit`.

## When to use `onChange`

Use `onChange` when the user is actively typing and the UI can respond immediately without blocking the flow.

Good fits for `onChange`:

- Updating a controlled input value.
- Showing a character counter.
- Highlighting a password strength hint.
- Formatting a value as the user types (for example, normalizing an amount input).

Example:

```tsx
import { useState } from 'react'

function AmountField() {
  const [value, setValue] = useState('')

  return (
    <label>
      Amount
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        inputMode="decimal"
      />
    </label>
  )
}
```

Avoid using `onChange` as the only validation point for required or business-rule checks. Doing so can create noisy feedback while the user is still typing.

## When to use `onBlur`

Use `onBlur` when the user has finished editing one field and the UI should validate that field once before the next step.

Good fits for `onBlur`:

- Required field checks after the user leaves the field.
- Email or address format checks that should not appear on every keystroke.
- Field-level hints such as “Please enter a valid Stellar address” after the field loses focus.

Example:

```tsx
function AddressField() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const validate = (nextValue: string) => {
    if (!nextValue.trim()) {
      return 'Address is required.'
    }

    if (!nextValue.startsWith('G')) {
      return 'Enter a valid Stellar public key.'
    }

    return null
  }

  return (
    <label>
      Recipient address
      <input
        value={value}
        onBlur={() => setError(validate(value))}
        onChange={(event) => {
          setValue(event.target.value)
          if (error) {
            setError(null)
          }
        }}
      />
      {error ? <p role="alert">{error}</p> : null}
    </label>
  )
}
```

This pattern gives the user a clear signal once they have finished with the field, without turning the form into a stream of validation messages while they type.

## When to use `onSubmit`

Use `onSubmit` for the final gate before the form is accepted. This is the place to run the full set of validations that must be true before the request is sent.

Good fits for `onSubmit`:

- Required fields across the whole form.
- Cross-field rules such as “amount must be greater than zero” or “recipient and memo must be compatible.”
- Server-side validation that should happen once the user attempts to submit.
- Preventing network requests when the form is invalid.

Example:

```tsx
function BondForm() {
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!amount.trim() || !address.trim()) {
      setError('Amount and recipient are required.')
      return
    }

    setError(null)
    console.log('submit', { amount, address })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={amount} onChange={(event) => setAmount(event.target.value)} />
      <input value={address} onChange={(event) => setAddress(event.target.value)} />
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">Create bond</button>
    </form>
  )
}
```

## Recommended pattern for this codebase

For most Credence forms, the cleanest pattern is:

- Use `onChange` to update the current input value.
- Use `onBlur` for field-level validation that should appear once the field is done.
- Use `onSubmit` to verify the whole form before sending the request.

That keeps the UI responsive while still ensuring that final submission is blocked by the complete rule set.

## Common mistakes to avoid

- Relying on `onChange` alone for all validation, which can become noisy and distracting.
- Skipping `onSubmit` validation and trusting earlier field feedback alone.
- Mixing too many validation sources without a clear hierarchy, which makes it hard to reason about which message is authoritative.

If a field has a server-side requirement, the final decision still belongs in `onSubmit` after the user attempts to proceed.
