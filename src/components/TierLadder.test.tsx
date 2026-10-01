import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TierLadder, {
  formatThreshold,
  TIER_LADDER,
  type TierDefinition,
} from './TierLadder'

// Mock the child Badge component so its internal styling doesn't break our unit tests
vi.mock('./Badge', () => ({
  default: ({ variant }: { variant: string }) => (
    <div data-testid={`badge-${variant}`}>{variant}</div>
  ),
}))

// ─── helpers ────────────────────────────────────────────────────────────────

/** Render and return a stable reference to the panel element. */
function renderAndGetPanel(props: React.ComponentProps<typeof TierLadder> = {}) {
  render(<TierLadder {...props} />)
  const button = screen.getByRole('button', { name: /how trust is earned/i })
  const panelId = button.getAttribute('aria-controls')!
  const panel = document.getElementById(panelId)!
  return { button, panel }
}

// ─── Original baseline tests ─────────────────────────────────────────────────

describe('TierLadder Component', () => {
  it('renders the visually hidden semantic heading for screen readers', () => {
    render(<TierLadder />)

    // Asserts compliance with <h2 id={headingId} className="sr-only">
    const heading = screen.getByRole('heading', { level: 2, name: /how trust is earned/i })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveClass('sr-only')
  })

  it('renders in a collapsed state by default', () => {
    render(<TierLadder />)

    const button = screen.getByRole('button', { name: /how trust is earned/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    // Dynamically query based on whatever ID React's useId() outputted
    const panelId = button.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()

    const panel = document.getElementById(panelId!)
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveAttribute('hidden')
    expect(panel).toHaveClass('tier-ladder__panel')
  })

  it('respects the defaultOpen prop to render expanded on mount', () => {
    render(<TierLadder defaultOpen={true} />)

    const button = screen.getByRole('button', { name: /how trust is earned/i })
    expect(button).toHaveAttribute('aria-expanded', 'true')

    const panelId = button.getAttribute('aria-controls')
    const panel = document.getElementById(panelId!)

    expect(panel).toBeInTheDocument()
    expect(panel).not.toHaveAttribute('hidden')
  })

  it('toggles aria-expanded and hidden panel attributes dynamically on user clicks', async () => {
    const user = userEvent.setup()
    render(<TierLadder />)

    const button = screen.getByRole('button', { name: /how trust is earned/i })
    const panelId = button.getAttribute('aria-controls')
    const panel = document.getElementById(panelId!)

    // --- First Click: Expand ---
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('hidden')

    // --- Second Click: Collapse ---
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveAttribute('hidden')
  })

  it('renders all four tiers alongside their formatted threshold ranges', () => {
    render(<TierLadder defaultOpen={true} />)

    // Validate tier labels
    expect(screen.getByRole('heading', { level: 3, name: /bronze tier/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /silver tier/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /gold tier/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /platinum tier/i })).toBeInTheDocument()

    // Validate formatThreshold outputs (using en-dash '–' or plus '+')
    expect(screen.getByText('0–249')).toBeInTheDocument()
    expect(screen.getByText('250–499')).toBeInTheDocument()
    expect(screen.getByText('500–749')).toBeInTheDocument()
    expect(screen.getByText('750+')).toBeInTheDocument()

    // Check that our mocked badges were rendered with correct variants
    expect(screen.getByTestId('badge-bronze')).toBeInTheDocument()
    expect(screen.getByTestId('badge-platinum')).toBeInTheDocument()
  })
})

describe('formatThreshold — deterministic failure-boundary coverage', () => {
  it('formats canonical protocol tiers accurately', () => {
    expect(formatThreshold(TIER_LADDER[0])).toBe('0–249')
    expect(formatThreshold(TIER_LADDER[1])).toBe('250–499')
    expect(formatThreshold(TIER_LADDER[2])).toBe('500–749')
    expect(formatThreshold(TIER_LADDER[3])).toBe('750+')
  })

  describe('valid & boundary ranges', () => {
    it('formats a zero-to-zero range', () => {
      expect(formatThreshold({ scoreMin: 0, scoreMax: 0 })).toBe('0–0')
    })

    it('formats maximum score boundaries with open-ended plus', () => {
      expect(formatThreshold({ scoreMin: 1000, scoreMax: null })).toBe('1000+')
    })

    it('formats maximum score upper bound', () => {
      expect(formatThreshold({ scoreMin: 900, scoreMax: 1000 })).toBe('900–1000')
    })

    it('formats identical min and max values preserving range format', () => {
      expect(formatThreshold({ scoreMin: 500, scoreMax: 500 })).toBe('500–500')
    })
  })

  describe('invalid and malformed input resilience (fail-closed)', () => {
    it('returns safe fallback "0+" when tier is null', () => {
      expect(formatThreshold(null)).toBe('0+')
    })

    it('returns safe fallback "0+" when tier is undefined', () => {
      expect(formatThreshold(undefined)).toBe('0+')
    })

    it('returns safe fallback "0+" for non-object inputs', () => {
      expect(formatThreshold('invalid' as unknown as TierDefinition)).toBe('0+')
      expect(formatThreshold(12345 as unknown as TierDefinition)).toBe('0+')
      expect(formatThreshold(true as unknown as TierDefinition)).toBe('0+')
    })

    it('returns safe fallback "0+" for an empty object', () => {
      expect(formatThreshold({} as unknown as TierDefinition)).toBe('0+')
    })

    it('resolves canonical thresholds when only valid tier id is provided', () => {
      expect(formatThreshold({ id: 'bronze' })).toBe('0–249')
      expect(formatThreshold({ id: 'silver' })).toBe('250–499')
      expect(formatThreshold({ id: 'gold' })).toBe('500–749')
      expect(formatThreshold({ id: 'platinum' })).toBe('750+')
    })

    it('safely handles NaN and Infinite scores', () => {
      expect(formatThreshold({ scoreMin: NaN, scoreMax: 249 })).toBe('0–249')
      expect(formatThreshold({ scoreMin: Number.POSITIVE_INFINITY, scoreMax: null })).toBe('1000+')
      expect(formatThreshold({ scoreMin: Number.NEGATIVE_INFINITY, scoreMax: 200 })).toBe('0–200')
      expect(formatThreshold({ scoreMin: 100, scoreMax: NaN })).toBe('100+')
      expect(formatThreshold({ scoreMin: 100, scoreMax: Number.POSITIVE_INFINITY })).toBe('100–1000')
    })

    it('clamps negative scores to zero', () => {
      expect(formatThreshold({ scoreMin: -50, scoreMax: 150 })).toBe('0–150')
      expect(formatThreshold({ scoreMin: -100, scoreMax: -10 })).toBe('0–0')
    })

    it('clamps scores exceeding MAX_SCORE (1000)', () => {
      expect(formatThreshold({ scoreMin: 1200, scoreMax: 1500 })).toBe('1000–1000')
      expect(formatThreshold({ scoreMin: 1200, scoreMax: null })).toBe('1000+')
    })

    it('rounds fractional scores to the nearest integer', () => {
      expect(formatThreshold({ scoreMin: 249.4, scoreMax: 499.6 })).toBe('249–500')
      expect(formatThreshold({ scoreMin: 0.1, scoreMax: 248.9 })).toBe('0–249')
    })

    it('enforces range monotonicity when scoreMax < scoreMin (inverted bounds)', () => {
      // Inverted bounds must clamp max to min rather than emitting an inverted range
      expect(formatThreshold({ scoreMin: 500, scoreMax: 200 })).toBe('500–500')
      expect(formatThreshold({ scoreMin: 700, scoreMax: 0 })).toBe('700–700')
    })

    it('safely coerces numeric strings from untrusted JSON payloads', () => {
      expect(
        formatThreshold({
          scoreMin: '100' as unknown as number,
          scoreMax: '300' as unknown as number,
        })
      ).toBe('100–300')
      expect(
        formatThreshold({
          scoreMin: '750' as unknown as number,
          scoreMax: null,
        })
      ).toBe('750+')
    })

    it('survives hostile objects with throwing property getters without throwing', () => {
      const hostileTier = {
        get scoreMin() {
          throw new Error('Explosive getter')
        },
        get scoreMax() {
          throw new Error('Explosive getter')
        },
      } as unknown as TierDefinition

      expect(formatThreshold(hostileTier)).toBe('0+')
    })
  })

  describe('purity and idempotence', () => {
    it('produces identical deterministic results across repeated invocations', () => {
      const tier: TierDefinition = {
        id: 'gold',
        label: 'Gold',
        scoreMin: 500,
        scoreMax: 749,
        benefits: [],
      }

      const expected = formatThreshold(tier)
      for (let i = 0; i < 50; i++) {
        expect(formatThreshold(tier)).toBe(expected)
      }
    })

    it('does not mutate the input tier object', () => {
      const tier: TierDefinition = {
        id: 'silver',
        label: 'Silver',
        scoreMin: 250,
        scoreMax: 499,
        benefits: ['Benefit A'],
      }
      const frozenTier = Object.freeze({ ...tier })
      expect(() => formatThreshold(frozenTier)).not.toThrow()
      expect(frozenTier.scoreMin).toBe(250)
      expect(frozenTier.scoreMax).toBe(499)
    })
  })
})

describe('TierLadder — loading, error, retry, stale, and permission state coverage', () => {
  it('renders custom tiers when supplied via the tiers prop', () => {
    const customTiers: TierDefinition[] = [
      {
        id: 'bronze',
        label: 'Starter',
        scoreMin: 0,
        scoreMax: 100,
        benefits: ['Basic access'],
      },
      {
        id: 'platinum',
        label: 'Elite',
        scoreMin: 101,
        scoreMax: null,
        benefits: ['VIP access'],
      },
    ]

    render(<TierLadder defaultOpen={true} tiers={customTiers} />)

    expect(screen.getByRole('heading', { level: 3, name: /starter tier/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /elite tier/i })).toBeInTheDocument()
    expect(screen.getByText('0–100')).toBeInTheDocument()
    expect(screen.getByText('101+')).toBeInTheDocument()
    expect(screen.getByText('Basic access')).toBeInTheDocument()
  })

  it('renders the loading state and marks the trigger with aria-busy', () => {
    render(<TierLadder defaultOpen={true} isLoading={true} />)

    const trigger = screen.getByRole('button', { name: /how trust is earned/i })
    expect(trigger).toHaveAttribute('aria-busy', 'true')

    const loadingStatus = screen.getByRole('status')
    expect(loadingStatus).toHaveTextContent(/loading tier thresholds/i)

    // Existing tier cards remain rendered (no silent data loss during loading)
    expect(screen.getByText('0–249')).toBeInTheDocument()
  })

  it('renders the error state with a sanitized message and role="alert"', () => {
    render(<TierLadder defaultOpen={true} error="Failed to sync tier definitions from contract." />)

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('Failed to sync tier definitions from contract.')

    // Existing data is preserved
    expect(screen.getByText('0–249')).toBeInTheDocument()
  })

  it('extracts error message from an Error instance and displays safe default for non-string errors', () => {
    const { unmount } = render(<TierLadder defaultOpen={true} error={new Error('Network failure')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Network failure')
    unmount()

    render(<TierLadder defaultOpen={true} error={{} as unknown as Error} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load tier thresholds.')
  })

  it('renders retry button and invokes onRetry callback upon user click', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn().mockResolvedValue(undefined)

    render(
      <TierLadder
        defaultOpen={true}
        error="Temporary connection loss."
        onRetry={onRetry}
      />
    )

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    expect(retryBtn).toBeInTheDocument()

    await user.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('guards against concurrent retry clicks while retry is in flight', async () => {
    const user = userEvent.setup()
    let resolveRetry!: () => void
    const pendingPromise = new Promise<void>((res) => {
      resolveRetry = res
    })
    const onRetry = vi.fn().mockReturnValue(pendingPromise)

    render(
      <TierLadder
        defaultOpen={true}
        error="Temporary connection loss."
        onRetry={onRetry}
      />
    )

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    await user.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)

    // While in flight, button is disabled with "Retrying..." and duplicate clicks are ignored
    expect(retryBtn).toBeDisabled()
    expect(retryBtn).toHaveTextContent('Retrying...')

    await user.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)

    // Complete the retry
    resolveRetry()
    await waitFor(() => {
      expect(retryBtn).not.toBeDisabled()
      expect(retryBtn).toHaveTextContent('Retry')
    })
  })

  it('catches and logs retry errors without throwing unhandled exceptions', async () => {
    const user = userEvent.setup()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onRetry = vi.fn().mockRejectedValue(new Error('Persistent server error'))

    render(
      <TierLadder
        defaultOpen={true}
        error="Initial error."
        onRetry={onRetry}
      />
    )

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    await user.click(retryBtn)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TierLadder] Retry failed:',
        'Persistent server error'
      )
    })
    consoleErrorSpy.mockRestore()
  })

  it('renders stale data indicator with role="status" while preserving rendered tiers', () => {
    render(<TierLadder defaultOpen={true} isStale={true} />)

    const staleIndicator = screen.getByRole('status')
    expect(staleIndicator).toHaveTextContent(/tier thresholds may be out of date/i)

    // Data is preserved
    expect(screen.getByText('0–249')).toBeInTheDocument()
    expect(screen.getByText('750+')).toBeInTheDocument()
  })

  it('enforces permission boundary and withholds tier cards when hasPermission is false', () => {
    render(<TierLadder defaultOpen={true} hasPermission={false} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('You do not have permission to view tier thresholds.')

    // Sensitive tier thresholds are not disclosed
    expect(screen.queryByText('0–249')).not.toBeInTheDocument()
    expect(screen.queryByText('750+')).not.toBeInTheDocument()
  })

  it('supports custom permission message when permission is denied', () => {
    render(
      <TierLadder
        defaultOpen={true}
        hasPermission={false}
        permissionMessage="Tier requirements are restricted to authenticated members."
      />
    )

    expect(
      screen.getByText('Tier requirements are restricted to authenticated members.')
    ).toBeInTheDocument()
  })

  it('gracefully handles malformed tiers array with null/undefined items without crashing', () => {
    const corruptTiers = [
      null,
      undefined,
      {
        id: 'unknown-tier' as unknown as TierDefinition['id'],
        label: '',
        scoreMin: NaN,
        scoreMax: NaN,
        benefits: null as unknown as string[],
      },
    ] as unknown as TierDefinition[]

    expect(() => {
      render(<TierLadder defaultOpen={true} tiers={corruptTiers} />)
    }).not.toThrow()

    // Non-nullish corrupted tier was rendered safely with fallback label and threshold
    expect(screen.getByText('Bronze tier')).toBeInTheDocument()
    expect(screen.getByText('0+')).toBeInTheDocument()
  })
})
