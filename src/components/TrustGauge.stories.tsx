import type { Meta, StoryObj } from '@storybook/react'
import TrustGauge from './TrustGauge'
import { TIER_THRESHOLDS } from '../lib/tier'

const meta: Meta<typeof TrustGauge> = {
  title: 'Components/TrustGauge',
  component: TrustGauge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'TrustGauge is a visual horizontal meter representing a user’s trust score progression across four tier bands (Bronze, Silver, Gold, Platinum). It features threshold markers, progress fills, accessibility ARIA landmarks, and reduced-motion support.',
      },
    },
  },
  argTypes: {
    score: {
      control: { type: 'range', min: 0, max: 1000, step: 1 },
      description: 'Current trust score (0–1000).',
    },
    tier: {
      control: 'select',
      options: ['bronze', 'silver', 'gold', 'platinum'],
      description: 'Current trust tier matching the score.',
    },
    isLoading: {
      control: 'boolean',
      description: 'Whether the gauge data is currently loading.',
    },
    error: {
      control: 'text',
      description: 'Error message if fetching gauge data failed.',
    },
    isStale: {
      control: 'boolean',
      description: 'Whether the displayed data is stale/cached.',
    },
    isPermitted: {
      control: 'boolean',
      description: 'Whether the user has permission to view the gauge.',
    },
    onRetry: { action: 'onRetry' },
    onCommit: { action: 'onCommit' },
  },
  args: {
    score: 675,
    tier: 'gold',
  },
}

export default meta
type Story = StoryObj<typeof TrustGauge>

/* ─── Baseline Story ──────────────────────────────────────────────────────── */

export const Default: Story = {
  args: {
    score: 675,
    tier: 'gold',
  },
  parameters: {
    docs: {
      description: {
        story: 'Default display showing an established score in the Gold tier.',
      },
    },
  },
}

/* ─── Tier Boundary Stories (TIER_THRESHOLDS) ─────────────────────────────── */

/**
 * Bronze Lower Boundary (0):
 * The protocol minimum score (0/1000). Thumb indicator at the far left edge,
 * 250 points needed to reach Silver.
 */
export const BronzeMin: Story = {
  args: {
    score: TIER_THRESHOLDS.bronze.min,
    tier: 'bronze',
  },
  parameters: {
    docs: {
      description: {
        story:
          '**Bronze Lower Boundary (0)**: Protocol minimum score (0/1000). The thumb is at 0% and 250 points remain to reach Silver.',
      },
    },
  },
}

/**
 * Bronze Upper Boundary (249):
 * The highest score in Bronze tier (249/1000), exactly 1 point below Silver threshold (250).
 */
export const BronzeMax: Story = {
  args: {
    score: TIER_THRESHOLDS.bronze.max,
    tier: 'bronze',
  },
  parameters: {
    docs: {
      description: {
        story:
          '**Bronze Upper Boundary (249)**: Highest score in Bronze tier. Shows 1 point remaining to reach Silver.',
      },
    },
  },
}

/**
 * Silver Lower Boundary (250):
 * The threshold crossing score entering the Silver tier (250/1000).
 */
export const SilverMin: Story = {
  args: {
    score: TIER_THRESHOLDS.silver.min,
    tier: 'silver',
  },
  parameters: {
    docs: {
      description: {
        story:
          '**Silver Lower Boundary (250)**: First score of Silver tier. Progress is at 25%, with 250 points remaining to Gold.',
      },
    },
  },
}

/**
 * Silver Upper Boundary (499):
 * The highest score in Silver tier (499/1000), exactly 1 point below Gold threshold (500).
 */
export const SilverMax: Story = {
  args: {
    score: TIER_THRESHOLDS.silver.max,
    tier: 'silver',
  },
  parameters: {
    docs: {
      description: {
        story:
          '**Silver Upper Boundary (499)**: Highest score in Silver tier. Shows 1 point remaining to reach Gold.',
      },
    },
  },
}

/**
 * Gold Lower Boundary (500):
 * The threshold crossing score entering the Gold tier (500/1000).
 */
export const GoldMin: Story = {
  args: {
    score: TIER_THRESHOLDS.gold.min,
    tier: 'gold',
  },
  parameters: {
    docs: {
      description: {
        story:
          '**Gold Lower Boundary (500)**: First score of Gold tier. Progress is at 50%, with 250 points remaining to Platinum.',
      },
    },
  },
}

/**
 * Gold Upper Boundary (749):
 * The highest score in Gold tier (749/1000), exactly 1 point below Platinum threshold (750).
 */
export const GoldMax: Story = {
  args: {
    score: TIER_THRESHOLDS.gold.max,
    tier: 'gold',
  },
  parameters: {
    docs: {
      description: {
        story:
          '**Gold Upper Boundary (749)**: Highest score in Gold tier. Shows 1 point remaining to reach Platinum.',
      },
    },
  },
}

