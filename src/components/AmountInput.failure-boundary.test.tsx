/**
 * @file AmountInput.failure-boundary.test.tsx
 * @description Deterministic failure-boundary coverage for AmountInput.
 *
 * Scope: loading, error, retry, stale and permission states, plus the data,
 * validation and concurrency boundaries they interact with — written so the
 * behaviour under adverse conditions is provable rather than incidental.
 *
 * Determinism rules observed throughout:
 * - No timers, no `waitFor` on polling, no network. Every async boundary is a
 *   deferred promise the test resolves explicitly, so ordering is exact and the
 *   suite cannot flake on a slow machine.
 * - Assertions read the DOM or spy call counts, never implementation internals.
 * - Each test asserts the user-visible outcome *and* the absence of data loss.
 *
 * Invariants I1–I8 are documented in `AmountInput.tsx`; the group headings below
 * name the invariant each block defends.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import AmountInput, { classifyMaxError } from './AmountInput'

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type AmountInputProps = React.ComponentProps<typeof AmountInput>

/**
 * A genuinely controlled consumer. Several invariants (I1, I3) are about what
 * happens to the *parent's* stored value, so a spy-only harness that never
 * re-renders would not be able to observe them.
 */
function ControlledAmountInput({
  onValueChange,
  ...props
}: Partial<AmountInputProps> & { onValueChange?: (v: string) => void }) {
  const [value, setValue] = useState(props.value ?? '')
  return (
    <AmountInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next)
        props.onChange?.(next)
        onValueChange?.(next)
      }}
    />
  )
}

/** A promise whose settlement the test drives, so ordering is never racy. */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function maxButton() {
  return screen.getByRole('button', { name: /set max amount/i })
}

/**
 * Builds an `Error` carrying a specific `name` and/or `code`.
 *
 * `PermissionError` and `StaleDataError` are not globals under jsdom, and a
 * neutral message is deliberate: it forces the classifier to match on the
 * `name`/`code` signal rather than accidentally matching on the text.
 */
function signalError(message: string, extra: { name?: string; code?: string } = {}) {
  const err = new Error(message)
  if (extra.name) err.name = extra.name
  if (extra.code) Object.assign(err, { code: extra.code })
  return err
}

function retryButton() {
  return screen.getByRole('button', { name: /retry getting max amount/i })
}

function root() {
  return screen.getByRole('textbox').closest('.amountInput') as HTMLElement
}

