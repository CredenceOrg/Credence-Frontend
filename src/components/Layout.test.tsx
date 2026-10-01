import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import ErrorBoundary from './ErrorBoundary'
import { INSTALL_PROMPT_SESSION_KEY } from '../config/installPrompt'

// Mock matchMedia for JSDOM
beforeAll(() => {
  // jsdom does not implement scroll positioning (BackToTop / skip link).
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<div>Home Page Content</div>} />
          <Route path="dashboard" element={<div>Dashboard Page Content</div>} />
          <Route path="bond" element={<div>Bond Page Content</div>} />
          <Route path="trust" element={<div>Trust Score Page Content</div>} />
          <Route path="settings" element={<div>Settings Page Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('Layout Integration', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('renders skip link and main branding', () => {
    renderLayout()
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^credence$/i })).toBeInTheDocument()
  })

  it('renders keyboard shortcuts button with accessible name', () => {
    renderLayout()
    expect(screen.getByRole('button', { name: /open keyboard shortcuts/i })).toHaveAccessibleName(
      /open keyboard shortcuts/i
    )
  })

  it('renders theme toggle button', () => {
    renderLayout()
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
  })

  it('renders desktop navigation links', () => {
    renderLayout()
    const desktopLinks = screen.getAllByRole('link', {
      name: /dashboard|bond|trust score|settings/i,
    })
    expect(desktopLinks.length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /dashboard/i }).length).toBeGreaterThan(0)
  })

  it('marks active link on desktop navigation', () => {
    renderLayout('/bond')
    const activeLinks = screen.getAllByRole('link', { name: /bond/i })
    const hasActiveClass = activeLinks.some(
      (link) =>
        link.classList.contains('appNav-link--active') ||
        link.classList.contains('mobileNav-link--active')
    )
    expect(hasActiveClass).toBe(true)

    // active nav should expose aria-current="page"
    const active = activeLinks.find((l) => l.getAttribute('aria-current') === 'page')
    expect(active).toBeDefined()
  })

  it('opens and closes mobile nav drawer', () => {
    renderLayout()
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
    const drawer = document.getElementById('mobile-nav-drawer')

    expect(drawer).toHaveAttribute('aria-hidden', 'true')

    // Open drawer
    fireEvent.click(hamburger)
    expect(drawer).toHaveAttribute('aria-hidden', 'false')
    expect(drawer).toHaveClass('mobileNav-drawer--open')

    // Close drawer using close button
    const closeBtn = screen.getByRole('button', { name: /close navigation menu/i })
    fireEvent.click(closeBtn)
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
  })

  it('closes mobile nav drawer when clicking on the backdrop', () => {
    renderLayout()
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })

    fireEvent.click(hamburger)
    const backdrop = document.querySelector('.mobileNav-backdrop')
    expect(backdrop).not.toBeNull()

    if (backdrop) {
      fireEvent.click(backdrop)
    }

    const drawer = document.getElementById('mobile-nav-drawer')
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
  })

  it('closes mobile nav drawer on Escape key', () => {
    renderLayout()
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })

    fireEvent.click(hamburger)
    const drawer = document.getElementById('mobile-nav-drawer') as HTMLElement

    fireEvent.keyDown(drawer, { key: 'Escape' })
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
  })

  it('closes mobile nav drawer when a link is clicked', () => {
    renderLayout()
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })

    fireEvent.click(hamburger)

    const drawer = document.getElementById('mobile-nav-drawer') as HTMLElement
    // The drawer now shows only secondary routes: Home and Settings.
    const settingsLink = screen
      .getAllByRole('link', { name: /settings/i })
      .find((link) => drawer.contains(link))

    expect(settingsLink).toBeDefined()
    if (settingsLink) {
      fireEvent.click(settingsLink)
    }

    expect(drawer).toHaveAttribute('aria-hidden', 'true')
  })

  // --- BottomNav integration ---

  it('renders BottomNav inside the layout', () => {
    renderLayout()
    expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInTheDocument()
  })

  it('BottomNav contains the 5 primary route tabs', () => {
    renderLayout()
    const bottomNav = screen.getByRole('navigation', { name: /bottom navigation/i })
    const tabs = Array.from(bottomNav.querySelectorAll('a'))
    expect(tabs).toHaveLength(5)
  })
})

