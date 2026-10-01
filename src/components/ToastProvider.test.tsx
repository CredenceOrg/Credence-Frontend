import { Component, StrictMode, useContext, useState, type ReactNode } from 'react'
import { render, screen, act, fireEvent, within } from '@testing-library/react'
import { vi } from 'vitest'
import ToastProvider, { useToast, ToastContext, type ToastContextValue } from './ToastProvider'
import type { ToastSeverity } from './Toast'
import { TOAST_CONFIG } from '../config/toast'
import * as SettingsContextModule from '../context/SettingsContext'
import type { SettingsState } from '../context/SettingsContext'

// Mock the settings module to control useSettings
vi.mock('../context/SettingsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/SettingsContext')>()
  return {
    ...actual,
    useSettings: vi.fn(),
  }
})

type MockSettings = Pick<
  SettingsState,
  'toastsEnabled' | 'autoDismiss' | 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd'
>

const baseMockSettings: MockSettings = {
  toastsEnabled: true,
  autoDismiss: '5s',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

/** Mirrors the provider's own constants so the suite tracks the config module. */
const MAX_TOASTS = TOAST_CONFIG.maxToasts
const INFO_TIMEOUT = TOAST_CONFIG.timeouts.info
/** Provider-internal delay before an aria-live message is cleared. */
const ANNOUNCEMENT_CLEAR_DELAY = 3000
/** Provider-internal cap on a single message. */
const MAX_MESSAGE_LENGTH = 1000

/** `ToastOptions` is intentionally open at runtime; `timeoutMs` is documented but untyped. */
type LooseOptions = Record<string, unknown>

function setSettings(overrides: Partial<MockSettings> = {}) {
  vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
    ...baseMockSettings,
    ...overrides,
  } as ReturnType<typeof SettingsContextModule.useSettings>)
}

/**
 * Imperative handle over the provider context. Driving the context directly
 * (rather than through click handlers) lets a test control exact dispatch
 * orderings, including bursts inside a single `act` batch.
 */
interface Harness {
  /** Live view of the provider's most recently published context object. */
  api: ToastContextValue
  /** Every context object the provider published, in order. */
  published: ToastContextValue[]
  /** Consumer that must be mounted to populate `api` / `published`. */
  Capture: () => null
}

function makeHarness(): Harness {
  const published: ToastContextValue[] = []
  const api = {} as ToastContextValue

  function Capture() {
    const ctx = useToast()
    published.push(ctx)
    Object.assign(api, ctx)
    return null
  }

  return { api, published, Capture }
}

function renderProvider(
  options: {
    settings?: Partial<MockSettings>
    strict?: boolean
    harness?: Harness
  } = {},
) {
  setSettings(options.settings)
  const Harness = options.harness?.Capture
  const tree = (
    <ToastProvider>{Harness ? <Harness /> : null}</ToastProvider>
  )
  return render(options.strict ? <StrictMode>{tree}</StrictMode> : tree)
}

function TestComponent() {
  const { addToast, removeAllToasts } = useToast()
  return (
    <div>
      <button onClick={() => addToast('info', 'Info Message')}>Add Info</button>
      <button onClick={() => addToast('danger', 'Danger Message')}>Add Danger</button>
      <button onClick={removeAllToasts}>Remove All</button>
    </div>
  )
}

function toasts(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.toast'))
}

function toastMessages(container: HTMLElement): string[] {
  return toasts(container).map((node) => node.querySelector('.toast__message')?.textContent ?? '')
}

function politeRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('.sr-only[aria-live="polite"]')
  if (!region) throw new Error('polite aria-live region not rendered')
  return region
}

function assertiveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('.sr-only[aria-live="assertive"]')
  if (!region) throw new Error('assertive aria-live region not rendered')
  return region
}

function dismissButtonFor(severity: ToastSeverity): HTMLElement {
  return screen.getByRole('button', { name: `Dismiss ${severity} notification` })
}

/** React logs duplicate sibling keys as an error; this collects only those. */
function duplicateKeyWarnings(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.includes('same key'))
}

beforeEach(() => {
  vi.useFakeTimers()
  setSettings()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useToast', () => {
  it('throws a deterministic error when used outside a provider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Orphan() {
      useToast()
      return null
    }

    expect(() => render(<Orphan />)).toThrow('useToast must be used within ToastProvider')

    consoleErrorSpy.mockRestore()
  })

  it('exposes the full context surface to consumers', () => {
    const harness = makeHarness()
    renderProvider({ harness })

    expect(Object.keys(harness.api).sort()).toEqual([
      'addToast',
      'announce',
      'removeAllToasts',
      'removeToast',
    ])
    for (const fn of Object.values(harness.api)) {
      expect(typeof fn).toBe('function')
    }
  })

  it('keeps every context callback referentially stable across settings changes', () => {
    const harness = makeHarness()
    const { rerender } = renderProvider({ harness })

    const first = harness.published[harness.published.length - 1]
    expect(first).toBeDefined()

    // A settings change re-renders the provider. Settings are read through a
    // ref precisely so the memoised callbacks -- and therefore the effect
    // dependencies of every consumer -- do not change.
    setSettings({ autoDismiss: '3s' })
    const { Capture } = harness
    rerender(
      <ToastProvider>
        <Capture />
      </ToastProvider>,
    )

    const last = harness.published[harness.published.length - 1]
    expect(last.addToast).toBe(first.addToast)
    expect(last.removeToast).toBe(first.removeToast)
    expect(last.removeAllToasts).toBe(first.removeAllToasts)
    expect(last.announce).toBe(first.announce)
  })

  it('allows reading the context through the exported ToastContext object', () => {
    let seen: ToastContextValue | null = null

    function DirectConsumer() {
      seen = useContext(ToastContext)
      return null
    }

    render(
      <ToastProvider>
        <DirectConsumer />
      </ToastProvider>,
    )

    expect(seen).not.toBeNull()
    expect(typeof (seen as unknown as ToastContextValue).addToast).toBe('function')
  })
})

