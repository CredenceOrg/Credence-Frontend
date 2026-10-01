import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import NetworkIndicator from './NetworkIndicator'
import { useSettings, type SettingsState } from '../context/SettingsContext'

vi.mock('../context/SettingsContext', () => ({
  useSettings: vi.fn(),
}))

function mockNetwork(network: unknown) {
  vi.mocked(useSettings).mockReturnValue({
    network: network as 'public',
  } as Partial<SettingsState> as SettingsState)
}

describe('NetworkIndicator — deterministic failure boundaries', () => {
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

  // ---------------------------------------------------------------------------
  // Deterministic failure-boundary coverage (issue #1151)
  // The `network` value comes from persisted settings, so a hostile or legacy
  // payload can hold anything. The indicator must degrade to the `unknown`
  // variant without throwing, and without ever rendering an unlabelled or
  // otherwise unrecognizable pill for untrusted input.
  // ---------------------------------------------------------------------------

  it.each([
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['object', { malicious: true }],
    ['array', ['public']],
    ['case-mismatched string', 'PUBLIC'],
    ['whitespace-only string', '   '],
    ['path-like injection string', 'public"><img src=x onerror=alert(1)>'],
  ])('degrades to Unknown for %s network value', (_name, value) => {
    mockNetwork(value)
    render(<NetworkIndicator />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByLabelText('Active network: Unknown')).toBeInTheDocument()
    // Badge must normalize hostile input to the safe `unknown` variant class.
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
  })

  it('keeps its public interface stable across consecutive renders with different inputs', () => {
    // Same render root, changing context value: every transition must produce
    // a deterministic, complete aria label (no stale or partial output).
    const { rerender } = render(<NetworkIndicator />)

    mockNetwork('public')
    vi.mocked(useSettings).mockReturnValue({ network: 'public' } as SettingsState)
    rerender(<NetworkIndicator />)
    expect(screen.getByLabelText('Active network: Mainnet')).toBeInTheDocument()

    mockNetwork('test')
    rerender(<NetworkIndicator />)
    expect(screen.getByLabelText('Active network: Testnet')).toBeInTheDocument()

    mockNetwork(undefined)
    rerender(<NetworkIndicator />)
    expect(screen.getByLabelText('Active network: Unknown')).toBeInTheDocument()
  })

  it('is deterministic: the same input always yields the same label and variant', () => {
    for (const [input, expected] of [
      ['public', 'Mainnet'],
      ['test', 'Testnet'],
      ['garbage', 'Unknown'],
    ] as const) {
      mockNetwork(input)
      const { unmount } = render(<NetworkIndicator />)
      expect(screen.getByLabelText(`Active network: ${expected}`)).toBeInTheDocument()
      unmount()
    }
  })

  it('never renders an empty or whitespace-only label for any input class', () => {
    const inputs: unknown[] = ['', '  ', null, undefined, 0, false, [], {}, Symbol('x')]
    for (const input of inputs) {
      mockNetwork(input)
      const { unmount } = render(<NetworkIndicator />)
      const label = document.querySelector('.networkIndicator .badge')
      expect(label).not.toBeNull()
      expect(label?.textContent?.trim().length ?? 0).toBeGreaterThan(0)
      unmount()
    }
  })

  it('exposes exactly one badge and one aria label (no duplicated nodes on re-render)', () => {
    mockNetwork('public')
    const { rerender } = render(<NetworkIndicator />)
    for (let i = 0; i < 5; i++) rerender(<NetworkIndicator />)
    expect(screen.getAllByLabelText('Active network: Mainnet')).toHaveLength(1)
    expect(screen.getAllByText('Mainnet')).toHaveLength(1)
  })

  it('badge variant normalization rejects prototype pollution keys', () => {
    // Badge lowercases the variant and looks it up in DEFAULT_LABELS. A hostile
    // value such as "constructor" must not resolve to an inherited property
    // and produce a labelled variant class.
    mockNetwork('constructor')
    render(<NetworkIndicator />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
    expect(document.querySelector('.badge--constructor')).toBeNull()
  })

  it('renders correctly when the settings context provider itself is unavailable', () => {
    // useSettings has a default context value; ensure the component still
    // renders deterministically rather than crashing the app shell.
    vi.mocked(useSettings).mockReturnValue({} as SettingsState)
    expect(() => render(<NetworkIndicator />)).not.toThrow()
    expect(screen.getByLabelText('Active network: Unknown')).toBeInTheDocument()
  })
})
