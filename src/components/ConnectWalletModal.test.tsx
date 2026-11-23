import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConnectWalletModal, {
  classifyWalletError,
  sanitizeErrorMessage,
  type ConnectWalletModalProps,
} from './ConnectWalletModal'

// ---------------------------------------------------------------------------
// Wallet context mock — controllable per test
// ---------------------------------------------------------------------------

const mockConnect = vi.fn()
let mockIsConnected = false
let mockIsConnecting = false
let mockError: { code: string; message: string } | null = null

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    connect: mockConnect,
    isConnected: mockIsConnected,
    isConnecting: mockIsConnecting,
    error: mockError,
    disconnect: vi.fn(),
    address: '',
    network: null,
  }),
}))

function renderModal(overrides: Partial<ConnectWalletModalProps> = {}) {
  const onClose = vi.fn()
  const props: ConnectWalletModalProps = { open: true, onClose, ...overrides }
  const result = render(<ConnectWalletModal {...props} />)
  return { ...result, onClose }
}

beforeEach(() => {
  mockConnect.mockClear()
  mockIsConnected = false
  mockIsConnecting = false
  mockError = null

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0)
    return 0
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.style.overflow = ''
})

describe('ConnectWalletModal — Unit: classifyWalletError and sanitizeErrorMessage', () => {
  it('sanitizes Stellar secret keys from error messages', () => {
    const rawSecret = 'S' + 'A'.repeat(55)
    const sanitized = sanitizeErrorMessage(`Failed to sign with key ${rawSecret}`)
    expect(sanitized).not.toContain(rawSecret)
    expect(sanitized).toContain('[REDACTED_SECRET]')
  })

  it('sanitizes bearer auth tokens and password parameters', () => {
    const sanitized = sanitizeErrorMessage('Authorization: bearer eyJhbGciOi... and token=secret123')
    expect(sanitized).toContain('bearer [REDACTED]')
    expect(sanitized).toContain('[REDACTED]')
    expect(sanitized).not.toContain('secret123')
  })

  it('handles null, undefined, and non-string inputs safely in sanitizeErrorMessage', () => {
    expect(sanitizeErrorMessage(null)).toBe('')
    expect(sanitizeErrorMessage(undefined)).toBe('')
    expect(sanitizeErrorMessage(12345)).toBe('12345')
  })

  it('classifies null or missing error as unknown error', () => {
    const classification = classifyWalletError(null)
    expect(classification.state).toBe('error')
    expect(classification.kind).toBe('unknown')
    expect(classification.message).toContain('unknown wallet connection error')
  })

  it('classifies not_installed error as error with not_installed kind', () => {
    const classification = classifyWalletError({ code: 'not_installed', message: 'Not found' })
    expect(classification.state).toBe('error')
    expect(classification.kind).toBe('not_installed')
    expect(classification.message).toMatch(/Freighter is not installed/i)
  })

  it('classifies rejected, permission denied, and declined errors as permission state', () => {
    expect(classifyWalletError({ code: 'rejected' }).state).toBe('permission')
    expect(classifyWalletError({ code: 'permission_denied' }).state).toBe('permission')
    expect(classifyWalletError(new Error('User declined the transaction')).state).toBe('permission')
    expect(classifyWalletError(new Error('Permission denied by browser')).state).toBe('permission')
    expect(classifyWalletError({ name: 'PermissionError', message: 'Access denied' }).state).toBe(
      'permission'
    )
  })

  it('classifies network_mismatch and stale errors as stale state', () => {
    expect(classifyWalletError({ code: 'network_mismatch' }).state).toBe('stale')
    expect(classifyWalletError({ code: 'stale' }).state).toBe('stale')
    expect(classifyWalletError(new Error('Wallet session is stale')).state).toBe('stale')
    expect(classifyWalletError({ name: 'StaleSessionError', message: 'Expired' }).state).toBe('stale')
  })
})