describe('ToastProvider normal lifecycles', () => {
  it('adds and auto-dismisses a toast according to the autoDismiss setting', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.toast')).toHaveTextContent('Info Message')

// autoDismiss is 5s
    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(container.querySelector('.toast')).toHaveTextContent('Info Message')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(container.querySelector('.toast')).not.toBeInTheDocument()
  })

  it('renders non-danger severities in the polite region as role=status', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('success', 'Saved'))
    act(() => harness.api.addToast('warning', 'Heads up'))
    act(() => harness.api.addToast('info', 'FYI'))

    const polite = screen.getByRole('region', { name: 'Notifications' })
    expect(within(polite).getAllByRole('status')).toHaveLength(3)
    expect(container.querySelectorAll('.toast--success')).toHaveLength(1)
    expect(container.querySelectorAll('.toast--warning')).toHaveLength(1)
    expect(container.querySelectorAll('.toast--info')).toHaveLength(1)
  })

  it('renders a danger toast in the assertive region as role=alert', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('danger', 'Transfer failed'))

    const assertive = screen.getByRole('region', { name: 'Error notifications' })
    expect(within(assertive).getAllByRole('alert')).toHaveLength(1)
    expect(container.querySelector('.toast--danger')).toHaveTextContent('Transfer failed')
  })

  it('keeps danger toasts sticky regardless of the global autoDismiss setting', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('danger', 'Danger Message'))
    expect(container.querySelector('.toast--danger')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(100000)
    })

    expect(container.querySelector('.toast--danger')).toHaveTextContent('Danger Message')
  })

  it('keeps a danger toast on screen for the whole session and only removes it on request', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('danger', 'Critical'))

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_CLEAR_DELAY * 10)
    })
    expect(toasts(container)).toHaveLength(1)

    act(() => harness.api.removeAllToasts())
    expect(toasts(container)).toHaveLength(0)
  })

  it('renders the explorer action for a toast carrying a transaction hash', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() =>
      harness.api.addToast('success', 'Payment sent', {
        txHash: 'a'.repeat(56),
        network: 'test',
      }),
    )

    const link = within(container).getByRole('link', {
      name: 'View transaction on Stellar Explorer',
    })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(container.querySelector('.toast__tw-hash')).toBeInTheDocument()
  })

  it('omits the explorer action when no transaction hash is supplied', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('success', 'Payment sent'))

    expect(container.querySelector('.toast__tw-hash')).not.toBeInTheDocument()
  })
})

