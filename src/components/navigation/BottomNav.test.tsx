import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomNav from './BottomNav'

beforeAll(() => {
  // JSDOM does not implement matchMedia; stub it so useMediaQuery-style hooks don't throw.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
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

function renderBottomNav(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>
  )
}

describe('BottomNav', () => {
  // --- structure ---

  it('renders a nav element with aria-label "Bottom navigation"', () => {
    renderBottomNav()
    expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInTheDocument()
  })

  it('renders exactly 5 tab items', () => {
    renderBottomNav()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
  })

  // --- routing ---

  it('each tab links to the correct href', () => {
    renderBottomNav('/dashboard')
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs).toEqual(['/dashboard', '/bond', '/trust', '/attestations', '/transactions'])
  })

  // --- active state ---

  it('marks the active route tab with aria-current="page"', () => {
    renderBottomNav('/bond')
    // React Router NavLink sets aria-current="page" on the active <a>
    expect(screen.getByRole('link', { name: /bond/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not set aria-current on inactive tabs', () => {
    renderBottomNav('/bond')
    const inactiveNames = [/dashboard/i, /trust score/i, /attestations/i, /transactions/i]
    for (const name of inactiveNames) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('active tab has the bottomNav-tab--active CSS class', () => {
    renderBottomNav('/trust')
    expect(screen.getByRole('link', { name: /trust score/i })).toHaveClass('bottomNav-tab--active')
  })

  it('inactive tabs do not have the bottomNav-tab--active CSS class', () => {
    renderBottomNav('/trust')
    expect(screen.getByRole('link', { name: /dashboard/i })).not.toHaveClass(
      'bottomNav-tab--active'
    )
    expect(screen.getByRole('link', { name: /bond/i })).not.toHaveClass('bottomNav-tab--active')
  })

  // --- labels ---

  it('renders the Dashboard tab label', () => {
    renderBottomNav()
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders the Bond tab label', () => {
    renderBottomNav()
    expect(screen.getByRole('link', { name: /bond/i })).toBeInTheDocument()
  })

  it('renders the Trust Score tab label', () => {
    renderBottomNav()
    expect(screen.getByRole('link', { name: /trust score/i })).toBeInTheDocument()
  })

  it('renders the Attestations tab label', () => {
    renderBottomNav()
    expect(screen.getByRole('link', { name: /attestations/i })).toBeInTheDocument()
  })

  it('renders the Transactions tab label', () => {
    renderBottomNav()
    expect(screen.getByRole('link', { name: /transactions/i })).toBeInTheDocument()
  })

  // --- active state updates when route changes ---

  it('marks /dashboard tab active when on /dashboard', () => {
    renderBottomNav('/dashboard')
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page')
  })

  it('marks /attestations tab active when on /attestations', () => {
    renderBottomNav('/attestations')
    expect(screen.getByRole('link', { name: /attestations/i })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('marks /transactions tab active when on /transactions', () => {
    renderBottomNav('/transactions')
    expect(screen.getByRole('link', { name: /transactions/i })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })
})
