import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActivityTimeline, {
  ActivityItem,
  isTxHash,
  toneToBadgeVariant,
  resolveItemStatus,
} from './ActivityTimeline'

const makeItem = (overrides: Partial<ActivityItem> = {}): ActivityItem => ({
  id: 'test-1',
  timestamp: 'Jun 20, 10:00 UTC',
  title: 'Test event',
  description: 'A test event description.',
  actor: 'Test Actor',
  statusLabel: 'Done',
  tone: 'info',
  meta: 'meta-value',
  ...overrides,
})

const amountItem = (amountUsdc: number): ActivityItem =>
  makeItem({ id: `amount-${amountUsdc}`, amountUsdc })

// Mock CopyableHash to avoid clipboard complexity in tests
vi.mock('./CopyableHash', () => ({
  default: ({ hash }: { hash: string }) => <span data-testid="copyable-hash">{hash}</span>,
}))

// Mock Badge to test variant mapping
vi.mock('./Badge', () => ({
  default: ({ variant, label }: { variant: string; label?: string }) => (
    <span data-testid={`badge-${variant}`}>{label || variant}</span>
  ),
}))

describe('toneToBadgeVariant', () => {
  it.each([
    ['success', 'active'],
    ['warning', 'grace-period'],
    ['info', 'locked'],
  ] as const)('maps tone "%s" to Badge variant "%s"', (tone, expectedVariant) => {
    expect(toneToBadgeVariant(tone)).toBe(expectedVariant)
  })
})

describe('isTxHash', () => {
  it.each([
    ['Tx 0x93a1...22f4', true],
    ['tx 0x1234...5678', true],
    ['Tx 0xabc', true],
    ['Rule AV-17', false],
    ['Window +90d', false],
    ['some other meta', false],
  ])('correctly identifies "%s" as %s', (meta, expected) => {
    expect(isTxHash(meta)).toBe(expected)
  })
})

describe('resolveItemStatus', () => {
  it('returns explicit item.status when present', () => {
    const item = makeItem({ status: 'accepted', tone: 'warning' })
    expect(resolveItemStatus(item)).toBe('accepted')
  })

  it('falls back to toneToStatus when status is not present', () => {
    const item = makeItem({ status: undefined, tone: 'warning' })
    expect(resolveItemStatus(item)).toBe('needs-update')
  })

  it('falls back to toneToStatus for success tone', () => {
    const item = makeItem({ status: undefined, tone: 'success' })
    expect(resolveItemStatus(item)).toBe('accepted')
  })

  it('falls back to toneToStatus for info tone', () => {
    const item = makeItem({ status: undefined, tone: 'info' })
    expect(resolveItemStatus(item)).toBe('in-review')
  })
})