describe('ToastProvider auto-dismiss timer resolution', () => {
  it('applies the global autoDismiss duration to non-danger severities', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: '3s' } })

    act(() => harness.api.addToast('info', 'Info'))

    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(toasts(container)).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it('treats autoDismiss "off" as sticky for every severity', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'Info'))
    act(() => harness.api.addToast('success', 'Success'))
    act(() => harness.api.addToast('warning', 'Warning'))

    expect(toasts(container)).toHaveLength(3)
    act(() => {
      vi.advanceTimersByTime(600000)
    })
    expect(toasts(container)).toHaveLength(3)
  })

  it('treats autoDismiss "0s" as sticky', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: '0s' as never } })

    act(() => harness.api.addToast('info', 'Info'))
    act(() => {
      vi.advanceTimersByTime(600000)
    })
    expect(toasts(container)).toHaveLength(1)
  })

  it('falls back to the severity default for a malformed autoDismiss value', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'soon' as never } })

    act(() => harness.api.addToast('info', 'Info'))

    act(() => {
      vi.advanceTimersByTime(INFO_TIMEOUT - 1)
    })
    expect(toasts(container)).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it('falls back to the severity default for a non-string autoDismiss value', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 5 as never } })

    act(() => harness.api.addToast('info', 'Info'))

    act(() => {
      vi.advanceTimersByTime(INFO_TIMEOUT)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it('lets an explicit timeoutMs option override the global setting', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: '8s' } })

    act(() => harness.api.addToast('info', 'Info', { timeoutMs: 1000 } as unknown as LooseOptions))

    act(() => {
      vi.advanceTimersByTime(1001)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it('rounds a fractional explicit timeoutMs deterministically', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'Info', { timeoutMs: 1500.6 } as unknown as LooseOptions))

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(toasts(container)).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it('treats an explicit timeoutMs of 0 as sticky', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'Info', { timeoutMs: 0 } as unknown as LooseOptions))

    act(() => {
      vi.advanceTimersByTime(600000)
    })
    expect(toasts(container)).toHaveLength(1)
  })

  it('lets an explicit timeoutMs re-arm a normally sticky danger toast', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() =>
      harness.api.addToast('danger', 'Danger', { timeoutMs: 2000 } as unknown as LooseOptions),
    )

    act(() => {
      vi.advanceTimersByTime(2001)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it.each([
    ['a negative duration', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a non-numeric value', 'soon'],
  ])('falls back to the severity default for %s', (_label, timeoutMs) => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'Info', { timeoutMs } as unknown as LooseOptions))

    act(() => {
      vi.advanceTimersByTime(INFO_TIMEOUT - 1)
    })
    expect(toasts(container)).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it('does not let options override the provider-resolved duration', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: '3s' } })

    act(() =>
      harness.api.addToast('info', 'Info', { durationMs: 600000 } as unknown as LooseOptions),
    )

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it('does not let options override the normalised message, id, or severity', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() =>
      harness.api.addToast('info', '  Authoritative  ', {
        message: 'Injected',
        id: 'attacker-controlled',
        severity: 'danger',
      } as unknown as LooseOptions),
    )

    expect(toastMessages(container)).toEqual(['Authoritative'])
    expect(container.querySelector('.toast--info')).toBeInTheDocument()
    expect(container.querySelector('.toast--danger')).not.toBeInTheDocument()
  })

  it('auto-dismisses exactly one toast and leaves the others untouched', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'first', { timeoutMs: 1000 } as unknown as LooseOptions))
    act(() => harness.api.addToast('info', 'second', { timeoutMs: 5000 } as unknown as LooseOptions))

    act(() => {
      vi.advanceTimersByTime(1001)
    })
    expect(toastMessages(container)).toEqual(['second'])
  })

  // --------------------------------------------------------------------------
  // Deterministic failure-boundary coverage
  // --------------------------------------------------------------------------

  it('rejects invalid toast types and empty messages without crashing', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // Empty message should not produce a toast
    act(() => {
      // @ts-expect-error -- deliberately invalid input to exercise rejection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (window as any).__toastAddToast?.('info', '')
    })
    expect(container.querySelectorAll('.toast').length).toBe(0)
  })

  it('recovers cleanly after a thrown toast and continues accepting valid toasts', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // Add a valid toast first
    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelectorAll('.toast').length).toBe(1)

    // Attempt an invalid toast type; should not throw or corrupt state
    act(() => {
      // @ts-expect-error -- deliberately invalid type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (window as any).__toastAddToast?.('not-a-type', 'Bad')
    })

    // State still holds the original toast and accepts new ones
    expect(container.querySelectorAll('.toast').length).toBe(1)
    fireEvent.click(screen.getByText('Add Danger'))
    expect(container.querySelectorAll('.toast').length).toBe(2)
  })

  it('keeps duplicate toasts independent and deterministic', () => {
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      ...baseMockSettings,
      autoDismiss: 'off',
    } as ReturnType<typeof SettingsContextModule.useSettings>)

    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    fireEvent.click(screen.getByText('Add Info'))

    expect(container.querySelectorAll('.toast--info').length).toBe(2)
  })

  it('removing all toasts is idempotent and safe when empty', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // Remove all when nothing is present should not throw
    fireEvent.click(screen.getByText('Remove All'))
    expect(container.querySelectorAll('.toast').length).toBe(0)

    // Add one, remove all twice in a row
    fireEvent.click(screen.getByText('Add Info'))
    fireEvent.click(screen.getByText('Remove All'))
    fireEvent.click(screen.getByText('Remove All'))
    expect(container.querySelectorAll('.toast').length).toBe(0)
  })

  it('clears aria-live announcements after toasts are removed', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.sr-only[aria-live="polite"]')).toHaveTextContent(
      'Info Message'
    )

    fireEvent.click(screen.getByText('Remove All'))
    expect(container.querySelector('.sr-only[aria-live="polite"]')).toHaveTextContent('')
  })

  it('toggling toastsEnabled off then on again keeps behavior deterministic', () => {
    const { rerender, container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // Disable
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      ...baseMockSettings,
      toastsEnabled: false,
    } as ReturnType<typeof SettingsContextModule.useSettings>)
    rerender(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelectorAll('.toast').length).toBe(0)

    // Re-enable
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      ...baseMockSettings,
      toastsEnabled: true,
    } as ReturnType<typeof SettingsContextModule.useSettings>)
    rerender(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelectorAll('.toast').length).toBe(1)
  })

  it('unmounting the provider with pending timers does not leak or throw', () => {
    const { unmount } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    unmount()

    // Advancing timers after unmount must not trigger state updates or throw
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000)
      })
    }).not.toThrow()
  })

  it('handles concurrent adds and removall without losing valid toasts', () => {
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      ...baseMockSettings,
      autoDismiss: 'off',
    } as ReturnType<typeof SettingsContextModule.useSettings>)

    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // Interleave adds and a removal in a single act to simulate concurrent events
    act(() => {
      fireEvent.click(screen.getByText('Add Info'))
      fireEvent.click(screen.getByText('Add Danger'))
      fireEvent.click(screen.getByText('Add Info'))
    })

    expect(container.querySelectorAll('.toast').length).toBe(3)

    // Remove all and immediately add another in the same act
    act(() => {
      fireEvent.click(screen.getByText('Remove All'))
      fireEvent.click(screen.getByText('Add Info'))
    })

    expect(container.querySelectorAll('.toast').length).toBe(1)
    expect(container.querySelector('.toast--info')).toHaveTextContent('Info Message')
  })

  it('does not auto-dismiss danger toasts even when autoDismiss is a valid duration', () => {
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      ...baseMockSettings,
      autoDismiss: '1s',
    } as ReturnType<typeof SettingsContextModule.useSettings>)

    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Danger'))
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(container.querySelector('.toast--danger')).toHaveTextContent('Danger Message')
  })

  it('treats malformed autoDismiss as no auto-dismiss without losing the toast', () => {
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      ...baseMockSettings,
      autoDismiss: 'not-a-duration',
    } as ReturnType<typeof SettingsContextModule.useSettings>)

    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    act(() => {
      vi.advanceTimersByTime(100000)
    })
    expect(container.querySelector('.toast--info')).toHaveTextContent('Info Message')
  })
})

