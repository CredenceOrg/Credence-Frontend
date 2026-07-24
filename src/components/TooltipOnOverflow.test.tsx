import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import TooltipOnOverflow from './TooltipOnOverflow'

vi.mock('./TooltipOnOverflow.css', () => ({}))
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

// Mock rAF for synchronous execution in jsdom test environment.
// TooltipOnOverflow uses rAF to debounce ResizeObserver callbacks.
vi.stubGlobal(
  'requestAnimationFrame',
  vi.fn((cb: FrameRequestCallback) => {
    cb(0)
    return 1
  }),
)
vi.stubGlobal('cancelAnimationFrame', vi.fn())

// Intercept document.createElement to inject scrollWidth/offsetWidth
// directly on instance — jsdom sets these as instance data properties
// that shadow prototype getters.
const originalCreateElement = document.createElement.bind(document)

function stubCreateElement(scroll: number, offset: number) {
  vi.spyOn(document, 'createElement').mockImplementation(
    (tagName: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tagName, options)
      Object.defineProperties(el, {
        scrollWidth: { configurable: true, get: () => scroll },
        offsetWidth: { configurable: true, get: () => offset },
      })
      return el
    },
  )
}

const OVERFLOWING = { scroll: 200, offset: 100 }
const NOT_OVERFLOWING = { scroll: 100, offset: 100 }

