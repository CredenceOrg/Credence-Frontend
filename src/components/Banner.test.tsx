import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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
      ['critical', 'alert'],
      ['warning', 'alert'],
      ['info', 'status'],
      ['success', 'status'],
    ])('severity "%s" → role="%s"', (severity, role) => {
      render(<Banner severity={severity}>Message</Banner>)
      expect(screen.getByRole(role)).toBeInTheDocument()
    })
  })

  // ── aria-label ────────────────────────────────────────────────────────────

  describe('aria-label', () => {
    it.each<[BannerSeverity, string]>([
      ['info', 'Information banner'],
      ['success', 'Success banner'],
      ['warning', 'Warning banner'],
      ['critical', 'Critical banner'],
    ])('severity "%s" → aria-label="%s"', (severity, label) => {
      render(<Banner severity={severity}>Message</Banner>)
      // getByRole with name option asserts both the role and accessible name
      const isUrgent = severity === 'critical' || severity === 'warning'
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
        </Banner>,
      )
      expect(screen.queryByRole('button', { name: 'Dismiss banner' })).not.toBeInTheDocument()
    })

    it('is present when dismissible is true', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>,
      )
      expect(screen.getByRole('button', { name: 'Dismiss banner' })).toBeInTheDocument()
    })

    it('calls onDismiss when clicked', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="info" dismissible onDismiss={onDismiss}>
          Message
        </Banner>,
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
          <Banner severity="warning" dismissible returnFocusRef={ref}>
            Message
          </Banner>
        </>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))

      expect(screen.getByRole('button', { name: 'Return target' })).toHaveFocus()
    })

    it('returns focus to document.body when returnFocusRef is not provided', () => {
      render(
        <Banner severity="info" dismissible>
          Message
        </Banner>,
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
        </Banner>,
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
        <Banner severity="critical" dismissible onDismiss={onDismiss}>
          Message
        </Banner>,
      )

      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss banner' }), { key: 'Escape' })

      expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('does not trigger dismissal on other keys', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="critical" dismissible onDismiss={onDismiss}>
          Message
        </Banner>,
      )

      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss banner' }), { key: 'Enter' })
      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss banner' }), { key: 'Tab' })

      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('does not trigger dismissal when Escape is fired on the banner wrapper', () => {
      const onDismiss = vi.fn()
      render(
        <Banner severity="critical" dismissible onDismiss={onDismiss}>
          Message
        </Banner>,
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
        </Banner>,
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
        </Banner>,
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
        </Banner>,
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
        </Banner>,
      )
      expect(screen.getByText('Heads up')).toBeInTheDocument()
    })

    it('omits the title element when title is not provided', () => {
      render(<Banner severity="info">Message</Banner>)
      // No <p class="banner__title"> — nothing with that text
      expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
    })
  })
})