describe('ToastProvider capacity boundary', () => {
  it('shows at most MAX_TOASTS toasts at once', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    for (let i = 0; i < MAX_TOASTS + 4; i += 1) {
      act(() => harness.api.addToast('info', `toast-${i}`))
    }

    expect(toasts(container)).toHaveLength(MAX_TOASTS)
  })

  it('evicts the oldest toast and keeps the newest ones when capacity is exceeded', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    for (let i = 0; i < MAX_TOASTS + 1; i += 1) {
      act(() => harness.api.addToast('info', `toast-${i}`))
    }

    expect(toastMessages(container)).toEqual(['toast-1', 'toast-2', 'toast-3'])
  })

  it('preserves insertion order across mixed severities', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'a'))
    act(() => harness.api.addToast('danger', 'b'))
    act(() => harness.api.addToast('warning', 'c'))
    act(() => harness.api.addToast('success', 'd'))

    // The polite/assertive split changes DOM grouping, but the surviving set is
    // the newest MAX_TOASTS regardless of severity.
    expect(toastMessages(container).sort()).toEqual(['b', 'c', 'd'])
  })

  it('cancels the evicted toast auto-dismiss timer so a later tick cannot remove a survivor', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    const sticky = { timeoutMs: 5000 } as unknown as LooseOptions
    act(() => harness.api.addToast('info', 'evicted', sticky))
    act(() => harness.api.addToast('info', 'filler-1', sticky))
    act(() => harness.api.addToast('info', 'filler-2', sticky))
    act(() => harness.api.addToast('info', 'newest', sticky))

    expect(toastMessages(container)).toEqual(['filler-1', 'filler-2', 'newest'])

    act(() => {
      vi.advanceTimersByTime(5001)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it('never produces duplicate React keys while evicting', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = makeHarness()
    renderProvider({ harness, settings: { autoDismiss: 'off' } })

    for (let i = 0; i < MAX_TOASTS * 4; i += 1) {
      act(() => harness.api.addToast('info', 'same message'))
    }

    expect(duplicateKeyWarnings(consoleErrorSpy)).toEqual([])

    consoleErrorSpy.mockRestore()
  })

  it('does not leave the evicted toast auto-dismiss timer scheduled', () => {
    const harness = makeHarness()
    renderProvider({ harness, settings: { autoDismiss: 'off' } })
    const sticky = { timeoutMs: 600000 } as unknown as LooseOptions

    for (let i = 0; i < MAX_TOASTS; i += 1) {
      act(() => harness.api.addToast('info', `t${i}`, sticky))
    }
    const atCapacity = vi.getTimerCount()

    act(() => harness.api.addToast('info', 'overflow', sticky))

    // The overflow toast contributes one provider timer and its own toast
    // timers, while the evicted toast's provider timer must be released --
    // otherwise the pending timer count grows without bound across churn.
    expect(vi.getTimerCount()).toBe(atCapacity)
  })

  it('gives every dispatched toast a distinct identity, including duplicate messages', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'duplicate'))
    act(() => harness.api.addToast('info', 'duplicate'))
    act(() => harness.api.addToast('info', 'duplicate'))

    expect(toasts(container)).toHaveLength(3)

    // Identical messages share no identity, so removal is by generated id
    // rather than by content: each click removes exactly one toast.
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss info notification' })
    fireEvent.click(dismissButtons[0])
    expect(toasts(container)).toHaveLength(2)

    fireEvent.click(dismissButtons[1])
    expect(toasts(container)).toHaveLength(1)

    fireEvent.click(dismissButtons[2])
    expect(toasts(container)).toHaveLength(0)
  })
})

describe('ToastProvider rapid and concurrent dispatch', () => {
  it('keeps exactly MAX_TOASTS when many toasts are dispatched in a single batch', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => {
      for (let i = 0; i < 25; i += 1) {
        harness.api.addToast('info', `burst-${i}`)
      }
    })

    expect(toasts(container)).toHaveLength(MAX_TOASTS)
    expect(toastMessages(container)).toEqual(['burst-22', 'burst-23', 'burst-24'])
  })

  it('leaves no orphaned timers after a burst larger than the capacity', () => {
    const harness = makeHarness()
    const { unmount } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => {
      for (let i = 0; i < 25; i += 1) {
        harness.api.addToast('info', `burst-${i}`, { timeoutMs: 1000 } as unknown as LooseOptions)
      }
    })

    // Unmounting must leave nothing scheduled, whether a timer was evicted or not.
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('produces the same visible set for interleaved severities regardless of batching', () => {
    const severities: ToastSeverity[] = ['info', 'danger', 'warning', 'success', 'info']
    const batched = makeHarness()
    const first = renderProvider({ harness: batched, settings: { autoDismiss: 'off' } })

    const sequential = makeHarness()
    const second = renderProvider({ harness: sequential, settings: { autoDismiss: 'off' } })

    act(() => {
      severities.forEach((severity, index) => batched.api.addToast(severity, `m-${index}`))
    })
    act(() => {
      severities.forEach((severity, index) => sequential.api.addToast(severity, `m-${index}`))
    })

    expect(toastMessages(first.container).sort()).toEqual(toastMessages(second.container).sort())
    expect(toastMessages(first.container).sort()).toEqual(['m-2', 'm-3', 'm-4'])
  })

  it('is deterministic under React StrictMode double invocation', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = makeHarness()
    const { container } = renderProvider({
      harness,
      strict: true,
      settings: { autoDismiss: 'off' },
    })

    act(() => {
      for (let i = 0; i < MAX_TOASTS + 5; i += 1) {
        harness.api.addToast('info', `strict-${i}`)
      }
    })

    expect(toasts(container)).toHaveLength(MAX_TOASTS)
    expect(toastMessages(container)).toEqual(['strict-5', 'strict-6', 'strict-7'])
    expect(duplicateKeyWarnings(consoleErrorSpy)).toEqual([])

    consoleErrorSpy.mockRestore()
  })

  it('keeps ids unique across many add/evict rounds', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = makeHarness()
    const { container, unmount } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    for (let round = 0; round < MAX_TOASTS * 3; round += 1) {
      act(() => harness.api.addToast('info', `round-${round}`))
    }

    expect(toasts(container)).toHaveLength(MAX_TOASTS)
    // If ids were reused across evictions, React would log a duplicate-key warning.
    expect(duplicateKeyWarnings(consoleErrorSpy)).toEqual([])

    unmount()
    consoleErrorSpy.mockRestore()
  })
})

