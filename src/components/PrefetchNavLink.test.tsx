import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PrefetchNavLink } from './PrefetchNavLink'

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('PrefetchNavLink', () => {
  it('renders as a NavLink with the given label', () => {
    const preload = vi.fn().mockResolvedValue(undefined)

    renderInRouter(
      <PrefetchNavLink to="/dashboard" preload={preload}>
        Dashboard
      </PrefetchNavLink>,
    )

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('calls preload on mouse enter', async () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderInRouter(
      <PrefetchNavLink to="/dashboard" preload={preload}>
        Dashboard
      </PrefetchNavLink>,
    )

    await user.hover(screen.getByRole('link', { name: 'Dashboard' }))

    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('calls preload on focus', async () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderInRouter(
      <PrefetchNavLink to="/dashboard" preload={preload}>
        Dashboard
      </PrefetchNavLink>,
    )

    await user.tab()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus()
    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('passes through className prop', () => {
    const preload = vi.fn().mockResolvedValue(undefined)

    renderInRouter(
      <PrefetchNavLink to="/dashboard" preload={preload} className="custom-link">
        Dashboard
      </PrefetchNavLink>,
    )

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('custom-link')
  })

  it('chains user-provided onMouseEnter handler', async () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const onMouseEnter = vi.fn()
    const user = userEvent.setup()

    renderInRouter(
      <PrefetchNavLink to="/dashboard" preload={preload} onMouseEnter={onMouseEnter}>
        Dashboard
      </PrefetchNavLink>,
    )

    await user.hover(screen.getByRole('link', { name: 'Dashboard' }))

    expect(onMouseEnter).toHaveBeenCalledTimes(1)
  })

  it('chains user-provided onFocus handler', async () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const onFocus = vi.fn()
    const user = userEvent.setup()

    renderInRouter(
      <PrefetchNavLink to="/dashboard" preload={preload} onFocus={onFocus}>
        Dashboard
      </PrefetchNavLink>,
    )

    await user.tab()
    expect(onFocus).toHaveBeenCalledTimes(1)
  })
})
