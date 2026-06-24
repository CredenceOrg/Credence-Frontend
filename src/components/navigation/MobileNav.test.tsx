import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MobileNav from './MobileNav'

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

describe('MobileNav', () => {
  beforeEach(() => {
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
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'false')
  })

  it('drawer gains the open CSS class when opened', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    expect(getDrawer()).toHaveClass('mobileNav-drawer--open')
  })

  // --- close ---

  it('closes the drawer when close button is clicked', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /close navigation menu/i }))
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  it('closes the drawer when the backdrop is clicked', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    const backdrop = document.querySelector('.mobileNav-backdrop') as HTMLElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop)
    expect(getDrawer()).toHaveAttribute('aria-hidden', 'true')
  })

  // --- Escape key (handled by useFocusTrap on the drawer container) ---

  it('closes the drawer on Escape key', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    fireEvent.keyDown(getDrawer(), { key: 'Escape' })
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
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
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

  it('marks the current route with aria-current="page"', () => {
    renderNav('/bond')
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    expect(screen.getByRole('link', { name: /bond/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark inactive routes with aria-current', () => {
    renderNav('/bond')
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    expect(screen.getByRole('link', { name: /trust score/i })).not.toHaveAttribute('aria-current')
  })

  // --- links ---

  it('shows all nav links when drawer is open', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /bond/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /trust score/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  // --- backdrop lifecycle ---

  it('does not render backdrop when drawer is closed', () => {
    renderNav()
    expect(document.querySelector('.mobileNav-backdrop')).toBeNull()
  })

  it('renders backdrop when drawer is open', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    expect(document.querySelector('.mobileNav-backdrop')).not.toBeNull()
  })

  it('removes backdrop after drawer is closed', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /close navigation menu/i }))
    expect(document.querySelector('.mobileNav-backdrop')).toBeNull()
  })
})
