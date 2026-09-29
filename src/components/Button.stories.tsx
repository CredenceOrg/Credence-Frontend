import type { Meta, StoryObj } from '@storybook/react'
import Button from './Button'

const meta: Meta<typeof Button> = {
  title: 'Components/Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger', 'link'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    isLoading: {
      control: 'boolean',
      description: 'Loading state - shows spinner and disables interaction',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Full width button',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    children: {
      control: 'text',
      description: 'Button content',
    },
  },
  args: {
    variant: 'primary',
    size: 'md',
    children: 'Click me',
    isLoading: false,
    fullWidth: false,
    disabled: false,
  },
}

export default meta
type Story = StoryObj<typeof Button>

/* ─── All Variants ───────────────────────────────────────────────────────── */

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
}

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
}

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Danger Button',
  },
}

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link Button',
  },
}

/* ─── Sizes ──────────────────────────────────────────────────────────────── */

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
}

export const Medium: Story = {
  args: {
    size: 'md',
    children: 'Medium (default)',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
}

export const SizeComparison: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}

/* ─── States ─────────────────────────────────────────────────────────────── */

export const Loading: Story = {
  args: {
    isLoading: true,
    children: 'Loading...',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
}

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button',
  },
}

/* ─── Keyboard Focus Review ──────────────────────────────────────────────── */

/**
 * Focus review: Tab through all variants to verify the focus ring is visible
 * against both the button background and the page background in both light
 * and dark modes. The ring should create a clear separation and meet WCAG
 * 2.1 SC 2.4.7 (Focus Visible) and 2.2 SC 2.4.11 (Focus Appearance).
 *
 * Test in:
 * - Light mode
 * - Dark mode
 * - Windows High Contrast mode (forced-colors: active)
 * - Reduced motion (prefers-reduced-motion: reduce)
 */
export const KeyboardFocusReview: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        maxWidth: '600px',
        padding: '2rem',
      }}
    >
      <p style={{ marginBottom: '1rem', color: 'var(--credence-text-secondary)' }}>
        <strong>Instructions:</strong> Press Tab to cycle through each button. Verify that the focus
        ring is clearly visible on every variant in both light and dark modes.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="link">Link</Button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Button variant="primary" disabled>
          Disabled Primary
        </Button>
        <Button variant="secondary" disabled>
          Disabled Secondary
        </Button>
        <Button variant="link" disabled>
          Disabled Link
        </Button>
      </div>

      <div
        style={{
          background: 'var(--credence-color-slate-900)',
          padding: '1rem',
          borderRadius: '0.5rem',
        }}
      >
        <p style={{ color: 'white', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          Dark background test
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </div>
    </div>
  ),
}

/**
 * Hover and active state review: Hover over each variant to verify that
 * the hover state is visually distinct from the default state. Click and
 * hold to verify the active (pressed) state.
 */
export const InteractiveStates: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        maxWidth: '600px',
        padding: '2rem',
      }}
    >
      <p style={{ marginBottom: '1rem', color: 'var(--credence-text-secondary)' }}>
        <strong>Instructions:</strong> Hover over each button to verify the hover state, then click
        and hold to verify the active (pressed) state.
      </p>

      <div>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Primary</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="primary">Default</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Secondary</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="secondary">Default</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Ghost</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="ghost">Default</Button>
          <Button variant="ghost" disabled>
            Disabled
          </Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Danger</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="danger">Default</Button>
          <Button variant="danger" disabled>
            Disabled
          </Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Link</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="link">Default</Button>
          <Button variant="link" disabled>
            Disabled
          </Button>
        </div>
      </div>
    </div>
  ),
}
