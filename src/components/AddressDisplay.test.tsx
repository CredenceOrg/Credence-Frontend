import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddressDisplay from './AddressDisplay'
import * as CopyHookModule from '../hooks/useCopyToClipboard'
import * as ToastModule from './ToastProvider'

vi.mock('../hooks/useCopyToClipboard', () => ({
  default: vi.fn(),
}))

vi.mock('./ToastProvider', () => ({
  useToast: vi.fn(),
}))

// Long Stellar address that gets truncated by truncateAddress (first 12 + … + last 8)
const LONG_ADDR = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

// Short address that truncateAddress returns as-is
const SHORT_ADDR = 'GABC'

describe('AddressDisplay', () => {
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

  // --- Rendering ---

  describe('rendering', () => {
    it('renders a truncated address by default for long addresses', () => {
      render(<AddressDisplay address={LONG_ADDR} />)

      const code = screen.getByText((content) => content.includes('...'))
      expect(code).toBeInTheDocument()
      // Should not show the full address
      expect(code.textContent).not.toBe(LONG_ADDR)
    })

    it('renders the full address when it is short enough not to truncate', () => {
      render(<AddressDisplay address={SHORT_ADDR} />)

      expect(screen.getByText(SHORT_ADDR)).toBeInTheDocument()
    })

    it('sets the title attribute to the full address for native tooltips', () => {
      render(<AddressDisplay address={LONG_ADDR} />)

      const code = screen.getByText((content) => content.includes('...'))
      expect(code).toHaveAttribute('title', LONG_ADDR)
    })

    it('renders a copy button by default', () => {
      render(<AddressDisplay address={LONG_ADDR} />)

      expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument()
    })

    it('hides the copy button when showCopyButton is false', () => {
      render(<AddressDisplay address={LONG_ADDR} showCopyButton={false} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('applies a custom className', () => {
      render(<AddressDisplay address={SHORT_ADDR} className="my-custom-class" />)

      const container = screen.getByText(SHORT_ADDR).closest('.address-display')
      expect(container).toHaveClass('my-custom-class')
    })

    it('renders an empty code element when given an empty address', () => {
      const { container } = render(<AddressDisplay address="" />)

      const code = container.querySelector('code.address-display__address')
      expect(code).toBeInTheDocument()
      expect(code?.textContent).toBe('')
      // The copy button should still be present but copy should be a no-op
      expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument()
    })

    it('shows a checkmark icon and updated label when copied state is true', () => {
      vi.mocked(CopyHookModule.default).mockReturnValue({
        copy: mockCopy,
        copied: true,
        reset: vi.fn(),
      })

      render(<AddressDisplay address={LONG_ADDR} />)

      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
      // The checkmark icon is an svg with a polyline
      const btn = screen.getByRole('button', { name: 'Copied' })
      expect(btn.querySelector('svg polyline')).toBeInTheDocument()
    })
  })

  // --- Hover reveals ---

  describe('hover reveals full address', () => {
    it('shows full address on mouse enter and returns to truncated on mouse leave', async () => {
      render(<AddressDisplay address={LONG_ADDR} />)

      const code = screen.getByText((content) => content.includes('...'))
      expect(code.textContent).not.toBe(LONG_ADDR)

      // Hover: full address should be revealed
      fireEvent.mouseEnter(code)
      expect(code.textContent).toBe(LONG_ADDR)

      // Leave: truncated again
      fireEvent.mouseLeave(code)
      expect(code.textContent).not.toBe(LONG_ADDR)
      expect(code.textContent).toContain('...')
    })

    it('keeps full address visible while hovered even after a focus event blurs', async () => {
      render(<AddressDisplay address={LONG_ADDR} />)

      const code = screen.getByText((content) => content.includes('...'))

      // Hover first
      fireEvent.mouseEnter(code)
      expect(code.textContent).toBe(LONG_ADDR)

      // Focus while hovered — still full address
      fireEvent.focus(code)
      expect(code.textContent).toBe(LONG_ADDR)

      // Blur while still hovered — still full address
      fireEvent.blur(code)
      expect(code.textContent).toBe(LONG_ADDR)

      // Leave — truncated again
      fireEvent.mouseLeave(code)
      expect(code.textContent).not.toBe(LONG_ADDR)
    })
  })

  // --- Keyboard focus reveals ---

  describe('keyboard focus reveals full address', () => {
    it('shows full address on focus and returns to truncated on blur', () => {
      render(<AddressDisplay address={LONG_ADDR} />)

      const code = screen.getByText((content) => content.includes('...'))
      expect(code.textContent).not.toBe(LONG_ADDR)

      // Focus via keyboard
      fireEvent.focus(code)
      expect(code.textContent).toBe(LONG_ADDR)

      // Blur: truncated again
      fireEvent.blur(code)
      expect(code.textContent).not.toBe(LONG_ADDR)
      expect(code.textContent).toContain('...')
    })

    it('has tabIndex={0} so the element is keyboard-focusable', () => {
      render(<AddressDisplay address={LONG_ADDR} />)

      const code = screen.getByText((content) => content.includes('...'))
      expect(code).toHaveAttribute('tabindex', '0')
    })

    it('shows full address when focused via keyboard Tab navigation', async () => {
      const user = userEvent.setup()
      render(<AddressDisplay address={LONG_ADDR} />)

      const code = screen.getByText((content) => content.includes('...'))

      // Tab to focus the code element
      await user.tab()
      expect(document.activeElement).toBe(code)
      expect(code.textContent).toBe(LONG_ADDR)

      // Tab away — truncated again
      await user.tab()
      expect(code.textContent).not.toBe(LONG_ADDR)
      expect(code.textContent).toContain('...')
    })
  })

  // --- Right-to-left ---

  describe('right-to-left support', () => {
    it('renders truncated address and reveals full on hover and focus in RTL context', () => {
      render(
        <div dir="rtl">
          <AddressDisplay address={LONG_ADDR} />
        </div>
      )

      const code = screen.getByText((content) => content.includes('...'))
      expect(code).toBeInTheDocument()
      expect(code.textContent).not.toBe(LONG_ADDR)

      // Hover reveals full address in RTL
      fireEvent.mouseEnter(code)
      expect(code.textContent).toBe(LONG_ADDR)
      fireEvent.mouseLeave(code)
      expect(code.textContent).toContain('...')

      // Focus reveals full address in RTL
      fireEvent.focus(code)
      expect(code.textContent).toBe(LONG_ADDR)
      fireEvent.blur(code)
      expect(code.textContent).toContain('...')
    })
  })

  // --- Copy button ---

  describe('copy button', () => {
    it('calls copy with the full address on click', async () => {
      render(<AddressDisplay address={LONG_ADDR} />)

      const btn = screen.getByRole('button', { name: 'Copy address' })
      fireEvent.click(btn)

      expect(mockCopy).toHaveBeenCalledWith(LONG_ADDR)
    })

    it('shows a success toast after a successful copy', async () => {
      mockCopy.mockResolvedValue(true)

      render(<AddressDisplay address={LONG_ADDR} />)

      const btn = screen.getByRole('button', { name: 'Copy address' })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', 'Address copied to clipboard')
      })
    })

    it('does not show a success toast when copy fails', () => {
      mockCopy.mockResolvedValue(false)

      render(<AddressDisplay address={LONG_ADDR} />)

      const btn = screen.getByRole('button', { name: 'Copy address' })
      fireEvent.click(btn)

      expect(mockCopy).toHaveBeenCalledWith(LONG_ADDR)
      expect(mockAddToast).not.toHaveBeenCalled()
    })
  })
})
