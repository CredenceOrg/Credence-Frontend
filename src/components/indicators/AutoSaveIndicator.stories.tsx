import type { Meta, StoryObj } from '@storybook/react'
import AutoSaveIndicator, { type AutoSaveIndicatorLabels } from './AutoSaveIndicator'

const labels: AutoSaveIndicatorLabels = {
  saving: 'Saving…',
  saved: 'Saved',
  savedRelative: (relative: string) => `Saved ${relative}`,
  error: "Couldn't save. Try again.",
  retry: 'Retry',
}

const meta: Meta<typeof AutoSaveIndicator> = {
  title: 'Components/AutoSaveIndicator',
  component: AutoSaveIndicator,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['idle', 'pending', 'saving', 'saved', 'error'],
      description: 'Current auto-save lifecycle status.',
    },
    lastSavedAt: {
      control: 'number',
      description:
        'Unix-ms timestamp of the most recent successful save. Drives relative-time labels.',
    },
    onRetry: {
      action: 'retry',
      description: 'Called when the user clicks the Retry button in the error state.',
    },
    ttlMs: {
      control: 'number',
      description:
        'How long the "Saved" pill stays visible after a successful save (ms). Defaults to 6 000.',
    },
    className: {
      control: 'text',
      description: 'Additional CSS class appended to the root element.',
    },
  },
  args: {
    status: 'saved',
    lastSavedAt: Date.now() - 1000,
    labels,
  },
}

export default meta
type Story = StoryObj<typeof AutoSaveIndicator>

export const Idle: Story = {
  args: {
    status: 'idle',
    lastSavedAt: null,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders nothing when idle — the pill is only visible during active save lifecycle states.',
      },
    },
  },
}

export const Pending: Story = {
  args: {
    status: 'pending',
    lastSavedAt: null,
  },
}

export const Saving: Story = {
  args: {
    status: 'saving',
    lastSavedAt: null,
  },
}

export const SavedJustNow: Story = {
  args: {
    status: 'saved',
    lastSavedAt: Date.now() - 1000,
  },
}

export const SavedSecondsAgo: Story = {
  args: {
    status: 'saved',
    lastSavedAt: Date.now() - 5_500,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When 5+ seconds have elapsed, the label switches from "Saved just now" to "Saved Ns ago".',
      },
    },
  },
}

export const SavedMinutesAgo: Story = {
  args: {
    status: 'saved',
    lastSavedAt: Date.now() - 120_000,
    ttlMs: 300_000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Uses a custom `ttlMs` of 5 minutes to keep the pill visible so the minute-ago label is observable.',
      },
    },
  },
}

export const ErrorWithRetry: Story = {
  args: {
    status: 'error',
    lastSavedAt: null,
    onRetry: () => {},
  },
}

export const ErrorWithoutRetry: Story = {
  args: {
    status: 'error',
    lastSavedAt: null,
  },
  parameters: {
    docs: {
      description: {
        story: 'When `onRetry` is omitted, only the error message is shown — no Retry button.',
      },
    },
  },
}

/** All non-idle states side-by-side for quick visual comparison. */
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <AutoSaveIndicator status="pending" lastSavedAt={null} labels={labels} />
      <AutoSaveIndicator status="saving" lastSavedAt={null} labels={labels} />
      <AutoSaveIndicator status="saved" lastSavedAt={Date.now() - 1000} labels={labels} />
      <AutoSaveIndicator status="error" lastSavedAt={null} labels={labels} onRetry={() => {}} />
    </div>
  ),
}
