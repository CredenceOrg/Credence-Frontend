import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AmountDisplay from './AmountDisplay'
import * as CopyHookModule from '../hooks/useCopyToClipboard'
import * as ToastModule from './ToastProvider'

vi.mock('../hooks/useCopyToClipboard', () => ({
  default: vi.fn(),
}))

vi.mock('./ToastProvider', () => ({
  useToast: vi.fn(),
}))

describe('AmountDisplay', () => {
  const mockCopy = vi.fn()
  const mockAddToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    mockCopy.mockResolvedValue(true)
    vi.mocked(CopyHookModule.default).mockReturnValue({
      copy: mockCopy,
      copied: false,
      reset: vi.fn(),
    })

    vi.mocked(ToastModule.useToast).mockReturnValue({
      addToast: mockAddToast,
      removeToast: vi.fn(),
      removeAllToasts: vi.fn(),
      announce: vi.fn(),
    })
  })

  describe('rendering', () => {
    it('renders the amount formatted with the USDC suffix', () => {
      render(<AmountDisplay amount={1234.5} />)

      expect(screen.getByText('1,234.5 USDC')).toBeInTheDocument()
    })

    it('renders a copy button by default', () => {
      render(<AmountDisplay amount={100} />)

      expect(screen.getByRole('button', { name: 'Copy amount' })).toBeInTheDocument()
    })

    it('hides the copy button when showCopyButton is false', () => {
      render(<AmountDisplay amount={100} showCopyButton={false} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('applies a custom className', () => {
      render(<AmountDisplay amount={100} className="my-custom-class" />)

      const container = document.querySelector('.amount-display')
      expect(container).toHaveClass('my-custom-class')
    })

    it('shows a checkmark icon and updated label when copied state is true', () => {
      vi.mocked(CopyHookModule.default).mockReturnValue({
        copy: mockCopy,
        copied: true,
        reset: vi.fn(),
      })

      render(<AmountDisplay amount={100} />)

      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
      const btn = screen.getByRole('button', { name: 'Copied' })
      expect(btn.querySelector('svg polyline')).toBeInTheDocument()
    })
  })

  describe('copy button', () => {
    it('calls copy with the raw numeric amount on click', () => {
      render(<AmountDisplay amount={1234.5} />)

      const btn = screen.getByRole('button', { name: 'Copy amount' })
      fireEvent.click(btn)

      expect(mockCopy).toHaveBeenCalledWith('1234.5')
    })

    it('shows a success toast after a successful copy', async () => {
      mockCopy.mockResolvedValue(true)

      render(<AmountDisplay amount={1234.5} />)

      const btn = screen.getByRole('button', { name: 'Copy amount' })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', 'Amount copied to clipboard')
      })
    })

    it('does not show a success toast when copy fails', () => {
      mockCopy.mockResolvedValue(false)

      render(<AmountDisplay amount={1234.5} />)

      const btn = screen.getByRole('button', { name: 'Copy amount' })
      fireEvent.click(btn)

      expect(mockCopy).toHaveBeenCalledWith('1234.5')
      expect(mockAddToast).not.toHaveBeenCalled()
    })
  })
})
