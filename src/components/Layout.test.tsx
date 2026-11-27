import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import { SettingsProvider } from '../context/SettingsContext'
import { KEYBOARD_SHORTCUTS } from '../data/keyboardShortcuts'

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
    expect(screen.getByRole('button', { name: /switch to .* mode/i })).toBeInTheDocument()
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

  // --- HeaderWallet / WalletConnect demo guard ---

  it('does not render the fake demo balance "128.4 XLM" in the header', () => {
    // The header must never show the hard-coded placeholder from the old
    // uncontrolled WalletConnect demo path.
    renderLayout()
    expect(screen.queryByText(/128\.4 XLM/)).not.toBeInTheDocument()
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
    expect(window.sessionStorage.getItem('credence:install-prompt-handled')).toBe('handled')
  })

  it('does not re-show the install prompt after it has been handled', () => {
    window.sessionStorage.setItem('credence:install-prompt-handled', 'handled')
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

describe('Layout theme shortcut (T)', () => {
  function renderWithSettings() {
    return render(
      <SettingsProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route
                index
                element={
                  <div>
                    <input aria-label="Search field" />
                    <textarea aria-label="Notes field" />
                    <div contentEditable suppressContentEditableWarning aria-label="Editable">
                      edit me
                    </div>
                    <select aria-label="Pick one">
                      <option>a</option>
                    </select>
                  </div>
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </SettingsProvider>
    )
  }

  const theme = () => document.documentElement.dataset.theme
  const announcer = () => screen.getByTestId('theme-announcer')

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    cleanup()
  })

  it('toggles light to dark and back when T is pressed outside inputs', () => {
    renderWithSettings()
    expect(theme()).toBe('light')

    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT' })
    expect(theme()).toBe('dark')

    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT' })
    expect(theme()).toBe('light')
  })

  it('also responds to an uppercase T (Caps Lock)', () => {
    renderWithSettings()
    fireEvent.keyDown(document.body, { key: 'T', code: 'KeyT' })
    expect(theme()).toBe('dark')
  })

  it('announces the change politely', () => {
    renderWithSettings()
    expect(announcer()).toHaveAttribute('aria-live', 'polite')
    expect(announcer()).toBeEmptyDOMElement()

    fireEvent.keyDown(document.body, { key: 't' })
    expect(announcer()).toHaveTextContent('Switched to dark mode')

    fireEvent.keyDown(document.body, { key: 't' })
    expect(announcer()).toHaveTextContent('Switched to light mode')
  })

  it('keeps the header theme toggle in sync with the shortcut', () => {
    renderWithSettings()
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()

    fireEvent.keyDown(document.body, { key: 't' })

    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  })

  it('persists the chosen theme through the settings store', () => {
    renderWithSettings()
    fireEvent.keyDown(document.body, { key: 't' })

    const saved = JSON.parse(localStorage.getItem('credence:settings') ?? '{}')
    expect(saved.themeMode).toBe('dark')
  })

  it.each([
    ['input', 'Search field'],
    ['textarea', 'Notes field'],
    ['select', 'Pick one'],
  ])('ignores T typed inside a %s', (_label, name) => {
    renderWithSettings()
    const field = screen.getByLabelText(name)
    field.focus()

    fireEvent.keyDown(field, { key: 't', code: 'KeyT' })

    expect(theme()).toBe('light')
    expect(announcer()).toBeEmptyDOMElement()
  })

  it('ignores T typed inside a contenteditable region', () => {
    renderWithSettings()
    const editable = screen.getByLabelText('Editable')

    fireEvent.keyDown(editable, { key: 't', code: 'KeyT' })

    expect(theme()).toBe('light')
  })

  it('lets T type normally in an input (default is not prevented)', () => {
    renderWithSettings()
    const input = screen.getByLabelText('Search field')

    const notPrevented = fireEvent.keyDown(input, { key: 't', code: 'KeyT' })

    expect(notPrevented).toBe(true)
  })

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Alt', { altKey: true }],
    ['Shift', { shiftKey: true }],
  ])('ignores %s+T modifier combos', (_label, modifiers) => {
    renderWithSettings()

    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT', ...modifiers })

    expect(theme()).toBe('light')
    expect(announcer()).toBeEmptyDOMElement()
  })

  it('ignores auto-repeat keydown events so holding T does not flicker', () => {
    renderWithSettings()

    fireEvent.keyDown(document.body, { key: 't', repeat: true })

    expect(theme()).toBe('light')
  })

  it('ignores other keys', () => {
    renderWithSettings()
    fireEvent.keyDown(document.body, { key: 'y', code: 'KeyY' })
    expect(theme()).toBe('light')
  })

  it('keeps the shortcuts help dialog entry accurate', () => {
    const entry = KEYBOARD_SHORTCUTS.find((s) => s.label === 'Toggle light / dark theme')
    expect(entry).toBeDefined()
    expect(entry?.keys).toEqual(['T'])
  })
})
