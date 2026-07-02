import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConnectWalletModal from './ConnectWalletModal'

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

function renderModal(
  overrides: Partial<Parameters<typeof ConnectWalletModal>[0]> = {}
) {
  const onClose = vi.fn()
  const props = { open: true, onClose, ...overrides }
  const result = render(<ConnectWalletModal {...props} />)
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

describe('ConnectWalletModal — rendering', () => {
  it('renders nothing when open is false', () => {
    renderModal({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog when open is true', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('has aria-modal="true"', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('has an accessible title via aria-labelledby', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const titleEl = document.getElementById(labelId!)
    expect(titleEl).toHaveTextContent('Connect Freighter Wallet')
  })

  it('has an accessible description via aria-describedby', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    const descId = dialog.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    const descEl = document.getElementById(descId!)
    expect(descEl).toHaveTextContent(/Freighter/i)
  })

  it('renders Cancel and Connect buttons', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument()
  })

  it('does not render an error alert by default', () => {
    renderModal()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

describe('ConnectWalletModal — error display', () => {
  it('renders a not-installed error message', () => {
    mockError = { code: 'not_installed', message: 'Not installed' }
    renderModal()
    expect(screen.getByRole('alert')).toHaveTextContent(/Freighter is not installed/i)
  })

  it('renders a rejected error message', () => {
    mockError = { code: 'rejected', message: 'User declined' }
    renderModal()
    expect(screen.getByRole('alert')).toHaveTextContent(/declined/i)
  })

  it('falls back to error.message for unknown error codes', () => {
    mockError = { code: 'unknown', message: 'Something went wrong' }
    renderModal()
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })
})

// ---------------------------------------------------------------------------
// Connecting state
// ---------------------------------------------------------------------------

describe('ConnectWalletModal — connecting state', () => {
  it('disables Cancel while connecting', () => {
    mockIsConnecting = true
    renderModal()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled()
  })

  it('shows loading state on Connect button while connecting', () => {
    mockIsConnecting = true
    renderModal()
    const connectBtn = screen.getByRole('button', { name: /^connect$/i })
    expect(connectBtn).toHaveAttribute('aria-busy', 'true')
  })
})

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------

describe('ConnectWalletModal — closing', () => {
  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape is pressed', async () => {
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
})

// ---------------------------------------------------------------------------
// Connect action
// ---------------------------------------------------------------------------

describe('ConnectWalletModal — connect action', () => {
  it('calls connect() when Connect button is clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /^connect$/i }))
    expect(mockConnect).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Auto-close on wallet connect
// ---------------------------------------------------------------------------

describe('ConnectWalletModal — auto-close on wallet connect', () => {
  it('calls onClose when isConnected becomes true while open', () => {
    const onClose = vi.fn()
    mockIsConnected = false
    const { rerender } = render(<ConnectWalletModal open={true} onClose={onClose} />)

    expect(onClose).not.toHaveBeenCalled()

    mockIsConnected = true
    rerender(<ConnectWalletModal open={true} onClose={onClose} />)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose when already closed', () => {
    const onClose = vi.fn()
    mockIsConnected = true
    render(<ConnectWalletModal open={false} onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Body scroll lock
// ---------------------------------------------------------------------------

describe('ConnectWalletModal — body scroll lock', () => {
  it('sets overflow to hidden when open', () => {
    renderModal({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores overflow on unmount', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = renderModal({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('does not lock scroll when open is false', () => {
    renderModal({ open: false })
    expect(document.body.style.overflow).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Focus management
// ---------------------------------------------------------------------------

describe('ConnectWalletModal — focus management', () => {
  it('initially focuses the Cancel button when opened', () => {
    renderModal()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /^cancel$/i })
    )
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
      <ConnectWalletModal open={true} onClose={onClose} returnFocusRef={returnFocusRef} />
    )

    rerender(
      <ConnectWalletModal open={false} onClose={onClose} returnFocusRef={returnFocusRef} />
    )

    expect(document.activeElement).toBe(triggerEl)
    document.body.removeChild(triggerEl)
  })
})

