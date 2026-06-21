import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^credence$/i })).toBeInTheDocument()
  })

  it('renders theme toggle button', () => {
    renderLayout()
    expect(screen.getByRole('button', { name: /switch to/i })).toBeInTheDocument()
  })

  it('renders desktop navigation links', () => {
    renderLayout()
    const desktopLinks = screen.getAllByRole('link', { name: /dashboard|bond|trust score|settings/i })
    expect(desktopLinks.length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /dashboard/i }).length).toBeGreaterThan(0)
  })

  it('marks active link on desktop navigation', () => {
    renderLayout('/bond')
    const activeLinks = screen.getAllByRole('link', { name: /bond/i })
    const hasActiveClass = activeLinks.some((link) =>
      link.classList.contains('appNav-link--active') || link.classList.contains('mobileNav-link--active'),
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
    const bondLink = screen.getAllByRole('link', { name: /bond/i }).find(link => drawer.contains(link))
    
    expect(bondLink).toBeDefined()
    if (bondLink) {
      fireEvent.click(bondLink)
    }
    
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
  })
})
