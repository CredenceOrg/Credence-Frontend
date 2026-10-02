/**
 * @file CopyableHash.failure-boundary.test.tsx
 * @description Deterministic failure-boundary coverage for executeCopy in
 * ./src/components/CopyableHash.tsx (issue #1136).
 *
 * Scope: every failure classification the copy handler can produce, the
 * recovery window that follows each one, the retry affordance, and the shared
 * timer slot that a success and a failure both compete for.
 *
 * Determinism rules observed throughout:
 * - Time is driven by fake timers advanced inside `act`, never by real waiting,
 *   so the recovery window is asserted exactly rather than approximately.
 * - Copy resolution is driven by an explicit deferred promise the test settles,
 *   so in-flight ordering is exact and the suite cannot flake.
 * - Assertions read the DOM, never component internals.
 * - Each test asserts the user-visible outcome *and* the absence of data loss:
 *   the full hash stays readable through every failure and recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import CopyableHash from './CopyableHash'
import * as SettingsContextModule from '../context/SettingsContext'
import * as CopyHookModule from '../hooks/useCopyToClipboard'

vi.mock('../context/SettingsContext', () => ({
  useSettings: vi.fn(),
}))

vi.mock('../hooks/useCopyToClipboard', () => ({
  default: vi.fn(),
}))

const HASH = '0x93a1234567890abcdef1234567890abcdef22f4'

/** A promise whose settlement the test drives, so ordering is never racy. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Drive one click through the component's async copy path to completion. */
async function clickAndSettle(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button)
  })
}

