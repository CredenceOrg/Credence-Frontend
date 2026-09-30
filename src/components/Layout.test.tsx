import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from './Layout'

// Mock matchMedia for JSDOM
beforeAll(() => {
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
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInDocument()
    expect(screen.getByRole('link', { name: /^credence$/i })).toBeInDocument()
  })

  it('renders keyboard shortcuts button with accessible name', () => {
    renderLayout()
    expect(screen.getByRole('button', { name: /open keyboard shortcuts/i })).toHaveAccessibleName(
      /open keyboard shortcuts/i
    )
  })

  it('renders theme toggle button', () => {
    renderLayout()
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInDocument()
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
    expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInDocument()
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
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInDocument()
    expect(screen.getByText('Not Found')).toBeInDocument()
  })

  it('dismisses install prompt and persists the decision', () => {
    window.localStorage.clear()
    renderLayout()

    // Simulate the browser firing the install prompt event.
    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true })
      window.dispatchEvent(event)
    })

    const dismissButton = screen.getButtonBy(/dismiss/i)
    expect(dismissButton).toBeInDocument()
    fireEvent.click(dismissButton)

    // The prompt must be removed and the decision persisted.
    expect(screen.queryByText(/install this app/i)).not.toBeInDocument()
    expect(window.localStorage.getItem('credence:install-prompt-handled')).toBeTruthy()
  })

  it('does not re-show the install prompt after it has been handled', () => {
    window.localStorage.setItem('credence:install-prompt-handled', '1')
    renderLayout()

    act(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true })
      window.dispatchEvent(event)
    })

    expect(screen.queryByText(/install this app/i)).not.toBeInDocument()
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
    expect(screen.getByRole('dialog')).toBeInDocument()
  })

  it('recovers from a failed install prompt event without losing the layout', () => {
    renderLayout()

    // Dispatch a malformed event to verify the layout stays functional.
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })

    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInDocument()
    expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInDocument()
  })
})
