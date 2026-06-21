import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Bond from './Bond'

const mockAddToast = vi.fn()
const mockConnect = vi.fn()

let mockConnected = true

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}))

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    isConnected: mockConnected,
    address: mockConnected ? 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' : '',
    connect: mockConnect,
    disconnect: vi.fn(),
    isConnecting: false,
    error: null,
    network: 'public',
  }),
}))

describe('Bond Page', () => {
  beforeEach(() => {
    mockAddToast.mockClear()
    mockConnect.mockClear()
    mockConnected = true
    // Mock scrollIntoView since it's not implemented in JSDOM
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('renders the page header, description, and empty active bonds state', () => {
    render(<Bond />)

    expect(screen.getByRole('heading', { name: /Bond USDC/i })).toBeInTheDocument()
    expect(screen.getByText(/Lock USDC into the Credence contract/i)).toBeInTheDocument()
    expect(screen.getByText(/No active bonds/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create your first bond/i })).toBeInTheDocument()
  })

  it('disables the submit button initially when amount is empty', () => {
    render(<Bond />)
    const submitBtn = screen.getByRole('button', { name: /^Create bond$/i })
    expect(submitBtn).toBeDisabled()
  })

  it('enables submit button for valid inputs and fires success toast on submit', async () => {
    const user = userEvent.setup()
    render(<Bond />)

    const input = screen.getByPlaceholderText('0.00')
    const submitBtn = screen.getByRole('button', { name: /^Create bond$/i })

    // Input valid amount
    await user.type(input, '500')
    expect(submitBtn).toBeEnabled()

    // Trigger blur to format
    await user.tab()
    expect(input).toHaveValue('500.00')

    // Click submit
    await user.click(submitBtn)
    expect(mockAddToast).toHaveBeenCalledWith('success', 'Bond of 500 USDC created successfully.')
  })

  it('shows an error and disables submit when amount exceeds balance', async () => {
    const user = userEvent.setup()
    render(<Bond />)

    const input = screen.getByPlaceholderText('0.00')
    const submitBtn = screen.getByRole('button', { name: /^Create bond$/i })

    // Input over-balance amount (mockedBalance is 10000)
    await user.type(input, '15000')
    expect(submitBtn).toBeDisabled()

    // It should display error inline
    const errorEl = screen.getByRole('alert')
    expect(errorEl).toHaveTextContent(/Amount exceeds available balance/i)
  })

  it('validates amount > 0 when user submits 0', async () => {
    const user = userEvent.setup()
    render(<Bond />)

    const input = screen.getByPlaceholderText('0.00')
    const submitBtn = screen.getByRole('button', { name: /^Create bond$/i })

    // Type 0 (not empty, so button is enabled)
    await user.type(input, '0')
    expect(submitBtn).toBeEnabled()

    // Submit
    await user.click(submitBtn)

    // Should display inline error instead of firing toast
    expect(mockAddToast).not.toHaveBeenCalled()
    const errorEl = screen.getByRole('alert')
    expect(errorEl).toHaveTextContent(/Please enter a valid amount greater than 0/i)

    // Clear error when value changes
    await user.type(input, '1')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('ensures accessibility requirements are met', async () => {
    const user = userEvent.setup()
    render(<Bond />)

    const input = screen.getByPlaceholderText('0.00')
    await user.type(input, '15000')

    const errorEl = screen.getByRole('alert')
    const errorId = errorEl.getAttribute('id')
    expect(input.getAttribute('aria-describedby')).toContain(errorId)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('focuses the bond amount input when clicking empty state action button', async () => {
    const user = userEvent.setup()
    render(<Bond />)

    const actionBtn = screen.getByRole('button', { name: /Create your first bond/i })
    const input = screen.getByPlaceholderText('0.00')

    await user.click(actionBtn)
    expect(document.activeElement).toBe(input)
  })

  it('shows wallet gating and connects instead of creating a bond while disconnected', async () => {
    const user = userEvent.setup()
    mockConnected = false
    render(<Bond />)

    expect(screen.getByText(/Create bond and withdraw actions require a connected Stellar wallet/i)).toBeInTheDocument()

    const input = screen.getByPlaceholderText('0.00')
    await user.type(input, '500')

    await user.click(screen.getByRole('button', { name: /^Connect wallet to continue$/i }))

    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockAddToast).not.toHaveBeenCalled()
  })

  it('restores the create bond action while connected', async () => {
    const user = userEvent.setup()
    render(<Bond />)

    const input = screen.getByPlaceholderText('0.00')
    await user.type(input, '250')
    await user.click(screen.getByRole('button', { name: /^Create bond$/i }))

    expect(mockConnect).not.toHaveBeenCalled()
    expect(mockAddToast).toHaveBeenCalledWith('success', 'Bond of 250 USDC created successfully.')
  })
})
