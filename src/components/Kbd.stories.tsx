import type { Meta, StoryObj } from '@storybook/react'
import Kbd from './Kbd'

const meta: Meta<typeof Kbd> = {
  title: 'Components/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'The key label to display (e.g. `"Esc"`, `"Ctrl"`, `"K"`).',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Visual size of the key chip. `md` matches the KeyboardShortcutsDialog size.',
    },
    ariaLabel: {
      control: 'text',
      description:
        'Accessible label override. Use when the visible symbol is ambiguous (e.g. `"⌘"` → `ariaLabel="Command"`).',
    },
    className: {
      control: 'text',
      description: 'Extra CSS class names appended to the root element.',
    },
  },
  args: {
    children: 'Esc',
    size: 'md',
  },
}

export default meta
type Story = StoryObj<typeof Kbd>

/** Default medium-size key chip. */
export const Default: Story = {
  args: {
    children: 'Esc',
  },
}

/** Small variant — suited for dense tooltips and inline prose. */
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'K',
  },
}

/** Medium variant — the default; matches the KeyboardShortcutsDialog. */
export const Medium: Story = {
  args: {
    size: 'md',
    children: 'K',
  },
}

/** Large variant — suited for onboarding copy and large-print contexts. */
export const Large: Story = {
  args: {
    size: 'lg',
    children: 'K',
  },
}

/** Modifier key using a longer label. */
export const ModifierKey: Story = {
  args: {
    children: 'Shift',
  },
}

/**
 * Platform symbol (⌘) with an explicit `ariaLabel` so screen readers
 * announce "Command" rather than the raw Unicode character.
 */
export const PlatformSymbol: Story = {
  args: {
    children: '⌘',
    ariaLabel: 'Command',
  },
}

/** All three size variants side-by-side for quick visual comparison. */
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <Kbd size="sm">K</Kbd>
      <Kbd size="md">K</Kbd>
      <Kbd size="lg">K</Kbd>
    </div>
  ),
}

/**
 * Composite shortcut — each key wrapped in its own `<Kbd>` with a `+`
 * separator. This is the recommended pattern for multi-key shortcuts in docs
 * and tooltips.
 */
export const CompositeShortcut: Story = {
  render: () => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      <Kbd>Ctrl</Kbd>
      <span
        aria-hidden="true"
        style={{
          color: 'var(--credence-text-secondary)',
          fontSize: 'var(--credence-font-size-xs)',
        }}
      >
        +
      </span>
      <Kbd>K</Kbd>
    </span>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Wrap each key in its own `<Kbd>` and add a plain `+` separator between them. ' +
          'The wrapping `<span>` should carry `aria-label="Ctrl + K"` (or similar) ' +
          'so screen readers announce the full shortcut in one breath.',
      },
    },
  },
}

/**
 * Three-key shortcut showing that the pattern scales to any number of keys.
 */
export const ThreeKeyShortcut: Story = {
  render: () => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      <Kbd>Ctrl</Kbd>
      <span
        aria-hidden="true"
        style={{
          color: 'var(--credence-text-secondary)',
          fontSize: 'var(--credence-font-size-xs)',
        }}
      >
        +
      </span>
      <Kbd>Shift</Kbd>
      <span
        aria-hidden="true"
        style={{
          color: 'var(--credence-text-secondary)',
          fontSize: 'var(--credence-font-size-xs)',
        }}
      >
        +
      </span>
      <Kbd>P</Kbd>
    </span>
  ),
}

/** Inline usage inside a sentence of prose. */
export const InlineProse: Story = {
  render: () => (
    <p
      style={{
        fontFamily: 'var(--credence-font-family-base)',
        color: 'var(--credence-text-primary)',
      }}
    >
      Press <Kbd>Shift</Kbd> + <Kbd>?</Kbd> to open the keyboard shortcuts help dialog.
    </p>
  ),
}
