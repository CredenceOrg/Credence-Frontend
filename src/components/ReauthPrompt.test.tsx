import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReauthPrompt from './ReauthPrompt'

vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: vi.fn() }))
vi.mock('../hooks/useScrollPreserver', () => ({ useScrollPreserver: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ReauthPrompt', () => {
  it('renders nothing when open is false with minimal props', () => {
    const { container } = render(
      <ReauthPrompt open={false} onConfirm={vi.fn(async () => {})} onCancel={vi.fn()} />
    )

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog content and accessibility attributes when open', () => {
    render(<ReauthPrompt open={true} onConfirm={vi.fn(async () => {})} onCancel={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: /re-authenticate to view balances/i })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(dialog).toHaveAttribute('aria-describedby')

    const labelledBy = dialog.getAttribute('aria-labelledby')!
    const describedBy = dialog.getAttribute('aria-describedby')!
    expect(document.getElementById(labelledBy)).toHaveTextContent(
      'Re-authenticate to view balances'
    )
    expect(document.getElementById(describedBy)).toHaveTextContent(
      'Your session has expired. Please reconnect your wallet to continue.'
    )

    expect(
      screen.getByText('For your security, we need to verify your wallet connection again.')
    ).toBeInTheDocument()

    const liveRegion = screen.getByText('Re-authentication required')
    expect(liveRegion).toHaveAttribute('aria-live', 'assertive')
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true')

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Reconnect Wallet' })).toBeEnabled()
  })

  it('calls onConfirm when clicking Reconnect Wallet and disables buttons while submitting', async () => {
    let resolveConfirm!: () => void
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve
        })
    )
    const onCancel = vi.fn()

    render(<ReauthPrompt open={true} onConfirm={onConfirm} onCancel={onCancel} />)

    const confirmButton = screen.getByRole('button', { name: 'Reconnect Wallet' })
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })

    fireEvent.click(confirmButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(confirmButton).toBeDisabled()
    expect(confirmButton).toHaveAttribute('aria-disabled', 'true')
    expect(cancelButton).toBeDisabled()

    // Backdrop click should be ignored while submitting
    const backdrop = document.querySelector('.confirm-dialog__backdrop') as HTMLElement
    fireEvent.click(backdrop)
    expect(onCancel).not.toHaveBeenCalled()

    await act(async () => {
      resolveConfirm()
    })

    expect(confirmButton).toBeEnabled()
    expect(cancelButton).toBeEnabled()
  })

  it('calls onCancel when clicking Cancel or the backdrop, but not when clicking inside the dialog', () => {
    const onCancel = vi.fn()
    render(<ReauthPrompt open={true} onConfirm={vi.fn(async () => {})} onCancel={onCancel} />)

    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    const backdrop = document.querySelector('.confirm-dialog__backdrop') as HTMLElement
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