describe('ToastProvider message normalisation boundary', () => {
  it('trims surrounding whitespace', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', '   padded message   '))

    expect(toastMessages(container)).toEqual(['padded message'])
  })

  it.each([
    ['an empty string', ''],
    ['a whitespace-only string', '   \n\t  '],
  ])('rejects %s without announcing or storing anything', (_label, message) => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', message))

    expect(toasts(container)).toHaveLength(0)
    expect(politeRegion(container).textContent).toBe('')
  })

  it('coerces a non-string message to a string', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 42 as unknown as string))

    expect(toastMessages(container)).toEqual(['42'])
  })

  it('rejects a message whose stringification throws, without throwing out of addToast', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    const hostile = {
      toString() {
        throw new Error('cannot stringify')
      },
    }

    expect(() => act(() => harness.api.addToast('info', hostile as unknown as string))).not.toThrow()

    expect(toasts(container)).toHaveLength(0)
    expect(politeRegion(container).textContent).toBe('')
  })

  it(`caps a message at ${MAX_MESSAGE_LENGTH} characters in both the toast and the announcement`, () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'x'.repeat(MAX_MESSAGE_LENGTH + 500)))

    expect(toastMessages(container)[0]).toHaveLength(MAX_MESSAGE_LENGTH)
    expect(politeRegion(container).textContent).toHaveLength(MAX_MESSAGE_LENGTH)
  })

  it('accepts a message that is exactly at the cap', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'y'.repeat(MAX_MESSAGE_LENGTH)))

    expect(toastMessages(container)[0]).toHaveLength(MAX_MESSAGE_LENGTH)
  })

  it('does not deduplicate identical messages', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'same'))
    act(() => harness.api.addToast('info', 'same'))

    expect(toasts(container)).toHaveLength(2)
  })
})

describe('ToastProvider manual dismissal and removal', () => {
  it('removes a toast when its dismiss button is clicked', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'Info'))
    expect(toasts(container)).toHaveLength(1)

    // Let the aria-live clear timer expire so the only timers left belong to
    // the toast itself and to the provider's auto-dismiss bookkeeping.
    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_CLEAR_DELAY)
    })

    fireEvent.click(dismissButtonFor('info'))
    expect(toasts(container)).toHaveLength(0)
    // The toast's own timers and the provider's auto-dismiss timer are all
    // released, so nothing is left scheduled for a toast that no longer exists.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels the auto-dismiss timer on manual dismissal so no late tick fires', () => {
    const harness = makeHarness()
    const { container, unmount } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'Info'))
    fireEvent.click(dismissButtonFor('info'))
    expect(toasts(container)).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(toasts(container)).toHaveLength(0)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('removes only the targeted toast when several are visible', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'first'))
    act(() => harness.api.addToast('warning', 'second'))
    act(() => harness.api.addToast('danger', 'third'))

    fireEvent.click(dismissButtonFor('warning'))

    expect(toastMessages(container)).toEqual(['first', 'third'])
  })

  it('treats removeToast with an unknown id as a no-op', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'Info'))
    const before = vi.getTimerCount()

    expect(() => act(() => harness.api.removeToast('does-not-exist'))).not.toThrow()
    expect(toasts(container)).toHaveLength(1)
    // An unknown id must not disturb the timers of the toasts still on screen.
    expect(vi.getTimerCount()).toBe(before)
  })

  it('is idempotent when the same unknown id is removed repeatedly', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'Info'))
    act(() => harness.api.removeToast('does-not-exist'))
    act(() => harness.api.removeToast('does-not-exist'))
    act(() => harness.api.removeToast('does-not-exist'))

    expect(toasts(container)).toHaveLength(1)
  })

  it('shows the Dismiss All control only when more than one toast is visible', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    expect(screen.queryByRole('button', { name: 'Dismiss All' })).not.toBeInTheDocument()

    act(() => harness.api.addToast('info', 'first'))
    expect(screen.queryByRole('button', { name: 'Dismiss All' })).not.toBeInTheDocument()

    act(() => harness.api.addToast('info', 'second'))
    expect(screen.getByRole('button', { name: 'Dismiss All' })).toBeInTheDocument()

    act(() => harness.api.removeAllToasts())
    expect(toasts(container)).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Dismiss All' })).not.toBeInTheDocument()
  })

  it('clears every pending auto-dismiss timer on removeAllToasts', () => {
    const harness = makeHarness()
    const { container, unmount } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'a'))
    act(() => harness.api.addToast('info', 'b'))
    act(() => harness.api.addToast('info', 'c'))
    expect(toasts(container)).toHaveLength(3)

    // Let the aria-live clear timer expire so the remaining timers all belong
    // to the toasts and the provider's auto-dismiss bookkeeping.
    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_CLEAR_DELAY)
    })
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    act(() => harness.api.removeAllToasts())
    expect(toasts(container)).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(toasts(container)).toHaveLength(0)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('recovers and accepts new toasts after a full dismissal', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'before'))
    act(() => harness.api.removeAllToasts())
    expect(toasts(container)).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(toasts(container)).toHaveLength(0)

    act(() => harness.api.addToast('success', 'after'))
    expect(toastMessages(container)).toEqual(['after'])

    act(() => {
      vi.advanceTimersByTime(INFO_TIMEOUT)
    })
    expect(toasts(container)).toHaveLength(0)
  })

  it('recovers on a fresh mount after the previous provider unmounted', () => {
    const first = makeHarness()
    const a = renderProvider({ harness: first, settings: { autoDismiss: 'off' } })
    act(() => first.api.addToast('info', 'from-first'))
    expect(toasts(a.container)).toHaveLength(1)
    a.unmount()

    const second = makeHarness()
    const b = renderProvider({ harness: second, settings: { autoDismiss: 'off' } })
    expect(toasts(b.container)).toHaveLength(0)
    act(() => second.api.addToast('info', 'from-second'))
    expect(toastMessages(b.container)).toEqual(['from-second'])
  })
})

