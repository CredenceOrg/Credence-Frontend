import type { Meta, StoryObj } from '@storybook/react'
import TierLadder from './TierLadder'
import TrustGauge from './TrustGauge'
import { TIER_THRESHOLDS } from '../lib/tier'

const meta: Meta<typeof TierLadder> = {
  title: 'Components/TierLadder',
  component: TierLadder,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'TierLadder displays the disclosure ladder detailing how trust is earned, listing each tier (Bronze, Silver, Gold, Platinum) with its score thresholds and unlocked protocol benefits.',
      },
    },
  },
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description: 'Whether the disclosure panel is expanded by default.',
    },
    className: {
      control: 'text',
      description: 'Optional additional CSS class names.',
    },
  },
  args: {
    defaultOpen: false,
  },
}

export default meta
type Story = StoryObj<typeof TierLadder>

/* ─── Baseline Stories ────────────────────────────────────────────────────── */

/**
 * Default collapsed state. The user clicks "How trust is earned" to expand
 * the ladder and review tier thresholds and benefits.
 */
export const Default: Story = {
  args: {
    defaultOpen: false,
  },
}

/**
 * Expanded ladder showing all tiers and score ranges:
 * - Bronze: 0–249
 * - Silver: 250–499
 * - Gold: 500–749
 * - Platinum: 750+
 */
export const Expanded: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Expanded ladder detailing all four tiers, score ranges, and associated benefits.',
      },
    },
  },
}

/* ─── Tier Boundaries Reference ───────────────────────────────────────────── */

/**
 * Tier Boundaries:
 * Demonstrates the tier ladder alongside explicit protocol threshold boundaries from `TIER_THRESHOLDS`:
 * - Bronze: min 0, max 249
 * - Silver: min 250, max 499
 * - Gold: min 500, max 749
 * - Platinum: min 750, no upper cap (750+)
 */
export const TierBoundaries: Story = {
  args: {
    defaultOpen: true,
  },
  render: (args) => (
    <div style={{ maxWidth: '720px' }}>
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          borderRadius: 'var(--credence-radius-md, 8px)',
          border: '1px solid var(--credence-border-default, #e2e8f0)',
          background: 'var(--credence-surface-card, #f8fafc)',
        }}
      >
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Protocol Tier Thresholds</h4>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: '1.6' }}>
          <li>
            <strong>Bronze</strong>: {TIER_THRESHOLDS.bronze.min} – {TIER_THRESHOLDS.bronze.max}{' '}
            points
          </li>
          <li>
            <strong>Silver</strong>: {TIER_THRESHOLDS.silver.min} – {TIER_THRESHOLDS.silver.max}{' '}
            points
          </li>
          <li>
            <strong>Gold</strong>: {TIER_THRESHOLDS.gold.min} – {TIER_THRESHOLDS.gold.max} points
          </li>
          <li>
            <strong>Platinum</strong>: {TIER_THRESHOLDS.platinum.min}+ points
          </li>
        </ul>
      </div>
      <TierLadder {...args} />
    </div>
  ),
}

/**
 * TierLadder paired with TrustGauge at key boundary scores (0, 250, 500, 750, 1000).
 */
export const PairedWithTrustGaugeBoundaries: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          Tier Ladder Guide
        </h4>
        <TierLadder defaultOpen />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          TrustGauge at Bronze Lower Boundary (0)
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.bronze.min} tier="bronze" id="gauge-ladder-0" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          TrustGauge at Silver Lower Boundary (250)
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.silver.min} tier="silver" id="gauge-ladder-250" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          TrustGauge at Gold Lower Boundary (500)
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.gold.min} tier="gold" id="gauge-ladder-500" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          TrustGauge at Platinum Lower Boundary (750)
        </h4>
        <TrustGauge score={TIER_THRESHOLDS.platinum.min} tier="platinum" id="gauge-ladder-750" />
      </div>
      <div>
        <h4 style={{ margin: '0 0 0.5rem', color: 'var(--credence-text-secondary)' }}>
          TrustGauge at Protocol Maximum (1000)
        </h4>
        <TrustGauge score={1000} tier="platinum" id="gauge-ladder-1000" />
      </div>
    </div>
  ),
}

/* ─── Reduced-Motion Support ─────────────────────────────────────────────── */

/**
 * Reduced Motion:
 * Documents and tests behavior of TierLadder under `prefers-reduced-motion: reduce`.
 * Chevron rotation transitions and button background hover transitions are disabled.
 */
export const ReducedMotion: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
> [!NOTE]
> **Reduced-Motion Note**: When \`prefers-reduced-motion: reduce\` is active:
> - The chevron rotation transition on \`.tier-ladder__chevron\` is suppressed.
> - Container and trigger background/border transitions are reduced to instantaneous updates (\`0.01ms\`).
> - The disclosure panel opens and closes cleanly without animated motion.
`,
      },
    },
  },
  render: (args) => (
    <div style={{ maxWidth: '720px' }}>
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
          When <code style={{ fontSize: '0.8rem' }}>prefers-reduced-motion: reduce</code> is set,
          the disclosure chevron icon flip and container transitions are instantaneous (
          <code style={{ fontSize: '0.8rem' }}>0.01ms</code>), preventing unwanted movement for
          motion-sensitive users.
        </p>
      </div>
      <TierLadder {...args} />
    </div>
  ),
}