describe('Layout boundary and recovery conditions', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders and recovers when a navigation link has a malformed path', () => {
    // Boundary: ensure layout still renders when a route is unknown.
    render(
      <MemoryRouter initialEntries={['/not-a-real-route']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div>Home Page Content</div>} />
            <Route path="*" element={<div>Not Found</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
    expect(screen.getByText('Not Found')).toBeInTheDocument()
  })

  it('dismisses install prompt and persists the decision', () => {
    window.localStorage.clear()
    renderLayout()

    // Simulate the browser firing the install prompt event.
    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true })
      window.dispatchEvent(event)
    })

    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    expect(dismissButton).toBeInTheDocument()
    fireEvent.click(dismissButton)

    // The prompt must be removed and the decision persisted.
    expect(screen.queryByText(/install this app/i)).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem(INSTALL_PROMPT_SESSION_KEY)).toBe('handled')
  })

  it('does not re-show the install prompt after it has been handled', () => {
    window.sessionStorage.setItem(INSTALL_PROMPT_SESSION_KEY, 'handled')
    renderLayout()

    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true })
      window.dispatchEvent(event)
    })

    expect(screen.queryByText(/install this app/i)).not.toBeInTheDocument()
  })

  it('recovers mobile nav state when the drawer is closed and reopened', () => {
    renderLayout()
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
    const drawer = document.getElementById('mobile-nav-drawer') as HTMLElement

    fireEvent.click(hamburger)
    expect(drawer).toHaveAttribute('aria-hidden', 'false')

    const closeBtn = screen.getByRole('button', { name: /close navigation menu/i })
    fireEvent.click(closeBtn)
    expect(drawer).toHaveAttribute('aria-hidden', 'true')

    // Reopen and confirm the drawer is in a consistent state.
    fireEvent.click(hamburger)
    expect(drawer).toHaveAttribute('aria-hidden', 'false')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body overflow when the drawer is closed via Escape', () => {
    renderLayout()
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
    const drawer = document.getElementById('mobile-nav-drawer') as HTMLElement

    fireEvent.click(hamburger)
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(drawer, { key: 'Escape' })
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
    expect(document.body.style.overflow).toBe('')
  })

  it('toggles the action launcher with the Ctrl+K keyboard shortcut', () => {
    renderLayout()

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

    // The launcher is expected to render a dialog when opened.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('recovers from a failed install prompt event without losing the layout', () => {
    renderLayout()

    // Dispatch a malformed event to verify the layout stays functional.
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })

    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Slot (Outlet) rendering boundaries
// ---------------------------------------------------------------------------

/** Deterministic deeply-nested slot content used to stress the outlet. */
function DeepSlot({ depth, payload }: { depth: number; payload: string }) {
  if (depth <= 0) return <span data-testid="deep-leaf">{payload}</span>
  return (
    <div data-depth={depth}>
      <DeepSlot depth={depth - 1} payload={payload} />
    </div>
  )
}

describe('Layout slot rendering boundaries', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('mounts the standard shell around the routed slot', () => {
    renderLayout()

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toContainElement(screen.getByText('Home Page Content'))
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute(
      'href',
      '#main-content'
    )
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('keeps the shell intact when the matched route has no child slot', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Layout />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByRole('main')).toBeEmptyDOMElement()
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('renders deeply nested and very long slot content without dropping the shell', () => {
    const payload = 'A'.repeat(20000)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DeepSlot depth={80} payload={payload} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    const leaf = screen.getByTestId('deep-leaf')
    expect(leaf).toHaveTextContent(payload)
    expect(document.querySelector('[data-depth="80"]')).toBeInTheDocument()
    expect(screen.getByRole('main')).toContainElement(leaf)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(document.querySelectorAll('#main-content')).toHaveLength(1)
  })

  it('keeps the shell stable while the routed slot changes', () => {
    renderLayout()
    expect(screen.getByText('Home Page Content')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('link', { name: /dashboard/i })[0])

    expect(screen.getByText('Dashboard Page Content')).toBeInTheDocument()
    expect(screen.queryByText('Home Page Content')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })

  it('fails with a diagnosable error when rendered without a Router context', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      expect(() => render(<Layout />)).toThrow(/Router/i)
    } finally {
      consoleError.mockRestore()
    }
  })
})

