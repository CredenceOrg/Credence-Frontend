import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
      expect(
        screen.getByText(/attestations and events will appear here/i)
      ).toBeInTheDocument()
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
      'applies tone class "%s" to node and status pill',
      (tone) => {
        const { container } = render(
          <ActivityTimeline items={[makeItem({ tone, id: `tone-${tone}` })]} />
        )
        expect(container.querySelector(`.activity-row__node--${tone}`)).not.toBeNull()
        expect(container.querySelector(`.activity-row__status--${tone}`)).not.toBeNull()
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

    it('renders actor prefixed with "By"', () => {
      render(<ActivityTimeline items={[makeItem({ actor: 'Node 99' })]} />)
      expect(screen.getByText('By Node 99')).toBeInTheDocument()
    })
  })
})