describe('ToastProvider announcements', () => {
  it('renders both aria-live regions up front', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    )

    expect(container.querySelector('.sr-only[aria-live="polite"]')).toBeInTheDocument()
    expect(container.querySelector('.sr-only[aria-live="assertive"]')).toBeInTheDocument()
  })

  it('mirrors non-danger messages into the polite region only', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'polite message'))

    expect(politeRegion(container)).toHaveTextContent('polite message')
    expect(assertiveRegion(container).textContent).toBe('')
  })

  it('mirrors danger messages into the assertive region only', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('danger', 'assertive message'))

    expect(assertiveRegion(container)).toHaveTextContent('assertive message')
    expect(politeRegion(container).textContent).toBe('')
  })

  it('keeps the two regions independent across interleaved severities', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'info-1'))
    act(() => harness.api.addToast('danger', 'danger-1'))
    act(() => harness.api.addToast('success', 'success-1'))

    expect(politeRegion(container).textContent).toBe('success-1')
    expect(assertiveRegion(container).textContent).toBe('danger-1')
  })

  it('clears an announcement after the clear delay so an identical message can be re-announced', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'repeatable'))

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_CLEAR_DELAY - 1)
    })
    expect(politeRegion(container).textContent).toBe('repeatable')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(politeRegion(container).textContent).toBe('')

    act(() => harness.api.addToast('info', 'repeatable'))
    expect(politeRegion(container).textContent).toBe('repeatable')
  })

  it('resets the clear delay when a new announcement supersedes a pending one', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'first'))
    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_CLEAR_DELAY - 500)
    })
    act(() => harness.api.addToast('info', 'second'))

    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_CLEAR_DELAY - 1)
    })
    expect(politeRegion(container).textContent).toBe('second')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(politeRegion(container).textContent).toBe('')
  })

  it('clears polite and assertive announcements on independent schedules', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('danger', 'danger-1'))
    act(() => {
      vi.advanceTimersByTime(ANNOUNCEMENT_CLEAR_DELAY - 1000)
    })
    act(() => harness.api.addToast('info', 'info-1'))

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(assertiveRegion(container).textContent).toBe('')
    expect(politeRegion(container).textContent).toBe('info-1')
  })

  it('supports announce() directly, with and without the assertive flag', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.announce('polite status'))
    expect(politeRegion(container).textContent).toBe('polite status')

    act(() => harness.api.announce('assertive status', true))
    expect(assertiveRegion(container).textContent).toBe('assertive status')
    expect(politeRegion(container).textContent).toBe('polite status')
  })

  it.each([
    ['an empty string', ''],
    ['a whitespace-only string', '  \n '],
  ])('ignores announce() for %s', (_label, message) => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness })

    act(() => harness.api.announce(message))

    expect(politeRegion(container).textContent).toBe('')
    expect(assertiveRegion(container).textContent).toBe('')
  })

  it('announces only the newest message after a high-volume burst', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => {
      for (let i = 0; i < 100; i += 1) {
        harness.api.addToast('info', `burst-${i}`)
      }
    })

    expect(politeRegion(container).textContent).toBe('burst-99')
  })

  it('puts only the message text in the live regions', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.addToast('info', 'Info Message', { txHash: 'b'.repeat(56) }))

    expect(politeRegion(container).textContent).toBe('Info Message')
  })
})

describe('ToastProvider gating', () => {
  it('suppresses every toast and announcement when toastsEnabled is false', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { toastsEnabled: false } })

    act(() => harness.api.addToast('info', 'Info'))
    act(() => harness.api.addToast('danger', 'Danger'))

    expect(toasts(container)).toHaveLength(0)
    expect(politeRegion(container).textContent).toBe('')
    expect(assertiveRegion(container).textContent).toBe('')
  })

  it('picks up a mid-session toastsEnabled change on the next dispatch', () => {
    const { rerender, container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.toast')).toHaveTextContent('Info Message')

    setSettings({ toastsEnabled: false })
    rerender(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByText('Add Danger'))
    expect(container.querySelector('.toast--danger')).not.toBeInTheDocument()
    // The toast shown before the change is untouched.
    expect(container.querySelector('.toast--info')).toHaveTextContent('Info Message')
  })

  it('picks up a mid-session autoDismiss change on the next dispatch', () => {
    const { rerender, container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    )

    setSettings({ autoDismiss: '3s' })
    rerender(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.toast')).toHaveTextContent('Info Message')

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(container.querySelector('.toast')).not.toBeInTheDocument()
  })
})

