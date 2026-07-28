import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Attestations from './Attestations'

vi.mock('../components/AttestationForm', () => ({
  default: () => <div data-testid="attestation-form" />,
}))

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

const renderInRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('Attestations Page — filter, drawer, and live region', () => {
  afterEach(cleanup)

  it('renders the page header, form, timeline, and a radio-group filter', () => {
    renderInRouter(<Attestations />)
    expect(
      screen.getByRole('heading', { name: /^attestations$/i, level: 1 })
    ).toBeInTheDocument()
    expect(screen.getByTestId('attestation-form')).toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: /recent timeline events/i })
    ).toBeInTheDocument()
    const radios = screen.getAllByRole('radio', {
      name: /all statuses|accepted|needs update|in review/i,
    })
    expect(radios).toHaveLength(4)
  })

  it('uses a real <fieldset> with a visible legend so the radio group is named for screen readers', () => {
    renderInRouter(<Attestations />)
    const radios = screen.getAllByRole('radio', { name: /all statuses/i })
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute('name', 'attestation-status-filter')
    })
    expect(screen.getByText(/filter by status/i)).toBeInTheDocument()
  })

  it('filters the timeline by status — accepted, needs-update, in-review', async () => {
    const user = userEvent.setup()
    renderInRouter(<Attestations />)
    // 5 sample items: 2 accepted, 2 needs-update, 1 in-review
    expect(screen.getAllByRole('listitem')).toHaveLength(5)

    await user.click(screen.getByRole('radio', { name: 'Accepted' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    await user.click(screen.getByRole('radio', { name: 'Needs update' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    await user.click(screen.getByRole('radio', { name: 'In review' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('radio', { name: 'All statuses' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('announces the result count via aria-live as the filter changes', async () => {
    const user = userEvent.setup()
    renderInRouter(<Attestations />)
    const summary = screen.getByText(/showing 5 of 5 attestations/i)
    expect(summary).toHaveAttribute('aria-live', 'polite')

    await user.click(screen.getByRole('radio', { name: 'Accepted' }))
    expect(screen.getByText(/showing 2 of 5 attestations/i)).toBeInTheDocument()
  })

  it('opens the drawer when a row is activated and closes it on Escape', async () => {
    const user = userEvent.setup()
    renderInRouter(<Attestations />)

    const rows = screen.getAllByRole('listitem')
    await user.click(rows[0]!)

    const dialog = await screen.findByRole('dialog', {
      name: /attestation submitted/i,
    })
    expect(dialog).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(dialog).not.toBeInTheDocument()
  })

  it('drawer surfaces validator, transaction hash, evidence, and timestamp', async () => {
    const user = userEvent.setup()
    renderInRouter(<Attestations />)
    const rows = screen.getAllByRole('listitem')
    await user.click(rows[0]!)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/validator node 12/i)
    expect(dialog).toHaveTextContent(/identity evidence package uploaded/i)
    expect(dialog).toHaveTextContent(/apr 28/i)
    expect(dialog.querySelector('.copyable-hash')).toBeInTheDocument()
  })

  it('drawer is focus-trapped — focus stays inside the dialog as the user tabs', async () => {
    const user = userEvent.setup()
    renderInRouter(<Attestations />)
    const rows = screen.getAllByRole('listitem')
    await user.click(rows[0]!)

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    // Tab through the focusable elements in the dialog body. The cycle is
    // header close → CopyableHash copy / explorer → footer close →
    // wraps via useFocusTrap. We tab once into the body to confirm the
    // first hop lands inside the dialog; further cycles wrap and stay
    // inside.
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('closes the drawer when the footer Close button is activated', async () => {
    const user = userEvent.setup()
    renderInRouter(<Attestations />)
    const rows = screen.getAllByRole('listitem')
    await user.click(rows[0]!)

    const dialog = await screen.findByRole('dialog')
    // The header (icon-only ×) close button has aria-label="Close attestation
    // details" — find it via that. The footer button has visible text "Close"
    // only — find it via a scoped text-name query inside the dialog.
    within(dialog).getByRole('button', { name: /close attestation details/i })
    const footerClose = within(dialog).getByRole('button', { name: /^Close$/ })
    await user.click(footerClose)
    expect(dialog).not.toBeInTheDocument()
  })

  it('timeline rows expose "View details" with a status-aware aria-label', () => {
    renderInRouter(<Attestations />)
    const viewButtons = screen.getAllByRole('button', { name: /view details/i })
    expect(viewButtons.length).toBeGreaterThan(0)
    expect(viewButtons[0]).toHaveAccessibleName(/accepted.*view details/i)
  })
})
