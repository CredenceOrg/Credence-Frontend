import { describe, it, expect, beforeEach, afterEach, viExtend } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

function openDrawer() {
  fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
}

describe('MobileNav', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  // --- render ---

  it('renders a hamburger button', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInDocument()
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
    expect(screen.getByRole('link', { name: /home/i })).toBeInDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInDocument()
  })

  it('does not show primary route links in the drawer', () => {
    renderNav()
    openDrawer()
    expect(screen.queryByRole('link', { name: /^dashboard$/i })).not.toBeInDocument()
    expect(screen.queryByRole('link', { name: /^bond$/i })).not.toBeInDocument()
    expect(screen.queryByRole('link', { name: /^trust score$/i })).not.toBeInDocument()
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

  it('restores body overflow and focus after a failure-boundary close', () => {
    renderNav()
    openDrawer()
    expect(document.body.style.overflow).toBe('hidden')
    const drawer = getDrawer()
    fireEvent.keyDown(drawer, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
    expect(screen.getByRole('button', { name: /open navigation menu/i })).toHaveFocus()
  })
})