describe('ToastProvider quiet hours', () => {
  beforeEach(() => {
    // Pin the fake clock inside the default quiet hours window
    // (22:00 - 07:00) so silence assertions are deterministic regardless
    // of the host machine's local timezone (use the UTC suffix).
    vi.setSystemTime(new Date('2024-01-01T23:00:00Z'))
  })

  function renderWithQuietHours(overrides: Partial<MockSettings> = {}) {
    const harness = makeHarness()
    const rendered = renderProvider({
      harness,
      settings: { quietHoursEnabled: true, ...overrides },
    })
    return { ...rendered, harness }
  }

  it('silences non-danger toasts while quiet hours are active', () => {
    const { container, harness } = renderWithQuietHours()
    act(() => harness.api.addToast('info', 'Info'))

    expect(toasts(container)).toHaveLength(0)
    expect(politeRegion(container).textContent).toBe('')
  })

  it('keeps danger toasts and their assertive announcement during quiet hours', () => {
    const { container, harness } = renderWithQuietHours()
    act(() => harness.api.addToast('info', 'Info'))
    act(() => harness.api.addToast('danger', 'Danger'))

    expect(politeRegion(container).textContent).toBe('')
    expect(assertiveRegion(container)).toHaveTextContent('Danger')
    expect(toastMessages(container)).toEqual(['Danger'])
  })

  it('lets every toast through when quiet hours are disabled', () => {
    const { container, harness } = renderWithQuietHours({ quietHoursEnabled: false })
    act(() => harness.api.addToast('info', 'Info'))
    act(() => harness.api.addToast('danger', 'Danger'))

    expect(toastMessages(container).sort()).toEqual(['Danger', 'Info'])
  })

  it('silences non-danger toasts when the quiet window wraps around midnight', () => {
    const { container, harness } = renderWithQuietHours()
    act(() => harness.api.addToast('info', 'Info'))

    expect(toasts(container)).toHaveLength(0)
  })

  it('includes the end of the window, matching isWithinQuietHours', () => {
    vi.setSystemTime(new Date('2024-01-01T07:00:00Z'))
    const { container, harness } = renderWithQuietHours()
    act(() => harness.api.addToast('info', 'Info'))

    // `isWithinQuietHours` is inclusive at both bounds, so 07:00 is quiet.
    expect(toasts(container)).toHaveLength(0)
  })

  it('lets non-danger toasts through one minute past the end of the window', () => {
    vi.setSystemTime(new Date('2024-01-01T07:01:00Z'))
    const { container, harness } = renderWithQuietHours()
    act(() => harness.api.addToast('info', 'Info'))

    expect(toastMessages(container)).toEqual(['Info'])
  })

  it('lets non-danger toasts through when the clock is well outside the window', () => {
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    const { container, harness } = renderWithQuietHours()
    act(() => harness.api.addToast('info', 'Info'))

    expect(toastMessages(container)).toEqual(['Info'])
  })

  it('treats a degenerate identical-bounds window as not-quiet, matching isWithinQuietHours', () => {
    const { container, harness } = renderWithQuietHours({
      quietHoursStart: '22:00',
      quietHoursEnd: '22:00',
    })
    act(() => harness.api.addToast('info', 'Info'))

    // A `start === end` window selects no meaningful range and must not silence
    // toasts indefinitely.
    expect(toastMessages(container)).toEqual(['Info'])
  })

  it('treats malformed quiet hours times as non-quiet while enabled', () => {
    const { container, harness } = renderWithQuietHours({
      quietHoursStart: 'not-a-time',
      quietHoursEnd: '',
    })
    act(() => harness.api.addToast('info', 'Info'))

    expect(toastMessages(container)).toEqual(['Info'])
  })

  it('still shows danger toasts with malformed quiet hours times', () => {
    const { container, harness } = renderWithQuietHours({
      quietHoursStart: 'not-a-time',
      quietHoursEnd: '',
    })
    act(() => harness.api.addToast('danger', 'Danger'))

    expect(toastMessages(container)).toEqual(['Danger'])
  })

  it('does not honour quiet hours when the feature is disabled, even with malformed times', () => {
    vi.setSystemTime(new Date('2024-01-01T23:00:00Z'))
    const { container, harness } = renderWithQuietHours({
      quietHoursEnabled: false,
      quietHoursStart: '',
      quietHoursEnd: 'bad',
    })
    act(() => harness.api.addToast('info', 'Info'))

    expect(toastMessages(container)).toEqual(['Info'])
  })

  it('does not consume a capacity slot for a toast rejected before storage', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => {
      harness.api.addToast('info', '   ')
      for (let i = 0; i < MAX_TOASTS; i += 1) {
        harness.api.addToast('info', `toast-${i}`)
      }
    })

    expect(toastMessages(container)).toEqual(['toast-0', 'toast-1', 'toast-2'])
  })
})

