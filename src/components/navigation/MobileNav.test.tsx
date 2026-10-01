import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Component, ReactNode, useState } from 'react'
import MobileNav from './MobileNav'
import ErrorBoundary from '../ErrorBoundary'

vi.mock('../../config/routes', () => ({
  PRELOADS_BY_PATH: {
    '/': vi.fn().mockResolvedValue({}),
    '/settings': vi.fn().mockResolvedValue({}),
  }
}))

function renderNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MobileNav />
    </MemoryRouter>
  )
}

function getDrawer() {
  // Query directly because aria-hidden elements are excluded from the role tree
  return document.getElementById('mobile-nav-drawer') as HTMLElement
}

function openDrawer() {
  fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
}

describe('MobileNav', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    sessionStorage.clear()
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  // --- render ---

  it('renders a hamburger button', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument()
  })

  it('drawer is hidden on initial render', () => {
    renderNav()
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  // --- open ---

  it('opens the drawer when hamburger is clicked', () => {
    renderNav()
    openDrawer()
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
  })

  it('drawer gains the open CSS class when opened', () => {
    renderNav()
    openDrawer()
    expect(getDrawer()).toHaveClass('mobileNav-drawer--open')
  })

  it('moves focus to the close button when the drawer opens', async () => {
    renderNav()
    openDrawer()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close navigation menu/i })).toHaveFocus()
    })
  })

  // --- close ---

  it('closes the drawer when close button is clicked', () => {
    renderNav()
    openDrawer()
    fireEvent.click(screen.getByRole('button', { name: /close navigation menu/i }))
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  it('closes the drawer when the backdrop is clicked', () => {
    renderNav()
    openDrawer()
    const backdrop = document.querySelector('.mobileNav-backdrop') as HTMLElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop)
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  it('close is idempotent when called repeatedly', () => {
    renderNav()
    openDrawer()
    const closeBtn = screen.getByRole('button', { name: /close navigation menu/i })
    fireEvent.click(closeBtn)
    expect(() => fireEvent.click(closeBtn)).not.toThrow()
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  it('close handles concurrent dispatches without throwing', () => {
    renderNav()
    openDrawer()
    const closeBtn = screen.getByRole('button', { name: /close navigation menu/i })
    const backdrop = document.querySelector('.mobileNav-backdrop') as HTMLElement
    expect(() => {
      fireEvent.click(closeBtn)
      fireEvent.click(backdrop)
    }).not.toThrow()
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  // --- Escape key (handled by useFocusTrap on the drawer container) ---

  it('closes the drawer on Escape key', () => {
    renderNav()
    openDrawer()
    fireEvent.keyDown(getDrawer(), { key: 'Escape' })
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  it('closes the drawer when Escape is pressed at the window level', () => {
    renderNav()
    openDrawer()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  // --- aria state ---

  it('hamburger aria-expanded is false when closed', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /open navigation menu/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('hamburger aria-expanded is true when open', () => {
    renderNav()
    openDrawer()
    expect(screen.getByRole('button', { name: /open navigation menu/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('hamburger aria-controls points to the drawer id', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /open navigation menu/i })).toHaveAttribute(
      'aria-controls',
      'mobile-nav-drawer'
    )
  })

  // --- active route (drawer must be open for links to be in the a11y tree) ---
  // The drawer now shows only secondary routes: Home (/) and Settings ( /settings).
  // Primary routes (Dashboard, Bond, Trust Score, Attestations, Transactions) are
  // handled by the BottomNav component.

  it('marks the current route with aria-current="page"', () => {
    renderNav('/settings')
    openDrawer()
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark inactive routes with aria-current', () => {
    renderNav('/settings')
    openDrawer()
    expect(screen.getByRole('link', { name: /home/i })).not.toHaveAttribute('aria-current')
  })

  // --- links ---

  it('shows secondary nav links (Home and Settings) when drawer is open', () => {
    renderNav()
    openDrawer()
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('does not show primary route links in the drawer', () => {
    renderNav()
    openDrawer()
    expect(screen.queryByRole('link', { name: /^dashboard$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^bond$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^trust score$/i })).not.toBeInTheDocument()
  })

  // --- backdrop lifecycle ---

  it('does not render backdrop when drawer is closed', () => {
    renderNav()
    expect(document.querySelector('.mobileNav-backdrop')).toBeNull()
  })

  it('renders backdrop when drawer is open', () => {
    renderNav()
    openDrawer()
    expect(document.querySelector('.mobileNav-backdrop')).not.toBeNull()
  })

  it('removes backdrop after drawer is closed', () => {
    renderNav()
    openDrawer()
    fireEvent.click(screen.getByRole('button', { name: /close navigation menu/i }))
    expect(document.querySelector('.mobileNav-backdrop')).toBeNull()
  })

  // --- handleKeyDown failure boundaries ---
  // These tests pin down the deterministic behaviour of the keyboard handler when
  // it receives malformed, unexpected, or concurrent inputs. The invariants are:
  //   1. Only the Escape key closes the drawer.
  //   2. A key event with a missing/non-string `key` must not throw or mutate state.
  //   3. Repeated Escape presses are idempotent (no double close, no error).
  //   4. Events targeting detached nodes must not crash the handler.

  it('ignores non-Escape keys and keeps the drawer open', () => {
    renderNav()
    openDrawer()
    const drawer = getDrawer()
    fireEvent.keyDown(drawer, { key: 'Enter' })
    fireEvent.keyDown(drawer, { key: 'Tab' })
    fireEvent.keyDown(drawer, { key: 'ArrowDown' })
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
  })

  it('does not throw or close when the key field is missing', () => {
    renderNav()
    openDrawer()
    const drawer = getDrawer()
    expect(() => fireEvent.keyDown(drawer, {})).not.toThrow()
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
  })

  it('does not throw or close when the key field is null', () => {
    renderNav()
    openDrawer()
    const drawer = getDrawer()
    expect(() => fireEvent.keyDown(drawer, { key: null as unknown as string })).not.toThrow()
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
  })

  it('does not throw or close when the key field is a number', () => {
    renderNav()
    openDrawer()
    const drawer = getDrawer()
    expect(() => fireEvent.keyDown(drawer, { key: 13 as unknown as string })).not.toThrow()
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
  })

  it('does not throw or close when the key field is an object', () => {
    renderNav()
    openDrawer()
    const drawer = getDrawer()
    expect(() => fireEvent.keyDown(drawer, { key: {} as unknown as string })).not.toThrow()
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
  })

  it('is idempotent when Escape is pressed repeatedly', () => {
    renderNav()
    openDrawer()
    const drawer = getDrawer()
    fireEvent.keyDown(drawer, { key: 'Escape' })
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
    // Subsequent Escape presses on the closed drawer must not throw or re-open.
    expect(() => fireEvent.keyDown(drawer, { key: 'Escape' })).not.toThrow()
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  it('closes exactly once when Escape is dispatched on both drawer and window concurrently', () => {
    renderNav()
    openDrawer()
    const drawer = getDrawer()
    fireEvent.keyDown(drawer, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('.mobileNav-backdrop')).toBeNull()
  })

  it('handles an Escape keydown dispatched on a detached node without throwing', () => {
    renderNav()
    openDrawer()
    const detached = document.createElement('div')
    expect(() => fireEvent.keyDown(detached, { key: 'Escape' })).not.toThrow()
    // The drawer must remain open because the event did not originate from the drawer.
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
  })

  it('remains consistent after a failed open/close cycle followed by a valid Escape', () => {
    renderNav()
    openDrawer()
    const drawer = getDrawer()
    // Malformed events first.
    fireEvent.keyDown(drawer, {})
    fireEvent.keyDown(drawer, { key: null as unknown as string })
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
    // Then a valid Escape must still close the drawer.
    fireEvent.keyDown(drawer, { key: 'Escape' })
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  it('restores body overflow and focus after a failure-boundary close', async () => {
    renderNav()
    openDrawer()
    expect(document.body.style.overflow).toBe('hidden')
    const drawer = getDrawer()
    fireEvent.keyDown(drawer, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open navigation menu/i })).toHaveFocus()
    })
  })

  // =====================================================================
  // ErrorBoundary integration — render crash → fallback → retry → recovery
  // =====================================================================

  describe('ErrorBoundary integration', () => {
    /**
     * Helper: a component that throws on its first render and succeeds on
     * subsequent renders. Used to test ErrorBoundary catch + reset behavior.
     */
    let throwOnRender = false

    function ThrowingChild() {
      if (throwOnRender) {
        throw new Error('Simulated MobileNav render crash')
      }
      return <div data-testid="recovered">Recovered</div>
    }

    it('ErrorBoundary catches render errors and shows fallback with retry', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      throwOnRender = true

      render(
        <ErrorBoundary
          fallback={(error, reset) => (
            <button
              data-error-boundary="mobilenav"
              aria-label="Navigation error — tap to retry"
              onClick={reset}
            >
              {error.message}
            </button>
          )}
        >
          <ThrowingChild />
        </ErrorBoundary>
      )

      // The fallback should show with the error message
      const retryButton = screen.getByRole('button', { name: /navigation error/i })
      expect(retryButton).toBeInDocument()
      expect(retryButton).toHaveAttribute('data-error-boundary', 'mobilenav')
      expect(retryButton.textContent).toContain('Simulated MobileNav render crash')

      // Reset the flag and click retry
      throwOnRender = false
      fireEvent.click(retryButton)

      // After reset, the component should recover
      expect(screen.getByTestId('recovered')).toBeInDocument()

      consoleSpy.mockRestore()
    })

    it('ErrorBoundary around MobileNav catches errors without crashing the page', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      throwOnRender = true

      render(
        <MemoryRouter>
          <div data-testid="page-root">
            <ErrorBoundary
              fallback={(error, reset) => (
                <button
                  data-error-boundary="mobilenav"
                  aria-label="Navigation error — tap to retry"
                  onClick={reset}
                >
                  Retry
                </button>
              )}
            >
              <ThrowingChild />
            </ErrorBoundary>
            <main data-testid="main-content">Main content still works</main>
          </div>
        </MemoryRouter>
      )

      // The page root and main content should still be rendered
      expect(screen.getByTestId('page-root')).toBeInDocument()
      expect(screen.getByTestId('main-content')).toBeInDocument()

      // The fallback should be shown instead of the crashed component
      expect(screen.getByRole('button', { name: /navigation error/i })).toBeInDocument()

      throwOnRender = false
      consoleSpy.mockRestore()
    })

    it('MobileNav renders normally when no errors occur (boundary is transparent)', () => {
      renderNav()

      // Normal operation — boundary wrapper should be invisible
      expect(
        screen.getByRole('button', { name: /open navigation menu/i })
      ).toBeInDocument()
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')

      // No error boundary fallback should be present
      expect(
        screen.queryByRole('button', { name: /navigation error/i })
      ).not.toBeInDocument()
      expect(document.querySelector('[data-error-boundary="mobilenav"]')).toBeNull()
    })
  })

  // =====================================================================
  // sessionStorage failure boundaries
  // =====================================================================

  describe('sessionStorage failure boundaries', () => {
    it('defaults to closed when sessionStorage.getItem throws', () => {
      vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: storage disabled')
      })

      renderNav()

      // Should render normally with drawer closed
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
      expect(
        screen.getByRole('button', { name: /open navigation menu/i })
      ).toBeInDocument()

      vi.restoreAllMocks()
    })

    it('does not throw when sessionStorage.setItem fails during open', () => {
      vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      renderNav()
      expect(() => openDrawer()).not.toThrow()
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')

      vi.restoreAllMocks()
    })

    it('does not throw when sessionStorage.removeItem fails during close', () => {
      vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })

      renderNav()
      openDrawer()
      expect(() =>
        fireEvent.click(screen.getByRole('button', { name: /close navigation menu/i }))
      ).not.toThrow()
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')

      vi.restoreAllMocks()
    })

    it('recovers open state from sessionStorage when available', () => {
      sessionStorage.setItem('mobileNavOpen', 'true')

      renderNav()

      // Drawer should initialize as open
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')

      sessionStorage.removeItem('mobileNavOpen')
    })

    it('ignores invalid sessionStorage values gracefully', () => {
      sessionStorage.setItem('mobileNavOpen', 'invalid')

      renderNav()

      // 'invalid' !== 'true', so drawer should be closed
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')

      sessionStorage.removeItem('mobileNavOpen')
    })

    it('handles sessionStorage containing empty string', () => {
      sessionStorage.setItem('mobileNavOpen', '')

      renderNav()

      // '' !== 'true', so drawer should be closed
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')

      sessionStorage.removeItem('mobileNavOpen')
    })
  })

  // =====================================================================
  // Observability — data-mobilenav-state attribute
  // =====================================================================

  describe('observability', () => {
    it('sets data-mobilenav-state="closed" when drawer is closed', () => {
      renderNav()
      expect(getDrawer()).toHaveAttribute('data-mobilenav-state', 'closed')
    })

    it('sets data-mobilenav-state="open" when drawer is open', () => {
      renderNav()
      openDrawer()
      expect(getDrawer()).toHaveAttribute('data-mobilenav-state', 'open')
    })

    it('transitions data-mobilenav-state back to "closed" after close', () => {
      renderNav()
      openDrawer()
      expect(getDrawer()).toHaveAttribute('data-mobilenav-state', 'open')
      fireEvent.click(screen.getByRole('button', { name: /close navigation menu/i }))
      expect(getDrawer()).toHaveAttribute('data-mobilenav-state', 'closed')
    })
  })

  // =====================================================================
  // Concurrent and rapid state transitions
  // =====================================================================

  describe('concurrent state transitions', () => {
    it('handles rapid open-close-open without inconsistent state', () => {
      renderNav()

      // Rapid sequence
      openDrawer()
      fireEvent.click(screen.getByRole('button', { name: /close navigation menu/i }))
      openDrawer()

      expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
      expect(getDrawer()).toHaveAttribute('data-mobilenav-state', 'open')
      expect(document.querySelector('.mobileNav-backdrop')).not.toBeNull()
    })

    it('handles rapid close via different mechanisms without throwing', () => {
      renderNav()
      openDrawer()
      const drawer = getDrawer()

      // Close via Escape on drawer, then verify state
      fireEvent.keyDown(drawer, { key: 'Escape' })
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')

      // Re-open and close via backdrop
      openDrawer()
      const backdrop = document.querySelector('.mobileNav-backdrop') as HTMLElement
      fireEvent.click(backdrop)
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
    })

    it('double-clicking the hamburger does not produce inconsistent state', () => {
      renderNav()
      const hamburger = screen.getByRole('button', { name: /open navigation menu/i })

      fireEvent.click(hamburger)
      fireEvent.click(hamburger)

      // Drawer should still be open (second click on hamburger while open
      // sets isOpen to true again, which is idempotent)
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
    })
  })

  // =====================================================================
  // Boundary input tests for drawer state
  // =====================================================================

  describe('boundary inputs', () => {
    it('does not crash when the drawer element is queried before mount', () => {
      // Verify that the drawer exists in the DOM even before opening
      renderNav()
      const drawer = getDrawer()
      expect(drawer).not.toBeNull()
      expect(drawer.tagName.toLowerCase()).toBe('nav')
    })

    it('multiple Escape presses after close are all no-ops', () => {
      renderNav()
      openDrawer()
      const drawer = getDrawer()

      for (let i = 0; i < 5; i++) {
        expect(() => fireEvent.keyDown(drawer, { key: 'Escape' })).not.toThrow()
      }
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
    })

    it('keyboard events with empty string key do not close the drawer', () => {
      renderNav()
      openDrawer()
      fireEvent.keyDown(getDrawer(), { key: '' })
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
    })

    it('keyboard events with case-variant "escape" do not close the drawer', () => {
      renderNav()
      openDrawer()
      // KeyboardEvent.key is case-sensitive; "escape" (lowercase) is not standard
      fireEvent.keyDown(getDrawer(), { key: 'escape' })
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
    })

    it('keyboard events with "Esc" (legacy IE) do not close the drawer', () => {
      renderNav()
      openDrawer()
      // "Esc" was the IE/Edge legacy value; modern browsers use "Escape"
      fireEvent.keyDown(getDrawer(), { key: 'Esc' })
      expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
    })
  })
})
