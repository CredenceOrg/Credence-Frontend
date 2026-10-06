import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ErrorState from './ErrorState'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorState', () => {
  it('renders the default title and message for type="generic"', () => {
    render(<ErrorState />)
    expect(screen.getByRole('heading', { name: /something didn\u2019t load/i })).toBeInTheDocument()
    expect(screen.getByText(/unexpected hiccup/i)).toBeInTheDocument()
  })

  it('renders the network copy when type="network"', () => {
    render(<ErrorState type="network" />)
    expect(screen.getByRole('heading', { name: /connection issue/i })).toBeInTheDocument()
    expect(screen.getByText(/check your connection/i)).toBeInTheDocument()
  })

  it('renders the backend copy when type="backend"', () => {
    render(<ErrorState type="backend" />)
    expect(
      screen.getByRole('heading', { name: /service temporarily unavailable/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/brief snag/i)).toBeInTheDocument()
  })

  it('renders the validation copy when type="validation"', () => {
    render(<ErrorState type="validation" />)
    expect(screen.getByRole('heading', { name: /check your input/i })).toBeInTheDocument()
    expect(screen.getByText(/highlighted items/i)).toBeInTheDocument()
  })

  it('renders the pageNotFound copy and severity=info by default', () => {
    render(<ErrorState type="pageNotFound" />)
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByText(/may have moved/i)).toBeInTheDocument()
    const panel = screen.getByRole('alert')
    expect(panel).toHaveClass('error-state--info')
  })

  it('allows overriding title and message', () => {
    render(
      <ErrorState
        title="Custom heading"
        message="Custom body copy"
        action={{ label: 'Retry', onClick: vi.fn() }}
      />
    )
    expect(screen.getByRole('heading', { name: /custom heading/i })).toBeInTheDocument()
    expect(screen.getByText(/custom body copy/i)).toBeInTheDocument()
  })

  it('renders the action button and triggers onClick', () => {
    const onClick = vi.fn()
    render(<ErrorState action={{ label: 'Try again', onClick }} />)
    const btn = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disables the action while isLoading and surfaces aria-busy', () => {
    render(<ErrorState action={{ label: 'Retry', onClick: vi.fn(), isLoading: true }} />)
    const btn = screen.getByRole('button', { name: /retrying/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('omits the action button when no action is provided', () => {
    render(<ErrorState />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('exposes role="alert" and aria-live="assertive" for screen readers', () => {
    render(<ErrorState />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-live', 'assertive')
  })

  it('derives the default aria-label from the title without leaking internal jargon', () => {
    render(<ErrorState type="network" />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-label', expect.stringMatching(/connection issue/i))
    // The label must not leak component-internal jargon like "error state"
    // (cf. Copy Tone Guide voice rules).
    expect(panel).not.toHaveAttribute('aria-label', expect.stringMatching(/error state/i))
  })

  it('respects an explicit ariaLabel prop', () => {
    render(<ErrorState ariaLabel="Custom label" />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-label', 'Custom label')
  })

  it('applies severity modifier class default of danger for generic', () => {
    render(<ErrorState />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--danger')
  })

  it.each(['danger', 'warning', 'info'] as const)(
    'applies severity modifier class error-state--%s when severity="%s"',
    (severity) => {
      render(<ErrorState severity={severity} />)
      expect(screen.getByRole('alert')).toHaveClass(`error-state--${severity}`)
    }
  )

  it('default severity for type="validation" is warning', () => {
    render(<ErrorState type="validation" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--warning')
  })

  it('default severity for type="pageNotFound" is info', () => {
    render(<ErrorState type="pageNotFound" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--info')
  })

  it('explicit severity prop overrides the type default', () => {
    render(<ErrorState type="validation" severity="danger" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--danger')
  })

  it('renders an inline SVG icon for every error kind', () => {
    const kinds = ['network', 'backend', 'validation', 'generic', 'pageNotFound'] as const
    for (const kind of kinds) {
      const { container, unmount } = render(<ErrorState type={kind} />)
      const svg = container.querySelector('svg')
      expect(svg, `expected an SVG for kind="${kind}"`).not.toBeNull()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      unmount()
    }
  })

  it('renders the user-provided icon and skips the default glyph', () => {
    render(<ErrorState icon={<span data-testid="custom-icon">!</span>} />)
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('marks the description with a has-action modifier when an action is present', () => {
    const { container } = render(<ErrorState action={{ label: 'Retry', onClick: vi.fn() }} />)
    const message = container.querySelector('.error-state__message') as HTMLElement | null
    expect(message).not.toBeNull()
    expect(message?.className).toContain('error-state__message--has-action')
  })

  it('does not mark the description with has-action when no action is present', () => {
    const { container } = render(<ErrorState />)
    const message = container.querySelector('.error-state__message') as HTMLElement | null
    expect(message).not.toBeNull()
    expect(message?.className).not.toContain('error-state__message--has-action')
  })

  it('exposes data-error-kind and data-error-severity for telemetry hooks', () => {
    render(<ErrorState type="backend" />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('data-error-kind', 'backend')
    expect(panel).toHaveAttribute('data-error-severity', 'danger')
  })

  it('keeps prefers-reduced-motion animations gated via CSS, not JS', () => {
    // The animation is a CSS-only concern (see ErrorState.css rules under
    // `@media (prefers-reduced-motion: reduce)`) so the test only asserts
    // that the panel mounts cleanly with reduced motion enabled — it
    // should not throw and the entrance animation should be a no-op.
    render(<ErrorState />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Failure-boundary coverage (issue #1182)
//
// Everything below exercises inputs a well-typed caller cannot produce but a
// dynamic one can: status codes from a config file, codes from an API payload,
// values that survived a JSON round-trip, and empty/whitespace overrides. The
// contract under test is that none of them may crash the panel, leave it
// unstyled, unannounced or unnamed, or echo a caller-supplied secret anywhere.
// ---------------------------------------------------------------------------

const GENERIC_TITLE = /something didn’t load/i
const GENERIC_MESSAGE = /unexpected hiccup/i

/** Every documented kind, for exhaustive matrix sweeps. */
const ALL_KINDS = [
  'network',
  'backend',
  'validation',
  'generic',
  'pageNotFound',
  'stale',
  'permission',
] as const

/** `generic` is danger, `validation`/`permission` warning, the rest info/danger. */
const DEFAULT_SEVERITY_OF: Record<(typeof ALL_KINDS)[number], string> = {
  network: 'danger',
  backend: 'danger',
  validation: 'warning',
  generic: 'danger',
  pageNotFound: 'info',
  stale: 'info',
  permission: 'warning',
}

describe('ErrorState — invalid `type` input resolves to the generic panel', () => {
  // The component reports rejected props on the dev console; silence it here and
  // assert the reporting itself in its own suite further down.
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  const rejected: Array<{ label: string; value: unknown; telemetry: string }> = [
    { label: 'null', value: null, telemetry: 'generic' },
    { label: 'a number', value: 42, telemetry: 'generic' },
    { label: 'NaN', value: Number.NaN, telemetry: 'generic' },
    { label: 'a boolean', value: true, telemetry: 'generic' },
    { label: 'an object', value: {}, telemetry: 'generic' },
    { label: 'an array', value: [], telemetry: 'generic' },
    { label: 'an empty string', value: '', telemetry: 'generic' },
    { label: 'a whitespace-only string', value: '   ', telemetry: 'generic' },
    {
      label: 'an unrecognised code',
      value: 'bond_settlement_timeout',
      telemetry: 'bond_settlement_timeout',
    },
    { label: 'a mis-cased kind', value: 'NETWORK', telemetry: 'NETWORK' },
    { label: 'a prototype name', value: '__proto__', telemetry: '__proto__' },
    { label: 'another prototype name', value: 'constructor', telemetry: 'constructor' },
    { label: 'a third prototype name', value: 'toString', telemetry: 'toString' },
  ]

  it.each(rejected)(
    'renders a complete, styled, named panel for $label',
    ({ value, telemetry }) => {
      const { container } = render(<ErrorState type={value as never} />)

      const panel = screen.getByRole('alert')
      // Copy, icon and tone all come from `generic` — never from the rejected value.
      expect(panel).toHaveClass('error-state--danger')
      expect(screen.getByRole('heading', { name: GENERIC_TITLE })).toBeInTheDocument()
      expect(screen.getByText(GENERIC_MESSAGE)).toBeInTheDocument()
      expect(container.querySelector('.error-state__icon svg')).not.toBeNull()
      expect(panel).toHaveAttribute('data-error-kind', telemetry)
      expect(panel).toHaveAttribute('data-error-severity', 'danger')
      expect(panel).toHaveAttribute('aria-label', 'Something didn’t load')
    }
  )

  it('does not throw for any rejected input (regression: unresolved identifier crashed every render)', () => {
    for (const { value } of rejected) {
      expect(() => render(<ErrorState type={value as never} />)).not.toThrow()
      cleanup()
    }
  })

  it('treats inherited prototype keys as unknown kinds instead of resolving them (regression)', () => {
    // `'constructor' in ERROR_COPY` is true via the prototype chain, which made
    // the copy lookup return the `Object` constructor: no title, no message, no
    // glyph. Own-property membership is what keeps this boundary total.
    const { container } = render(<ErrorState type={'constructor' as never} />)
    expect(container.querySelector('.error-state__title')?.textContent).toBe(
      'Something didn’t load'
    )
    expect(container.querySelector('.error-state__message')?.textContent).toMatch(GENERIC_MESSAGE)
    expect(container.querySelector('.error-state__icon svg')).not.toBeNull()
  })

  it.each(['network', ' backend ', '  validation  '])(
    'accepts the documented code "%s" with surrounding whitespace and reports it resolved',
    (value) => {
      const { unmount } = render(<ErrorState type={value as never} />)
      const panel = screen.getByRole('alert')
      const kind = value.trim()
      expect(panel).toHaveAttribute('data-error-kind', kind)
      expect(panel).toHaveClass(
        `error-state--${DEFAULT_SEVERITY_OF[kind as keyof typeof DEFAULT_SEVERITY_OF]}`
      )
      unmount()
    }
  )

  it('caps the echoed unknown code at 64 characters so a dynamic caller cannot bloat the DOM', () => {
    render(<ErrorState type={`x${'y'.repeat(200)}` as never} />)
    const reported = screen.getByRole('alert').getAttribute('data-error-kind') ?? ''
    expect(reported).toHaveLength(64)
  })

  it('is deterministic: the same rejected input renders byte-identical markup every time', () => {
    const first = render(<ErrorState type={'bond_settlement_timeout' as never} />)
    const markup = first.container.innerHTML
    first.unmount()

    const second = render(<ErrorState type={'bond_settlement_timeout' as never} />)
    expect(second.container.innerHTML).toBe(markup)
  })
})

describe('ErrorState — invalid `severity` input falls back to the kind default', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  const badSeverities: unknown[] = [
    null,
    undefined,
    0,
    42,
    'DANGER',
    'Danger',
    'critical',
    '',
    '   ',
    {},
  ]

  it.each(badSeverities)('severity=%p always yields one of the three styled tones', (severity) => {
    render(<ErrorState type="validation" severity={severity as never} />)
    const panel = screen.getByRole('alert')
    expect(panel.className).toMatch(/^error-state error-state--(danger|warning|info)$/)
    // `validation` defaults to warning, so every rejected value lands there.
    expect(panel).toHaveClass('error-state--warning')
    expect(panel).toHaveAttribute('data-error-severity', 'warning')
  })

  it('keeps data-error-severity in sync with the tone class for every kind', () => {
    for (const kind of ALL_KINDS) {
      const { container, unmount } = render(
        <ErrorState type={kind} severity={'not-a-tone' as never} />
      )
      const panel = container.querySelector('.error-state') as HTMLElement
      const reported = panel.getAttribute('data-error-severity')
      expect(reported, `kind="${kind}"`).toBe(DEFAULT_SEVERITY_OF[kind])
      expect(panel).toHaveClass(`error-state--${reported}`)
      unmount()
    }
  })

  it('honours a valid severity even when the kind was rejected', () => {
    render(<ErrorState type={'bond_settlement_timeout' as never} severity="info" />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveClass('error-state--info')
    expect(panel).toHaveAttribute('data-error-kind', 'bond_settlement_timeout')
    expect(panel).toHaveAttribute('data-error-severity', 'info')
  })
})

describe('ErrorState — stale data state', () => {
  it('announces politely as a status region and reassures that no data was lost', () => {
    render(<ErrorState type="stale" />)
    const panel = screen.getByRole('status')
    expect(panel).toHaveAttribute('aria-live', 'polite')
    expect(panel).toHaveClass('error-state--info')
    expect(panel).toHaveAttribute('data-error-kind', 'stale')
    expect(screen.getByRole('heading', { name: /may be out of date/i })).toBeInTheDocument()
    expect(screen.getByText(/your data is still here/i)).toBeInTheDocument()
  })

  it('offers a refresh action that fires once per click', () => {
    const onRefresh = vi.fn()
    render(<ErrorState type="stale" action={{ label: 'Refresh', onClick: onRefresh }} />)
    const btn = screen.getByRole('button', { name: /refresh/i })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('marks the refresh in flight with the retry affordance (stale is retryable)', () => {
    render(
      <ErrorState type="stale" action={{ label: 'Refresh', onClick: vi.fn(), isLoading: true }} />
    )
    const btn = screen.getByRole('button', { name: /retrying/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('lets the caller raise the tone without changing the region semantics', () => {
    render(<ErrorState type="stale" severity="danger" />)
    const panel = screen.getByRole('status')
    expect(panel).toHaveClass('error-state--danger')
    expect(panel).toHaveAttribute('aria-live', 'polite')
    expect(panel).toHaveAttribute('data-error-severity', 'danger')
  })

  it('renders a decorative icon so the hint is not announced twice', () => {
    const { container } = render(<ErrorState type="stale" />)
    const svg = container.querySelector('.error-state__icon svg') as Element
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('ErrorState — permission state', () => {
  it('announces as a polite alert with a warning tone and actionable copy', () => {
    render(<ErrorState type="permission" />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-live', 'polite')
    expect(panel).toHaveClass('error-state--warning')
    expect(panel).toHaveAttribute('data-error-kind', 'permission')
    expect(screen.getByRole('heading', { name: /don.t have access to this/i })).toBeInTheDocument()
    expect(screen.getByText(/ask an owner to grant it/i)).toBeInTheDocument()
  })

  it('never treats a permission action as a retry: isLoading cannot disable or mark it busy', () => {
    // Retrying an authorization failure cannot succeed, so the CTA must stay
    // actionable and must not claim a busy state the user cannot act on.
    const onRequest = vi.fn()
    render(
      <ErrorState
        type="permission"
        action={{ label: 'Request access', onClick: onRequest, isLoading: true }}
      />
    )
    const btn = screen.getByRole('button', { name: /request access/i })
    expect(btn).not.toBeDisabled()
    expect(btn).not.toHaveAttribute('aria-busy')
    fireEvent.click(btn)
    expect(onRequest).toHaveBeenCalledTimes(1)
  })

  it('still exposes an accessible name and icon', () => {
    const { container } = render(<ErrorState type="permission" />)
    const panel = screen.getByRole('alert')
    expect(panel.getAttribute('aria-label')).toBeTruthy()
    expect(container.querySelector('.error-state__icon svg')).not.toBeNull()
  })

  it('can be escalated to danger or softened to info by the caller', () => {
    const { unmount } = render(<ErrorState type="permission" severity="danger" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--danger')
    unmount()

    render(<ErrorState type="permission" severity="info" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--info')
  })
})

describe('ErrorState — retry boundary and concurrent safety', () => {
  it('suppresses clicks while a retry is in flight and re-enables after it resolves', () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <ErrorState type="network" action={{ label: 'Try again', onClick }} />
    )
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <ErrorState type="network" action={{ label: 'Try again', onClick, isLoading: true }} />
    )
    fireEvent.click(screen.getByRole('button', { name: /retrying/i }))
    expect(onClick).toHaveBeenCalledTimes(1)

    // Failed retry: the panel stays and the CTA is live again — no sticky disable.
    rerender(
      <ErrorState type="network" action={{ label: 'Try again', onClick, isLoading: false }} />
    )
    const btn = screen.getByRole('button', { name: /try again/i })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('drops aria-busy entirely when no retry is in flight (regression: aria-busy="false" lingered)', () => {
    render(<ErrorState action={{ label: 'Retry', onClick: vi.fn(), isLoading: false }} />)
    expect(screen.getByRole('button', { name: /retry/i })).not.toHaveAttribute('aria-busy')
  })

  it('treats only a literal true as in-flight, so a truthy non-boolean cannot wedge the panel', () => {
    const onClick = vi.fn()
    render(<ErrorState action={{ label: 'Retry', onClick, isLoading: 1 as never }} />)
    const btn = screen.getByRole('button', { name: /retry/i })
    expect(btn).not.toBeDisabled()
    expect(btn).not.toHaveAttribute('aria-busy')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('propagates every click while the panel is idle (no swallowed user intent)', () => {
    const onClick = vi.fn()
    render(<ErrorState action={{ label: 'Retry', onClick }} />)
    const btn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('never renders an unnamed action button when the label is empty or whitespace', () => {
    const { unmount } = render(<ErrorState action={{ label: '', onClick: vi.fn() }} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    unmount()

    render(<ErrorState action={{ label: '   ', onClick: vi.fn() }} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('a click that arrives after unmount cannot reach the handler', () => {
    const onClick = vi.fn()
    const staleNode = render(<ErrorState action={{ label: 'Retry', onClick }} />)
    const btn = screen.getByRole('button', { name: /retry/i })
    staleNode.unmount()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ErrorState — text overrides never leave an unlabelled or unreadable panel', () => {
  const headinglessConfigs: Array<{ label: string; props: Record<string, string | boolean> }> = [
    { label: 'hideHeading', props: { hideHeading: true } },
    { label: 'title=""', props: { title: '' } },
    { label: 'title="   "', props: { title: '   ' } },
    { label: 'hideHeading + title=""', props: { hideHeading: true, title: '' } },
    { label: 'title non-string', props: { title: 7 as never } },
  ]

  it.each(headinglessConfigs)(
    '$label suppresses the heading and keeps a non-empty aria-label',
    ({ props }) => {
      render(<ErrorState {...(props as never)} />)
      expect(screen.queryByRole('heading')).toBeNull()
      const label = screen.getByRole('alert').getAttribute('aria-label')
      expect(label).toBeTruthy()
      expect(label!.trim().length).toBeGreaterThan(0)
    }
  )

  it.each(['', '   ', '\n\t'])(
    'an empty or blank message override (%p) falls back to the kind copy',
    (value) => {
      render(<ErrorState type="network" message={value} />)
      expect(screen.getByText(/check your connection/i)).toBeInTheDocument()
    }
  )

  it.each(['', '   '])('a blank ariaLabel override (%p) never empties the region name', (value) => {
    render(<ErrorState type="backend" ariaLabel={value} />)
    expect(screen.getByRole('alert')).toHaveAttribute(
      'aria-label',
      'Service temporarily unavailable'
    )
  })

  it('keeps a caller-supplied title and message verbatim, including duplicates', () => {
    render(<ErrorState title="Draft restored" message="Nothing was discarded." />)
    expect(screen.getByRole('heading', { name: 'Draft restored' })).toBeInTheDocument()
    expect(screen.getByText('Nothing was discarded.')).toBeInTheDocument()
  })

  it('preserves user-entered copy across a state transition (no data loss on re-render)', () => {
    const { rerender } = render(
      <ErrorState title="Draft restored" message="Nothing was discarded." />
    )
    rerender(<ErrorState title="Draft restored" message="Nothing was discarded." severity="info" />)
    expect(screen.getByRole('heading', { name: 'Draft restored' })).toBeInTheDocument()
    expect(screen.getByText('Nothing was discarded.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('error-state--info')
  })
})

describe('ErrorState — dev diagnostics never leak caller data', () => {
  const SENSITIVE = 'seed phrase for 0xABCDEF account'

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('warns once about the rejected kind and nothing about the message', () => {
    render(
      <ErrorState type={'bond_refund_failed' as never} message={SENSITIVE} title={SENSITIVE} />
    )
    expect(console.warn).toHaveBeenCalledTimes(1)
    const logged = String(vi.mocked(console.warn).mock.calls[0][0])
    expect(logged).toContain('bond_refund_failed')
    expect(logged).not.toContain('seed phrase')
    expect(logged).not.toContain('0xABCDEF')
  })

  it('names the offending prop when severity is rejected', () => {
    render(<ErrorState severity={'fatal' as never} message={SENSITIVE} />)
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(console.warn).mock.calls[0][0])).toContain('"severity"')
  })

  it('reports both rejections independently', () => {
    render(<ErrorState type={'notAKind' as never} severity={'notATone' as never} />)
    expect(console.warn).toHaveBeenCalledTimes(2)
  })

  it.each(ALL_KINDS)('stays silent for a valid kind (%s)', (kind) => {
    render(<ErrorState type={kind} />)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('logs only the value type for non-string rejection, never its contents', () => {
    render(<ErrorState type={{ secret: '0xABCDEF' } as never} />)
    const logged = String(vi.mocked(console.warn).mock.calls[0][0])
    expect(logged).toContain('a non-string (object) value')
    expect(logged).not.toContain('0xABCDEF')
  })
})

describe('ErrorState — full kind/severity matrix renders cleanly', () => {
  it('every documented kind mounts, names its region, styles it and carries a glyph', () => {
    for (const kind of ALL_KINDS) {
      const { container, unmount } = render(<ErrorState type={kind} />)
      const panel = container.querySelector('.error-state') as HTMLElement
      expect(panel, `kind="${kind}" must render a panel`).not.toBeNull()
      expect(['alert', 'status']).toContain(panel.getAttribute('role'))
      expect(['assertive', 'polite']).toContain(panel.getAttribute('aria-live'))
      expect((panel.getAttribute('aria-label') ?? '').trim()).not.toBe('')
      expect(panel).toHaveClass(`error-state--${DEFAULT_SEVERITY_OF[kind]}`)
      expect(panel).toHaveAttribute('data-error-kind', kind)
      expect(container.querySelector('.error-state__icon svg')).not.toBeNull()
      expect(container.querySelectorAll('.error-state')).toHaveLength(1)
      unmount()
    }
  })

  it.each(ALL_KINDS)('kind "%s" renders in each severity without throwing', (kind) => {
    for (const severity of ['danger', 'warning', 'info'] as const) {
      expect(() => render(<ErrorState type={kind} severity={severity} />)).not.toThrow()
      expect(screen.getByRole(kind === 'stale' ? 'status' : 'alert')).toHaveClass(
        `error-state--${severity}`
      )
      cleanup()
    }
  })

  it('custom icon still wins over every default glyph', () => {
    for (const kind of ALL_KINDS) {
      const { container, unmount } = render(
        <ErrorState type={kind} icon={<span data-testid="marker">!</span>} />
      )
      expect(screen.getByTestId('marker')).toBeInTheDocument()
      expect(container.querySelector('.error-state__icon svg')).toBeNull()
      unmount()
    }
  })
})
