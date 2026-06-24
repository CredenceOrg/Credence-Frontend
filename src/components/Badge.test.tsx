import { useRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Banner from './Banner'
import type { BannerSeverity } from './Banner'

// Mock the CSS import so Vitest doesn't choke on it
vi.mock('./Banner.css', () => ({}))

// requestAnimationFrame is used by Banner to defer focus-return until after
// the caller has unmounted the banner. We stub it to invoke synchronously so
// dismiss/focus assertions are deterministic and don't depend on jsdom's
// internal rAF-to-setTimeout shim.
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(((cb: FrameRequestCallback) => {
    cb(0)
    return 0
  }) as typeof window.requestAnimationFrame)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Banner', () => {
  describe('role mapping by severity', () => {
    const URGENT: BannerSeverity[] = ['critical', 'warning']
    const POLITE: BannerSeverity[] = ['info', 'success']

    it.each(URGENT)('%s severity renders role="alert"', (severity) => {
      render(<Banner severity={severity}>Message</Banner>)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.queryByRole('status')).toBeNull()
    })

    it.each(POLITE)('%s severity renders role="status"', (severity) => {
      render(<Banner severity={severity}>Message</Banner>)
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it.each([
      ['info', 'Information banner'],
      ['success', 'Success banner'],
      ['warning', 'Warning banner'],
      ['critical', 'Critical banner'],
    ] as const)('%s severity sets aria-label "%s"', (severity, expectedLabel) => {
      render(<Banner severity={severity}>Message</Banner>)
      expect(screen.getByLabelText(expectedLabel)).toBeInTheDocument()
    })
  })

  describe('severity icon selection', () => {
    // Each severity renders exactly one aria-hidden SVG icon inside the banner
    // (a second aria-hidden SVG — the arrow — only appears when action.href is set,
    // so these assertions scope to the icon wrapper to stay unambiguous).
    it.each(['info', 'success', 'warning', 'critical'] as const)(
      '%s severity renders an aria-hidden icon',
      (severity) => {
        render(<Banner severity={severity}>Message</Banner>)
        const region = screen.getByRole(severity === 'critical' || severity === 'warning' ? 'alert' : 'status')
        const icon = region.querySelector('svg[aria-hidden="true"]')
        expect(icon).not.toBeNull()
        expect(icon).toHaveAttribute('aria-hidden', 'true')
      }
    )

    it('renders a different icon path for each severity', () => {
      const paths = (['info', 'success', 'warning', 'critical'] as const).map((severity) => {
        const { unmount } = render(<Banner severity={severity}>Message</Banner>)
        const region = screen.getByRole(severity === 'critical' || severity === 'warning' ? 'alert' : 'status')
        const path = region.querySelector('svg[aria-hidden="true"] path')?.getAttribute('d')
        unmount()
        return path
      })
      // All four severity icons must be visually distinct
      expect(new Set(paths).size).toBe(4)
    })
  })

  describe('action prop', () => {
    it('renders a link when action.href is provided', () => {
      render(
        <Banner severity="info" action={{ label: 'Learn more', href: 'https://example.com/docs' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: 'Learn more' })
      expect(link).toHaveAttribute('href', 'https://example.com/docs')
      expect(screen.queryByRole('button', { name: 'Learn more' })).toBeNull()
    })

    it('renders a button when action.onClick is provided (no href)', () => {
      const onActionClick = vi.fn()
      render(
        <Banner severity="info" action={{ label: 'Retry', onClick: onActionClick }}>
          Message
        </Banner>
      )
      const button = screen.getByRole('button', { name: 'Retry' })
      expect(screen.queryByRole('link', { name: 'Retry' })).toBeNull()

      fireEvent.click(button)
      expect(onActionClick).toHaveBeenCalledTimes(1)
    })

    it('renders a link, not a button, when both href and onClick are provided (href wins)', () => {
      const onActionClick = vi.fn()
      render(
        <Banner
          severity="info"
          action={{ label: 'Go', href: 'https://example.com', onClick: onActionClick }}
        >
          Message
        </Banner>
      )
      expect(screen.getByRole('link', { name: 'Go' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Go' })).toBeNull()
    })

    it('renders no action element when action is omitted', () => {
      render(<Banner severity="info">Message</Banner>)
      expect(screen.queryByRole('link')).toBeNull()
      // Only the dismiss button could be a 'button'; this banner is not dismissible,
      // so there should be no buttons at all.
      expect(screen.queryByRole('button')).toBeNull()
    })
  })

  describe('title rendering', () => {
    it('renders the title when provided', () => {
      render(
        <Banner severity="info" title="Heads up">
          Message body
        </Banner>
      )
      expect(screen.getByText('Heads up')).toBeInTheDocument()
      expect(screen.getByText('Message body')).toBeInTheDocument()
    })

    it('renders no title element when omitted', () => {
      render(<Banner severity="info">Message body</Banner>)
      expect(screen.queryByText('Heads up')).toBeNull()
    })
  })

  describe('dismissible behavior', () => {
    it('persistent banner (dismissible omitted) has no close button', () => {
      render(<Banner severity="info">Message</Banner>)
      expect(screen.queryByRole('button', { name: 'Dismiss banner' })).toBeNull()
    })

    it('persistent banner (dismissible=false) has no close button', () => {
      render(
        <Banner severity="info" dismissible={false}>
          Message
        </Banner>
      )
      expect(screen.queryByRole('button', { name: 'Dismiss banner' })).toBeNull()
    })

    it('dismissible banner renders a close button', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      expect(screen.getByRole('button', { name: 'Dismiss banner' })).toBeInTheDocument()
    })

    it('clicking the close button calls onDismiss', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="info" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('Escape on the close button calls onDismiss', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="info" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )
      const closeBtn = screen.getByRole('button', { name: 'Dismiss banner' })
      closeBtn.focus()
      fireEvent.keyDown(closeBtn, { key: 'Escape' })
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('a non-Escape key on the close button does not dismiss', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="info" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )
      const closeBtn = screen.getByRole('button', { name: 'Dismiss banner' })
      closeBtn.focus()
      fireEvent.keyDown(closeBtn, { key: 'Enter' })
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('dismissing via click returns focus to returnFocusRef when provided', () => {
      function Harness() {
        const ref = useRef<HTMLButtonElement>(null)
        return (
          <>
            <button ref={ref} type="button">
              Trigger
            </button>
            <Banner severity="info" dismissible returnFocusRef={ref}>
              Message
            </Banner>
          </>
        )
      }
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      expect(screen.getByRole('button', { name: 'Trigger' })).toHaveFocus()
    })

    it('dismissing via Escape returns focus to returnFocusRef when provided', () => {
      function Harness() {
        const ref = useRef<HTMLButtonElement>(null)
        return (
          <>
            <button ref={ref} type="button">
              Trigger
            </button>
            <Banner severity="info" dismissible returnFocusRef={ref}>
              Message
            </Banner>
          </>
        )
      }
      render(<Harness />)
      const closeBtn = screen.getByRole('button', { name: 'Dismiss banner' })
      closeBtn.focus()
      fireEvent.keyDown(closeBtn, { key: 'Escape' })
      expect(screen.getByRole('button', { name: 'Trigger' })).toHaveFocus()
    })

    it('dismissing returns focus to document.body when returnFocusRef is not provided', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      expect(document.body).toHaveFocus()
    })

    it('dismissing returns focus to document.body when returnFocusRef.current is null', () => {
      const nullRef = { current: null }
      render(
        <Banner severity="info" dismissible returnFocusRef={nullRef as React.RefObject<HTMLElement>}>
          Message
        </Banner>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      expect(document.body).toHaveFocus()
    })

    it('dismiss works even when onDismiss is not provided (focus still returns)', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      // Should not throw despite no onDismiss handler
      expect(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      }).not.toThrow()
      expect(document.body).toHaveFocus()
    })
  })
})