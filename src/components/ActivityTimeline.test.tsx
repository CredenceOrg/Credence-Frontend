import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActivityTimeline, { ActivityItem } from './ActivityTimeline'

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

// Mock CopyableHash to avoid clipboard complexity in tests
vi.mock('./CopyableHash', () => ({
  default: ({ hash }: { hash: string }) => (
    <span data-testid="copyable-hash">{hash}</span>
  ),
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
  ] as const)(
    'maps tone "%s" to Badge variant "%s"',
    (tone, expectedVariant) => {
      expect(toneToBadgeVariant(tone)).toBe(expectedVariant)
    }
  )
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

    it('shows "3 recent events" summary for the sample data', () => {
      render(<ActivityTimeline />)
      expect(screen.getByText('3 recent events')).toBeInTheDocument()
    })

    it('renders the sample timeline list', () => {
      render(<ActivityTimeline />)
      expect(screen.getByRole('list', { name: /recent timeline events/i })).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(3)
    })

    it('renders all three sample event titles', () => {
      render(<ActivityTimeline />)
      expect(screen.getByText('Attestation submitted')).toBeInTheDocument()
      expect(screen.getByText('Proof mismatch detected')).toBeInTheDocument()
      expect(screen.getByText('Credential refreshed')).toBeInTheDocument()
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
    it.each(['success', 'warning', 'info'] as const)(
      'applies tone class "%s" to node',
      (tone) => {
        const { container } = render(
          <ActivityTimeline items={[makeItem({ tone, id: `tone-${tone}` })]} />
        )
        expect(container.querySelector(`.activity-row__node--${tone}`)).not.toBeNull()
      }
    )

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
  })

    it('renders actor label', () => {
      render(<ActivityTimeline items={[makeItem({ actor: 'Node 99' })]} />)
      const button = screen.getByText('Show details')
      fireEvent.click(button)
      expect(screen.getByText(/Node 99/)).toBeInTheDocument()
    })
  })

  describe('expandable details and keyboard interaction', () => {
    it('toggles details visibility and aria-expanded state on click', async () => {
      const user = userEvent.setup()
      render(<ActivityTimeline items={[makeItem({ id: 'test-expand', actor: 'Test Actor' })]} />)
      
      const button = screen.getByRole('button', { name: 'Show details' })
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText(/Test Actor/)).toBeNull()

      await user.click(button)
      
      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(button).toHaveTextContent('Hide details')
      expect(screen.getByText(/Test Actor/)).toBeInTheDocument()

      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText(/Test Actor/)).toBeNull()
    })

    it('is fully operable via keyboard', async () => {
      const user = userEvent.setup()
      render(<ActivityTimeline items={[makeItem({ id: 'test-kbd', actor: 'Keyboard Actor' })]} />)
      
      const button = screen.getByRole('button', { name: 'Show details' })
      
      // Focus via Tab
      await user.tab()
      expect(button).toHaveFocus()
      
      // Expand via Enter
      await user.keyboard('[Enter]')
      expect(screen.getByText(/Keyboard Actor/)).toBeInTheDocument()
      
      // Collapse via Space
      await user.keyboard('[Space]')
      expect(screen.queryByText(/Keyboard Actor/)).toBeNull()
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