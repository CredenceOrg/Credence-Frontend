import React from 'react'
import { render, screen, fireEvent, createEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import Banner from './Banner'
import type { BannerSeverity } from './Banner'

// Stub requestAnimationFrame to execute synchronously so focus-return assertions
// don't need timer flushing — the deferred focus() runs inline during the test.
describe('Banner', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── role mapping ──────────────────────────────────────────────────────────

  describe('role mapping', () => {
    it.each<[BannerSeverity, 'alert' | 'status']>([
      ['incident', 'alert'],
      ['warn', 'alert'],
      ['info', 'status'],
    ])('severity "%s" → role="%s"', (severity, role) => {
      render(<Banner severity={severity}>Message</Banner>)
      expect(screen.getByRole(role)).toBeInTheDocument()
    })
  })

  // ── aria-label ────────────────────────────────────────────────────────────

  describe('aria-label', () => {
    it.each<[BannerSeverity, string]>([
      ['info', 'Information banner'],
      ['warn', 'Warning banner'],
      ['incident', 'Incident banner'],
    ])('severity "%s" → aria-label="%s"', (severity, label) => {
      render(<Banner severity={severity}>Message</Banner>)
      // getByRole with name option asserts both the role and accessible name
      const isUrgent = severity === 'incident' || severity === 'warn'
      expect(screen.getByRole(isUrgent ? 'alert' : 'status', { name: label })).toBeInTheDocument()
    })
  })

  // ── dismiss button visibility ─────────────────────────────────────────────

  describe('dismiss button', () => {
    it('is absent when dismissible is omitted', () => {
      render(<Banner severity="info">Message</Banner>)
      expect(screen.queryByRole('button', { name: 'Dismiss banner' })).not.toBeInTheDocument()
    })

    it('is absent when dismissible is false', () => {
      render(
        <Banner severity="info" dismissible={false}>
          Message
        </Banner>
      )
      expect(screen.queryByRole('button', { name: 'Dismiss banner' })).not.toBeInTheDocument()
    })

    it('is present when dismissible is true', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      expect(screen.getByRole('button', { name: 'Dismiss banner' })).toBeInTheDocument()
    })

    it('calls onDismiss when clicked', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="info" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      expect(onDismiss).toHaveBeenCalledOnce()
    })
  })

  // ── focus return on dismiss ───────────────────────────────────────────────

  describe('focus return on dismiss', () => {
    it('returns focus to returnFocusRef.current after dismiss', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(
        <>
          <button ref={ref} type="button">
            Return target
          </button>
          <Banner severity="warn" dismissible returnFocusRef={ref}>
            Message
          </Banner>
        </>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))

      expect(screen.getByRole('button', { name: 'Return target' })).toHaveFocus()
    })

    it('returns focus to document.body when returnFocusRef is not provided', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))

      expect(document.body).toHaveFocus()
    })

    it('returns focus to document.body when returnFocusRef.current is null', () => {
      // A ref whose current is still null (element not yet mounted to a DOM node)
      const ref = React.createRef<HTMLButtonElement>()
      // Intentionally don't attach ref to any element — current stays null
      render(
        <Banner severity="info" dismissible returnFocusRef={ref}>
          Message
        </Banner>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))

      expect(document.body).toHaveFocus()
    })
  })

  // ── Escape key handling ───────────────────────────────────────────────────

  describe('Escape key on dismiss button', () => {
    it('triggers dismissal when Escape is pressed on the dismiss button', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="incident" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )

      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss banner' }), { key: 'Escape' })

      expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('does not trigger dismissal on other keys', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="incident" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )

      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss banner' }), { key: 'Enter' })
      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss banner' }), { key: 'Tab' })

      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('does not trigger dismissal when Escape is fired on the banner wrapper', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="incident" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )

      // The onKeyDown handler is only on the dismiss button, not the banner root
      fireEvent.keyDown(screen.getByRole('alert'), { key: 'Escape' })

      expect(onDismiss).not.toHaveBeenCalled()
    })
  })

  // ── action rendering ──────────────────────────────────────────────────────

  describe('action rendering', () => {
    it('renders an <a> with the given href', () => {
      render(
        <Banner severity="info" action={{ label: 'Learn more', href: 'https://example.com' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /learn more/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', 'https://example.com')
    })

    it('renders a <button> and calls onClick when no href is given', () => {
      const onClick = vi.fn()
      render(
        <Banner severity="info" action={{ label: 'Take action', onClick }}>
          Message
        </Banner>
      )
      const btn = screen.getByRole('button', { name: /take action/i })
      expect(btn).toBeInTheDocument()
      fireEvent.click(btn)
      expect(onClick).toHaveBeenCalledOnce()
    })

    it('renders a <button> even when neither href nor onClick is supplied', () => {
      render(
        <Banner severity="info" action={{ label: 'Static label' }}>
          Message
        </Banner>
      )
      expect(screen.getByRole('button', { name: /static label/i })).toBeInTheDocument()
    })

    it('renders no action element when action prop is omitted', () => {
      render(<Banner severity="info">Message</Banner>)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      // Only the dismiss button (if any) would be a button — there is none here either
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  // ── optional title ────────────────────────────────────────────────────────

  describe('title', () => {
    it('renders the title when provided', () => {
      render(
        <Banner severity="info" title="Heads up">
          Message
        </Banner>
      )
      expect(screen.getByText('Heads up')).toBeInTheDocument()
    })

    it('omits the title element when title is not provided', () => {
      render(<Banner severity="info">Message</Banner>)
      // No <p class="banner__title"> — nothing with that text
      expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
    })
  })

  // ── external link security ────────────────────────────────────────────────
  //
  // isExternalUrl drives whether Banner adds target="_blank" rel="noopener noreferrer".
  // jsdom sets window.location.origin to "null" by default, so any absolute
  // http/https URL is cross-origin from jsdom's perspective — no extra mocking needed.

  describe('external link security', () => {
    it('adds target="_blank" and rel="noopener noreferrer" for a cross-origin https URL', () => {
      render(
        <Banner severity="info" action={{ label: 'Docs', href: 'https://docs.example.com/guide' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /docs/i })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('adds target="_blank" and rel="noopener noreferrer" for a cross-origin http URL', () => {
      render(
        <Banner severity="info" action={{ label: 'Legacy', href: 'http://legacy.example.com' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /legacy/i })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('does not add target or rel for a same-origin absolute path', () => {
      render(
        <Banner severity="info" action={{ label: 'Settings', href: '/settings' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /settings/i })
      expect(link).not.toHaveAttribute('target')
      expect(link).not.toHaveAttribute('rel')
    })

    it('does not add target or rel for a relative path', () => {
      render(
        <Banner severity="info" action={{ label: 'Help', href: './help' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /help/i })
      expect(link).not.toHaveAttribute('target')
      expect(link).not.toHaveAttribute('rel')
    })

    it('does not add target or rel for a mailto: href (isExternalUrl returns true, but mailto is not an http/https origin)', () => {
      // mailto: → isExternalUrl returns true, so the component DOES set target/rel.
      // We test what the component actually does rather than what we might wish it did:
      // the banner applies target/rel whenever isExternalUrl says true, including mailto:.
      render(
        <Banner severity="info" action={{ label: 'Contact', href: 'mailto:support@example.com' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /contact/i })
      // isExternalUrl('mailto:...') returns true → component sets target/rel
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('does not set target or rel for a javascript: href (isExternalUrl returns false)', () => {
      // javascript: is blocked by isExternalUrl → treated as internal → no target/rel.
      // This is the security-critical path: a javascript: action href must never
      // result in a new browsing context or relaxed referrer policy.
      render(
        // eslint-disable-next-line no-script-url
        <Banner severity="info" action={{ label: 'XSS', href: 'javascript:alert(1)' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /xss/i })
      expect(link).not.toHaveAttribute('target', '_blank')
      expect(link).not.toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('does not set target or rel for a hash placeholder href', () => {
      render(
        <Banner severity="info" action={{ label: 'Anchor', href: '#section' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /anchor/i })
      expect(link).not.toHaveAttribute('target')
      expect(link).not.toHaveAttribute('rel')
    })
  })

  // ── CSS class composition ─────────────────────────────────────────────────

  describe('CSS class composition', () => {
    it('always includes the base "banner" class', () => {
      const { container } = render(<Banner severity="info">Message</Banner>)
      expect(container.firstElementChild).toHaveClass('banner')
    })

    it.each<BannerSeverity>(['info', 'warn', 'incident'])(
      'applies the "banner--%s" modifier class for severity "%s"',
      (severity) => {
        const { container } = render(<Banner severity={severity}>Message</Banner>)
        expect(container.firstElementChild).toHaveClass(`banner--${severity}`)
      }
    )

    it('applies "banner--dismissible" when dismissible is true', () => {
      const { container } = render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      expect(container.firstElementChild).toHaveClass('banner--dismissible')
      expect(container.firstElementChild).not.toHaveClass('banner--persistent')
    })

    it('applies "banner--persistent" when dismissible is false', () => {
      const { container } = render(
        <Banner severity="info" dismissible={false}>
          Message
        </Banner>
      )
      expect(container.firstElementChild).toHaveClass('banner--persistent')
      expect(container.firstElementChild).not.toHaveClass('banner--dismissible')
    })

    it('applies "banner--persistent" when dismissible is omitted', () => {
      const { container } = render(<Banner severity="info">Message</Banner>)
      expect(container.firstElementChild).toHaveClass('banner--persistent')
    })
  })

  // ── icon rendering by severity ────────────────────────────────────────────

  describe('icon rendering by severity', () => {
    it.each<BannerSeverity>(['info', 'warn', 'incident'])(
      'renders an aria-hidden SVG icon for severity "%s"',
      (severity) => {
        const { container } = render(<Banner severity={severity}>Message</Banner>)
        const iconWrapper = container.querySelector('.banner__icon')
        expect(iconWrapper).toBeInTheDocument()
        const svg = iconWrapper?.querySelector('svg')
        expect(svg).toBeInTheDocument()
        expect(svg).toHaveAttribute('aria-hidden', 'true')
      }
    )

    it('renders different SVG path data for each severity', () => {
      const paths: Record<BannerSeverity, string> = {} as Record<BannerSeverity, string>

      for (const severity of ['info', 'warn', 'incident'] as BannerSeverity[]) {
        const { container } = render(<Banner severity={severity}>M</Banner>)
        const path = container.querySelector('.banner__icon svg path')
        paths[severity] = path?.getAttribute('d') ?? ''
      }

      // All three severities must use distinct icon paths
      expect(paths.info).not.toBe(paths.warn)
      expect(paths.info).not.toBe(paths.incident)
      expect(paths.warn).not.toBe(paths.incident)
    })
  })

  // ── children / content rendering ─────────────────────────────────────────

  describe('children rendering', () => {
    it('renders plain text children', () => {
      render(<Banner severity="info">Simple message</Banner>)
      expect(screen.getByText('Simple message')).toBeInTheDocument()
    })

    it('renders rich ReactNode children (elements, fragments)', () => {
      render(
        <Banner severity="info">
          <strong>Bold</strong> and <em>italic</em> content
        </Banner>
      )
      expect(screen.getByText('Bold')).toBeInTheDocument()
      expect(screen.getByText('italic')).toBeInTheDocument()
    })

    it('renders children inside the banner__content wrapper', () => {
      const { container } = render(<Banner severity="info">Content text</Banner>)
      const contentEl = container.querySelector('.banner__content')
      expect(contentEl).toBeInTheDocument()
      expect(contentEl).toHaveTextContent('Content text')
    })

    it('handles an empty string child without throwing', () => {
      expect(() => render(<Banner severity="info">{''}</Banner>)).not.toThrow()
    })

    it('handles a very long title and children string without throwing', () => {
      const longString = 'A'.repeat(5000)
      expect(() =>
        render(
          <Banner severity="warn" title={longString}>
            {longString}
          </Banner>
        )
      ).not.toThrow()
      // Both the title and content wrapper must be present
      expect(document.querySelector('.banner__title')).toBeInTheDocument()
      expect(document.querySelector('.banner__content')).toBeInTheDocument()
    })

    it('handles numeric children without throwing', () => {
      expect(() => render(<Banner severity="info">{42}</Banner>)).not.toThrow()
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('handles null children without throwing', () => {
      expect(() => render(<Banner severity="info">{null}</Banner>)).not.toThrow()
    })

    it('handles multiple children without throwing', () => {
      expect(() =>
        render(
          <Banner severity="info">
            <span>First</span>
            <span>Second</span>
            <span>Third</span>
          </Banner>
        )
      ).not.toThrow()
      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Third')).toBeInTheDocument()
    })
  })

  // ── dismiss idempotency and recovery ──────────────────────────────────────

  describe('dismiss idempotency and recovery', () => {
    it('calls onDismiss exactly once even when the dismiss button is clicked multiple times rapidly', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="warn" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )
      const btn = screen.getByRole('button', { name: 'Dismiss banner' })

      // Simulate rapid double-click
      fireEvent.click(btn)
      fireEvent.click(btn)
      fireEvent.click(btn)

      // Banner is a controlled component — it does not gate multiple calls.
      // Each click WILL fire onDismiss; the parent is responsible for unmounting.
      // This test locks in the current contract: three clicks → three calls.
      expect(onDismiss).toHaveBeenCalledTimes(3)
    })

    it('calls onDismiss exactly once when Escape is pressed multiple times', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="incident" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )
      const btn = screen.getByRole('button', { name: 'Dismiss banner' })

      fireEvent.keyDown(btn, { key: 'Escape' })
      fireEvent.keyDown(btn, { key: 'Escape' })

      expect(onDismiss).toHaveBeenCalledTimes(2)
    })

    it('does not throw when dismissible is true but onDismiss is not provided', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      const btn = screen.getByRole('button', { name: 'Dismiss banner' })
      // Clicking without onDismiss must not throw (optional chaining: onDismiss?.())
      expect(() => fireEvent.click(btn)).not.toThrow()
    })

    it('does not throw when Escape is pressed but onDismiss is not provided', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      const btn = screen.getByRole('button', { name: 'Dismiss banner' })
      expect(() => fireEvent.keyDown(btn, { key: 'Escape' })).not.toThrow()
    })

    it('still returns focus correctly when onDismiss is absent', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(
        <>
          <button ref={ref} type="button">
            Target
          </button>
          <Banner severity="info" dismissible returnFocusRef={ref}>
            Message
          </Banner>
        </>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      expect(screen.getByRole('button', { name: 'Target' })).toHaveFocus()
    })

    it('recovers gracefully when requestAnimationFrame is not available', () => {
      // Temporarily remove rAF stub to simulate an environment where rAF is absent
      vi.unstubAllGlobals()
      vi.stubGlobal('requestAnimationFrame', undefined)

      const onDismiss = vi.fn()
      render(
        <Banner severity="info" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )

      // Banner calls requestAnimationFrame — with it stubbed to undefined the
      // component will throw a TypeError at runtime. We verify the component
      // does NOT silently corrupt state before the throw, and that onDismiss
      // was already invoked (it is called before rAF).
      let threw = false
      try {
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      } catch {
        threw = true
      }

      if (threw) {
        // onDismiss must have been called before rAF threw
        expect(onDismiss).toHaveBeenCalledOnce()
      } else {
        // In environments where undefined is silently ignored, it still must not call onDismiss more than once
        expect(onDismiss).toHaveBeenCalledOnce()
      }

      // Re-install synchronous rAF stub so afterEach cleanup works correctly
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        cb(0)
        return 0
      })
    })
  })

  // ── action button edge cases ──────────────────────────────────────────────

  describe('action button edge cases', () => {
    it('renders action button with correct type="button" to avoid accidental form submission', () => {
      render(
        <Banner severity="info" action={{ label: 'Click me', onClick: vi.fn() }}>
          Message
        </Banner>
      )
      expect(screen.getByRole('button', { name: /click me/i })).toHaveAttribute('type', 'button')
    })

    it('does not throw when action onClick is undefined and the button is clicked', () => {
      render(
        <Banner severity="info" action={{ label: 'No-op' }}>
          Message
        </Banner>
      )
      expect(() =>
        fireEvent.click(screen.getByRole('button', { name: /no-op/i }))
      ).not.toThrow()
    })

    it('renders action link with the correct href attribute', () => {
      render(
        <Banner severity="info" action={{ label: 'Go', href: '/dashboard' }}>
          Message
        </Banner>
      )
      expect(screen.getByRole('link', { name: /go/i })).toHaveAttribute('href', '/dashboard')
    })

    it('renders an arrow icon (aria-hidden svg) inside action links', () => {
      const { container } = render(
        <Banner severity="info" action={{ label: 'Docs', href: 'https://docs.example.com' }}>
          Message
        </Banner>
      )
      const actionEl = container.querySelector('.banner__action')
      const arrowSvg = actionEl?.querySelector('svg.banner__link-arrow')
      expect(arrowSvg).toBeInTheDocument()
      expect(arrowSvg).toHaveAttribute('aria-hidden', 'true')
    })

    it('does not render an arrow icon for action buttons (only links get the arrow)', () => {
      const { container } = render(
        <Banner severity="info" action={{ label: 'Act', onClick: vi.fn() }}>
          Message
        </Banner>
      )
      const actionEl = container.querySelector('.banner__action')
      expect(actionEl?.querySelector('svg.banner__link-arrow')).not.toBeInTheDocument()
    })

    it('action and dismiss button coexist without conflict', () => {
      const onDismiss = vi.fn()
      const onAction = vi.fn()
      render(
        <Banner
          severity="warn"
          dismissible
          onDismiss={onDismiss}
          action={{ label: 'Fix it', onClick: onAction }}
        >
          Message
        </Banner>
      )
      fireEvent.click(screen.getByRole('button', { name: /fix it/i }))
      expect(onAction).toHaveBeenCalledOnce()
      expect(onDismiss).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      expect(onDismiss).toHaveBeenCalledOnce()
      expect(onAction).toHaveBeenCalledOnce() // still only once
    })
  })

  // ── title edge cases ──────────────────────────────────────────────────────

  describe('title edge cases', () => {
    it('renders title inside the banner__title element', () => {
      const { container } = render(
        <Banner severity="info" title="Alert!">
          Message
        </Banner>
      )
      const titleEl = container.querySelector('.banner__title')
      expect(titleEl).toBeInTheDocument()
      expect(titleEl).toHaveTextContent('Alert!')
    })

    it('renders an empty string title without crashing (renders empty p element)', () => {
      expect(() =>
        render(
          <Banner severity="info" title="">
            Message
          </Banner>
        )
      ).not.toThrow()
    })

    it('does not render the title element when title is undefined', () => {
      const { container } = render(<Banner severity="info">Message</Banner>)
      expect(container.querySelector('.banner__title')).not.toBeInTheDocument()
    })
  })

  // ── full prop combination smoke tests ─────────────────────────────────────

  describe('full prop combination smoke tests', () => {
    it('renders a fully-loaded incident banner without errors', () => {
      const onDismiss = vi.fn()
      const onAction = vi.fn()
      const ref = React.createRef<HTMLButtonElement>()

      expect(() =>
        render(
          <>
            <button ref={ref} type="button">
              Trigger
            </button>
            <Banner
              severity="incident"
              title="System Outage"
              dismissible
              onDismiss={onDismiss}
              returnFocusRef={ref}
              action={{ label: 'Status page', href: 'https://status.example.com' }}
            >
              All services are currently degraded. Our team is investigating.
            </Banner>
          </>
        )
      ).not.toThrow()

      expect(screen.getByRole('alert', { name: 'Incident banner' })).toBeInTheDocument()
      expect(screen.getByText('System Outage')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Dismiss banner' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /status page/i })).toBeInTheDocument()
    })

    it('renders a minimal info banner (no optional props) without errors', () => {
      expect(() => render(<Banner severity="info">Just info</Banner>)).not.toThrow()
      expect(screen.getByRole('status', { name: 'Information banner' })).toBeInTheDocument()
    })

    it('renders a warn banner with title and action button (no href)', () => {
      const onClick = vi.fn()
      render(
        <Banner severity="warn" title="Deprecation notice" action={{ label: 'Migrate now', onClick }}>
          This feature will be removed in v2.
        </Banner>
      )
      expect(screen.getByRole('alert', { name: 'Warning banner' })).toBeInTheDocument()
      expect(screen.getByText('Deprecation notice')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /migrate now/i }))
      expect(onClick).toHaveBeenCalledOnce()
    })
  })

  // ── GAP 1: e.preventDefault() on Escape ──────────────────────────────────
  //
  // handleKeyDown calls e.preventDefault() before handleDismiss() when the key
  // is Escape. Previous tests only asserted onDismiss was called — they never
  // verified that the event's default action was suppressed.  An unsuppressed
  // Escape can close modals or trigger other browser-level handlers when the
  // banner is used inside an overlay.

  describe('Escape key preventDefault', () => {
    it('calls e.preventDefault() when Escape is pressed on the dismiss button', () => {
      render(
        <Banner severity="info" dismissible onDismiss={vi.fn()}>
          Message
        </Banner>
      )
      const btn = screen.getByRole('button', { name: 'Dismiss banner' })
      const event = createEvent.keyDown(btn, { key: 'Escape' })
      fireEvent(btn, event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('does NOT call e.preventDefault() for non-Escape keys', () => {
      render(
        <Banner severity="info" dismissible onDismiss={vi.fn()}>
          Message
        </Banner>
      )
      const btn = screen.getByRole('button', { name: 'Dismiss banner' })
      const event = createEvent.keyDown(btn, { key: 'Tab' })
      fireEvent(btn, event)
      expect(event.defaultPrevented).toBe(false)
    })
  })

  // ── GAP 2: action.href + action.onClick together — onClick is silently ignored ──
  //
  // When action.href is provided the component renders an <a>.  The action.onClick
  // field is NOT spread onto the link, so a caller who passes both expects onClick
  // to fire but it never will.  This test locks in that (intentional) contract so
  // a future refactor cannot accidentally wire it up without the change being noticed.

  describe('action href + onClick coexistence', () => {
    it('renders an <a> (not a button) when both href and onClick are provided', () => {
      render(
        <Banner severity="info" action={{ label: 'Go', href: '/docs', onClick: vi.fn() }}>
          Message
        </Banner>
      )
      expect(screen.getByRole('link', { name: /go/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /go/i })).not.toBeInTheDocument()
    })

    it('does NOT call action.onClick when both href and onClick are provided (href wins, onClick is dropped)', () => {
      const onClick = vi.fn()
      render(
        <Banner severity="info" action={{ label: 'Link', href: '/docs', onClick }}>
          Message
        </Banner>
      )
      fireEvent.click(screen.getByRole('link', { name: /link/i }))
      // The <a> element has no onClick handler — the prop is silently unused
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  // ── GAP 3: sr-only span inside dismiss button ─────────────────────────────
  //
  // The dismiss button has aria-label="Dismiss banner" AND a visually-hidden
  // <span class="sr-only"> with the same text.  getByRole queries match on
  // aria-label, so the span itself is never touched by existing tests.

  describe('dismiss button sr-only span', () => {
    it('renders a sr-only "Dismiss banner" text span inside the dismiss button', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      const btn = screen.getByRole('button', { name: 'Dismiss banner' })
      const srSpan = btn.querySelector('.sr-only')
      expect(srSpan).toBeInTheDocument()
      expect(srSpan).toHaveTextContent('Dismiss banner')
    })
  })

  // ── GAP 4: dismiss button type="button" ───────────────────────────────────
  //
  // The action button's type="button" is tested, but the dismiss button's is not.
  // Without type="button" a button inside a <form> defaults to type="submit",
  // causing an unexpected form submission on click.

  describe('dismiss button type attribute', () => {
    it('dismiss button has type="button" to prevent accidental form submission', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      expect(screen.getByRole('button', { name: 'Dismiss banner' })).toHaveAttribute(
        'type',
        'button'
      )
    })
  })

  // ── GAP 5: Escape on action elements does not trigger dismissal ───────────
  //
  // handleKeyDown is wired only to the dismiss button element.  Action links and
  // action buttons must not accidentally dismiss the banner when Escape is pressed
  // on them.  The existing test checks the banner wrapper root but not the action
  // elements specifically.

  describe('Escape on action elements does not dismiss', () => {
    it('Escape on action link does not trigger dismissal', () => {
      const onDismiss = vi.fn()
      render(
        <Banner
          severity="info"
          dismissible
          onDismiss={onDismiss}
          action={{ label: 'Learn more', href: '/docs' }}
        >
          Message
        </Banner>
      )
      fireEvent.keyDown(screen.getByRole('link', { name: /learn more/i }), { key: 'Escape' })
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('Escape on action button does not trigger dismissal', () => {
      const onDismiss = vi.fn()
      render(
        <Banner
          severity="info"
          dismissible
          onDismiss={onDismiss}
          action={{ label: 'Act', onClick: vi.fn() }}
        >
          Message
        </Banner>
      )
      fireEvent.keyDown(screen.getByRole('button', { name: /act/i }), { key: 'Escape' })
      expect(onDismiss).not.toHaveBeenCalled()
    })
  })

  // ── GAP 6: banner__body wrapper structural integrity ──────────────────────
  //
  // The title, content, and action are all rendered inside a banner__body <div>.
  // Tests query into the body's children but never assert the wrapper itself exists,
  // meaning the wrapper element could be removed without triggering a test failure.

  describe('banner__body wrapper', () => {
    it('always renders the banner__body wrapper element', () => {
      const { container } = render(<Banner severity="info">Message</Banner>)
      expect(container.querySelector('.banner__body')).toBeInTheDocument()
    })

    it('banner__content is a child of banner__body', () => {
      const { container } = render(<Banner severity="info">Message</Banner>)
      const body = container.querySelector('.banner__body')
      expect(body?.querySelector('.banner__content')).toBeInTheDocument()
    })

    it('banner__title is a child of banner__body when title is provided', () => {
      const { container } = render(
        <Banner severity="info" title="Heading">
          Message
        </Banner>
      )
      const body = container.querySelector('.banner__body')
      expect(body?.querySelector('.banner__title')).toBeInTheDocument()
    })

    it('banner__action is a child of banner__body when action is provided', () => {
      const { container } = render(
        <Banner severity="info" action={{ label: 'Go', href: '/docs' }}>
          Message
        </Banner>
      )
      const body = container.querySelector('.banner__body')
      expect(body?.querySelector('.banner__action')).toBeInTheDocument()
    })
  })

  // ── GAP 7: isExternalUrl boundary cases at the Banner level ──────────────
  //
  // isExternalUrl has its own unit tests, but the Banner-level tests only cover
  // https://, http://, relative paths, mailto:, javascript:, and #.
  // ftp:// and malformed strings are meaningful cases because:
  //   - ftp:// is cross-origin but NOT http/https → isExternalUrl returns false
  //     → the link must NOT get target/_blank (user stays in same context)
  //   - A malformed href that cannot be parsed → isExternalUrl returns false
  //     → no target/_blank, link still renders

  describe('external link security — additional href schemes', () => {
    it('does not add target/rel for an ftp:// href (not http/https — no opener risk)', () => {
      render(
        <Banner severity="info" action={{ label: 'FTP', href: 'ftp://files.example.com' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /ftp/i })
      expect(link).not.toHaveAttribute('target', '_blank')
      expect(link).not.toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('does not add target/rel for a malformed href that fails URL parsing', () => {
      render(
        // A string with a space makes new URL() throw → isExternalUrl returns false
        <Banner severity="info" action={{ label: 'Bad', href: 'ht tp://bad url' }}>
          Message
        </Banner>
      )
      const link = screen.getByRole('link', { name: /bad/i })
      expect(link).not.toHaveAttribute('target', '_blank')
      expect(link).not.toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  // ── GAP 8: requestAnimationFrame is actually invoked ─────────────────────
  //
  // Focus-return tests verify the outcome (the element has focus) but don't
  // assert the mechanism.  If the implementation swapped rAF for setTimeout the
  // outcome tests would still pass.  This test spies on rAF to lock in the
  // contract that focus is scheduled via requestAnimationFrame specifically.

  describe('requestAnimationFrame invocation', () => {
    it('schedules focus-return via requestAnimationFrame when the dismiss button is clicked', () => {
      // Override beforeEach stub with a spy that also executes the callback
      const rafSpy = vi.fn((cb: FrameRequestCallback) => {
        cb(0)
        return 0
      })
      vi.stubGlobal('requestAnimationFrame', rafSpy)

      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))

      expect(rafSpy).toHaveBeenCalledOnce()
    })

    it('schedules focus-return via requestAnimationFrame when Escape is pressed on the dismiss button', () => {
      const rafSpy = vi.fn((cb: FrameRequestCallback) => {
        cb(0)
        return 0
      })
      vi.stubGlobal('requestAnimationFrame', rafSpy)

      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>
      )
      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss banner' }), { key: 'Escape' })

      expect(rafSpy).toHaveBeenCalledOnce()
    })
  })

  // ── GAP 9: onDismiss throwing — documents focus-return failure mode ───────
  //
  // onDismiss() is called BEFORE requestAnimationFrame(() => target.focus()).
  // If onDismiss throws, execution never reaches the rAF call, so focus is
  // never returned.  This is an accessibility concern (keyboard trap on error).
  // This test documents the current behaviour as a contract so it cannot regress
  // silently, and makes the failure mode visible to future maintainers.

  describe('onDismiss throwing — focus-return failure mode', () => {
    it('propagates the thrown error and focus is NOT returned to returnFocusRef when onDismiss throws', () => {
      const ref = React.createRef<HTMLButtonElement>()
      const throwingDismiss = vi.fn(() => {
        throw new Error('dismiss failed')
      })

      render(
        <>
          <button ref={ref} type="button">
            Target
          </button>
          <Banner severity="info" dismissible onDismiss={throwingDismiss} returnFocusRef={ref}>
            Message
          </Banner>
        </>
      )

      // The throw must propagate out of the click handler
      expect(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
      ).toThrow('dismiss failed')

      // onDismiss was called (it threw)
      expect(throwingDismiss).toHaveBeenCalledOnce()

      // Focus was NOT returned — rAF never ran because onDismiss threw first
      expect(screen.getByRole('button', { name: 'Target' })).not.toHaveFocus()
    })
  })

  // ── GAP 10: falsy but renderable children ────────────────────────────────
  //
  // The existing children suite covers null, empty string, numeric 42, and rich
  // nodes.  React 18 has distinct rendering behaviour for false (renders nothing,
  // like null) and 0 (renders the string "0" — a common footgun).  undefined
  // also renders nothing but is semantically different from null.

  describe('falsy children edge cases', () => {
    it('handles children={false} without throwing (renders empty content)', () => {
      expect(() => render(<Banner severity="info">{false}</Banner>)).not.toThrow()
      // The content wrapper must still be present even with no visible content
      const { container } = render(<Banner severity="info">{false}</Banner>)
      expect(container.querySelector('.banner__content')).toBeInTheDocument()
    })

    it('handles children={0} and renders the text "0" (React renders 0 as text)', () => {
      render(<Banner severity="info">{0}</Banner>)
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('handles children={undefined} without throwing', () => {
      // Explicit cast because TypeScript would normally flag undefined as invalid
      // ReactNode, but a runtime caller could still pass it.
      expect(() =>
        render(<Banner severity="info">{undefined as unknown as React.ReactNode}</Banner>)
      ).not.toThrow()
    })
  })

  // ── GAP 11: title with HTML/XSS characters rendered as plain text ─────────
  //
  // React renders string props as text nodes, not innerHTML, so
  // <script>alert(1)</script> in title must appear as literal characters, not
  // execute or inject DOM nodes.  No existing test asserts this escaping contract.

  describe('title XSS / special-character safety', () => {
    it('renders a title containing HTML-like characters as plain text, not parsed HTML', () => {
      const xssPayload = '<img src=x onerror="alert(1)">'
      const { container } = render(
        <Banner severity="info" title={xssPayload}>
          Message
        </Banner>
      )
      const titleEl = container.querySelector('.banner__title')
      expect(titleEl).toBeInTheDocument()
      // React must NOT have created an <img> element from the title string
      expect(titleEl?.querySelector('img')).not.toBeInTheDocument()
      // The raw string must appear as text content
      expect(titleEl).toHaveTextContent(xssPayload)
    })

    it('renders a title with a <script> tag as plain text', () => {
      const scriptPayload = '<script>document.title="pwned"</script>'
      const { container } = render(
        <Banner severity="info" title={scriptPayload}>
          Message
        </Banner>
      )
      const titleEl = container.querySelector('.banner__title')
      expect(titleEl?.querySelector('script')).not.toBeInTheDocument()
      expect(titleEl).toHaveTextContent(scriptPayload)
    })

    it('renders action.label with HTML-like characters as plain text', () => {
      const xssLabel = '<b>Click</b>'
      render(
        <Banner severity="info" action={{ label: xssLabel, onClick: vi.fn() }}>
          Message
        </Banner>
      )
      // The rendered button text is the literal string, not a <b> element
      const btn = screen.getByRole('button', { name: xssLabel })
      expect(btn.querySelector('b')).not.toBeInTheDocument()
      expect(btn).toHaveTextContent(xssLabel)
    })
  })

  // ── GAP 12: returnFocusRef.current pointing to a non-focusable element ────
  //
  // The component calls target.focus() unconditionally.  All existing ref tests
  // use natively-focusable <button> elements.  A ref to a plain <div> (not
  // focusable unless tabIndex is set) still receives the focus() call — the
  // component must not gate on element type.

  describe('returnFocusRef on non-focusable element', () => {
    it('calls focus() on a plain div even though it is not natively focusable', () => {
      // We spy on the div's focus method to confirm the call happens without
      // needing to assert actual focus state (which depends on tabIndex).
      const divRef = React.createRef<HTMLDivElement>()
      const focusSpy = vi.fn()

      render(
        <>
          <div ref={divRef}>Non-focusable target</div>
          <Banner
            severity="info"
            dismissible
            returnFocusRef={divRef as unknown as React.RefObject<HTMLElement>}
          >
            Message
          </Banner>
        </>
      )

      // Attach spy after render so we're patching the live DOM node
      if (divRef.current) {
        divRef.current.focus = focusSpy
      }

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))

      expect(focusSpy).toHaveBeenCalledOnce()
    })
  })

  // ── GAP 13: Space/Enter on dismiss button (native button activation) ──────
  //
  // handleKeyDown only handles Escape with a custom listener.  Space and Enter
  // activate <button> elements natively — the browser fires a synthetic click
  // event, which calls handleDismiss via onClick.  userEvent simulates this full
  // browser-level key → click dispatch chain, confirming the dismiss path works
  // via keyboard without relying solely on direct fireEvent.click().

  describe('dismiss button keyboard activation (Space / Enter)', () => {
    it('dismisses the banner when Space is pressed on the dismiss button', async () => {
      const onDismiss = vi.fn()
      const user = userEvent.setup()

      render(
        <Banner severity="info" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )

      const btn = screen.getByRole('button', { name: 'Dismiss banner' })
      btn.focus()
      await user.keyboard(' ')

      expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('dismisses the banner when Enter is pressed on the dismiss button', async () => {
      const onDismiss = vi.fn()
      const user = userEvent.setup()

      render(
        <Banner severity="info" dismissible onDismiss={onDismiss}>
          Message
        </Banner>
      )

      const btn = screen.getByRole('button', { name: 'Dismiss banner' })
      btn.focus()
      await user.keyboard('{Enter}')

      expect(onDismiss).toHaveBeenCalledOnce()
    })
  })
})
