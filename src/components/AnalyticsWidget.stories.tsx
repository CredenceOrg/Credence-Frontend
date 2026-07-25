import type { Meta, StoryObj } from '@storybook/react'
import AnalyticsWidget from './AnalyticsWidget'
import type { AnalyticsPeriodData } from './AnalyticsWidget'

// ── Fixture data ─────────────────────────────────────────────────────────────

const currentPeriod: AnalyticsPeriodData = {
  label: 'Jul 2026',
  metrics: [
    { label: 'Trust Score', value: 684 },
    { label: 'Active Bonds', value: 3 },
    {
      label: 'Total Bonded',
      value: 4250,
      format: (v) => v.toLocaleString(),
      unit: 'USDC',
    },
    { label: 'Attestations', value: 12 },
  ],
}

const previousPeriod: AnalyticsPeriodData = {
  label: 'Jun 2026',
  metrics: [
    { label: 'Trust Score', value: 612 },
    { label: 'Active Bonds', value: 2 },
    {
      label: 'Total Bonded',
      value: 3100,
      format: (v) => v.toLocaleString(),
      unit: 'USDC',
    },
    { label: 'Attestations', value: 8 },
  ],
}

// ── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof AnalyticsWidget> = {
  title: 'Components/AnalyticsWidget',
  component: AnalyticsWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Heading text displayed at the top of the widget.',
    },
    defaultCompare: {
      control: 'boolean',
      description: 'Whether the compare-periods view is on by default (uncontrolled mode).',
    },
    compareEnabled: {
      control: 'boolean',
      description: 'Controlled toggle state (supply alongside onCompareChange).',
    },
    className: {
      control: 'text',
      description: 'Additional CSS class names appended to the widget root.',
    },
  },
  args: {
    title: 'Analytics Overview',
    currentPeriod,
  },
}

export default meta
type Story = StoryObj<typeof AnalyticsWidget>

// ── Stories ──────────────────────────────────────────────────────────────────

/** Default: current period only, no compare toggle. */
export const Default: Story = {
  args: {
    currentPeriod,
  },
}

/** With a previous period available but compare toggled off (default). */
export const WithPreviousPeriodOff: Story = {
  args: {
    currentPeriod,
    previousPeriod,
    defaultCompare: false,
  },
}

/** With compare toggled on by default so both periods are visible immediately. */
export const ComparePeriods: Story = {
  args: {
    currentPeriod,
    previousPeriod,
    defaultCompare: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both the current and previous period columns are rendered side by side when `defaultCompare` is `true`.',
      },
    },
  },
}

/** Controlled: toggle state is owned by the parent story. */
export const Controlled: Story = {
  args: {
    currentPeriod,
    previousPeriod,
    compareEnabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Provide `compareEnabled` and `onCompareChange` to lift state outside the component. ' +
          'The story keeps `compareEnabled` static so you can see the compare layout immediately.',
      },
    },
  },
}

/** Single metric per period (minimal usage). */
export const SingleMetric: Story = {
  args: {
    title: 'Trust Score',
    currentPeriod: {
      label: 'Jul 2026',
      metrics: [{ label: 'Score', value: 684 }],
    },
    previousPeriod: {
      label: 'Jun 2026',
      metrics: [{ label: 'Score', value: 612 }],
    },
    defaultCompare: true,
  },
}

/** With a custom format function and unit suffix. */
export const FormattedValues: Story = {
  args: {
    title: 'USDC Activity',
    currentPeriod: {
      label: 'Jul 2026',
      metrics: [
        {
          label: 'Volume',
          value: 128750.5,
          format: (v) =>
            v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          unit: 'USDC',
        },
        {
          label: 'Transactions',
          value: 47,
        },
      ],
    },
    previousPeriod: {
      label: 'Jun 2026',
      metrics: [
        {
          label: 'Volume',
          value: 95200.0,
          format: (v) =>
            v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          unit: 'USDC',
        },
        {
          label: 'Transactions',
          value: 31,
        },
      ],
    },
    defaultCompare: true,
  },
}

/** No previousPeriod — the toggle is hidden entirely. */
export const NoPreviousPeriod: Story = {
  args: {
    title: 'This Month',
    currentPeriod,
    previousPeriod: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `previousPeriod` is not supplied, the compare toggle is not rendered.',
      },
    },
  },
}
