import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Bond from './Bond'

const mockAddToast = vi.fn()

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}))

describe('Bond Page - lazy ConfirmDialog tests', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
    mockAddToast.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.style.overflow = ''
  })

  const mockBonds = [
    { id: 1, amountUsdc: 1000, status: 'active' as const },
    { id: 2, amountUsdc: 500, status: 'locked' as const },
  ]

  it('renders Bond component and active bonds list', () => {
    render(<Bond initialBonds={mockBonds} />)
    expect(screen.getByText('Bond USDC')).toBeInTheDocument()
    expect(screen.getByText('1,000 USDC')).toBeInTheDocument()
    expect(screen.getByText('500 USDC')).toBeInTheDocument()
  })

  it('initially does not render the ConfirmDialog', () => {
    render(<Bond initialBonds={mockBonds} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lazy loads and renders ConfirmDialog when Withdraw is clicked', async () => {
    const user = userEvent.setup()
    render(<Bond initialBonds={mockBonds} />)

    const withdrawButtons = screen.getAllByRole('button', { name: 'Withdraw' })
    expect(withdrawButtons.length).toBe(2)

    // Click withdraw on the first bond
    await user.click(withdrawButtons[0])

    // Should load and show dialog
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Confirm bond withdrawal')).toBeInTheDocument()
  })

  it('manages focus trap correctly upon loading the dialog', async () => {
    const user = userEvent.setup()
    render(<Bond initialBonds={mockBonds} />)

    const withdrawButtons = screen.getAllByRole('button', { name: 'Withdraw' })
    
    // Target the first button
    const triggerBtn = withdrawButtons[0]
    triggerBtn.focus()
    expect(document.activeElement).toBe(triggerBtn)

    await user.click(triggerBtn)

    // Wait for lazy loaded dialog
    await screen.findByRole('dialog')

    // Focus trap: initialFocusRef points to cancelRef (Cancel button)
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    await waitFor(() => {
      expect(document.activeElement).toBe(cancelBtn)
    })
  })

  it('returns focus to trigger button when dialog is cancelled', async () => {
    const user = userEvent.setup()
    render(<Bond initialBonds={mockBonds} />)

    const withdrawButtons = screen.getAllByRole('button', { name: 'Withdraw' })
    const triggerBtn = withdrawButtons[0]
    
    await user.click(triggerBtn)
    await screen.findByRole('dialog')

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    await user.click(cancelBtn)

    // Dialog should be gone
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Focus should be restored to the withdraw button
    await waitFor(() => {
      expect(document.activeElement).toBe(triggerBtn)
    })
  })

  it('allows confirming early withdrawal with confirm phrase and triggers warning toast', async () => {
    const user = userEvent.setup()
    render(<Bond initialBonds={mockBonds} />)

    // Target the locked bond (id: 2, index: 1) which has penalty rate > 0
    const withdrawButtons = screen.getAllByRole('button', { name: 'Withdraw' })
    await user.click(withdrawButtons[1])
    await screen.findByRole('dialog')

    const confirmBtn = screen.getByRole('button', { name: 'Withdraw bond' })
    expect(confirmBtn).toBeDisabled()

    const confirmInput = screen.getByPlaceholderText('CONFIRM')
    await user.type(confirmInput, 'CONFIRM')

    expect(confirmBtn).toBeEnabled()
    await user.click(confirmBtn)

    // Dialog is closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Toast triggered
    expect(mockAddToast).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('slashed')
    )
  })
})
