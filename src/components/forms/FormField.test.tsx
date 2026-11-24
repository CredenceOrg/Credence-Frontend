import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { FormField } from './FormField'

/**
 * Boundary and recovery coverage for the two invariants FormField owns
 * independently of any particular caller:
 *
 *   1. `aria-describedby` stays a well-formed, duplicate-free ID reference list
 *      for every combination of caller-supplied and component-owned tokens.
 *   2. A blank (`''` / whitespace-only) message is indistinguishable from an
 *      absent one, so it can never mark a control invalid, mount an empty
 *      `role="alert"`, or suppress a real success message.
 *
 * Plus the recovery path: an error appearing and then clearing — directly, via
 * a retry, or while the user keeps typing — must leave behind no stale
 * `role="alert"`, no stale IDREF, and no lost user input.
 */

/** Reads the control's `aria-describedby` as the token list assistive tech parses. */
function describedByTokens(testId: string): string[] {
  const value = screen.getByTestId(testId).getAttribute('aria-describedby') ?? ''
  return value.split(' ').filter(Boolean)
}

/**
 * Reads the owning field's `data-state`, resolved from the control rather than
 * from document order so sibling fields stay distinguishable.
 */
function fieldStateForInput(testId: string): string | null {
  return screen.getByTestId(testId).closest('.form-field')?.getAttribute('data-state') ?? null
}