/**
 * Platinum Lower Boundary (750):
 * The threshold crossing score entering Platinum tier (750/1000).
 */
export const PlatinumMin: Story = {
  args: {
    score: TIER_THRESHOLDS.platinum.min,
    tier: 'platinum',
  },
  parameters: {
    docs: {
      description: {
        story:
          '**Platinum Lower Boundary (750)**: First score of Platinum tier. Progress is at 75%. Top tier achieved.',
      },
    },
  },
}

/**
 * Platinum Maximum Score (1000):
 * The maximum score on the trust gauge (1000/1000). Fill is at 100% and displays
 * "Platinum tier — maximum score achieved".
 */
export const PlatinumMax: Story = {
  args: {
    score: 1000,
    tier: 'platinum',
  },
  parameters: {
    docs: {
      description: {
        story:
          '**Platinum Maximum (1000)**: Visual ceiling of the gauge. Displays "Platinum tier — maximum score achieved".',
      },
    },
  },
}

/* ─── Composite Boundary Comparison ──────────────────────────────────────── */

/**
 * All Boundary Scores:
 * Side-by-side / stacked overview of all tier boundary scores (0, 249, 250, 499, 500, 749, 750, 1000)
 * to verify visual progression and alignment across thresholds.
 */
export const AllTierBoundaries: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          Bronze Min (Score: 0) — Protocol Minimum
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.bronze.min} tier="bronze" id="gauge-boundary-0" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          Bronze Max (Score: 249) — 1 point to Silver
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.bronze.max} tier="bronze" id="gauge-boundary-249" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          Silver Min (Score: 250) — Silver Threshold Entry
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.silver.min} tier="silver" id="gauge-boundary-250" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          Silver Max (Score: 499) — 1 point to Gold
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.silver.max} tier="silver" id="gauge-boundary-499" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          Gold Min (Score: 500) — Gold Threshold Entry
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.gold.min} tier="gold" id="gauge-boundary-500" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          Gold Max (Score: 749) — 1 point to Platinum
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.gold.max} tier="gold" id="gauge-boundary-749" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          Platinum Min (Score: 750) — Platinum Threshold Entry
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.platinum.min} tier="platinum" id="gauge-boundary-750" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          Platinum Max (Score: 1000) — Maximum Achieved
        </h4>
        <TrustGauge score={1000} tier="platinum" id="gauge-boundary-1000" />
      </div>
    </div>
  ),
}

/* ─── Reduced-Motion Support ─────────────────────────────────────────────── */

/**
 * Reduced Motion:
 * Documents and tests behavior under `prefers-reduced-motion: reduce`.
 * All transitions on the progress bar width, thumb indicator position, and tier badge
 * are removed (`transition: none`), updating the UI immediately.
 */
export const ReducedMotion: Story = {
  args: {
    score: 500,
    tier: 'gold',
  },
  parameters: {
    docs: {
      description: {
        story: `
> [!NOTE]
> **Reduced-Motion Note**: When \`prefers-reduced-motion: reduce\` is enabled at the OS or browser level:
> - CSS transitions on \`.trust-gauge__progress\`, \`.trust-gauge__thumb\`, and \`.trust-gauge__tier-badge\` are disabled (\`transition: none\`).
> - The component's internal \`useReducedMotion()\` hook detects the preference and applies \`transition: none\` inline.
> - Progress changes occur instantaneously without motion, ensuring vestibular safety per WCAG 2.2 SC 2.3.3.
`,
      },
    },
  },
  render: (args) => (
    <div style={{ maxWidth: '800px' }}>
      <div
        style={{
          padding: '1rem',
          marginBottom: '1rem',
          borderRadius: 'var(--credence-radius-md, 8px)',
          border: '1px solid var(--credence-border-default, #e2e8f0)',
          background: 'var(--credence-surface-card, #f8fafc)',
          fontSize: '0.875rem',
          color: 'var(--credence-text-secondary, #64748b)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Reduced-Motion Note:</p>
        <p style={{ margin: '0.5rem 0 0' }}>
          When the user’s operating system or browser requests reduced motion, transitions on the
          gauge fill, thumb position, and tier badge are disabled (
          <code style={{ fontSize: '0.8rem' }}>transition: none</code>). Scores update instantly
          without intermediate animations.
        </p>
      </div>
      <TrustGauge {...args} />
    </div>
  ),
}

/* ─── State Variants ─────────────────────────────────────────────────────── */

export const Loading: Story = {
  args: {
    score: 675,
    tier: 'gold',
    isLoading: true,
  },
}

export const ErrorState: Story = {
  args: {
    score: 0,
    tier: 'bronze',
    error: 'Failed to load trust score from contract.',
    onRetry: () => alert('Retry triggered'),
  },
}

export const StaleData: Story = {
  args: {
    score: 675,
    tier: 'gold',
    isStale: true,
  },
}

export const PermissionDenied: Story = {
  args: {
    score: 0,
    tier: 'bronze',
    isPermitted: false,
  },
}
