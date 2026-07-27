import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SpeedDial, { SPEED_DIAL_DEFAULT_ACTIONS } from './SpeedDial'

// useNavigate is called inside SpeedDial when an action button is clicked.
// We mock the whole react-router-dom module so we can assert navigate calls.
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderSpeedDial(props: Partial<React.ComponentProps<typeof SpeedDial>> = {}) {
  return render(
    <MemoryRouter>
      <SpeedDial {...props} />
    </MemoryRouter>
  )
}

describe('SpeedDial', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  // ── render ──────────────────────────────────────────────────────────────

  it('renders the FAB toggle button', () => {
    renderSpeedDial()
    expect(screen.getByRole('button', { name: /open quick actions/i })).toBeInTheDocument()
  })

  it('renders as a nav landmark with an accessible name', () => {
    renderSpeedDial()
    expect(screen.getByRole('navigation', { name: /quick actions/i })).toBeInTheDocument()
  })

  it('action list is not visible before FAB is clicked (collapsed state)', () => {
    renderSpeedDial()
    const list = screen.getByRole('list', { name: /quick action menu/i })
    expect(list).not.toHaveClass('speedDial__actions--open')
  })

  // ── open ────────────────────────────────────────────────────────────────

  it('opens the action list when FAB is clicked', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    const list = screen.getByRole('list', { name: /quick action menu/i })
    expect(list).toHaveClass('speedDial__actions--open')
  })

  it('FAB aria-expanded is false when closed', () => {
    renderSpeedDial()
    expect(screen.getByRole('button', { name: /open quick actions/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('FAB aria-expanded is true when open', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    expect(screen.getByRole('button', { name: /close quick actions/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('FAB aria-controls points to the action list id', () => {
    renderSpeedDial()
    const fab = screen.getByRole('button', { name: /open quick actions/i })
    expect(fab).toHaveAttribute('aria-controls', 'speed-dial-actions')
  })

  // ── close ───────────────────────────────────────────────────────────────

  it('closes the action list when FAB is clicked again', () => {
    renderSpeedDial()
    const fab = screen.getByRole('button', { name: /open quick actions/i })
    fireEvent.click(fab)
    fireEvent.click(screen.getByRole('button', { name: /close quick actions/i }))
    const list = screen.getByRole('list', { name: /quick action menu/i })
    expect(list).not.toHaveClass('speedDial__actions--open')
  })

  it('closes the action list on Escape key press', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    fireEvent.keyDown(window, { key: 'Escape' })
    const list = screen.getByRole('list', { name: /quick action menu/i })
    expect(list).not.toHaveClass('speedDial__actions--open')
  })

  it('returns focus to the FAB after Escape closes the menu', async () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open quick actions/i })).toHaveFocus()
    })
  })

  // ── default actions ─────────────────────────────────────────────────────

  it('renders three action buttons by default', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    const actionButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.classList.contains('speedDial__action'))
    expect(actionButtons).toHaveLength(3)
  })

  it('renders a Send action button', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    expect(screen.getByRole('button', { name: /send funds/i })).toBeInTheDocument()
  })

  it('renders a Receive action button', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    expect(screen.getByRole('button', { name: /receive funds/i })).toBeInTheDocument()
  })

  it('renders a Swap action button', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    expect(screen.getByRole('button', { name: /swap assets/i })).toBeInTheDocument()
  })

  // ── navigation ──────────────────────────────────────────────────────────

  it('navigates to /transactions?action=send on Send click', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    fireEvent.click(screen.getByRole('button', { name: /send funds/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/transactions?action=send')
  })

  it('navigates to /transactions?action=receive on Receive click', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    fireEvent.click(screen.getByRole('button', { name: /receive funds/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/transactions?action=receive')
  })

  it('navigates to /transactions?action=swap on Swap click', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    fireEvent.click(screen.getByRole('button', { name: /swap assets/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/transactions?action=swap')
  })

  it('closes the menu after an action is activated', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    fireEvent.click(screen.getByRole('button', { name: /send funds/i }))
    const list = screen.getByRole('list', { name: /quick action menu/i })
    expect(list).not.toHaveClass('speedDial__actions--open')
  })

  // ── custom actions ───────────────────────────────────────────────────────

  it('renders custom actions when passed via props', () => {
    const customActions = [
      {
        id: 'custom',
        label: 'Custom',
        to: '/custom',
        icon: <span>★</span>,
        ariaLabel: 'Do custom thing',
      },
    ]
    renderSpeedDial({ actions: customActions })
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    expect(screen.getByRole('button', { name: /do custom thing/i })).toBeInTheDocument()
  })

  // ── tabIndex management ──────────────────────────────────────────────────

  it('action buttons have tabIndex=-1 when menu is closed', () => {
    renderSpeedDial()
    // When closed all action buttons (inside collapsed list) should have tabIndex=-1
    const actionButtons = document
      .querySelectorAll<HTMLButtonElement>('.speedDial__action')
    actionButtons.forEach((btn) => {
      expect(btn).toHaveAttribute('tabindex', '-1')
    })
  })

  it('action buttons have tabIndex=0 when menu is open', () => {
    renderSpeedDial()
    fireEvent.click(screen.getByRole('button', { name: /open quick actions/i }))
    const actionButtons = document
      .querySelectorAll<HTMLButtonElement>('.speedDial__action')
    actionButtons.forEach((btn) => {
      expect(btn).toHaveAttribute('tabindex', '0')
    })
  })

  // ── SPEED_DIAL_DEFAULT_ACTIONS export ────────────────────────────────────

  it('exports the three default actions', () => {
    expect(SPEED_DIAL_DEFAULT_ACTIONS).toHaveLength(3)
    const ids = SPEED_DIAL_DEFAULT_ACTIONS.map((a) => a.id)
    expect(ids).toContain('send')
    expect(ids).toContain('receive')
    expect(ids).toContain('swap')
  })

  it('default Send action routes to /transactions?action=send', () => {
    const sendAction = SPEED_DIAL_DEFAULT_ACTIONS.find((a) => a.id === 'send')
    expect(sendAction?.to).toBe('/transactions?action=send')
  })

  it('default Receive action routes to /transactions?action=receive', () => {
    const receiveAction = SPEED_DIAL_DEFAULT_ACTIONS.find((a) => a.id === 'receive')
    expect(receiveAction?.to).toBe('/transactions?action=receive')
  })

  it('default Swap action routes to /transactions?action=swap', () => {
    const swapAction = SPEED_DIAL_DEFAULT_ACTIONS.find((a) => a.id === 'swap')
    expect(swapAction?.to).toBe('/transactions?action=swap')
  })
})