describe('TooltipOnOverflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Rendering ─────────────────────────────────────────────────────────
  it('renders the child element', () => {
    stubCreateElement(NOT_OVERFLOWING.scroll, NOT_OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full tooltip content">
        <span data-testid="child">Short</span>
      </TooltipOnOverflow>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders the child with its original text', () => {
    stubCreateElement(NOT_OVERFLOWING.scroll, NOT_OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full tooltip content">
        <span>Hello World</span>
      </TooltipOnOverflow>,
    )
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  // ── Overflow detection ────────────────────────────────────────────────
  it('does not render the tooltip when content is not overflowing', async () => {
    stubCreateElement(NOT_OVERFLOWING.scroll, NOT_OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Not needed">
        <span>Short text</span>
      </TooltipOnOverflow>,
    )
    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument()
    })
  })

  it('renders the tooltip when content is overflowing (hidden until hover/focus)', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="This is the full long text that overflows">
        <span>Truncated...</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip', { hidden: true })
      expect(tooltip).toBeInTheDocument()
      expect(tooltip).toHaveAttribute('aria-hidden', 'true')
    })
  })

  // ── Tooltip visibility ────────────────────────────────────────────────
  it('shows tooltip on mouse enter when overflowing', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text here">
        <span data-testid="child">Truncated...</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { hidden: true })).toBeInTheDocument()
    })

    const child = screen.getByTestId('child')
    const tooltip = screen.getByRole('tooltip', { hidden: true })

    fireEvent.mouseEnter(child)
    expect(tooltip).toHaveAttribute('aria-hidden', 'false')
  })

  it('hides tooltip on mouse leave', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text here">
        <span data-testid="child">Truncated...</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { hidden: true })).toBeInTheDocument()
    })

    const child = screen.getByTestId('child')
    const tooltip = screen.getByRole('tooltip', { hidden: true })

    fireEvent.mouseEnter(child)
    expect(tooltip).toHaveAttribute('aria-hidden', 'false')

    fireEvent.mouseLeave(child)
    expect(tooltip).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows tooltip on focus when overflowing', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text here">
        <span data-testid="child" tabIndex={0}>
          Truncated...
        </span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { hidden: true })).toBeInTheDocument()
    })

    const child = screen.getByTestId('child')
    const tooltip = screen.getByRole('tooltip', { hidden: true })

    fireEvent.focus(child)
    expect(tooltip).toHaveAttribute('aria-hidden', 'false')
  })

  it('hides tooltip on blur', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text here">
        <span data-testid="child" tabIndex={0}>
          Truncated...
        </span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { hidden: true })).toBeInTheDocument()
    })

    const child = screen.getByTestId('child')
    const tooltip = screen.getByRole('tooltip', { hidden: true })

    fireEvent.focus(child)
    expect(tooltip).toHaveAttribute('aria-hidden', 'false')

    fireEvent.blur(child)
    expect(tooltip).toHaveAttribute('aria-hidden', 'true')
  })

  // ── Keyboard: Escape ──────────────────────────────────────────────────
  it('hides tooltip on Escape key when focused and visible', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text here">
        <span data-testid="child" tabIndex={0}>
          Truncated...
        </span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { hidden: true })).toBeInTheDocument()
    })

    const child = screen.getByTestId('child')
    const tooltip = screen.getByRole('tooltip', { hidden: true })

    fireEvent.focus(child)
    expect(tooltip).toHaveAttribute('aria-hidden', 'false')

    fireEvent.keyDown(child, { key: 'Escape' })
    expect(tooltip).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not hide tooltip on non-Escape key', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text here">
        <span data-testid="child" tabIndex={0}>
          Truncated...
        </span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { hidden: true })).toBeInTheDocument()
    })

    const child = screen.getByTestId('child')
    const tooltip = screen.getByRole('tooltip', { hidden: true })

    fireEvent.focus(child)
    expect(tooltip).toHaveAttribute('aria-hidden', 'false')

    fireEvent.keyDown(child, { key: 'Enter' })
    expect(tooltip).toHaveAttribute('aria-hidden', 'false')
  })

  // ── ARIA attributes ───────────────────────────────────────────────────
  it('sets aria-describedby on the child when overflowing', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text here">
        <span data-testid="child">Truncated...</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('child')).toHaveAttribute('aria-describedby')
    })
  })

  it('does not set aria-describedby when not overflowing', async () => {
    stubCreateElement(NOT_OVERFLOWING.scroll, NOT_OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Not needed">
        <span data-testid="child">Short</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('child')).not.toHaveAttribute('aria-describedby')
    })
  })

  it('tooltip has role="tooltip" and correct content', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text here">
        <span>Truncated...</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip', { hidden: true })
      expect(tooltip).toHaveTextContent('Full text here')
    })
  })

  // ── Position classes ──────────────────────────────────────────────────
  it('renders tooltip with position class', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text here">
        <span>Truncated...</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip', { hidden: true })
      expect(
        tooltip.className.includes('tooltip-on-overflow__tooltip--top') ||
          tooltip.className.includes('tooltip-on-overflow__tooltip--bottom'),
      ).toBe(true)
    })
  })

  // ── className prop ────────────────────────────────────────────────────
  it('appends className to the tooltip element', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text" className="my-custom-tooltip">
        <span>Truncated...</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip', { hidden: true })
      expect(tooltip.className).toContain('my-custom-tooltip')
    })
  })

  // ── Reduced motion ────────────────────────────────────────────────────
  it('does not set data-reduced-motion when reduced motion is false', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text">
        <span>Truncated...</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip', { hidden: true })
      expect(tooltip).not.toHaveAttribute('data-reduced-motion')
    })
  })

  // ── Empty content ─────────────────────────────────────────────────────
  it('renders tooltip with empty string content', async () => {
    stubCreateElement(OVERFLOWING.scroll, OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="">
        <span>Truncated...</span>
      </TooltipOnOverflow>,
    )

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip', { hidden: true })
      expect(tooltip).toHaveTextContent('')
    })
  })

  // ── Wrapper element ───────────────────────────────────────────────────
  it('renders a wrapper span around the child', () => {
    stubCreateElement(NOT_OVERFLOWING.scroll, NOT_OVERFLOWING.offset)
    render(
      <TooltipOnOverflow content="Full text">
        <span data-testid="child">Truncated...</span>
      </TooltipOnOverflow>,
    )

    const wrapper = screen.getByTestId('child').parentElement
    expect(wrapper).toHaveClass('tooltip-on-overflow__wrapper')
  })
})