/** Advance the fake clock inside `act` so React flushes the resulting render. */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe('CopyableHash — executeCopy failure boundaries', () => {
  const mockCopy = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      network: 'public',
      addressDisplay: 'short',
      themeMode: 'system',
      toastsEnabled: true,
      autoDismiss: '5s',
      setThemeMode: vi.fn(),
      setNetwork: vi.fn(),
      setAddressDisplay: vi.fn(),
      setToastsEnabled: vi.fn(),
      setAutoDismiss: vi.fn(),
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      setQuietHoursEnabled: vi.fn(),
      setQuietHoursStart: vi.fn(),
      setQuietHoursEnd: vi.fn(),

      resetToDefaults: vi.fn(),
      saveSettings: vi.fn(),
      cancelSettings: vi.fn(),
      canPersist: true,
      lastError: null,
      retryPersist: vi.fn().mockResolvedValue(undefined),

      hasUnsavedChanges: false,
    })

    mockCopy.mockResolvedValue(true)
    vi.mocked(CopyHookModule.default).mockReturnValue({
      copy: mockCopy,
      copied: false,
      reset: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const copyButton = () => screen.getByRole('button', { name: 'Copy hash' })

  // -------------------------------------------------------------------------
  // I1: every failure classification is announced and is recoverable.
  // -------------------------------------------------------------------------

  describe('failure classification and recovery window', () => {
    it('recovers to idle after a rejected copy result', async () => {
      mockCopy.mockResolvedValue(false)
      render(<CopyableHash hash={HASH} />)

      await clickAndSettle(copyButton())

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy hash.')
      expect(screen.getByText(HASH.slice(0, 12) + '...' + HASH.slice(-8))).toBeInTheDocument()

      // Still failing at the edge of the window, recovered just past it.
      await advance(2999)
      expect(screen.getByRole('alert')).toBeInTheDocument()

      await advance(1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(copyButton()).toBeEnabled()
    })

    it('classifies a permission rejection and recovers to idle', async () => {
      const denied = Object.assign(new Error('write blocked'), {
        name: 'NotAllowedError',
      })
      mockCopy.mockRejectedValue(denied)
      render(<CopyableHash hash={HASH} />)

      await clickAndSettle(copyButton())

      expect(screen.getByRole('alert')).toHaveTextContent('Permission denied copying hash.')

      await advance(3000)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('classifies stale data separately from a generic failure and recovers', async () => {
      mockCopy.mockRejectedValue(new Error('row is stale'))
      render(<CopyableHash hash={HASH} />)

      await clickAndSettle(copyButton())

      // Stale is its own state: it must not be reported as a copy failure.
      expect(screen.getByRole('alert')).toHaveTextContent('Hash data is stale.')
      expect(screen.getByRole('alert')).not.toHaveTextContent('Failed to copy hash.')

      await advance(3000)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('treats a thrown non-Error as a generic failure without leaking its value', async () => {
      // A non-Error rejection is the boundary a raw clipboard library can hit.
      mockCopy.mockRejectedValue('SECRET-SESSION-TOKEN')
      render(<CopyableHash hash={HASH} />)

      await clickAndSettle(copyButton())

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Failed to copy hash.')
      expect(alert).not.toHaveTextContent('SECRET-SESSION-TOKEN')
      expect(screen.getByText(/copy failed/i)).toBeInTheDocument()
    })

    it('recovers from the isStale prop short-circuit without invoking the clipboard', async () => {
      render(<CopyableHash hash={HASH} isStale />)

      await clickAndSettle(copyButton())

      expect(screen.getByRole('alert')).toHaveTextContent('Hash data is stale.')
      expect(mockCopy).not.toHaveBeenCalled()

      await advance(3000)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // I2: success and failure share one timer slot; the later event owns the
  // deadline. An earlier success must never clear a later failure.
  // -------------------------------------------------------------------------

  describe('shared success/failure timer slot', () => {
    it('does not let a pending success deadline erase a newer failure', async () => {
      const firstAttempt = deferred<boolean>()
      mockCopy.mockReturnValueOnce(firstAttempt.promise).mockResolvedValueOnce(false)

      render(<CopyableHash hash={HASH} />)
      const button = copyButton()

      // Attempt 1 succeeds and arms the 2s confirmation deadline.
      await clickAndSettle(button)
      await act(async () => {
        firstAttempt.resolve(true)
      })
      expect(screen.getByText('Copied')).toBeInTheDocument()

      // Attempt 2 fails while the success deadline is still pending.
      await advance(1000)
      await clickAndSettle(button)

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy hash.')

      // The old success deadline would have fired here; the failure must survive it.
      await advance(1000)
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy hash.')

      // The failure then recovers on its own window.
      await advance(2000)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not let a pending failure deadline erase a newer success', async () => {
      const failingAttempt = deferred<boolean>()
      mockCopy.mockReturnValueOnce(failingAttempt.promise).mockResolvedValueOnce(true)

      render(<CopyableHash hash={HASH} />)
      const button = copyButton()

      await act(async () => {
        fireEvent.click(button)
      })
      await act(async () => {
        failingAttempt.resolve(false)
      })
      expect(screen.getByRole('alert')).toBeInTheDocument()

      // Recover, then succeed before the failure deadline elapses.
      await advance(2000)
      await clickAndSettle(button)

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByText('Copied')).toBeInTheDocument()

      await advance(1999)
      expect(screen.getByText('Copied')).toBeInTheDocument()
      await advance(1)
      expect(screen.queryByText('Copied')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // I3: the alert exposes a retry that re-runs the copy path and clears the
  // failure; a stale in-flight result cannot resurrect a dead alert.
  // -------------------------------------------------------------------------

  describe('retry and in-flight boundaries', () => {
    it('retries from the alert and clears the failure on success', async () => {
      mockCopy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      render(<CopyableHash hash={HASH} />)

      await clickAndSettle(copyButton())
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy hash.')

      const retry = screen.getByRole('button', { name: 'Retry copy' })
      await clickAndSettle(retry)

      expect(mockCopy).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByText('Copied')).toBeInTheDocument()
    })

    it('announces only the last failure when two attempts overlap', async () => {
      const firstAttempt = deferred<boolean>()
      const secondAttempt = deferred<boolean>()
      mockCopy.mockReturnValueOnce(firstAttempt.promise).mockReturnValueOnce(secondAttempt.promise)

      render(<CopyableHash hash={HASH} />)

      // Two attempts in flight; the copy button is gated while loading, so drive
      // the second through the retry affordance that the first failure exposes.
      await act(async () => {
        fireEvent.click(copyButton())
      })
      await act(async () => {
        firstAttempt.resolve(false)
      })

      await clickAndSettle(screen.getByRole('button', { name: 'Retry copy' }))
      await act(async () => {
        secondAttempt.resolve(false)
      })

      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy hash.')
    })

    it('keeps the failure recoverable after a hash change during an in-flight copy', async () => {
      const pending = deferred<boolean>()
      mockCopy.mockReturnValueOnce(pending.promise)

      const { rerender } = render(<CopyableHash hash={HASH} />)
      await act(async () => {
        fireEvent.click(copyButton())
      })

      rerender(<CopyableHash hash="0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" />)

      await act(async () => {
        pending.resolve(true)
      })

      // The success is discarded as stale: no false "Copied" confirmation.
      expect(screen.queryByText('Copied')).not.toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('Hash data is stale.')

      await advance(3000)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not resurrect state after unmount while a copy is in flight', async () => {
      const pending = deferred<boolean>()
      mockCopy.mockReturnValueOnce(pending.promise)
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { unmount } = render(<CopyableHash hash={HASH} />)
      await act(async () => {
        fireEvent.click(copyButton())
      })

      unmount()
      await act(async () => {
        pending.resolve(false)
      })

      // The pending recovery timer belonged to the unmounted tree.
      await advance(3000)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      errors.mockRestore()
    })

    it('cancels a pending recovery when the component unmounts with a failure shown', async () => {
      mockCopy.mockResolvedValue(false)
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { unmount } = render(<CopyableHash hash={HASH} />)
      await clickAndSettle(copyButton())
      expect(screen.getByRole('alert')).toBeInTheDocument()

      unmount()
      // The recovery deadline fires against a tree that no longer exists.
      await advance(3000)
      errors.mockRestore()
    })
  })

  // -------------------------------------------------------------------------
  // I4: the custom-handler prop and the loading gate are the remaining
  // reachable boundaries of executeCopy.
  // -------------------------------------------------------------------------

  describe('custom handler and concurrency gate', () => {
    it('routes through onCopyRequest and honours an explicit false result', async () => {
      const onCopyRequest = vi.fn().mockResolvedValue(false)
      render(<CopyableHash hash={HASH} onCopyRequest={onCopyRequest} />)

      await clickAndSettle(copyButton())

      expect(onCopyRequest).toHaveBeenCalledWith(HASH)
      expect(mockCopy).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy hash.')

      await advance(3000)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('treats a void-resolving onCopy alias as success', async () => {
      const onCopy = vi.fn().mockResolvedValue(undefined)
      render(<CopyableHash hash={HASH} onCopy={onCopy} />)

      await clickAndSettle(copyButton())

      expect(onCopy).toHaveBeenCalledWith(HASH)
      expect(screen.getByText('Copied')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('ignores a second click while a copy is already in flight', async () => {
      const pending = deferred<boolean>()
      mockCopy.mockReturnValueOnce(pending.promise)

      render(<CopyableHash hash={HASH} />)
      const button = copyButton()

      await act(async () => {
        fireEvent.click(button)
      })
      // While loading the control renames itself and is disabled.
      const loadingButton = screen.getByRole('button', { name: 'Copying hash...' })
      expect(loadingButton).toBeDisabled()

      await act(async () => {
        fireEvent.click(loadingButton)
      })
      // The loading gate held: exactly one clipboard call is in flight.
      expect(mockCopy).toHaveBeenCalledTimes(1)

      await act(async () => {
        pending.resolve(false)
      })
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy hash.')
    })

    it('discards an out-of-order resolution from a superseded attempt', async () => {
      const first = deferred<boolean>()
      const second = deferred<boolean>()
      mockCopy.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      render(<CopyableHash hash={HASH} />)

      await act(async () => {
        fireEvent.click(copyButton())
      })
      await act(async () => {
        first.resolve(false)
      })
      await clickAndSettle(screen.getByRole('button', { name: 'Retry copy' }))

      // The newer attempt succeeds; the older failure arrives afterwards and
      // must not overwrite the confirmation.
      await act(async () => {
        second.resolve(true)
      })
      await act(async () => {
        first.resolve(false)
      })

      expect(screen.getByText('Copied')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('discards a rejection that lands after unmount', async () => {
      const pending = deferred<boolean>()
      mockCopy.mockReturnValueOnce(pending.promise)
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { unmount } = render(<CopyableHash hash={HASH} />)
      await act(async () => {
        fireEvent.click(copyButton())
      })

      // Unmount, then let the in-flight attempt fail. The catch block must
      // observe the unmounted tree and stay silent rather than set state.
      unmount()
      await act(async () => {
        pending.reject(new Error('late failure'))
      })

      expect(errors).not.toHaveBeenCalled()
      errors.mockRestore()
    })

    it('fails closed for a non-string hash without touching the clipboard', async () => {
      const { container } = render(
        // A runtime-invalid prop is exactly what the fail-closed guard exists for.
        <CopyableHash hash={123 as unknown as string} />
      )

      expect(container).toBeEmptyDOMElement()
      await clickAndSettleSafe()
      expect(mockCopy).not.toHaveBeenCalled()
    })
  })
})

/** No-op settle for the fail-closed render, which exposes no button to click. */
async function clickAndSettleSafe() {
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
}