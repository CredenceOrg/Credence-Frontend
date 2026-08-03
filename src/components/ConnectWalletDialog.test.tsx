import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConnectWalletDialog from './ConnectWalletDialog'

// ---------------------------------------------------------------------------
// Wallet context mock — mutated per test
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(overrides: Partial<Parameters<typeof ConnectWalletDialog>[0]> = {}) {
  const onClose = vi.fn()
  const props = { open: true, onClose, ...overrides }
  const result = render(<ConnectWalletDialog {...props} />)
  return { ...result, onClose }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ConnectWalletDialog — rendering', () => {
  it('renders nothing when open is false', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog when open is true', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('has an accessible title via aria-labelledby', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const titleEl = document.getElementById(labelId!)
    expect(titleEl).toHaveTextContent('Connect Freighter Wallet')
  })

  it('has an accessible description via aria-describedby', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const descId = dialog.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    const descEl = document.getElementById(descId!)
    expect(descEl).toHaveTextContent(/Freighter/i)
  })

  it('renders Cancel and Connect buttons', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument()
  })

  it('does not render an error alert by default', () => {
    renderDialog()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

describe('ConnectWalletDialog — error display', () => {
  it('renders a not-installed error message', () => {
    mockError = { code: 'not_installed', message: 'Not installed' }
    renderDialog()
    expect(screen.getByRole('alert')).toHaveTextContent(/Freighter is not installed/i)
  })

  it('renders a rejected error message', () => {
    mockError = { code: 'rejected', message: 'User declined' }
    renderDialog()
    expect(screen.getByRole('alert')).toHaveTextContent(/declined/i)
  })

  it('falls back to error.message for unknown error codes', () => {
    mockError = { code: 'unknown', message: 'Something went wrong' }
    renderDialog()
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// Connecting state
// ---------------------------------------------------------------------------

describe('ConnectWalletDialog — connecting state', () => {
  it('disables Cancel while connecting', () => {
    mockIsConnecting = true
    renderDialog()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled()
  })

  it('shows loading state on Connect button while connecting', () => {
    mockIsConnecting = true
    renderDialog()
    const connectBtn = screen.getByRole('button', { name: /connect/i })
    expect(connectBtn).toHaveAttribute('aria-busy', 'true')
  })
})

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------

describe('ConnectWalletDialog — closing', () => {
  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    // With native <dialog>, clicking the dialog element itself simulates a
    // backdrop click (the ::backdrop pseudo-element is rendered as part of the
    // dialog's top-layer, so event.target === dialog element).
    await user.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose when clicking inside the dialog panel', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    // Click a child element inside the dialog (not the dialog itself)
    await user.click(screen.getByRole('heading', { name: 'Connect Freighter Wallet' }))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Connect action
// ---------------------------------------------------------------------------

describe('ConnectWalletDialog — connect action', () => {
  it('calls connect() when Connect button is clicked', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: /^connect$/i }))
    expect(mockConnect).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Auto-close on wallet connect
// ---------------------------------------------------------------------------

describe('ConnectWalletDialog — auto-close on wallet connect', () => {
  it('calls onClose when isConnected becomes true while open', () => {
    const onClose = vi.fn()
    mockIsConnected = false
    const { rerender } = render(<ConnectWalletDialog open={true} onClose={onClose} />)

    expect(onClose).not.toHaveBeenCalled()

    mockIsConnected = true
    rerender(<ConnectWalletDialog open={true} onClose={onClose} />)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose when already closed', () => {
    const onClose = vi.fn()
    mockIsConnected = true
    render(<ConnectWalletDialog open={false} onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Body scroll lock
// ---------------------------------------------------------------------------

describe('ConnectWalletDialog — body scroll lock', () => {
  it('sets overflow to hidden when open', () => {
    renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores overflow on unmount', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('does not lock scroll when open is false', () => {
    renderDialog({ open: false })
    expect(document.body.style.overflow).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Focus management
// ---------------------------------------------------------------------------

describe('ConnectWalletDialog — focus management', () => {
  it('initially focuses the Cancel button when opened', () => {
    renderDialog()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^cancel$/i }))
  })

  it('returns focus to returnFocusRef element on close', () => {
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
      <ConnectWalletDialog open={true} onClose={onClose} returnFocusRef={returnFocusRef} />
    )

    rerender(<ConnectWalletDialog open={false} onClose={onClose} returnFocusRef={returnFocusRef} />)

    expect(document.activeElement).toBe(triggerEl)
    document.body.removeChild(triggerEl)
  })
})
