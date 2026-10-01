import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import NetworkIndicator from './NetworkIndicator'
import { useSettings, type SettingsState } from '../context/SettingsContext'

vi.mock('../context/SettingsContext', () => ({
  useSettings: vi.fn(),
}))

/** Build a minimal-but-valid SettingsState cast for the indicator's needs. */
const asSettingsState = (network: string) => ({ network }) as unknown as SettingsState

afterEach(() => {
  vi.mocked(useSettings).mockReset()
})

// --- Happy-path rendering ---------------------------------------------------

describe('NetworkIndicator happy paths', () => {
  it('renders "Mainnet" pill for public network', () => {
    vi.mocked(useSettings).mockReturnValue(asSettingsState('public'))
    render(<NetworkIndicator />)
    expect(screen.getByText('Mainnet')).toBeInTheDocument()
    expect(screen.getByLabelText('Active network: Mainnet')).toBeInTheDocument()
  })

  it('renders "Testnet" pill for test network', () => {
    vi.mocked(useSettings).mockReturnValue(asSettingsState('test'))
    render(<NetworkIndicator />)
    expect(screen.getByText('Testnet')).toBeInTheDocument()
    expect(screen.getByLabelText('Active network: Testnet')).toBeInTheDocument()
  })
})

// --- Boundary coverage (#1210) ----------------------------------------------
//
// The indicator is a failure boundary between an untrusted, possibly stale or
// malformed `network` value from settings persistence and the rendered pill.
// The contract: any value that is not exactly 'public' or 'test' degrades to a
// deterministic, safe "Unknown" state — never a crash, never a partial label.

describe('NetworkIndicator boundary coverage', () => {
  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['casing mismatch', 'Public'],
    ['trailing garbage', 'public '],
    ['arbitrary unknown id', 'staking'],
    ['type-confused value', 42],
  ] as const)('degrades %s to the deterministic Unknown state', (_label, network) => {
    vi.mocked(useSettings).mockReturnValue(asSettingsState(network as string))
    render(<NetworkIndicator />)

    // Label, badge text, and aria-label all agree on the fallback.
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByLabelText('Active network: Unknown')).toBeInTheDocument()
  })

  it('marks the fallback with the unknown badge variant for styling safety', () => {
    vi.mocked(useSettings).mockReturnValue(asSettingsState('staking'))
    const { container } = render(<NetworkIndicator />)

    const badge = container.querySelector('.badge') as HTMLElement | null
    expect(badge).not.toBeNull()
    // Badge normalizes unrecognized variants to `badge--unknown` so an
    // unexpected network id cannot select an unintended CSS variant class.
    expect(badge!.className).toContain('badge--unknown')
    expect(badge!.className).not.toContain('badge--active')
  })

  it('isolates duplicate instances: one corrupted value cannot leak into another', () => {
    vi.mocked(useSettings)
      .mockReturnValueOnce(asSettingsState('public'))
      .mockReturnValueOnce(asSettingsState('MALFORMED'))

    render(
      <>
        <NetworkIndicator />
        <NetworkIndicator />
      </>
    )

    // Each instance resolves its own state; the corrupted one does not
    // poison the healthy sibling's label.
    expect(screen.getByText('Mainnet')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('keeps the aria-label in exact lockstep with the visible label', () => {
    const cases: Array<[string, string]> = [
      ['public', 'Active network: Mainnet'],
      ['test', 'Active network: Testnet'],
      ['malformed', 'Active network: Unknown'],
    ]

    cases.forEach(([network, expectedAria]) => {
      vi.mocked(useSettings).mockReturnValue(asSettingsState(network))
      const { unmount } = render(<NetworkIndicator />)
      expect(screen.getByLabelText(expectedAria)).toBeInTheDocument()
      unmount()
    })
  })
})

// --- Recovery / state-transition coverage (#1210) ----------------------------
//
// Settings can round-trip through localStorage hydration, a corrupt payload,
// or a network switch. The indicator must recover to the authoritative value
// with no stale label, and transitions must be idempotent for duplicates.

describe('NetworkIndicator recovery and state transitions', () => {
  it('recovers from a stale/unknown value when the authoritative value arrives', () => {
    vi.mocked(useSettings).mockReturnValue(asSettingsState('corrupt-payload'))
    const { rerender } = render(<NetworkIndicator />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()

    // Authoritative value arrives (e.g. after re-hydration or user switch).
    vi.mocked(useSettings).mockReturnValue(asSettingsState('test'))
    rerender(<NetworkIndicator />)

    expect(screen.getByText('Testnet')).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Active network: Testnet')).toBeInTheDocument()
  })

  it('downgrades back to Unknown if the value becomes invalid again (no stale Mainnet)', () => {
    vi.mocked(useSettings).mockReturnValue(asSettingsState('public'))
    const { rerender } = render(<NetworkIndicator />)
    expect(screen.getByText('Mainnet')).toBeInTheDocument()

    vi.mocked(useSettings).mockReturnValue(asSettingsState(''))
    rerender(<NetworkIndicator />)

    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.queryByText('Mainnet')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Active network: Unknown')).toBeInTheDocument()
  })

  it('treats duplicate transitions to the same value as idempotent', () => {
    vi.mocked(useSettings).mockReturnValue(asSettingsState('public'))
    const { rerender } = render(<NetworkIndicator />)
    expect(screen.getByText('Mainnet')).toBeInTheDocument()

    // Re-render with the same value twice — output must stay stable.
    vi.mocked(useSettings).mockReturnValue(asSettingsState('public'))
    rerender(<NetworkIndicator />)
    vi.mocked(useSettings).mockReturnValue(asSettingsState('public'))
    rerender(<NetworkIndicator />)

    expect(screen.getAllByText('Mainnet')).toHaveLength(1)
    expect(screen.getByLabelText('Active network: Mainnet')).toBeInTheDocument()
  })

  it('cycles public → test → public without accumulating stale DOM', () => {
    vi.mocked(useSettings).mockReturnValue(asSettingsState('public'))
    const { rerender, container } = render(<NetworkIndicator />)

    vi.mocked(useSettings).mockReturnValue(asSettingsState('test'))
    rerender(<NetworkIndicator />)
    expect(screen.getByText('Testnet')).toBeInTheDocument()

    vi.mocked(useSettings).mockReturnValue(asSettingsState('public'))
    rerender(<NetworkIndicator />)

    const badges = container.querySelectorAll('.badge')
    expect(badges).toHaveLength(1)
    expect(screen.getByText('Mainnet')).toBeInTheDocument()
  })
})
