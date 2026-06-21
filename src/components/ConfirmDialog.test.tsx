import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog, { type ConfirmDialogPenaltyBreakdown } from './ConfirmDialog'

const defaultBreakdown: ConfirmDialogPenaltyBreakdown = {
  bondAmount: '1,000 USDC',
  penaltyAmount: '100 USDC',
  penaltyPercent: 10,
  resultingBalance: '900 USDC',
}

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()

  const props = {
    open: true,
    title: 'Withdraw Bond',
    breakdown: defaultBreakdown,
    onConfirm,
    onCancel,
    ...overrides,
  }

  const result = render(<ConfirmDialog {...props} />)
  return { ...result, onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.style.overflow = ''
  })

  describe('rendering', () => {
    it('renders nothing when open is false', () => {
      renderDialog({ open: false })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders the dialog when open is true', () => {
      renderDialog()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('has aria-modal="true"', () => {
      renderDialog()
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('renders the title', () => {
      renderDialog({ title: 'Withdraw Bond' })
      expect(screen.getByRole('heading', { name: 'Withdraw Bond' })).toBeInTheDocument()
    })

    it('renders subtitle when provided', () => {
      renderDialog({ subtitle: 'This is irreversible' })
      expect(screen.getByText('This is irreversible')).toBeInTheDocument()
    })

    it('does not render subtitle when omitted', () => {
      renderDialog({ subtitle: undefined })
      // heading is there but no subtitle paragraph
      expect(screen.queryByText(/This is irreversible/i)).not.toBeInTheDocument()
    })

    it('renders the financial breakdown', () => {
      renderDialog()
      const dl = screen.getByRole('dialog')
      expect(within(dl).getByText('Bond amount')).toBeInTheDocument()
      expect(within(dl).getByText('1,000 USDC')).toBeInTheDocument()
      expect(within(dl).getByText(/Slash penalty.*10%/)).toBeInTheDocument()
      expect(within(dl).getByText('−100 USDC')).toBeInTheDocument()
      expect(within(dl).getByText('You receive')).toBeInTheDocument()
      expect(within(dl).getByText('900 USDC')).toBeInTheDocument()
    })

    it('renders custom confirmLabel on the confirm button', () => {
      renderDialog({ confirmLabel: 'Yes, withdraw' })
      expect(screen.getByRole('button', { name: 'Yes, withdraw' })).toBeInTheDocument()
    })

    it('uses default confirmLabel "Withdraw bond"', () => {
      renderDialog()
      expect(screen.getByRole('button', { name: 'Withdraw bond' })).toBeInTheDocument()
    })
  })

  describe('CONFIRM text gating', () => {
    it('confirm button is disabled initially', () => {
      renderDialog()
      expect(screen.getByRole('button', { name: 'Withdraw bond' })).toBeDisabled()
    })

    it('confirm button remains disabled for partial input', async () => {
      const user = userEvent.setup()
      renderDialog()
      const input = screen.getByRole('textbox', { name: /type confirm/i })
      await user.type(input, 'CONFI')
      expect(screen.getByRole('button', { name: 'Withdraw bond' })).toBeDisabled()
    })

    it('confirm button remains disabled for wrong case input', async () => {
      const user = userEvent.setup()
      renderDialog()
      const input = screen.getByRole('textbox', { name: /type confirm/i })
      await user.type(input, 'confirm')
      expect(screen.getByRole('button', { name: 'Withdraw bond' })).toBeDisabled()
    })

    it('confirm button becomes enabled when "CONFIRM" is typed exactly', async () => {
      const user = userEvent.setup()
      renderDialog()
      const input = screen.getByRole('textbox', { name: /type confirm/i })
      await user.type(input, 'CONFIRM')
      expect(screen.getByRole('button', { name: 'Withdraw bond' })).toBeEnabled()
    })

    it('confirm button has aria-disabled="true" before text is entered', () => {
      renderDialog()
      expect(screen.getByRole('button', { name: 'Withdraw bond' })).toHaveAttribute(
        'aria-disabled',
        'true'
      )
    })

    it('confirm button has aria-disabled="false" after "CONFIRM" entered', async () => {
      const user = userEvent.setup()
      renderDialog()
      const input = screen.getByRole('textbox', { name: /type confirm/i })
      await user.type(input, 'CONFIRM')
      expect(screen.getByRole('button', { name: 'Withdraw bond' })).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    })
  })

  describe('onConfirm callback', () => {
    it('does not call onConfirm when button is clicked without "CONFIRM" typed', async () => {
      const user = userEvent.setup()
      const { onConfirm } = renderDialog()
      // Button is disabled so click should have no effect
      await user.click(screen.getByRole('button', { name: 'Withdraw bond' }))
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('calls onConfirm when "CONFIRM" is typed and confirm button is clicked', async () => {
      const user = userEvent.setup()
      const { onConfirm } = renderDialog()
      const input = screen.getByRole('textbox', { name: /type confirm/i })
      await user.type(input, 'CONFIRM')
      await user.click(screen.getByRole('button', { name: 'Withdraw bond' }))
      expect(onConfirm).toHaveBeenCalledOnce()
    })
  })

  describe('onCancel callback', () => {
    it('calls onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderDialog()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onCancel).toHaveBeenCalledOnce()
    })

    it('calls onCancel when Escape key is pressed', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderDialog()
      await user.keyboard('{Escape}')
      expect(onCancel).toHaveBeenCalledOnce()
    })

    it('calls onCancel when backdrop is clicked', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderDialog()
      // The backdrop is the direct parent of the dialog element
      const backdrop = screen.getByRole('dialog').parentElement!
      await user.click(backdrop)
      expect(onCancel).toHaveBeenCalledOnce()
    })

    it('does not call onCancel when clicking inside the dialog', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderDialog()
      await user.click(screen.getByRole('dialog'))
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  describe('body scroll lock', () => {
    it('sets document.body.style.overflow to "hidden" when open', () => {
      renderDialog({ open: true })
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('restores document.body.style.overflow when unmounted', () => {
      document.body.style.overflow = 'auto'
      const { unmount } = renderDialog({ open: true })
      expect(document.body.style.overflow).toBe('hidden')
      unmount()
      expect(document.body.style.overflow).toBe('auto')
    })

    it('does not lock scroll when open is false', () => {
      document.body.style.overflow = ''
      renderDialog({ open: false })
      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('state reset on close', () => {
    it('resets the confirm input when reopened', async () => {
      const user = userEvent.setup()
      const { rerender, onConfirm, onCancel } = renderDialog()
      const input = screen.getByRole('textbox', { name: /type confirm/i })
      await user.type(input, 'CONFIRM')

      rerender(
        <ConfirmDialog
          open={false}
          title="Withdraw Bond"
          breakdown={defaultBreakdown}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )
      rerender(
        <ConfirmDialog
          open={true}
          title="Withdraw Bond"
          breakdown={defaultBreakdown}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )

      expect(screen.getByRole('textbox', { name: /type confirm/i })).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Withdraw bond' })).toBeDisabled()
    })
  })

  describe('focus management', () => {
    it('initially focuses the Cancel button', () => {
      renderDialog()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    })

    it('returns focus to returnFocusRef on close', () => {
      const returnEl = document.createElement('button')
      returnEl.type = 'button'
      Object.defineProperty(returnEl, 'offsetParent', {
        get: () => document.body,
        configurable: true,
      })
      document.body.appendChild(returnEl)
      returnEl.focus()

      const returnFocusRef = createRef<HTMLButtonElement>()
      ;(returnFocusRef as React.MutableRefObject<HTMLButtonElement>).current = returnEl

      const { onConfirm, onCancel, rerender } = renderDialog({ returnFocusRef })

      rerender(
        <ConfirmDialog
          open={false}
          title="Withdraw Bond"
          breakdown={defaultBreakdown}
          onConfirm={onConfirm}
          onCancel={onCancel}
          returnFocusRef={returnFocusRef}
        />
      )

      expect(document.activeElement).toBe(returnEl)
    })
  })
})