describe('ActivityTimeline', () => {
  describe('default (no props)', () => {
    it('renders the section with the correct aria-label', () => {
      render(<ActivityTimeline />)
      expect(screen.getByRole('region', { name: /activity and attestations/i })).toBeInTheDocument()
    })

    it('renders the eyebrow and title', () => {
      render(<ActivityTimeline />)
      expect(screen.getByText('Activity Surface Concept')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Attestation timeline' })).toBeInTheDocument()
    })

    it('binds operation to a durable request key or nonce when provided', () => {
      render(<ActivityTimeline nonce="test-nonce-123" />)
      const section = screen.getByRole('region', { name: /activity and attestations/i })
      expect(section).toHaveAttribute('data-nonce', 'test-nonce-123')
    })

    it('shows "5 recent events" summary for the sample data', () => {
      render(<ActivityTimeline />)
      expect(screen.getByText('5 recent events')).toBeInTheDocument()
    })

    it('renders the sample timeline list', () => {
      render(<ActivityTimeline />)
      expect(screen.getByRole('list', { name: /recent timeline events/i })).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(5)
    })

    it('renders all five sample event titles', () => {
      render(<ActivityTimeline />)
      expect(screen.getByText('Attestation submitted')).toBeInTheDocument()
      expect(screen.getByText('Proof mismatch detected')).toBeInTheDocument()
      expect(screen.getByText('Credential refreshed')).toBeInTheDocument()
      expect(screen.getByText('Bond-backed identity confirmed')).toBeInTheDocument()
      expect(screen.getByText('Stale credential flagged')).toBeInTheDocument()
    })
  })

  describe('empty items', () => {
    it('renders the EmptyState heading when items is an empty array', () => {
      render(<ActivityTimeline items={[]} />)
      expect(screen.getByRole('heading', { name: /no activity yet/i })).toBeInTheDocument()
    })

    it('renders the EmptyState description', () => {
      render(<ActivityTimeline items={[]} />)
      expect(screen.getByText(/attestations and events will appear here/i)).toBeInTheDocument()
    })

    it('does not render the timeline list', () => {
      render(<ActivityTimeline items={[]} />)
      expect(screen.queryByRole('list', { name: /recent timeline events/i })).toBeNull()
    })

    it('does not render the summary count', () => {
      render(<ActivityTimeline items={[]} />)
      expect(screen.queryByText(/recent event/i)).toBeNull()
    })

    it('still renders the section heading', () => {
      render(<ActivityTimeline items={[]} />)
      expect(screen.getByRole('heading', { name: 'Attestation timeline' })).toBeInTheDocument()
    })
  })

  describe('single item', () => {
    it('shows "1 recent event" (singular)', () => {
      render(<ActivityTimeline items={[makeItem()]} />)
      expect(screen.getByText('1 recent event')).toBeInTheDocument()
    })

    it('does not show plural "events" label', () => {
      render(<ActivityTimeline items={[makeItem()]} />)
      expect(screen.queryByText(/\d+ recent events/)).toBeNull()
    })

    it('renders exactly one list item', () => {
      render(<ActivityTimeline items={[makeItem()]} />)
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
    })
  })

  describe('multiple items', () => {
    const items: ActivityItem[] = [
      makeItem({ id: 'a', title: 'Alpha' }),
      makeItem({ id: 'b', title: 'Beta' }),
      makeItem({ id: 'c', title: 'Gamma' }),
      makeItem({ id: 'd', title: 'Delta' }),
      makeItem({ id: 'e', title: 'Epsilon' }),
    ]

    it('shows correct plural count', () => {
      render(<ActivityTimeline items={items} />)
      expect(screen.getByText('5 recent events')).toBeInTheDocument()
    })

    it('renders the correct number of list items', () => {
      render(<ActivityTimeline items={items} />)
      expect(screen.getAllByRole('listitem')).toHaveLength(5)
    })
  })

  describe('tone classes', () => {
    it.each(['success', 'warning', 'info'] as const)('applies tone class "%s" to node', (tone) => {
      const { container } = render(
        <ActivityTimeline items={[makeItem({ tone, id: `tone-${tone}` })]} />
      )
      expect(container.querySelector(`.activity-row__node--${tone}`)).not.toBeNull()
    })

    it.each(['success', 'warning', 'info'] as const)(
      'renders Badge with correct variant for tone "%s"',
      (tone) => {
        render(<ActivityTimeline items={[makeItem({ tone, id: `tone-${tone}` })]} />)
        const expectedVariant = toneToBadgeVariant(tone)
        expect(screen.getByTestId(`badge-${expectedVariant}`)).toBeInTheDocument()
      }
    )
  })

  describe('a11y semantics', () => {
    it('renders timestamps as <time> elements', () => {
      const { container } = render(<ActivityTimeline items={[makeItem()]} />)
      expect(container.querySelector('time')).not.toBeNull()
      expect(container.querySelector('time')?.textContent).toBe('Jun 20, 10:00 UTC')
    })

    it('renders the rail as aria-hidden', () => {
      const { container } = render(<ActivityTimeline items={[makeItem()]} />)
      expect(container.querySelector('.activity-row__rail')).toHaveAttribute('aria-hidden', 'true')
    })

    describe('disclosure interaction', () => {
      it('renders disclosure button in collapsed state with aria-expanded="false"', () => {
        render(<ActivityTimeline items={[makeItem()]} />)
        const button = screen.getByRole('button', { name: /show details/i })
        expect(button).toHaveAttribute('aria-expanded', 'false')
      })

      it('renders disclosure button with aria-controls pointing to panel', () => {
        render(<ActivityTimeline items={[makeItem({ id: 'test-item' })]} />)
        const button = screen.getByRole('button', { name: /show details/i })
        expect(button).toHaveAttribute('aria-controls', 'details-test-item')
      })

      it('expands panel and sets aria-expanded="true" on click', async () => {
        const user = userEvent.setup()
        render(<ActivityTimeline items={[makeItem({ id: 'test-item' })]} />)

        const button = screen.getByRole('button', { name: /show details/i })
        await user.click(button)

        expect(button).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByText('Actor:')).toBeInTheDocument()
        expect(screen.getByText('Meta:')).toBeInTheDocument()
      })

      it('collapses panel and sets aria-expanded="false" on second click', async () => {
        const user = userEvent.setup()
        render(<ActivityTimeline items={[makeItem({ id: 'test-item' })]} />)

        const button = screen.getByRole('button', { name: /show details/i })
        await user.click(button)
        await user.click(button)

        expect(button).toHaveAttribute('aria-expanded', 'false')
        // Panel is unmounted when collapsed
        const panel = document.getElementById('details-test-item')
        expect(panel).toBeNull()
      })

      it('toggles panel visibility via Enter key', async () => {
        const user = userEvent.setup()
        render(<ActivityTimeline items={[makeItem({ id: 'test-item' })]} />)

        const button = screen.getByRole('button', { name: /show details/i })
        button.focus()
        await user.keyboard('{Enter}')

        expect(button).toHaveAttribute('aria-expanded', 'true')
      })

      it('toggles panel visibility via Space key', async () => {
        const user = userEvent.setup()
        render(<ActivityTimeline items={[makeItem({ id: 'test-item' })]} />)

        const button = screen.getByRole('button', { name: /show details/i })
        button.focus()
        await user.keyboard(' ')

        expect(button).toHaveAttribute('aria-expanded', 'true')
      })

      it('closes panel via Escape key and returns focus to trigger', async () => {
        const user = userEvent.setup()
        render(<ActivityTimeline items={[makeItem({ id: 'test-item' })]} />)

        const button = screen.getByRole('button', { name: /show details/i })
        await user.click(button)

        const panel = document.getElementById('details-test-item')
        expect(panel).toBeInTheDocument()
        expect(panel).not.toHaveAttribute('hidden')

        // Escape should close the panel - fire on panel element
        fireEvent.keyDown(panel!, { key: 'Escape' })

        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(button).toHaveFocus()
      })
    })

    describe('meta rendering', () => {
      it('renders tx hash meta via CopyableHash component', async () => {
        const user = userEvent.setup()
        render(<ActivityTimeline items={[makeItem({ meta: 'Tx 0x93a1...22f4' })]} />)

        const button = screen.getByRole('button', { name: /show details/i })
        await user.click(button)

        expect(screen.getByTestId('copyable-hash')).toBeInTheDocument()
        expect(screen.getByTestId('copyable-hash').textContent).toBe('Tx 0x93a1...22f4')
      })

      it('renders non-tx meta as plain text', async () => {
        const user = userEvent.setup()
        render(<ActivityTimeline items={[makeItem({ meta: 'Rule AV-17' })]} />)

        const button = screen.getByRole('button', { name: /show details/i })
        await user.click(button)

        expect(screen.getByText('Rule AV-17')).toBeInTheDocument()
        expect(screen.queryByTestId('copyable-hash')).toBeNull()
      })
    })
  })

  describe('amount display', () => {
    it('renders a formatted amount when amountUsdc is provided', () => {
      render(<ActivityTimeline items={[amountItem(1500)]} />)
      expect(screen.getByText('1,500 USDC')).toBeInTheDocument()
    })

    it('renders "0 USDC" for a zero amount', () => {
      render(<ActivityTimeline items={[amountItem(0)]} />)
      expect(screen.getByText('0 USDC')).toBeInTheDocument()
    })

    it('renders fractional amounts with correct precision', () => {
      render(<ActivityTimeline items={[amountItem(1234.567)]} />)
      expect(screen.getByText('1,234.57 USDC')).toBeInTheDocument()
    })

    it('does not render an amount element when amountUsdc is absent', () => {
      const { container } = render(
        <ActivityTimeline items={[makeItem({ amountUsdc: undefined })]} />
      )
      expect(container.querySelector('.activity-row__amount')).toBeNull()
    })

    it('renders "—" for NaN amount', () => {
      render(<ActivityTimeline items={[amountItem(NaN)]} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('renders "—" for Infinity amount', () => {
      render(<ActivityTimeline items={[amountItem(Infinity)]} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('renders "—" for negative amount', () => {
      render(<ActivityTimeline items={[amountItem(-5)]} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('renders a large amount with thousand separators', () => {
      render(<ActivityTimeline items={[amountItem(1_000_000)]} />)
      expect(screen.getByText('1,000,000 USDC')).toBeInTheDocument()
    })

    it('includes aria-label with formatted amount', () => {
      render(<ActivityTimeline items={[amountItem(1500)]} />)
      expect(screen.getByLabelText('Amount: 1,500 USDC')).toBeInTheDocument()
    })

    it('renders amounts for each item independently', () => {
      const items = [
        makeItem({ id: 'a', title: 'Alpha', amountUsdc: 100 }),
        makeItem({ id: 'b', title: 'Beta' }),
        makeItem({ id: 'c', title: 'Gamma', amountUsdc: 200 }),
      ]
      render(<ActivityTimeline items={items} />)
      expect(screen.getByText('100 USDC')).toBeInTheDocument()
      expect(screen.getByText('200 USDC')).toBeInTheDocument()
      // Beta has no amount, so only 2 amount elements should exist
      const amountEls = screen.getAllByText(/USDC$/)
      // 2 explicit amounts + no hidden amounts
      expect(amountEls).toHaveLength(2)
    })
  })

  describe('selectable mode (onSelect provided)', () => {
    it('renders "View details" disclosure button without aria-expanded/aria-controls', () => {
      const onSelect = vi.fn()
      render(<ActivityTimeline items={[makeItem({ id: 'sel-1' })]} onSelect={onSelect} />)

      const button = screen.getByRole('button', { name: /view details/i })
      expect(button).toBeInTheDocument()
      expect(button).not.toHaveAttribute('aria-expanded')
      expect(button).not.toHaveAttribute('aria-controls')
    })

    it('calls onSelect when row is clicked', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const item = makeItem({ id: 'sel-1' })
      const { container } = render(<ActivityTimeline items={[item]} onSelect={onSelect} />)

      const row = container.querySelector('.activity-row--selectable')
      expect(row).not.toBeNull()
      await user.click(row!)

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(item)
    })

    it('calls onSelect when disclosure button is clicked and stops propagation', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const item = makeItem({ id: 'sel-1' })
      render(<ActivityTimeline items={[item]} onSelect={onSelect} />)

      const button = screen.getByRole('button', { name: /view details/i })
      await user.click(button)

      // Should only be called once, not twice from row propagation
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(item)
    })

    it('calls onSelect when Enter or Space is pressed on disclosure button', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const item = makeItem({ id: 'sel-1' })
      render(<ActivityTimeline items={[item]} onSelect={onSelect} />)

      const button = screen.getByRole('button', { name: /view details/i })
      button.focus()
      await user.keyboard('{Enter}')
      expect(onSelect).toHaveBeenCalledTimes(1)

      await user.keyboard(' ')
      expect(onSelect).toHaveBeenCalledTimes(2)
    })

    it('does not render inline detail panel when onSelect is provided', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(<ActivityTimeline items={[makeItem({ id: 'sel-1' })]} onSelect={onSelect} />)

      const button = screen.getByRole('button', { name: /view details/i })
      await user.click(button)

      expect(document.getElementById('details-sel-1')).toBeNull()
    })
  })

  describe('atomic rollback and state recovery invariants', () => {
    it('resets expandedId when an expanded item is removed during refetch/filter/rollback', async () => {
      const user = userEvent.setup()
      const item1 = makeItem({ id: 'item-1', title: 'Item 1' })
      const item2 = makeItem({ id: 'item-2', title: 'Item 2' })

      const { rerender } = render(<ActivityTimeline items={[item1, item2]} />)

      // Expand item-1
      const button = screen.getAllByRole('button', { name: /show details/i })[0]
      await user.click(button)
      expect(screen.getByText('Actor:')).toBeInTheDocument()
      expect(document.getElementById('details-item-1')).toBeInTheDocument()

      // Rerender with item-1 removed (e.g. rolled back or filtered)
      rerender(<ActivityTimeline items={[item2]} />)

      // Details panel for item-1 must no longer exist, leaving no partial state
      expect(document.getElementById('details-item-1')).toBeNull()
      expect(screen.queryByText('Actor:')).toBeNull()
    })

    it('resets expanded state to empty slate when items become empty', async () => {
      const user = userEvent.setup()
      const item1 = makeItem({ id: 'item-1', title: 'Item 1' })

      const { rerender } = render(<ActivityTimeline items={[item1]} />)

      // Expand item-1
      const button = screen.getByRole('button', { name: /show details/i })
      await user.click(button)
      expect(document.getElementById('details-item-1')).toBeInTheDocument()

      // Rerender with empty items list (e.g. failed lookup or error rollback)
      rerender(<ActivityTimeline items={[]} />)

      // Panel must be unmounted and empty state displayed
      expect(document.getElementById('details-item-1')).toBeNull()
      expect(screen.getByRole('heading', { name: /no activity yet/i })).toBeInTheDocument()
    })

    it('resets expansion state when nonce changes (idempotency / safe replay boundary)', async () => {
      const user = userEvent.setup()
      const item1 = makeItem({ id: 'item-1', title: 'Item 1' })

      const { rerender } = render(<ActivityTimeline items={[item1]} nonce="nonce-1" />)

      // Expand item-1
      const button = screen.getByRole('button', { name: /show details/i })
      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(document.getElementById('details-item-1')).toBeInTheDocument()

      // Nonce updates (new operation / retry)
      rerender(<ActivityTimeline items={[item1]} nonce="nonce-2" />)

      const updatedButton = screen.getByRole('button', { name: /show details/i })
      expect(updatedButton).toHaveAttribute('aria-expanded', 'false')
      expect(document.getElementById('details-item-1')).toBeNull()
    })
  })
})
