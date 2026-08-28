import type { Meta, StoryObj } from '@storybook/react'
import LoadingSkeleton from './LoadingSkeleton'

const meta = {
  title: 'States/LoadingSkeleton',
  component: LoadingSkeleton,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'text',
        'card',
        'form',
        'table',
        'dashboard',
        'stat-widget',
        'list-row',
        'bond-row',
        'trust-score',
      ],
    },
    rows: { control: { type: 'number', min: 1, max: 10 } },
    width: { control: 'text' },
    height: { control: 'text' },
  },
} satisfies Meta<typeof LoadingSkeleton>

export default meta
type Story = StoryObj<typeof meta>

// ─── Individual variant stories ───────────────────────────────────────────────

export const Text: Story = {
  args: {
    variant: 'text',
    rows: 3,
    width: '400px',
  },
}

export const Card: Story = {
  args: {
    variant: 'card',
    width: '400px',
  },
}

export const Form: Story = {
  args: {
    variant: 'form',
    rows: 3,
    width: '400px',
  },
}

export const Table: Story = {
  args: {
    variant: 'table',
    rows: 5,
    width: '600px',
  },
}

export const Dashboard: Story = {
  args: {
    variant: 'dashboard',
    rows: 3,
    width: '600px',
  },
}

export const StatWidget: Story = {
  args: {
    variant: 'stat-widget',
    width: '220px',
  },
}

export const ListRow: Story = {
  args: {
    variant: 'list-row',
    rows: 4,
    width: '500px',
  },
}

export const BondRow: Story = {
  args: {
    variant: 'bond-row',
    rows: 3,
    width: '600px',
  },
}

export const TrustScore: Story = {
  args: {
    variant: 'trust-score',
    rows: 3,
    width: '600px',
  },
}

// ─── AllVariants: visual comparison grid ─────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '640px' }}>
      <section>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Text</h3>
        <LoadingSkeleton variant="text" rows={3} width="100%" />
      </section>

      <section>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Card</h3>
        <LoadingSkeleton variant="card" width="100%" />
      </section>

      <section>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Form</h3>
        <LoadingSkeleton variant="form" rows={3} width="100%" />
      </section>

      <section>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Table</h3>
        <LoadingSkeleton variant="table" rows={4} width="100%" />
      </section>

      <section>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Dashboard</h3>
        <LoadingSkeleton variant="dashboard" rows={3} width="100%" />
      </section>

      <section>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Stat Widget</h3>
        <LoadingSkeleton variant="stat-widget" width="220px" />
      </section>

      <section>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>List Row</h3>
        <LoadingSkeleton variant="list-row" rows={3} width="100%" />
      </section>

      <section>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Bond Row</h3>
        <LoadingSkeleton variant="bond-row" rows={3} width="100%" />
      </section>

      <section>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Trust Score</h3>
        <LoadingSkeleton variant="trust-score" rows={3} width="100%" />
      </section>
    </div>
  ),
}