// ---------------------------------------------------------------------------
// Failure boundaries and recovery
// ---------------------------------------------------------------------------

describe('Layout failure boundaries and recovery', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders exactly one install prompt when the event fires repeatedly', () => {
    renderLayout()

    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
    })

    expect(screen.getAllByText(/install this app/i)).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /dismiss/i })).toHaveLength(1)
  })

  it('persists the dismissal decision and ignores later install prompt events', () => {
    renderLayout()

    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
    })
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByText(/install this app/i)).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem(INSTALL_PROMPT_SESSION_KEY)).toBe('handled')

    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
    })

    expect(screen.queryByText(/install this app/i)).not.toBeInTheDocument()
  })

  it('stays usable when a malformed install prompt event arrives', () => {
    renderLayout()

    // Not cancelable and carries no `prompt()` / `userChoice` surface at all.
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })

    expect(screen.getAllByText(/install this app/i)).toHaveLength(1)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('keeps the action launcher stable across duplicate Ctrl+K dispatches', () => {
    renderLayout()

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

    expect(screen.getAllByRole('dialog')).toHaveLength(1)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('opens the shortcuts dialog with Shift+? and restores focus to its trigger on close', () => {
    renderLayout()

    const trigger = screen.getByRole('button', { name: /open keyboard shortcuts/i })
    trigger.focus()

    fireEvent.keyDown(document, { key: '?', shiftKey: true })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('treats duplicate drawer open requests as idempotent and restores body overflow', () => {
    renderLayout()
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
    const drawer = document.getElementById('mobile-nav-drawer') as HTMLElement

    fireEvent.click(hamburger)
    fireEvent.click(hamburger)
    fireEvent.click(hamburger)

    expect(drawer).toHaveAttribute('aria-hidden', 'false')
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(drawer, { key: 'Escape' })
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
    expect(document.body.style.overflow).toBe('')

    // Escape while already closed must stay a safe no-op.
    expect(() => fireEvent.keyDown(drawer, { key: 'Escape' })).not.toThrow()
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
    expect(document.body.style.overflow).toBe('')
  })

  it('never renders dead "#" anchors in the footer', () => {
    renderLayout()

    for (const label of ['Documentation', 'Terms of Service', 'Privacy Policy']) {
      const entry = screen.getByText(label)
      if (entry.tagName === 'A') {
        expect(entry.getAttribute('href')).toBeTruthy()
        expect(entry.getAttribute('href')).not.toBe('#')
      } else {
        expect(entry).toHaveAttribute('aria-disabled', 'true')
      }
    }

    expect(document.querySelectorAll('a[href="#"]')).toHaveLength(0)
  })

  it('falls back to the error boundary when the routed slot throws and recovers on retry', () => {
    let shouldThrow = true
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    function FlakySlot() {
      if (shouldThrow) throw new Error('simulated chunk load failure')
      return <div data-testid="slot-ok">Slot recovered</div>
    }

    try {
      render(
        <ErrorBoundary>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<FlakySlot />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ErrorBoundary>
      )

      const retry = screen.getByRole('button', { name: /try again/i })
      expect(retry).toBeInTheDocument()

      shouldThrow = false
      fireEvent.click(retry)

      expect(screen.getByTestId('slot-ok')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
      expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('stops reacting to install prompt events after unmount', () => {
    const { unmount } = renderLayout()
    unmount()

    expect(() =>
      act(() => {
        window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
      })
    ).not.toThrow()

    expect(screen.queryByText(/install this app/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Shell landmark structure (header / nav / main / footer slots)
// ---------------------------------------------------------------------------

describe('Layout shell landmark structure', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('mounts header, nav, main and footer slots once, in document order', () => {
    renderLayout()

    const shellHeader = document.querySelector('.appHeader')
    const shellNav = document.querySelector('.appNav')
    const shellMain = document.getElementById('main-content')
    const shellFooter = document.querySelector('.app-footer')

    expect(shellHeader).not.toBeNull()
    expect(shellNav).not.toBeNull()
    expect(shellMain).not.toBeNull()
    expect(shellFooter).not.toBeNull()

    // Exactly one primary shell instance of each slot.
    expect(document.querySelectorAll('.appHeader')).toHaveLength(1)
    expect(document.querySelectorAll('#main-content')).toHaveLength(1)
    expect(document.querySelectorAll('.app-footer')).toHaveLength(1)
    expect(screen.getAllByRole('main')).toHaveLength(1)

    // Implicit landmark roles resolve on the shell slots.
    expect(screen.getAllByRole('banner')).toContain(shellHeader)
    expect(screen.getByRole('contentinfo')).toBe(shellFooter)

    // Deterministic document order: header → nav → main → footer.
    const slots = [shellHeader!, shellNav!, shellMain!, shellFooter!]
    for (let i = 0; i < slots.length - 1; i++) {
      const follows =
        slots[i].compareDocumentPosition(slots[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING
      expect(follows, `slot ${i + 1} must follow slot ${i}`).toBeGreaterThan(0)
    }
  })

  it('exposes a single skip-link that targets the main slot', () => {
    renderLayout()

    const skipLinks = screen.getAllByRole('link', { name: /skip to main content/i })
    expect(skipLinks).toHaveLength(1)
    expect(skipLinks[0]).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')).toBe(screen.getByRole('main'))
  })

  it('renders the install prompt as a single labelled info banner with a dismiss control', () => {
    renderLayout()

    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
    })

    const prompt = document.querySelector('.appInstallPrompt')
    expect(prompt).not.toBeNull()
    expect(prompt).toHaveTextContent('Install Credence')
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/information banner/i)
    )
    expect(screen.getAllByRole('button', { name: /dismiss/i })).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Fallback UI shape and repeated-failure determinism
// ---------------------------------------------------------------------------

describe('Layout fallback UI shape and repeated failures', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('replaces the shell with the branded fallback when the routed slot throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    function ExplodingSlot(): never {
      throw new Error('simulated route module failure')
    }

    try {
      render(
        <ErrorBoundary>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<ExplodingSlot />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ErrorBoundary>
      )

      // Branded fallback surface replaces the shell entirely.
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
      expect(
        screen.getByRole('heading', { level: 3, name: /something went wrong/i })
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /go to home page/i })).toHaveAttribute('href', '/')

      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
      expect(screen.queryByRole('main')).not.toBeInTheDocument()
      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('stays deterministic when the slot keeps failing across repeated retries', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    function AlwaysFailsSlot(): never {
      throw new Error('permanent slot failure')
    }

    try {
      render(
        <ErrorBoundary>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<AlwaysFailsSlot />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ErrorBoundary>
      )

      expect(screen.getAllByRole('alert')).toHaveLength(1)

      const retry = screen.getByRole('button', { name: /try again/i })
      fireEvent.click(retry)
      fireEvent.click(retry)

      // The boundary re-catches and re-renders exactly one fallback — no
      // duplicated alerts, no leaked shell fragments, no unhandled crash.
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(
        screen.getByRole('heading', { level: 3, name: /something went wrong/i })
      ).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /try again/i })).toHaveLength(1)
      expect(screen.queryByRole('main')).not.toBeInTheDocument()
      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    } finally {
      consoleError.mockRestore()
    }
  })
})

// ---------------------------------------------------------------------------
// Missing translation context (Layout must not depend on i18n resources)
// ---------------------------------------------------------------------------

describe('Layout with missing translation resources', () => {
  afterEach(() => {
    vi.doUnmock('react-i18next')
    vi.resetModules()
    cleanup()
  })

  it('keeps the full shell intact when every translation resolves to its raw key', async () => {
    vi.resetModules()
    vi.doMock('react-i18next', async () => {
      const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
      const i18next = await vi.importActual<typeof import('i18next')>('i18next')
      return {
        ...actual,
        useTranslation: () => ({
          t: (key: string) => key,
          i18n: i18next.default,
          ready: true,
        }),
      }
    })

    const { default: IsolatedLayout } = await import('./Layout')

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<IsolatedLayout />}>
            <Route index element={<div>Home Page Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    // Missing resources degrade to raw keys without dropping any slot.
    expect(
      screen.getByRole('link', { name: 'layout.skipToMainContent' })
    ).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Home Page Content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getAllByText('layout.brand')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'nav.settings' }).length).toBeGreaterThan(0)
  })
})