describe('ConnectWalletModal — Rendering & A11y', () => {
  it('renders nothing when open is false', () => {
    renderModal({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('handles invalid or boundary open values safely (null/undefined/false)', () => {
    // @ts-expect-error testing boundary input
    renderModal({ open: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // @ts-expect-error testing boundary input
    renderModal({ open: undefined })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog when open is true with correct accessibility attributes', () => {
    renderModal({ open: true })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId!)).toHaveTextContent('Connect Freighter Wallet')

    const descId = dialog.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    expect(document.getElementById(descId!)).toHaveTextContent(/Freighter is a Stellar wallet/i)
  })

  it('renders Cancel and Connect buttons in default idle state', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ConnectWalletModal — Loading, Error, Permission, and Stale States', () => {
  it('enters loading state while wallet is connecting and disables cancel', () => {
    mockIsConnecting = true
    renderModal()

    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i })
    const connectBtn = screen.getByRole('button', { name: /connect/i })

    expect(cancelBtn).toBeDisabled()
    expect(connectBtn).toHaveAttribute('aria-busy', 'true')
  })

  it('renders error state when Freighter is not installed', () => {
    mockError = { code: 'not_installed', message: 'Not installed' }
    renderModal()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/Freighter is not installed/i)
    expect(screen.getByRole('link', { name: /install freighter/i })).toHaveAttribute(
      'href',
      'https://www.freighter.app/'
    )
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('renders permission state when connection is rejected or declined', () => {
    mockError = { code: 'rejected', message: 'User rejected' }
    renderModal()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/declined in Freighter/i)
    expect(alert).toHaveAttribute('data-state', 'permission')
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('renders stale state when network mismatch or session is stale', () => {
    mockError = { code: 'network_mismatch', message: 'Network mismatch' }
    renderModal()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/stale or network configuration changed/i)
    expect(alert).toHaveAttribute('data-state', 'stale')
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})

describe('ConnectWalletModal — Custom onConnectRequest & Retry Execution', () => {
  it('executes custom onConnectRequest and handles loading -> success transition', async () => {
    const user = userEvent.setup()
    let resolveFn: () => void = () => {}
    const onConnectRequest = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve
        })
    )
    const onSuccess = vi.fn()

    renderModal({ onConnectRequest, onSuccess })

    const connectBtn = screen.getByRole('button', { name: /^connect$/i })
    await user.click(connectBtn)

    expect(onConnectRequest).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled()

    // Resolve connection
    resolveFn()
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce()
    })
  })

  it('handles permission rejection via onConnectRequest and allows retry', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const onConnectRequest = vi.fn().mockImplementation(async () => {
      attempts++
      if (attempts === 1) {
        const err = new Error('Permission denied by user')
        err.name = 'PermissionError'
        throw err
      }
      return Promise.resolve()
    })
    const onSuccess = vi.fn()
    const onError = vi.fn()

    renderModal({ onConnectRequest, onSuccess, onError })

    // First attempt fails with permission error
    await user.click(screen.getByRole('button', { name: /^connect$/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('data-state', 'permission')
      expect(alert).toHaveTextContent(/declined/i)
    })
    expect(onError).toHaveBeenCalledOnce()

    // Click Retry button
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    await user.click(retryBtn)

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce()
    })
    expect(onConnectRequest).toHaveBeenCalledTimes(2)
  })

  it('handles stale state and allows retry', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const onConnectRequest = vi.fn().mockImplementation(async () => {
      attempts++
      if (attempts === 1) {
        const err = new Error('Session is stale')
        err.name = 'StaleDataError'
        throw err
      }
      return Promise.resolve()
    })

    renderModal({ onConnectRequest })

    await user.click(screen.getByRole('button', { name: /^connect$/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('data-state', 'stale')
      expect(alert).toHaveTextContent(/stale/i)
    })

    await user.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
    expect(attempts).toBe(2)
  })
})

describe('ConnectWalletModal — Concurrency, Race Condition & Sequence Guards', () => {
  it('prevents concurrent execution when clicked multiple times while in flight', async () => {
    const user = userEvent.setup()
    let resolveFn: () => void = () => {}
    const onConnectRequest = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve
        })
    )

    renderModal({ onConnectRequest })
    const connectBtn = screen.getByRole('button', { name: /^connect$/i })

    // First click initiates connection
    await user.click(connectBtn)
    expect(onConnectRequest).toHaveBeenCalledOnce()

    // Second click during loading is ignored
    await user.click(connectBtn)
    expect(onConnectRequest).toHaveBeenCalledOnce()

    resolveFn()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^connect$/i })).not.toHaveAttribute(
        'aria-busy',
        'true'
      )
    })
  })

  it('discards stale out-of-order asynchronous responses using sequence counter', async () => {
    let resolveSlow: () => void = () => {}

    const slowPromise = new Promise<void>((res) => {
      resolveSlow = res
    })

    let callCount = 0
    const onConnectRequest = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return slowPromise
      return Promise.resolve()
    })
    const onSuccess = vi.fn()

    const { rerender } = renderModal({ onConnectRequest, onSuccess })
    const user = userEvent.setup()

    // Trigger initial request (slow)
    await user.click(screen.getByRole('button', { name: /^connect$/i }))
    expect(onConnectRequest).toHaveBeenCalledTimes(1)

    // Unmount/remount boundary closes the window of stale response
    rerender(<ConnectWalletModal open={false} onClose={vi.fn()} />)

    // Resolve the slow promise after closure
    resolveSlow()
    await Promise.resolve()

    // Invariant: Success callback was not called because sequence was superseded
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

describe('ConnectWalletModal — Closing, Safe Cancellation & Auto-Close', () => {
  it('calls onClose when Cancel is clicked in idle state', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked in idle state', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape is pressed in idle state', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose when clicking inside the dialog panel', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('blocks closing via Cancel, backdrop click, or Escape while connecting is in flight', async () => {
    const user = userEvent.setup()
    mockIsConnecting = true
    const { onClose } = renderModal()

    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i })
    expect(cancelBtn).toBeDisabled()
    await user.click(cancelBtn)
    expect(onClose).not.toHaveBeenCalled()

    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('auto-closes when isConnected becomes true', () => {
    const onClose = vi.fn()
    mockIsConnected = false
    const { rerender } = render(<ConnectWalletModal open={true} onClose={onClose} />)

    expect(onClose).not.toHaveBeenCalled()

    mockIsConnected = true
    rerender(<ConnectWalletModal open={true} onClose={onClose} />)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('handles non-function onClose gracefully without crashing', async () => {
    const user = userEvent.setup()
    // @ts-expect-error testing boundary input
    render(<ConnectWalletModal open={true} onClose={null} />)

    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    // Should not throw
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('returns focus to returnFocusRef element upon closing', () => {
    const triggerEl = document.createElement('button')
    triggerEl.type = 'button'
    Object.defineProperty(triggerEl, 'offsetParent', {
      get: () => document.body,
      configurable: true,
    })
    document.body.appendChild(triggerEl)
    triggerEl.focus()

    const returnFocusRef = createRef<HTMLButtonElement>()
    ;(returnFocusRef as React.MutableRefObject<HTMLButtonElement>).current = triggerEl

    const onClose = vi.fn()
    const { rerender } = render(
      <ConnectWalletModal open={true} onClose={onClose} returnFocusRef={returnFocusRef} />
    )

    rerender(<ConnectWalletModal open={false} onClose={onClose} returnFocusRef={returnFocusRef} />)

    expect(document.activeElement).toBe(triggerEl)
    document.body.removeChild(triggerEl)
  })
})