describe('FormField Accessibility', () => {
  it('propagates the id from FormField to its child input', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('id', 'test-field')
  })

  it('renders the label element pointing to the input id', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input />
      </FormField>
    )

    const label = screen.getByText('Test Label')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', 'test-field')
  })

  it('handles the path when there is no hint and no error', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(input).not.toHaveAttribute('aria-invalid')

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('handles hint-only path and sets aria-describedby', () => {
    render(
      <FormField id="test-field" label="Test Label" hint="This is a hint">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-hint')
    expect(input).not.toHaveAttribute('aria-invalid')

    const hint = screen.getByText('This is a hint')
    expect(hint).toHaveAttribute('id', 'test-field-hint')
    expect(hint).toHaveClass('form-hint')
  })

  it('handles error-only path, sets aria-describedby, and sets aria-invalid="true"', () => {
    render(
      <FormField id="test-field" label="Test Label" error="This is an error">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    const errorMsg = screen.getByText('⚠ This is an error')
    expect(errorMsg).toHaveAttribute('id', 'test-field-error')
    expect(errorMsg).toHaveAttribute('role', 'alert')
    expect(errorMsg).toHaveClass('form-error')
  })

  it('merges both hint and error IDs into aria-describedby on the child input', () => {
    render(
      <FormField id="test-field" label="Test Label" hint="This is a hint" error="This is an error">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-hint test-field-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('preserves pre-existing aria-describedby value on the child input', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input data-testid="child-input" aria-describedby="existing-desc" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'existing-desc')
  })

  it('merges pre-existing aria-describedby with hint and error IDs', () => {
    render(
      <FormField id="test-field" label="Test Label" hint="This is a hint" error="This is an error">
        <input data-testid="child-input" aria-describedby="existing-desc" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute(
      'aria-describedby',
      'existing-desc test-field-hint test-field-error'
    )
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('renders a visually hidden sr-only label when srOnlyLabel is true', () => {
    render(
      <FormField id="search-field" label="Search" srOnlyLabel>
        <input placeholder="Search attestations…" />
      </FormField>
    )

    const label = screen.getByText('Search')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveClass('sr-only')
    expect(label).toHaveAttribute('for', 'search-field')
  })

  it('associates sr-only label with the control for screen reader accessible name', () => {
    render(
      <FormField id="search-field" label="Search" srOnlyLabel>
        <input placeholder="Search attestations…" />
      </FormField>
    )

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveAttribute('id', 'search-field')
  })

  it('does not apply sr-only class to the label by default', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input />
      </FormField>
    )

    const label = screen.getByText('Test Label')
    expect(label).not.toHaveClass('sr-only')
  })

  it('handles success-only path with role="status" and aria-describedby', () => {
    render(
      <FormField id="test-field" label="Test Label" success="Looks good">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-success')
    expect(input).not.toHaveAttribute('aria-invalid')

    const success = screen.getByRole('status')
    expect(success).toHaveAttribute('id', 'test-field-success')
    expect(success).toHaveClass('form-success')
    expect(success).toHaveTextContent('Looks good')
    expect(document.querySelector('.form-field')).toHaveAttribute('data-state', 'success')
  })

  it('merges hint and success IDs into aria-describedby', () => {
    render(
      <FormField id="test-field" label="Test Label" hint="Helpful hint" success="Looks good">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-hint test-field-success')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('suppresses success when error is present (error takes precedence)', () => {
    render(
      <FormField
        id="test-field"
        label="Test Label"
        hint="Helpful hint"
        error="Required"
        success="Looks good"
      >
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-hint test-field-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('⚠ Required')
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelector('.form-field')).toHaveAttribute('data-state', 'error')
  })

  it('marks required fields with aria-required and a visible asterisk', () => {
    render(
      <FormField id="test-field" label="Test Label" required>
        <input data-testid="child-input" />
      </FormField>
    )

    expect(screen.getByTestId('child-input')).toHaveAttribute('aria-required', 'true')
    expect(document.querySelector('.form-required')).toHaveTextContent('*')
  })

  it('preserves child aria-invalid when FormField has no error of its own', () => {
    render(
      <FormField id="end-time" label="End time">
        <input data-testid="child-input" aria-invalid="true" aria-describedby="start-time-error" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'start-time-error')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('FormField aria-describedby merge boundaries', () => {
  it('keeps caller tokens first and in order, appending owned ids after them', () => {
    render(
      <FormField id="merge" label="Merge" hint="Hint" error="Error">
        <input data-testid="merge-input" aria-describedby="own-a own-b" />
      </FormField>
    )

    expect(describedByTokens('merge-input')).toEqual([
      'own-a',
      'own-b',
      'merge-hint',
      'merge-error',
    ])
  })

  it('emits at most two owned ids, because error and success are mutually exclusive', () => {
    const { rerender } = render(
      <FormField id="merge" label="Merge" hint="Hint" error="Error" success="Success">
        <input data-testid="merge-input" />
      </FormField>
    )
    expect(describedByTokens('merge-input')).toEqual(['merge-hint', 'merge-error'])

    rerender(
      <FormField id="merge" label="Merge" hint="Hint" success="Success">
        <input data-testid="merge-input" />
      </FormField>
    )
    expect(describedByTokens('merge-input')).toEqual(['merge-hint', 'merge-success'])
  })

  it('collapses a caller token that repeats the derived hint id', () => {
    // Behavior under test: a wrapper that pre-computes the id FormField also
    // derives (as src/pages/Settings.tsx does for the quiet-hours pair) must not
    // produce a repeated IDREF, which makes the description announce twice.
    render(
      <FormField id="merge" label="Merge" hint="Hint">
        <input data-testid="merge-input" aria-describedby="merge-hint" />
      </FormField>
    )

    expect(describedByTokens('merge-input')).toEqual(['merge-hint'])
  })

  it('collapses a caller token that repeats the derived error id', () => {
    render(
      <FormField id="merge" label="Merge" error="Error">
        <input data-testid="merge-input" aria-describedby="merge-error other" />
      </FormField>
    )

    expect(describedByTokens('merge-input')).toEqual(['merge-error', 'other'])
  })

  it('collapses a caller token that repeats the derived success id', () => {
    render(
      <FormField id="merge" label="Merge" success="Success">
        <input data-testid="merge-input" aria-describedby="merge-success" />
      </FormField>
    )

    expect(describedByTokens('merge-input')).toEqual(['merge-success'])
  })

  it('collapses repeated tokens inside the caller value itself', () => {
    render(
      <FormField id="merge" label="Merge" hint="Hint">
        <input data-testid="merge-input" aria-describedby="own own own" />
      </FormField>
    )

    expect(describedByTokens('merge-input')).toEqual(['own', 'merge-hint'])
  })

  it.each([
    ['only spaces', '   '],
    ['a single tab', '\t'],
    ['a single newline', '\n'],
    ['mixed whitespace runs', '  \t\n  '],
  ])('drops empty tokens from a caller value containing %s', (_label, value) => {
    render(
      <FormField id="merge" label="Merge" hint="Hint">
        <input data-testid="merge-input" aria-describedby={value} />
      </FormField>
    )

    // No leading, trailing, or interior double space, and no empty token.
    expect(screen.getByTestId('merge-input').getAttribute('aria-describedby')).toBe('merge-hint')
  })

  it('normalizes irregular whitespace in a multi-token caller value', () => {
    render(
      <FormField id="merge" label="Merge" hint="Hint" error="Error">
        <input data-testid="merge-input" aria-describedby={'own-a \t own-b\n own-a'} />
      </FormField>
    )

    expect(screen.getByTestId('merge-input').getAttribute('aria-describedby')).toBe(
      'own-a own-b merge-hint merge-error'
    )
  })

  it('omits the attribute entirely instead of rendering an empty list', () => {
    render(
      <FormField id="merge" label="Merge">
        <input data-testid="merge-input" aria-describedby="" />
      </FormField>
    )

    expect(screen.getByTestId('merge-input').hasAttribute('aria-describedby')).toBe(false)
  })
})

describe('FormField blank message boundaries', () => {
  it.each([
    ['an empty string', ''],
    ['a single space', ' '],
    ['several spaces', '     '],
    ['a tab and newline', '\n\t  '],
  ])('treats a whitespace-only error (%s) as absent', (_label, error) => {
    render(
      <FormField id="blank" label="Blank" error={error} success="Valid">
        <input data-testid="blank-input" />
      </FormField>
    )

    // A blank error must not mark the control invalid, mount an empty alert, or
    // suppress the real success message that sits behind it.
    expect(fieldStateForInput('blank-input')).toBe('success')
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0)
    expect(screen.getByTestId('blank-input')).not.toHaveAttribute('aria-invalid')
    expect(describedByTokens('blank-input')).toEqual(['blank-success'])
    expect(screen.getByRole('status')).toHaveTextContent('Valid')
  })

  it('omits a whitespace-only hint and never references a node that does not exist', () => {
    render(
      <FormField id="blank-hint" label="Hinted" hint="   ">
        <input data-testid="blank-hint-input" />
      </FormField>
    )

    expect(document.querySelector('.form-hint')).toBeNull()
    expect(fieldStateForInput('blank-hint-input')).toBe('default')
    expect(screen.getByTestId('blank-hint-input')).not.toHaveAttribute('aria-describedby')
  })

  it('omits a whitespace-only success message', () => {
    render(
      <FormField id="blank-success" label="Confirmed" success="  ">
        <input data-testid="blank-success-input" />
      </FormField>
    )

    expect(document.querySelectorAll('[role="status"]')).toHaveLength(0)
    expect(document.querySelector('.form-success')).toBeNull()
    expect(fieldStateForInput('blank-success-input')).toBe('default')
    expect(screen.getByTestId('blank-success-input')).not.toHaveAttribute('aria-describedby')
  })

  it('renders a real error even when the accompanying success is blank', () => {
    render(
      <FormField id="mixed" label="Mixed" success="   " error="Server rejected the value">
        <input data-testid="mixed-input" />
      </FormField>
    )

    expect(fieldStateForInput('mixed-input')).toBe('error')
    expect(screen.getByRole('alert')).toHaveTextContent('⚠ Server rejected the value')
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(0)
  })

  it('preserves intentional whitespace inside a message that is present', () => {
    render(
      <FormField id="padded" label="Padded" hint="  Two leading spaces  " error="  Trailing  ">
        <input data-testid="padded-input" />
      </FormField>
    )

    // Presence is decided on the trimmed value; the rendered text stays verbatim.
    expect(document.querySelector('#padded-hint')?.textContent).toBe('  Two leading spaces  ')
    expect(screen.getByRole('alert').textContent).toBe('⚠   Trailing  ')
    expect(describedByTokens('padded-input')).toEqual(['padded-hint', 'padded-error'])
  })

  it('does not normalize the label, because dropping it would strip the accessible name', () => {
    render(
      <FormField id="blank-label" label="   ">
        <input data-testid="blank-label-input" />
      </FormField>
    )

    // Deliberate asymmetry with the message props: a blank label is a separate
    // defect, and silently removing the <label> would leave the control unnamed.
    const label = document.querySelector('label')
    expect(label).not.toBeNull()
    expect(label).toHaveAttribute('for', 'blank-label')
    expect(screen.getByTestId('blank-label-input')).toHaveAttribute('id', 'blank-label')
  })
})

describe('FormField state transitions and error recovery', () => {
  it('clears every error artifact when the error is removed', () => {
    const { rerender } = render(
      <FormField id="amount" label="Amount" hint="USDC" error="Amount is required">
        <input data-testid="amount-input" />
      </FormField>
    )
    expect(fieldStateForInput('amount-input')).toBe('error')
    expect(describedByTokens('amount-input')).toEqual(['amount-hint', 'amount-error'])
    expect(screen.getByTestId('amount-input')).toHaveAttribute('aria-invalid', 'true')

    rerender(
      <FormField id="amount" label="Amount" hint="USDC">
        <input data-testid="amount-input" />
      </FormField>
    )

    expect(fieldStateForInput('amount-input')).toBe('default')
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0)
    expect(screen.getByTestId('amount-input')).not.toHaveAttribute('aria-invalid')
    expect(describedByTokens('amount-input')).toEqual(['amount-hint'])
    // The stable hint is still wired, so recovery does not drop caller a11y.
    expect(screen.getByText('USDC')).toHaveAttribute('id', 'amount-hint')
  })

  it('promotes error to success atomically on recovery', () => {
    const { rerender } = render(
      <FormField id="amount" label="Amount" error="Too low">
        <input data-testid="amount-input" />
      </FormField>
    )
    rerender(
      <FormField id="amount" label="Amount" success="Amount accepted">
        <input data-testid="amount-input" />
      </FormField>
    )

    expect(fieldStateForInput('amount-input')).toBe('success')
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0)
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(screen.getByTestId('amount-input')).not.toHaveAttribute('aria-invalid')
    expect(describedByTokens('amount-input')).toEqual(['amount-success'])
  })

  it('keeps a single alert node when the error message is replaced in place', () => {
    const { rerender } = render(
      <FormField id="amount" label="Amount" error="Too low">
        <input data-testid="amount-input" />
      </FormField>
    )
    rerender(
      <FormField id="amount" label="Amount" error="Too high">
        <input data-testid="amount-input" />
      </FormField>
    )

    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('⚠ Too high')
    expect(describedByTokens('amount-input')).toEqual(['amount-error'])
  })

  it('removes the success announcement when the field becomes invalid again', () => {
    const { rerender } = render(
      <FormField id="amount" label="Amount" success="Looks good">
        <input data-testid="amount-input" />
      </FormField>
    )
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)

    rerender(
      <FormField id="amount" label="Amount" success="Looks good" error="Now invalid">
        <input data-testid="amount-input" />
      </FormField>
    )

    expect(fieldStateForInput('amount-input')).toBe('error')
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent('⚠ Now invalid')
    expect(describedByTokens('amount-input')).toEqual(['amount-error'])
  })

  it('does not accumulate IDREFs across repeated error and recovery cycles', () => {
    // Behavior under test: aria-describedby is rebuilt from props on every
    // render, so N error/clear cycles can never append the same id twice.
    const { rerender } = render(
      <FormField id="amount" label="Amount" hint="USDC">
        <input data-testid="amount-input" />
      </FormField>
    )

    for (let cycle = 0; cycle < 5; cycle += 1) {
      rerender(
        <FormField id="amount" label="Amount" hint="USDC" error={`Cycle ${cycle} failed`}>
          <input data-testid="amount-input" />
        </FormField>
      )
      expect(describedByTokens('amount-input')).toEqual(['amount-hint', 'amount-error'])
      expect(screen.getByTestId('amount-input')).toHaveAttribute('aria-invalid', 'true')

      rerender(
        <FormField id="amount" label="Amount" hint="USDC">
          <input data-testid="amount-input" />
        </FormField>
      )
      expect(describedByTokens('amount-input')).toEqual(['amount-hint'])
      expect(screen.getByTestId('amount-input')).not.toHaveAttribute('aria-invalid')
    }
  })

  it('restores the control original aria-required when required is turned off', () => {
    const { rerender } = render(
      <FormField id="req" label="Required" required>
        <input data-testid="req-input" aria-required="false" />
      </FormField>
    )
    expect(screen.getByTestId('req-input')).toHaveAttribute('aria-required', 'true')
    expect(document.querySelector('.form-required')).not.toBeNull()

    rerender(
      <FormField id="req" label="Required">
        <input data-testid="req-input" aria-required="false" />
      </FormField>
    )

    expect(screen.getByTestId('req-input')).toHaveAttribute('aria-required', 'false')
    expect(document.querySelector('.form-required')).toBeNull()
  })
})

describe('FormField recovery under retry and concurrent typing', () => {
  /** Models a submit that fails, is edited further, then succeeds on retry. */
  function RetryHarness() {
    const [value, setValue] = useState('100')
    const [status, setStatus] = useState<'error' | 'success'>('error')

    return (
      <>
        <FormField
          id="retry-amount"
          label="Amount (USDC)"
          error={status === 'error' ? 'Submission failed. Retry to send again.' : undefined}
          success={status === 'success' ? 'Bond submitted.' : undefined}
        >
          <input
            data-testid="retry-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </FormField>
        <button
          type="button"
          onClick={() => setStatus((s) => (s === 'error' ? 'success' : 'error'))}
        >
          Retry
        </button>
      </>
    )
  }

  /** Flips validation on every keystroke so input and error state churn together. */
  function InterleavedTypingHarness() {
    const [value, setValue] = useState('')
    const [error, setError] = useState<string | undefined>('Enter an amount')

    return (
      <FormField id="flip-amount" label="Amount" error={error}>
        <input
          data-testid="flip-input"
          value={value}
          onChange={(e) => {
            const next = e.target.value
            setValue(next)
            setError(next.length % 2 === 1 ? 'Enter an amount' : undefined)
          }}
        />
      </FormField>
    )
  }

  it('recovers from a failed submission on retry without losing the entered value', async () => {
    const user = userEvent.setup()
    render(<RetryHarness />)

    const input = screen.getByTestId('retry-input')
    expect(input).toHaveValue('100')
    expect(fieldStateForInput('retry-input')).toBe('error')
    expect(screen.getByRole('alert')).toHaveTextContent('Submission failed.')

    // The user keeps editing while the field is still in a failed state.
    await user.clear(input)
    await user.type(input, '250')
    expect(input).toHaveValue('250')
    expect(fieldStateForInput('retry-input')).toBe('error')

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(input).toHaveValue('250')
    expect(fieldStateForInput('retry-input')).toBe('success')
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0)
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(describedByTokens('retry-input')).toEqual(['retry-amount-success'])

    // A second failure must not leave the previous success banner behind.
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(fieldStateForInput('retry-input')).toBe('error')
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(0)
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(input).toHaveValue('250')
  })

  it('loses no characters when validation state flips on every keystroke', async () => {
    const user = userEvent.setup()
    render(<InterleavedTypingHarness />)

    const input = screen.getByTestId('flip-input')
    await user.type(input, '12345')

    // Five keystrokes drive five validation transitions (invalid -> valid -> ...),
    // each one re-rendering the field and rebuilding the IDREF list.
    expect(input).toHaveValue('12345')
    expect(fieldStateForInput('flip-input')).toBe('error')
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(describedByTokens('flip-input')).toEqual(['flip-amount-error'])
  })

  it('keeps focus and DOM identity on the control while the field recovers', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <FormField id="focus-amount" label="Amount" error="Too low">
        <input data-testid="focus-input" />
      </FormField>
    )

    const input = screen.getByTestId('focus-input')
    await user.click(input)
    expect(input).toHaveFocus()

    rerender(
      <FormField id="focus-amount" label="Amount">
        <input data-testid="focus-input" />
      </FormField>
    )

    // Recovery must not remount the control out from under the user.
    expect(screen.getByTestId('focus-input')).toBe(input)
    expect(input).toHaveFocus()
    expect(fieldStateForInput('focus-input')).toBe('default')
  })
})

describe('FormField rendering safety and structural invariants', () => {
  it('renders markup in an error message as text, never as HTML', () => {
    const payload = '<img src=x onerror="globalThis.__pwned = true">'
    render(
      <FormField id="xss" label="Payload" error={payload}>
        <input data-testid="xss-input" />
      </FormField>
    )

    expect(screen.getByRole('alert').textContent).toBe(`⚠ ${payload}`)
    expect(document.querySelector('img')).toBeNull()
  })

  it('does not turn a dangerous URI in a message into a link', () => {
    render(
      <FormField id="uri" label="Link" hint="javascript:alert(1)" success="https://example.test/ok">
        <input data-testid="uri-input" />
      </FormField>
    )

    expect(document.querySelector('.form-field')?.querySelector('a')).toBeNull()
    expect(screen.getByText('javascript:alert(1)')).toHaveClass('form-hint')
  })

  it('renders right-to-left labels and messages intact', () => {
    render(
      <FormField id="i18n" label="مبلغ USDC" hint="أدخل مبلغًا صالحًا" error="القيمة غير صالحة">
        <input data-testid="i18n-input" />
      </FormField>
    )

    expect(document.querySelector('label')?.textContent).toBe('مبلغ USDC')
    expect(document.querySelector('#i18n-hint')?.textContent).toBe('أدخل مبلغًا صالحًا')
    expect(screen.getByRole('alert').textContent).toBe('⚠ القيمة غير صالحة')
  })

  it('namespaces derived ids so distinct fields never share a node', () => {
    render(
      <>
        <FormField id="alpha" label="Alpha" hint="Hint A" error="Error A" success="Ignored A">
          <input data-testid="alpha-input" />
        </FormField>
        <FormField id="beta" label="Beta" hint="Hint B" success="Success B">
          <input data-testid="beta-input" />
        </FormField>
      </>
    )

    expect(describedByTokens('alpha-input')).toEqual(['alpha-hint', 'alpha-error'])
    expect(describedByTokens('beta-input')).toEqual(['beta-hint', 'beta-success'])
    expect(document.querySelectorAll('#alpha-hint')).toHaveLength(1)
    expect(document.querySelectorAll('#beta-hint')).toHaveLength(1)
  })

  it('does not leak state between sibling fields with different messages', () => {
    render(
      <>
        <FormField id="one" label="One" error="One failed">
          <input data-testid="one-input" />
        </FormField>
        <FormField id="two" label="Two" success="Two ok">
          <input data-testid="two-input" />
        </FormField>
      </>
    )

    expect(fieldStateForInput('one-input')).toBe('error')
    expect(fieldStateForInput('two-input')).toBe('success')
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(describedByTokens('one-input')).toEqual(['one-error'])
    expect(describedByTokens('two-input')).toEqual(['two-success'])
  })

  it('renders byte-identical markup for identical props across separate mounts', () => {
    const props = {
      id: 'determinism',
      label: 'Deterministic',
      hint: 'Stable hint',
      error: 'Stable error',
      required: true,
      className: 'stable',
    } as const

    const first = render(
      <FormField {...props}>
        <input data-testid="first-input" />
      </FormField>
    )
    const second = render(
      <FormField {...props}>
        <input data-testid="first-input" />
      </FormField>
    )

    expect(first.container.innerHTML).toBe(second.container.innerHTML)
  })

  it('does not clobber unrelated caller props on the control', () => {
    render(
      <FormField id="locked" label="Locked" hint="Read only" error="Not permitted">
        <input
          data-testid="locked-input"
          type="text"
          name="amount"
          maxLength={5}
          disabled
          readOnly
          className="caller-class"
          aria-disabled="true"
          aria-readonly="true"
        />
      </FormField>
    )

    const input = screen.getByTestId('locked-input')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('name', 'amount')
    expect(input).toHaveAttribute('maxlength', '5')
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('readonly')
    expect(input).toHaveClass('caller-class')
    expect(input).toHaveAttribute('aria-disabled', 'true')
    expect(input).toHaveAttribute('aria-readonly', 'true')
    // A permission-gated control still receives this field's validation wiring.
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(describedByTokens('locked-input')).toEqual(['locked-hint', 'locked-error'])
  })

  it('omits the visible asterisk for an sr-only label but still sets aria-required', () => {
    render(
      <FormField id="search" label="Search attestations" srOnlyLabel required>
        <input data-testid="search-input" />
      </FormField>
    )

    // The asterisk is aria-hidden decoration, so a visually hidden label must not
    // carry it, but the control still needs both the name and the required flag.
    expect(document.querySelector('.form-required')).toBeNull()
    expect(screen.getByTestId('search-input')).toHaveAttribute('aria-required', 'true')
    expect(screen.getByRole('textbox', { name: 'Search attestations' })).toBeInTheDocument()
  })

  it('forces aria-required="true" over a control that declared false', () => {
    render(
      <FormField id="req" label="Required" required>
        <input data-testid="req-input" aria-required="false" />
      </FormField>
    )

    expect(screen.getByTestId('req-input')).toHaveAttribute('aria-required', 'true')
  })

  it('joins the caller className onto form-field with a single space', () => {
    render(
      <FormField id="classy" label="Classy" className="bond-form" error="Invalid">
        <input data-testid="classy-input" />
      </FormField>
    )

    expect(screen.getByTestId('classy-input').closest('.form-field')?.className).toBe(
      'form-field bond-form'
    )
  })

  it.each([
    ['an empty string', ''],
    ['a bare space', ' '],
  ])('ignores a className that is %s', (_label, className) => {
    render(
      <FormField id="classy" label="Classy" className={className}>
        <input data-testid="classy-input" />
      </FormField>
    )

    expect(screen.getByTestId('classy-input').closest('.form-field')?.className).toBe('form-field')
  })

  it('overrides a control id that collides with the field id', () => {
    // Behavior under test: exactly one element may answer to `id`, otherwise the
    // label's htmlFor and the aria-describedby IDREFs become ambiguous.
    render(
      <FormField id="canonical" label="Canonical" hint="Hint">
        <input data-testid="collide-input" id="stale-id" aria-describedby="canonical-hint" />
      </FormField>
    )

    const input = screen.getByTestId('collide-input')
    expect(input).toHaveAttribute('id', 'canonical')
    expect(describedByTokens('collide-input')).toEqual(['canonical-hint'])
  })

  it('throws a deterministic error when children is not a single element', () => {
    // Behavior under test: misuse of the documented single-element contract fails
    // loudly at the FormField boundary instead of silently dropping a control.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const twoControls = [
      <input key="a" data-testid="control-a" />,
      <input key="b" data-testid="control-b" />,
    ] as unknown as ReactElement

    try {
      expect(() =>
        render(
          <FormField id="multi" label="Multi">
            {twoControls}
          </FormField>
        )
      ).toThrow(/React\.Children\.only expected to receive a single React element child/)
    } finally {
      consoleError.mockRestore()
    }
  })
})