function textbox() {
  return screen.getByRole('textbox') as HTMLInputElement
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  // Any React warning (duplicate keys, state updates on unmounted trees, act)
  // is a defect here, not noise. Collected rather than thrown so a failure
  // message can explain *which* invariant broke.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------

describe('AmountInput — inline validation message integrity', () => {
  // Guards the regression where the rendered alert was prefixed with a stray
  // "s " (rendered as "s Amount exceeds available balance."). The pre-existing
  // suite used toHaveTextContent, a substring match, so it could not see it.
  it('renders the over-balance message verbatim with no stray prefix or suffix', () => {
    render(<ControlledAmountInput value="200.00" balance={100} />)
    expect(screen.getByRole('alert').textContent).toBe('Amount exceeds available balance.')
  })

  it('renders the below-minimum message verbatim', () => {
    render(<ControlledAmountInput value="5.00" balance={1000} min={10} />)
    expect(screen.getByRole('alert').textContent).toBe('Amount must be at least 10 USDC.')
  })

  it('renders a caller-supplied error verbatim', () => {
    render(<ControlledAmountInput value="1.00" balance={1000} error="Bond is undercollateralised" />)
    expect(screen.getByRole('alert').textContent).toBe('Bond is undercollateralised')
  })

  it('never renders a message with leading or trailing whitespace', () => {
    render(<ControlledAmountInput value="200.00" balance={100} />)
    const text = screen.getByRole('alert').textContent ?? ''
    expect(text).toBe(text.trim())
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — loading state preserves user data (I1)', () => {
  it('keeps the typed amount visible while isLoading is true', () => {
    // Regression: the input used to render value={isLoading ? '' : displayValue},
    // which blanked whatever the user had typed for the whole loading window.
    render(<ControlledAmountInput value="250.00" balance={1000} isLoading />)
    expect(textbox()).toHaveValue('250.00')
  })

  it('keeps the formatted amount visible while isLoading is true and unfocused', () => {
    render(<ControlledAmountInput value="1234.50" balance={100000} isLoading />)
    expect(textbox()).toHaveValue('1,234.50')
  })

  it('disables the field while loading so it cannot be edited', () => {
    render(<ControlledAmountInput value="250.00" balance={1000} isLoading />)
    expect(textbox()).toBeDisabled()
  })

  it('announces the pending state with aria-busy', () => {
    render(<ControlledAmountInput value="250.00" balance={1000} isLoading />)
    expect(textbox()).toHaveAttribute('aria-busy', 'true')
  })

  it('does not set aria-busy when not loading', () => {
    render(<ControlledAmountInput value="250.00" balance={1000} />)
    expect(textbox()).not.toHaveAttribute('aria-busy')
  })

  it('shows the loading placeholder and spinner in place of the currency label', () => {
    render(<ControlledAmountInput value="250.00" balance={1000} isLoading />)
    expect(textbox()).toHaveAttribute('placeholder', 'Loading...')
    expect(screen.queryByText('USDC')).not.toBeInTheDocument()
  })

  it('disables Max and every preset while loading', () => {
    render(<ControlledAmountInput value="250.00" balance={1000} isLoading presets={[100, 500]} />)
    expect(maxButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Set amount to 100 USDC' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Set amount to 500 USDC' })).toBeDisabled()
  })

  it('marks the wrapper with the loading modifier class', () => {
    render(<ControlledAmountInput value="250.00" balance={1000} isLoading />)
    expect(root()).toHaveClass('amountInput--loading')
  })

  it('restores the value, the label and the placeholder when loading ends', () => {
    const { rerender } = render(<ControlledAmountInput value="250.00" balance={1000} isLoading />)
    rerender(<ControlledAmountInput value="250.00" balance={1000} isLoading={false} />)
    expect(textbox()).toHaveValue('250.00')
    expect(textbox()).toBeEnabled()
    expect(textbox()).not.toHaveAttribute('placeholder')
    expect(screen.getByText('USDC')).toBeInTheDocument()
  })

  it('keeps a custom placeholder out of the way while loading and back afterwards', () => {
    const { rerender } = render(
      <ControlledAmountInput value="" balance={1000} isLoading placeholder="0" />
    )
    expect(textbox()).toHaveAttribute('placeholder', 'Loading...')
    rerender(<ControlledAmountInput value="" balance={1000} isLoading={false} placeholder="0" />)
    expect(textbox()).toHaveAttribute('placeholder', '0')
  })

  it('still reports validity from the retained value while loading', () => {
    const onValidityChange = vi.fn()
    render(
      <ControlledAmountInput
        value="2000.00"
        balance={1000}
        min={10}
        isLoading
        onValidityChange={onValidityChange}
      />
    )
    expect(onValidityChange).toHaveBeenLastCalledWith(false)
  })

  it('does not lose the amount when the parent stops loading after a rejected fetch', async () => {
    // The realistic sequence: balance fetch fails -> isLoading -> balance fetch
    // recovers. The entered amount must survive the round trip.
    function FlakyBalance() {
      const [balance, setBalance] = useState<number | null>(null)
      const [amount, setAmount] = useState('250.00')
      return (
        <>
          <AmountInput
            value={amount}
            onChange={setAmount}
            balance={balance ?? 0}
            isLoading={balance === null}
            presets={[100]}
          />
          <button type="button" onClick={() => setBalance(1000)}>
            recover
          </button>
        </>
      )
    }
    const user = userEvent.setup()
    render(<FlakyBalance />)

    await user.type(textbox(), '') // focus the field
    expect(textbox()).toHaveValue('250.00')

    await user.click(screen.getByRole('button', { name: 'recover' }))

    expect(textbox()).toHaveValue('250.00')
    expect(textbox()).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — Max failure classification (I8)', () => {
  async function failWith(value: unknown) {
    const onMaxRequest = vi.fn().mockRejectedValue(value)
    const onChange = vi.fn()
    render(
      <AmountInput
        value="42.00"
        onChange={onChange}
        balance={1000}
        onMaxRequest={onMaxRequest}
        aria-label="Amount"
      />
    )
    fireEvent.click(maxButton())
    return { onChange, onMaxRequest }
  }

  it.each([
    ['network fault', new TypeError('Failed to fetch'), 'network', 'Failed to get max amount.'],
    ['offline message', new Error('You appear to be offline'), 'network', 'Failed to get max amount.'],
    ['network_error code', signalError('boom', { code: 'network_error' }), 'network', 'Failed to get max amount.'],
    ['PermissionError name', signalError('nope', { name: 'PermissionError' }), 'permission', 'Permission denied getting max amount.'],
    ['unauthorized message', new Error('401 Unauthorized'), 'permission', 'Permission denied getting max amount.'],
    ['permission message', new Error('Wallet permission revoked'), 'permission', 'Permission denied getting max amount.'],
    ['PERMISSION_DENIED code', signalError('denied', { code: 'PERMISSION_DENIED' }), 'permission', 'Permission denied getting max amount.'],
    ['StaleDataError name', signalError('old', { name: 'StaleDataError' }), 'stale', 'Max amount data is stale.'],
    ['stale message', new Error('Balance cache is stale'), 'stale', 'Max amount data is stale.'],
    ['STALE_DATA code', signalError('old', { code: 'STALE_DATA' }), 'stale', 'Max amount data is stale.'],
    ['unclassifiable', new Error('something odd happened'), 'unknown', 'Failed to get max amount.'],
  ])('maps a %s rejection to the right state', async (_label, err, reason, copy) => {
    const { onChange } = await failWith(err)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(copy)
    expect(root()).toHaveAttribute('data-max-error-reason', reason)
    // I1: a failed max must never write to the field.
    expect(onChange).not.toHaveBeenCalled()
  })

  it.each([
    ['a bare string', 'boom'],
    ['null', null],
    ['undefined', undefined],
    ['an object with no message', { detail: 'x' }],
    ['a number', 42],
  ])('classifies %s without throwing', async (_label, err) => {
    const { onChange } = await failWith(err)
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to get max amount.')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('prefers permission over stale when a message mentions both', async () => {
    await failWith(new Error('stale permission scope'))
    await screen.findByRole('alert')
    expect(root()).toHaveAttribute('data-max-error-reason', 'permission')
  })

  it('never leaks the raw rejection message into the DOM', async () => {
    // The upstream Error.message can echo request ids, wallet addresses or
    // internal route names. Only the generic copy and the bucket may surface.
    const secret = 'upstream said: wallet 0xabc123 failed at /internal/v1/max'
    await failWith(new Error(secret))
    await screen.findByRole('alert')
    expect(document.body.textContent).not.toContain('0xabc123')
    expect(document.body.textContent).not.toContain('/internal/v1/max')
    expect(document.body.textContent).not.toContain('upstream said')
  })

  it('clears the previous reason on a successful retry', async () => {
    const gate = deferred<number>()
    const onMaxRequest = vi
      .fn()
      .mockRejectedValueOnce(signalError('denied', { name: 'PermissionError' }))
      .mockImplementationOnce(() => gate.promise)
    const onChange = vi.fn()
    render(
      <AmountInput value="" onChange={onChange} balance={0} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    fireEvent.click(maxButton())
    await screen.findByText('Permission denied getting max amount.')
    expect(root()).toHaveAttribute('data-max-error-reason', 'permission')

    fireEvent.click(retryButton())
    await act(async () => {
      gate.resolve(750)
    })

    expect(onChange).toHaveBeenCalledWith('750.00')
    expect(root()).toHaveAttribute('data-max-state', 'idle')
    expect(root()).not.toHaveAttribute('data-max-error-reason')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('starts from data-max-state="idle" so the default is observable', () => {
    render(<AmountInput value="" onChange={vi.fn()} balance={10} aria-label="Amount" />)
    expect(root()).toHaveAttribute('data-max-state', 'idle')
    expect(root()).not.toHaveAttribute('data-max-error-reason')
  })
})

// ---------------------------------------------------------------------------

describe('classifyMaxError', () => {
  it('is exported and total over hostile inputs', () => {
    expect(classifyMaxError(new Error('network down'))).toBe('network')
    expect(classifyMaxError(null)).toBe('unknown')
    expect(classifyMaxError(undefined)).toBe('unknown')
    expect(classifyMaxError('')).toBe('unknown')
    expect(classifyMaxError(0)).toBe('unknown')
    expect(classifyMaxError(false)).toBe('unknown')
  })

  it('ignores a non-string code', () => {
    expect(classifyMaxError(signalError('x', { code: 42 as unknown as string }))).toBe('unknown')
  })

  it('matches codes case-sensitively so a typo cannot spoof a bucket', () => {
    expect(classifyMaxError(signalError('x', { code: 'permission_denied' }))).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — invalid max payload boundaries (I5)', () => {
  // Every one of these previously reached `onChange` and produced a string that
  // `normalizeUSDC` could not parse, which made the next blur erase the field.
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['a negative amount', -1],
    ['a negative fraction', -0.01],
    ['a numeric string', '500'],
    ['null prototype', Object.create(null)],
  ])('rejects %s without writing to the field', async (_label, payload) => {
    const onMaxRequest = vi.fn().mockResolvedValue(payload)
    const onChange = vi.fn()
    render(
      <AmountInput value="42.00" onChange={onChange} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    fireEvent.click(maxButton())
    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('Failed to get max amount.')
    expect(root()).toHaveAttribute('data-max-error-reason', 'invalid_payload')
    expect(onChange).not.toHaveBeenCalled()
    expect(textbox()).toHaveValue('42.00')
  })

  it('accepts negative zero as zero rather than a failure', async () => {
    const onMaxRequest = vi.fn().mockResolvedValue(-0)
    const onChange = vi.fn()
    render(
      <AmountInput value="" onChange={onChange} balance={0} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )
    fireEvent.click(maxButton())
    await act(async () => {})
    expect(onChange).toHaveBeenCalledWith('0.00')
  })

  it('accepts a fractional result and rounds it to 2dp', async () => {
    const onMaxRequest = vi.fn().mockResolvedValue(400.129)
    const onChange = vi.fn()
    render(
      <AmountInput value="" onChange={onChange} balance={0} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )
    fireEvent.click(maxButton())
    await act(async () => {})
    expect(onChange).toHaveBeenCalledWith('400.13')
  })

  it('accepts a result larger than the optimistic balance it was fetched with', async () => {
    // The authoritative max can legitimately exceed a stale rendered balance.
    const onMaxRequest = vi.fn().mockResolvedValue(5000)
    const onChange = vi.fn()
    render(
      <AmountInput value="" onChange={onChange} balance={100} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )
    fireEvent.click(maxButton())
    await act(async () => {})
    expect(onChange).toHaveBeenCalledWith('5000.00')
  })

  it('recovers from an invalid payload through Retry', async () => {
    const onMaxRequest = vi
      .fn()
      .mockResolvedValueOnce(Number.NaN)
      .mockResolvedValueOnce(88.5)
    const onChange = vi.fn()
    render(
      <AmountInput value="" onChange={onChange} balance={0} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    fireEvent.click(maxButton())
    await screen.findByRole('alert')

    fireEvent.click(retryButton())
    await act(async () => {})

    expect(onChange).toHaveBeenCalledWith('88.50')
    expect(root()).toHaveAttribute('data-max-state', 'idle')
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — no data loss on failure (I1)', () => {
  it('preserves the typed amount across an error, retry and recovery cycle', async () => {
    const gate = deferred<number>()
    const onMaxRequest = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(() => gate.promise)
    render(<ControlledAmountInput value="77.00" balance={1000} onMaxRequest={onMaxRequest} />)

    fireEvent.click(maxButton())
    await screen.findByText('Failed to get max amount.')
    expect(textbox()).toHaveValue('77.00')

    fireEvent.click(retryButton())
    await act(async () => {
      gate.resolve(1000)
    })
    expect(textbox()).toHaveValue('1,000.00')
  })

  it('keeps what the user types after a permission failure', async () => {
    const user = userEvent.setup()
    const onMaxRequest = vi.fn().mockRejectedValue(signalError('denied', { name: 'PermissionError' }))
    render(<ControlledAmountInput value="10.00" balance={1000} onMaxRequest={onMaxRequest} />)

    fireEvent.click(maxButton())
    await screen.findByText('Permission denied getting max amount.')

    await user.clear(textbox())
    await user.type(textbox(), '12.5')

    expect(textbox()).toHaveValue('12.5')
    expect(screen.getByText('Permission denied getting max amount.')).toBeInTheDocument()
  })

  it('keeps what the user types after a stale failure', async () => {
    const user = userEvent.setup()
    const onMaxRequest = vi.fn().mockRejectedValue(signalError('x', { name: 'StaleDataError' }))
    render(<ControlledAmountInput value="10.00" balance={1000} onMaxRequest={onMaxRequest} />)

    fireEvent.click(maxButton())
    await screen.findByText('Max amount data is stale.')

    await user.clear(textbox())
    await user.type(textbox(), '9')

    expect(textbox()).toHaveValue('9')
  })

  it('surfaces the max failure and the validation failure as two distinct alerts', () => {
    render(
      <AmountInput
        value="2000.00"
        onChange={vi.fn()}
        balance={1000}
        error="Bond is undercollateralised"
        onMaxRequest={vi.fn().mockRejectedValue(new Error('network'))}
        aria-label="Amount"
      />
    )
    // Only the validation alert renders before the max attempt; both must be
    // reachable from the input via aria-describedby.
    const input = textbox()
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
    expect(ids).toHaveLength(1)
    expect(document.getElementById(ids[0])).toHaveTextContent('Bond is undercollateralised')
  })

  it('does not call onChange at all when the max request is still pending', () => {
    const onMaxRequest = vi.fn().mockImplementation(() => new Promise<number>(() => {}))
    const onChange = vi.fn()
    render(
      <AmountInput value="42.00" onChange={onChange} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )
    fireEvent.click(maxButton())
    expect(onChange).not.toHaveBeenCalled()
    expect(textbox()).toHaveValue('42.00')
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — retry from each failure state (I4)', () => {
  it.each([
    ['error', new Error('network'), 'Failed to get max amount.'],
    ['permission', signalError('denied', { name: 'PermissionError' }), 'Permission denied getting max amount.'],
    ['stale', signalError('x', { name: 'StaleDataError' }), 'Max amount data is stale.'],
  ])('retries successfully after a %s failure', async (_state, err, copy) => {
    const onMaxRequest = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce(600)
    const onChange = vi.fn()
    render(
      <AmountInput value="" onChange={onChange} balance={0} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    fireEvent.click(maxButton())
    await screen.findByText(copy)
    expect(retryButton()).toBeEnabled()

    fireEvent.click(retryButton())
    await act(async () => {})

    expect(onMaxRequest).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenCalledWith('600.00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('re-enters loading on retry so the control reports progress', async () => {
    const gate = deferred<number>()
    const onMaxRequest = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(() => gate.promise)
    render(<AmountInput value="" onChange={vi.fn()} balance={0} onMaxRequest={onMaxRequest} aria-label="Amount" />)

    fireEvent.click(maxButton())
    await screen.findByText('Failed to get max amount.')

    fireEvent.click(retryButton())
    expect(maxButton()).toHaveTextContent('Loading...')
    expect(maxButton()).toHaveAttribute('aria-busy', 'true')
    // The alert is withdrawn while retrying so the user is not told about a
    // failure that is no longer current.
    expect(screen.queryByRole('button', { name: /retry getting max amount/i })).not.toBeInTheDocument()

    await act(async () => {
      gate.resolve(10)
    })
    expect(maxButton()).toHaveTextContent('Max')
  })

  it('survives an initial failure plus three failing retries, never committing', async () => {
    const onMaxRequest = vi.fn().mockRejectedValue(new Error('network'))
    const onChange = vi.fn()
    render(
      <AmountInput value="42.00" onChange={onChange} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    fireEvent.click(maxButton())
    await screen.findByText('Failed to get max amount.')

    for (let retry = 0; retry < 3; retry++) {
      fireEvent.click(retryButton())
      await act(async () => {})
      expect(screen.getByText('Failed to get max amount.')).toBeInTheDocument()
    }

    expect(onMaxRequest).toHaveBeenCalledTimes(4)
    expect(onChange).not.toHaveBeenCalled()
    expect(textbox()).toHaveValue('42.00')
  })

  it('keeps a second failing retry classified by its own reason, not the first', async () => {
    const onMaxRequest = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(signalError('revoked', { name: 'PermissionError' }))
    render(<AmountInput value="" onChange={vi.fn()} balance={0} onMaxRequest={onMaxRequest} aria-label="Amount" />)

    fireEvent.click(maxButton())
    await screen.findByText('Failed to get max amount.')
    fireEvent.click(retryButton())
    await act(async () => {})

    expect(screen.getByText('Permission denied getting max amount.')).toBeInTheDocument()
    expect(root()).toHaveAttribute('data-max-error-reason', 'permission')
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — concurrency and timing boundaries (I2, I3, I4)', () => {
  it('issues exactly one request for a same-tick double click on Max', () => {
    // Before the ref guard, both click handlers read the pre-click `maxState`
    // ('idle') and dispatched a second identical request. The clicks must share
    // one `act` scope: otherwise the first flush disables the button and the
    // later clicks never reach the handler, which would test nothing.
    const gate = deferred<number>()
    const onMaxRequest = vi.fn().mockImplementation(() => gate.promise)
    render(
      <AmountInput value="" onChange={vi.fn()} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    const btn = maxButton()
    act(() => {
      btn.click()
      btn.click()
      btn.click()
    })

    expect(onMaxRequest).toHaveBeenCalledTimes(1)
    expect(btn).toBeDisabled()
  })

  it('does not dispatch a second request once the first has settled', async () => {
    const gate = deferred<number>()
    const onMaxRequest = vi.fn().mockImplementation(() => gate.promise)
    render(
      <AmountInput value="" onChange={vi.fn()} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    const btn = maxButton()
    act(() => {
      btn.click()
      btn.click()
    })
    await act(async () => {
      gate.resolve(10)
    })
    expect(onMaxRequest).toHaveBeenCalledTimes(1)
    expect(btn).toBeEnabled()
  })

  it('collapses repeated clicks across ticks into a single in-flight request', async () => {
    // Once the first click enters `loading` the Max button is disabled, so the
    // only way to obtain a second request is to supersede the first one. Either
    // way at most one request may be outstanding at a time.
    const gates = [deferred<number>(), deferred<number>(), deferred<number>()]
    let call = 0
    const onMaxRequest = vi.fn().mockImplementation(() => gates[call++].promise)
    const onChange = vi.fn()
    render(
      <AmountInput value="" onChange={onChange} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    fireEvent.click(maxButton())
    expect(onMaxRequest).toHaveBeenCalledTimes(1)
    fireEvent.click(maxButton())
    fireEvent.click(maxButton())
    expect(onMaxRequest).toHaveBeenCalledTimes(1)

    await act(async () => {
      gates[0].resolve(100)
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('100.00')
  })

  it('commits only the newest of two genuinely overlapping requests', async () => {
    // Request 1 is in flight; a direct edit supersedes it and releases the
    // button; request 2 then starts. Request 1 resolves *last* and must lose.
    const first = deferred<number>()
    const second = deferred<number>()
    const onMaxRequest = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const onChange = vi.fn()
    render(
      <ControlledAmountInput value="" onChange={onChange} balance={100000} onMaxRequest={onMaxRequest} />
    )

    fireEvent.click(maxButton())
    expect(onMaxRequest).toHaveBeenCalledTimes(1)

    fireEvent.focus(textbox())
    fireEvent.blur(textbox())
    fireEvent.click(maxButton())
    expect(onMaxRequest).toHaveBeenCalledTimes(2)

    // Newest resolves first, then the stale one lands late.
    await act(async () => {
      second.resolve(700)
    })
    await act(async () => {
      first.resolve(100)
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('700.00')
    expect(textbox()).toHaveValue('700.00')
  })

  it('discards a late resolution when the user picks a preset mid-flight (I3)', async () => {
    const gate = deferred<number>()
    const onMaxRequest = vi.fn().mockImplementation(() => gate.promise)
    render(
      <ControlledAmountInput value="0" balance={1000} presets={[100, 500]} onMaxRequest={onMaxRequest} />
    )

    fireEvent.click(maxButton())
    expect(maxButton()).toHaveTextContent('Loading...')

    // Newer intent: the user picks 500 while the max request is outstanding.
    fireEvent.click(screen.getByRole('button', { name: 'Set amount to 500 USDC' }))
    expect(textbox()).toHaveValue('500.00')

    await act(async () => {
      gate.resolve(1000)
    })

    // The stale result must not clobber the newer preset choice.
    expect(textbox()).toHaveValue('500.00')
  })

  it('discards a late resolution when the user types mid-flight (I3)', async () => {
    const gate = deferred<number>()
    const onMaxRequest = vi.fn().mockImplementation(() => gate.promise)
    render(<ControlledAmountInput value="0" balance={1000} onMaxRequest={onMaxRequest} />)

    fireEvent.click(maxButton())

    const user = userEvent.setup()
    await user.clear(textbox())
    await user.type(textbox(), '25')

    await act(async () => {
      gate.resolve(1000)
    })

    expect(textbox()).toHaveValue('25')
  })

  it('releases the loading state after a superseded request so Max stays usable (I4)', async () => {
    const gate = deferred<number>()
    const onMaxRequest = vi.fn().mockImplementation(() => gate.promise)
    render(
      <ControlledAmountInput value="0" balance={1000} presets={[100]} onMaxRequest={onMaxRequest} />
    )

    fireEvent.click(maxButton())
    expect(maxButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Set amount to 100 USDC' }))
    expect(maxButton()).toBeEnabled()
    expect(maxButton()).toHaveTextContent('Max')
    expect(root()).toHaveAttribute('data-max-state', 'idle')

    await act(async () => {
      gate.resolve(1000)
    })

    // Resolving the discarded request must not re-latch the spinner.
    expect(maxButton()).toBeEnabled()
    expect(maxButton()).toHaveTextContent('Max')
  })

  it('allows a fresh Max request after superseding an in-flight one', async () => {
    const first = deferred<number>()
    const second = deferred<number>()
    const gates = [first, second]
    let call = 0
    const onMaxRequest = vi.fn().mockImplementation(() => gates[call++].promise)
    render(<ControlledAmountInput value="0" balance={1000} presets={[100]} onMaxRequest={onMaxRequest} />)

    fireEvent.click(maxButton())
    fireEvent.click(screen.getByRole('button', { name: 'Set amount to 100 USDC' }))

    fireEvent.click(maxButton())
    expect(onMaxRequest).toHaveBeenCalledTimes(2)

    await act(async () => {
      first.resolve(999)
    })
    await act(async () => {
      second.resolve(42)
    })

    expect(textbox()).toHaveValue('42.00')
  })

  it('does not resurrect an error banner from a request superseded before it failed', async () => {
    const gate = deferred<number>()
    const onMaxRequest = vi.fn().mockImplementation(() => gate.promise)
    render(<ControlledAmountInput value="0" balance={1000} presets={[100]} onMaxRequest={onMaxRequest} />)

    fireEvent.click(maxButton())
    fireEvent.click(screen.getByRole('button', { name: 'Set amount to 100 USDC' }))

    await act(async () => {
      gate.reject(new Error('network'))
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(root()).toHaveAttribute('data-max-state', 'idle')
    expect(root()).not.toHaveAttribute('data-max-error-reason')
  })

  it('does not warn when the control unmounts mid-flight', async () => {
    // React 18 removed the "setState on unmounted component" warning, so the
    // regression to guard is a React/DOM error of any kind surfacing here.
    const gate = deferred<number>()
    const onMaxRequest = vi.fn().mockImplementation(() => gate.promise)
    const onChange = vi.fn()
    const { unmount } = render(
      <AmountInput value="42.00" onChange={onChange} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    fireEvent.click(maxButton())
    unmount()

    await act(async () => {
      gate.resolve(500)
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(document.querySelector('.amountInput')).toBeNull()
  })

  it('does not retry after unmount', async () => {
    const gate = deferred<number>()
    const onMaxRequest = vi.fn().mockImplementation(() => gate.promise)
    const { unmount } = render(
      <AmountInput value="" onChange={vi.fn()} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )
    fireEvent.click(maxButton())
    unmount()
    await act(async () => {
      gate.reject(new Error('network'))
    })
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('resolves the newest request when the oldest resolves last', async () => {
    const first = deferred<number>()
    const second = deferred<number>()
    const onMaxRequest = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const onChange = vi.fn()
    render(
      <AmountInput value="" onChange={onChange} balance={0} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )

    fireEvent.click(maxButton())
    await act(async () => {})

    // Supersede via a blur (a real user gesture that reaches the handler).
    fireEvent.focus(textbox())
    fireEvent.blur(textbox())

    fireEvent.click(maxButton())
    expect(onMaxRequest).toHaveBeenCalledTimes(2)

    await act(async () => {
      second.resolve(200)
    })
    await act(async () => {
      first.resolve(100)
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('200.00')
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — Max without onMaxRequest (synchronous path)', () => {
  it('commits the clamped balance', () => {
    const onChange = vi.fn()
    render(<AmountInput value="" onChange={onChange} balance={500.5} aria-label="Amount" />)
    fireEvent.click(maxButton())
    expect(onChange).toHaveBeenCalledWith('500.50')
  })

  it('never commits "NaN" when the balance is non-finite (I5)', () => {
    const onChange = vi.fn()
    render(<AmountInput value="" onChange={onChange} balance={Number.NaN} aria-label="Amount" />)
    // NaN balance means "unknown", so Max is disabled rather than enabled.
    expect(maxButton()).toBeDisabled()
    fireEvent.click(maxButton())
    expect(onChange).not.toHaveBeenCalled()
  })

  it.each([
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['NaN', Number.NaN],
  ])('disables Max for a %s balance and keeps every preset disabled', (_label, balance) => {
    render(<AmountInput value="" onChange={vi.fn()} balance={balance} presets={[1, 2]} aria-label="Amount" />)
    expect(maxButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Set amount to 1 USDC' })).toBeDisabled()
  })

  it('treats a negative balance as zero rather than allowing a negative max', () => {
    const onChange = vi.fn()
    render(<AmountInput value="" onChange={onChange} balance={-100} aria-label="Amount" />)
    expect(maxButton()).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stays enabled for a zero balance when onMaxRequest is supplied', () => {
    render(
      <AmountInput
        value=""
        onChange={vi.fn()}
        balance={0}
        onMaxRequest={vi.fn().mockResolvedValue(1)}
        aria-label="Amount"
      />
    )
    expect(maxButton()).toBeEnabled()
  })

  it('is disabled when the caller sets disabled, regardless of balance', () => {
    render(<AmountInput value="" onChange={vi.fn()} balance={1000} disabled aria-label="Amount" />)
    expect(maxButton()).toBeDisabled()
  })

  it('cannot be clicked while an async max request is loading', () => {
    const onMaxRequest = vi.fn().mockImplementation(() => new Promise<number>(() => {}))
    render(
      <AmountInput value="" onChange={vi.fn()} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )
    fireEvent.click(maxButton())
    expect(maxButton()).toBeDisabled()
    expect(maxButton()).toHaveTextContent('Loading...')
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — balance and min boundaries (I5)', () => {
  it('flags an amount equal to the balance as valid', () => {
    const onValidityChange = vi.fn()
    render(<AmountInput value="100.00" onChange={vi.fn()} balance={100} onValidityChange={onValidityChange} aria-label="Amount" />)
    expect(onValidityChange).toHaveBeenLastCalledWith(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('flags one cent over the balance as invalid', () => {
    render(<AmountInput value="100.01" onChange={vi.fn()} balance={100} aria-label="Amount" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds available balance.')
  })

  it('flags one cent under the minimum as invalid', () => {
    render(<AmountInput value="9.99" onChange={vi.fn()} balance={1000} min={10} aria-label="Amount" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Amount must be at least 10 USDC.')
  })

  it('treats a non-finite min as "no minimum" rather than blocking every amount', () => {
    // NaN comparison would otherwise be a silent pass/fail depending on the
    // value; pinning it to "no minimum" makes the behaviour deterministic.
    for (const min of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const { unmount } = render(
        <AmountInput value="1.00" onChange={vi.fn()} balance={1000} min={min} aria-label="Amount" />
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('treats a zero min as no-op so an empty amount is not rejected', () => {
    render(<AmountInput value="" onChange={vi.fn()} balance={1000} min={0} aria-label="Amount" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('treats unparseable text as empty rather than as an over-balance amount', () => {
    render(<AmountInput value="not-a-number" onChange={vi.fn()} balance={0} aria-label="Amount" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not report an error while the field is empty', () => {
    render(<AmountInput value="" onChange={vi.fn()} balance={0} min={100} aria-label="Amount" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('treats an explicit zero amount as valid, not as "empty"', () => {
    render(<AmountInput value="0.00" onChange={vi.fn()} balance={0} min={10} aria-label="Amount" />)
    // numericValue === 0, so the min gate does not apply; zero is a real choice.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — onValidityChange transition semantics (I7)', () => {
  it('notifies once per transition, not once per render', () => {
    const onValidityChange = vi.fn()
    const { rerender } = render(
      <AmountInput value="50.00" onChange={vi.fn()} balance={100} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    expect(onValidityChange).toHaveBeenCalledTimes(1)

    // Re-rendering with an identical value must not re-notify: a caller that
    // stores this in state would otherwise loop.
    rerender(
      <AmountInput value="50.00" onChange={vi.fn()} balance={100} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    rerender(
      <AmountInput value="50.00" onChange={vi.fn()} balance={100} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    expect(onValidityChange).toHaveBeenCalledTimes(1)
  })

  it('is stable across a re-render caused by an unrelated prop change', () => {
    const onValidityChange = vi.fn()
    const { rerender } = render(
      <AmountInput value="50.00" onChange={vi.fn()} balance={1000} currencyLabel="USDC" onValidityChange={onValidityChange} aria-label="Amount" />
    )
    expect(onValidityChange).toHaveBeenCalledTimes(1)

    rerender(
      <AmountInput value="50.00" onChange={vi.fn()} balance={1000} currencyLabel="XLM" onValidityChange={onValidityChange} aria-label="Amount" />
    )
    expect(onValidityChange).toHaveBeenCalledTimes(1)
  })

  it('does not re-notify when the callback identity changes but validity does not', () => {
    // A caller passing an inline arrow gets a new function identity every
    // render. Re-running the effect must not re-notify, or a parent that stores
    // this in state would render forever.
    const onValidityChange = vi.fn()
    const { rerender } = render(
      <AmountInput value="50.00" onChange={vi.fn()} balance={1000} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    expect(onValidityChange).toHaveBeenCalledTimes(1)

    // Same validity, same callback identity: the effect does not even re-run.
    rerender(
      <AmountInput value="60.00" onChange={vi.fn()} balance={1000} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    expect(onValidityChange).toHaveBeenCalledTimes(1)

    // Same validity, *new* callback identity: the effect re-runs but must not
    // re-notify, because the boolean it would send is unchanged.
    rerender(
      <AmountInput value="60.00" onChange={vi.fn()} balance={1000} onValidityChange={vi.fn()} aria-label="Amount" />
    )
    expect(onValidityChange).toHaveBeenCalledTimes(1)

    // A genuine transition with a fresh callback still notifies.
    const next = vi.fn()
    rerender(
      <AmountInput value="1500.00" onChange={vi.fn()} balance={1000} onValidityChange={next} aria-label="Amount" />
    )
    expect(next).toHaveBeenCalledWith(false)
    expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds available balance.')
  })

  it('notifies on every real transition in both directions', () => {
    const onValidityChange = vi.fn()
    const { rerender } = render(
      <AmountInput value="50.00" onChange={vi.fn()} balance={100} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    rerender(
      <AmountInput value="500.00" onChange={vi.fn()} balance={100} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    rerender(
      <AmountInput value="50.00" onChange={vi.fn()} balance={100} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    expect(onValidityChange.mock.calls).toEqual([[true], [false], [true]])
  })

  it('transitions invalid when a late max result lands over the balance', async () => {
    const onMaxRequest = vi.fn().mockResolvedValue(5000)
    const onValidityChange = vi.fn()
    const { rerender } = render(
      <AmountInput value="50.00" onChange={vi.fn()} balance={1000} onMaxRequest={onMaxRequest} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    expect(onValidityChange).toHaveBeenLastCalledWith(true)

    fireEvent.click(maxButton())
    await act(async () => {})

    // Simulate the controlled parent applying the committed max.
    rerender(
      <AmountInput value="5000.00" onChange={vi.fn()} balance={1000} onMaxRequest={onMaxRequest} onValidityChange={onValidityChange} aria-label="Amount" />
    )
    expect(onValidityChange).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds available balance.')
  })

  it('still works when no callback is supplied', () => {
    expect(() =>
      render(<AmountInput value="50.00" onChange={vi.fn()} balance={100} aria-label="Amount" />)
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — preset boundaries (I6)', () => {
  it('renders duplicate presets once and does not warn', () => {
    render(<AmountInput value="" onChange={vi.fn()} balance={10000} presets={[100, 100, 250]} aria-label="Amount" />)
    expect(screen.getAllByRole('button', { name: 'Set amount to 100 USDC' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Set amount to 250 USDC' })).toHaveLength(1)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a negative amount', -50],
  ])('drops a %s preset instead of writing it into the field', (_label, bad) => {
    const onChange = vi.fn()
    render(<AmountInput value="42.00" onChange={onChange} balance={10000} presets={[bad, 100]} aria-label="Amount" />)
    expect(screen.getByRole('button', { name: 'Set amount to 100 USDC' })).toBeInTheDocument()
    expect(document.querySelector('.amountInput__presets')?.children).toHaveLength(1)
    expect(onChange).not.toHaveBeenCalled()
    expect(textbox()).toHaveValue('42.00')
  })

  it('renders no chips for an all-invalid preset list without crashing', () => {
    render(
      <AmountInput
        value=""
        onChange={vi.fn()}
        balance={1000}
        presets={[Number.NaN, Number.POSITIVE_INFINITY, -1]}
        aria-label="Amount"
      />
    )
    expect(document.querySelector('.amountInput__presets')?.children).toHaveLength(0)
  })

  it('renders no chips for an empty preset list', () => {
    render(<AmountInput value="" onChange={vi.fn()} balance={1000} presets={[]} aria-label="Amount" />)
    expect(document.querySelector('.amountInput__presets')?.children).toHaveLength(0)
  })

  it('disables presets above the clamped balance', () => {
    render(<AmountInput value="" onChange={vi.fn()} balance={-5} presets={[100]} aria-label="Amount" />)
    expect(screen.getByRole('button', { name: 'Set amount to 100 USDC' })).toBeDisabled()
  })

  it('commits the preset on click', () => {
    const onChange = vi.fn()
    render(<AmountInput value="" onChange={onChange} balance={10000} presets={[250]} aria-label="Amount" />)
    fireEvent.click(screen.getByRole('button', { name: 'Set amount to 250 USDC' }))
    expect(onChange).toHaveBeenCalledWith('250.00')
  })

  it('keeps a zero preset selectable', () => {
    const onChange = vi.fn()
    render(<AmountInput value="5.00" onChange={onChange} balance={1000} presets={[0]} aria-label="Amount" />)
    fireEvent.click(screen.getByRole('button', { name: 'Set amount to 0 USDC' }))
    expect(onChange).toHaveBeenCalledWith('0.00')
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — accessibility and diagnosability wiring', () => {
  it('merges a caller aria-describedby with the internal validation error id', () => {
    render(
      <AmountInput
        value="200.00"
        onChange={vi.fn()}
        balance={100}
        aria-describedby="network-warning"
        aria-label="Amount"
      />
    )
    const ids = (textbox().getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
    expect(ids).toContain('network-warning')
    expect(ids).toHaveLength(2)
  })

  it('keeps the caller id alone when the control is valid', () => {
    render(
      <AmountInput value="50.00" onChange={vi.fn()} balance={100} aria-describedby="network-warning" aria-label="Amount" />
    )
    expect(textbox().getAttribute('aria-describedby')).toBe('network-warning')
  })

  it('adds only the max-error id once a max failure is shown', async () => {
    const onMaxRequest = vi.fn().mockRejectedValue(new Error('network'))
    render(
      <AmountInput value="50.00" onChange={vi.fn()} balance={1000} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )
    fireEvent.click(maxButton())
    const alert = await screen.findByRole('alert')
    expect(textbox().getAttribute('aria-describedby')).toBe(alert.id)
  })

  it('does not duplicate the id when the caller passes the same validation error', () => {
    const { rerender } = render(
      <AmountInput value="50.00" onChange={vi.fn()} balance={1000} aria-label="Amount" />
    )
    const before = textbox().getAttribute('aria-describedby')
    rerender(<AmountInput value="50.00" onChange={vi.fn()} balance={1000} aria-label="Amount" />)
    expect(textbox().getAttribute('aria-describedby')).toBe(before)
  })

  it('drops the max-error id after recovery', async () => {
    const onMaxRequest = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(10)
    render(
      <AmountInput value="" onChange={vi.fn()} balance={0} onMaxRequest={onMaxRequest} aria-label="Amount" />
    )
    fireEvent.click(maxButton())
    await screen.findByRole('alert')
    expect(textbox()).toHaveAttribute('aria-describedby')

    fireEvent.click(retryButton())
    await act(async () => {})
    expect(textbox()).not.toHaveAttribute('aria-describedby')
  })

  it('marks the control invalid for aria-invalid="true" even without a message', () => {
    render(<AmountInput value="1.00" onChange={vi.fn()} balance={1000} aria-invalid="true" aria-label="Amount" />)
    expect(textbox()).toHaveAttribute('aria-invalid', 'true')
    expect(root()).toHaveAttribute('data-invalid', 'true')
  })

  it('uses a custom currencyLabel in every user-visible string', async () => {
    const onMaxRequest = vi.fn().mockRejectedValue(signalError('denied', { name: 'PermissionError' }))
    render(
      <AmountInput
        value=""
        onChange={vi.fn()}
        balance={1000}
        currencyLabel="XLM"
        presets={[10]}
        onMaxRequest={onMaxRequest}
        aria-label="Amount"
      />
    )
    expect(maxButton()).toHaveAccessibleName('Set max amount (XLM)')
    expect(screen.getByRole('button', { name: 'Set amount to 10 XLM' })).toBeInTheDocument()
    fireEvent.click(maxButton())
    await screen.findByRole('alert')
    expect(retryButton()).toHaveAccessibleName('Retry getting max amount (XLM)')
  })

  it('gives each control instance a distinct error id so two on a page do not collide', () => {
    render(
      <>
        <AmountInput value="200.00" onChange={vi.fn()} balance={100} aria-label="First" />
        <AmountInput value="200.00" onChange={vi.fn()} balance={100} aria-label="Second" />
      </>
    )
    const [first, second] = screen.getAllByRole('textbox')
    const firstId = (first.getAttribute('aria-describedby') ?? '').split(' ')[0]
    const secondId = (second.getAttribute('aria-describedby') ?? '').split(' ')[0]
    expect(firstId).toBeTruthy()
    expect(firstId).not.toBe(secondId)
  })

  it('gives each control instance a distinct max-error id', async () => {
    const onMaxRequest = vi.fn().mockRejectedValue(new Error('network'))
    render(
      <>
        <AmountInput value="" onChange={vi.fn()} balance={0} onMaxRequest={onMaxRequest} aria-label="First" />
        <AmountInput value="" onChange={vi.fn()} balance={0} onMaxRequest={onMaxRequest} aria-label="Second" />
      </>
    )
    fireEvent.click(screen.getAllByRole('button', { name: /set max amount/i })[0])
    fireEvent.click(screen.getAllByRole('button', { name: /set max amount/i })[1])
    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[0].id).not.toBe(alerts[1].id)
  })
})

// ---------------------------------------------------------------------------

describe('AmountInput — controlled consumer round trip (no data loss)', () => {
  it('survives a full type → max fail → type → max succeed cycle', async () => {
    const user = userEvent.setup()
    const gate = deferred<number>()
    const onMaxRequest = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(() => gate.promise)
    render(<ControlledAmountInput value="" balance={1000} onMaxRequest={onMaxRequest} />)

    await user.type(textbox(), '12.5')
    expect(textbox()).toHaveValue('12.5')

    fireEvent.click(maxButton())
    await screen.findByText('Failed to get max amount.')
    expect(textbox()).toHaveValue('12.5')

    await user.clear(textbox())
    await user.type(textbox(), '33')
    expect(textbox()).toHaveValue('33')

    fireEvent.click(retryButton())
    await act(async () => {
      gate.resolve(1000)
    })
    // The field is still focused, so the raw committed amount is shown rather
    // than the grouped display form. Blur is what applies the grouping.
    expect(textbox()).toHaveValue('1000.00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.blur(textbox())
    expect(textbox()).toHaveValue('1,000.00')
  })

  it('normalises on blur only when the value actually differs', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AmountInput value="100.00" onChange={onChange} balance={1000} aria-label="Amount" />)

    await user.click(textbox())
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('normalises an un-normalised value on blur exactly once', () => {
    const onChange = vi.fn()
    render(<AmountInput value="1,234.5" onChange={onChange} balance={100000} aria-label="Amount" />)
    fireEvent.focus(textbox())
    fireEvent.blur(textbox())
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('1234.50')
  })

  it('sanitises keystrokes so a non-numeric character never reaches the parent', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledAmountInput value="" onChange={onChange} balance={100000} />)

    await user.type(textbox(), '1a2b3')
    expect(onChange).toHaveBeenLastCalledWith('123')
    expect(textbox()).toHaveValue('123')
  })

  it('never surfaces a sanitised character in the field', async () => {
    const user = userEvent.setup()
    render(<ControlledAmountInput value="" balance={100000} />)

    await user.type(textbox(), '$1,000.5abc')
    expect(textbox()).toHaveValue('1000.5')
  })

  it('forwards onFocus and onBlur to the caller exactly once each', async () => {
    const user = userEvent.setup()
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    render(<AmountInput value="10.00" onChange={vi.fn()} balance={1000} onFocus={onFocus} onBlur={onBlur} aria-label="Amount" />)

    await user.click(textbox())
    expect(onFocus).toHaveBeenCalledTimes(1)

    await user.tab()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})