describe('ToastProvider unmount cleanup', () => {
  it('leaves no scheduled timers behind when unmounting with toasts on screen', () => {
    const harness = makeHarness()
    const { unmount } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'a'))
    act(() => harness.api.addToast('success', 'b'))
    act(() => harness.api.addToast('danger', 'c'))

    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves no scheduled timers behind when unmounting with a pending announcement', () => {
    const harness = makeHarness()
    const { unmount } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    act(() => harness.api.announce('polite pending'))
    act(() => harness.api.announce('assertive pending', true))
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not update state after unmount when pending auto-dismiss timers fire', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = makeHarness()
    const { unmount } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'a'))
    act(() => harness.api.addToast('info', 'b'))
    act(() => harness.api.addToast('info', 'c'))

    unmount()

    act(() => {
      vi.advanceTimersByTime(600000)
    })

    const messages = consoleErrorSpy.mock.calls.map((call) => String(call[0]))
    expect(messages.filter((m) => m.includes('unmounted component'))).toEqual([])
    expect(vi.getTimerCount()).toBe(0)

    consoleErrorSpy.mockRestore()
  })

  it('does not resurrect dismissed toasts after unmount', () => {
    const harness = makeHarness()
    const { container, unmount } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'a'))
    act(() => harness.api.addToast('info', 'b'))
    act(() => harness.api.removeAllToasts())
    expect(toasts(container)).toHaveLength(0)

    unmount()

    act(() => {
      vi.advanceTimersByTime(600000)
    })
    expect(document.querySelectorAll('.toast')).toHaveLength(0)
  })

  it('releases the toast container from the document on unmount', () => {
    const harness = makeHarness()
    const { unmount } = renderProvider({ harness })
    expect(document.querySelectorAll('.toast-container')).toHaveLength(1)

    unmount()

    expect(document.querySelectorAll('.toast-container')).toHaveLength(0)
  })
})

describe('ToastProvider error recovery', () => {
  class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false }

    static getDerivedStateFromError() {
      return { failed: true }
    }

    componentDidCatch() {
      // Swallowed: these tests assert on the surviving provider, not the error.
    }

    render() {
      return this.state.failed ? <p>consumer failed</p> : this.props.children
    }
  }

  it('keeps provider state and timers intact when a sibling consumer throws', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function ExplodingConsumer() {
      const { addToast } = useToast()
      const [armed, setArmed] = useState(false)
      if (armed) throw new Error('consumer failure')
      return (
        <button
          onClick={() => {
            addToast('info', 'Before Throw')
            setArmed(true)
          }}
        >
          Arm
        </button>
      )
    }

    const { container, unmount } = render(
      <ToastProvider>
        <Boundary>
          <ExplodingConsumer />
        </Boundary>
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Arm' }))
    expect(screen.getByText('consumer failed')).toBeInTheDocument()

    // The toast dispatched before the throw is still tracked by the provider,
    // which sits above the boundary and therefore survives the failure.
    expect(toastMessages(container)).toEqual(['Before Throw'])

    // And its auto-dismiss timer still runs exactly once.
    act(() => {
      vi.advanceTimersByTime(INFO_TIMEOUT)
    })
    expect(toasts(container)).toHaveLength(0)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
    consoleErrorSpy.mockRestore()
  })

  it('keeps dispatching deterministically after repeated add/remove cycles', () => {
    const harness = makeHarness()
    const { container } = renderProvider({ harness, settings: { autoDismiss: 'off' } })

    for (let round = 0; round < 10; round += 1) {
      act(() => {
        for (let i = 0; i < MAX_TOASTS + 1; i += 1) {
          harness.api.addToast('info', `r${round}-t${i}`)
        }
      })
      expect(toasts(container)).toHaveLength(MAX_TOASTS)

      act(() => harness.api.removeAllToasts())
      expect(toasts(container)).toHaveLength(0)
    }

    act(() => harness.api.addToast('info', 'final'))
    expect(toastMessages(container)).toEqual(['final'])
  })

  it('does not throw when the same toast is dismissed by both its button and its timer', () => {
    const harness = makeHarness()
    const { container, unmount } = renderProvider({ harness })

    act(() => harness.api.addToast('info', 'Info', { timeoutMs: 1000 } as unknown as LooseOptions))
    fireEvent.click(dismissButtonFor('info'))

    expect(() =>
      act(() => {
        vi.advanceTimersByTime(5000)
      }),
    ).not.toThrow()
    expect(toasts(container)).toHaveLength(0)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stays usable when a child throws during its own mount', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function ThrowOnMount(): null {
      throw new Error('mount failure')
    }

    const { container } = render(
      <ToastProvider>
        <Boundary>
          <ThrowOnMount />
        </Boundary>
      </ToastProvider>,
    )

    expect(screen.getByText('consumer failed')).toBeInTheDocument()
    expect(toasts(container)).toHaveLength(0)

    // A replacement provider mounted afterwards behaves normally.
    const harness = makeHarness()
    const { Capture } = harness
    const replacement = render(
      <ToastProvider>
        <Capture />
      </ToastProvider>,
    )
    act(() => harness.api.addToast('success', 'recovered'))
    expect(toastMessages(replacement.container)).toEqual(['recovered'])

    consoleErrorSpy.mockRestore()
  })

  it('silences non-danger toasts when quiet hours wrap around midnight', () => {
    // 23:00 is inside 22:00–07:00 and the default window wraps around midnight
    const { container } = renderWithQuietHours()
    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.toast')).not.toBeInTheDocument()
  })

  it('treats malformed quiet hours times as non-silencing when enabled', () => {
    const { container } = renderWithQuietHours({
      quietHoursStart: 'not-a-time',
      quietHoursEnd: '',
    })
    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.toast--info')).toBeInTheDocument()
  })

  it('still announces danger toasts during quiet hours even when toasts are disabled', () => {
    // Danger toasts are safety-critical and must not be silenced by the
    // general toastsEnabled flag.
    const { container } = renderWithQuietHours({ toastsEnabled: false })
    fireEvent.click(screen.getByText('Add Danger'))
    expect(container.querySelector('.toast--danger')).toBeInTheDocument()
  })
})
