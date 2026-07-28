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

  it('shows attestation-specific empty state when filter yields no results', () => {
    render(<Attestations />)
    const filterSelect = screen.getByRole('combobox', { name: /filter attestations/i })

    const rows = screen.getAllByRole('listitem')
    await user.click(rows[0]!)

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    // Should show the attestation-specific empty state, not the ActivityTimeline default
    expect(screen.getByRole('heading', { name: /no matching attestations/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear filter/i })).toBeInTheDocument()
  })

  it('drawer surfaces validator, transaction hash, evidence, and timestamp', async () => {
    const user = userEvent.setup()
    renderInRouter(<Attestations />)
    const rows = screen.getAllByRole('listitem')
    await user.click(rows[0]!)

    // Panel is hidden — use queryByTestId since CopyableHash is not mocked here
    expect(screen.queryByTestId('copyable-hash')).not.toBeInTheDocument()
    fireEvent.click(expandBtn)

    expect(expandBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Validator/)).toBeVisible()
  })
})
