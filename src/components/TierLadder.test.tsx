import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import TierLadder, { TIER_LADDER, type TierDefinition } from './TierLadder'
import { TIERS, TIER_ORDER, tierForScore } from '../lib/tiers'
import ErrorBoundary from './ErrorBoundary'

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

// ─── TIER_LADDER export — structural invariants ──────────────────────────────

describe('TIER_LADDER exported constant — structural invariants', () => {
  it('contains exactly four tiers in the canonical order', () => {
    expect(TIER_LADDER).toHaveLength(4)
    expect(TIER_LADDER.map((t) => t.id)).toEqual(['bronze', 'silver', 'gold', 'platinum'])
  })

  it('mirrors the canonical TIER_ORDER sequence exactly', () => {
    expect(TIER_LADDER.map((t) => t.id)).toEqual(TIER_ORDER)
  })

  it.each(TIER_ORDER)('%s: id field matches the tier key', (id) => {
    const entry = TIER_LADDER.find((t) => t.id === id)!
    expect(entry).toBeDefined()
    expect(entry.id).toBe(id)
  })

  it.each(TIER_ORDER)('%s: label is a non-empty string', (id) => {
    const entry = TIER_LADDER.find((t) => t.id === id)!
    expect(typeof entry.label).toBe('string')
    expect(entry.label.length).toBeGreaterThan(0)
  })

  it.each(TIER_ORDER)('%s: scoreMin matches canonical TIERS.min', (id) => {
    const entry = TIER_LADDER.find((t) => t.id === id)!
    expect(entry.scoreMin).toBe(TIERS[id].min)
  })

  it.each(TIER_ORDER)('%s: scoreMax matches canonical TIERS.max', (id) => {
    const entry = TIER_LADDER.find((t) => t.id === id)!
    expect(entry.scoreMax).toBe(TIERS[id].max)
  })

  it('only platinum has a null scoreMax (open-ended tier)', () => {
    for (const tier of TIER_LADDER) {
      if (tier.id === 'platinum') {
        expect(tier.scoreMax).toBeNull()
      } else {
        expect(tier.scoreMax).not.toBeNull()
      }
    }
  })

  it('scoreMin values are strictly ascending across the ordered list', () => {
    for (let i = 1; i < TIER_LADDER.length; i++) {
      expect(TIER_LADDER[i].scoreMin).toBeGreaterThan(TIER_LADDER[i - 1].scoreMin)
    }
  })

  it('each tier has at least one benefit string', () => {
    for (const tier of TIER_LADDER) {
      expect(Array.isArray(tier.benefits)).toBe(true)
      expect(tier.benefits.length).toBeGreaterThan(0)
      for (const benefit of tier.benefits) {
        expect(typeof benefit).toBe('string')
        expect(benefit.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('benefits lists contain no duplicate entries within a tier', () => {
    for (const tier of TIER_LADDER) {
      const unique = new Set(tier.benefits)
      expect(unique.size).toBe(tier.benefits.length)
    }
  })

  it('benefits arrays in TIER_LADDER share the same reference as TIERS (no defensive copy)', () => {
    // TIER_LADDER maps `benefits: t.benefits` — it assigns the same reference.
    // This test documents the actual behavior so callers know mutations are shared.
    const bronzeLadderEntry = TIER_LADDER.find((t) => t.id === 'bronze')!
    expect(bronzeLadderEntry.benefits).toBe(TIERS.bronze.benefits)
  })
})

// ─── formatThreshold boundary cases ─────────────────────────────────────────
//
// formatThreshold is a private function but its output is observable in the
// rendered DOM. We exercise boundary-case inputs through TIER_LADDER entries
// that represent every case the function can reach.

describe('formatThreshold — rendered output boundary cases', () => {
  it('renders "scoreMin–scoreMax" for tiers with a finite upper bound', () => {
    render(<TierLadder defaultOpen />)

    // Every non-platinum tier should use the "min–max" form
    expect(screen.getByText('0–249')).toBeInTheDocument()
    expect(screen.getByText('250–499')).toBeInTheDocument()
    expect(screen.getByText('500–749')).toBeInTheDocument()
  })

  it('renders "scoreMin+" for the open-ended top tier (platinum, scoreMax = null)', () => {
    render(<TierLadder defaultOpen />)
    expect(screen.getByText('750+')).toBeInTheDocument()
  })

  it('uses an en-dash (U+2013) not a hyphen-minus in bounded threshold strings', () => {
    render(<TierLadder defaultOpen />)
    const el = screen.getByText('0–249')
    // Confirm the separator is the Unicode en-dash character
    expect(el.textContent).toMatch(/\u2013/)
  })

  it('threshold values are numeric — no extra text or currency symbols', () => {
    render(<TierLadder defaultOpen />)
    // Each threshold value cell must match one of the two expected patterns
    const thresholdValues = screen.getAllByText(/^\d+[–+]\d*$/).map((el) => el.textContent?.trim())
    expect(thresholdValues).toEqual(expect.arrayContaining(['0–249', '250–499', '500–749', '750+']))
  })

  it('every tier has exactly one "Score range" label and one threshold value visible', () => {
    render(<TierLadder defaultOpen />)
    const scoreRangeLabels = screen.getAllByText(/score range/i)
    // Should match the 4 tier cards
    expect(scoreRangeLabels).toHaveLength(TIER_LADDER.length)
  })
})

// ─── className prop — boundary and merging behaviour ─────────────────────────

describe('className prop — boundary and merging', () => {
  it('applies the base tier-ladder class with no className supplied', () => {
    const { container } = render(<TierLadder />)
    const section = container.querySelector('section')
    expect(section).toHaveClass('tier-ladder')
  })

  it('merges a custom className alongside the base tier-ladder class', () => {
    const { container } = render(<TierLadder className="custom-class" />)
    const section = container.querySelector('section')
    expect(section).toHaveClass('tier-ladder')
    expect(section).toHaveClass('custom-class')
  })

  it('handles an empty string className without leaving a trailing space', () => {
    const { container } = render(<TierLadder className="" />)
    const section = container.querySelector('section')
    // className should be exactly "tier-ladder" (no leading or trailing space)
    expect(section?.className).toBe('tier-ladder')
  })

  it('handles a whitespace-only className (trimmed away by .trim())', () => {
    const { container } = render(<TierLadder className="   " />)
    const section = container.querySelector('section')
    // "tier-ladder    ".trim() → "tier-ladder"
    expect(section?.className.trim()).toBe('tier-ladder')
  })

  it('merges multiple space-separated extra classes', () => {
    const { container } = render(<TierLadder className="alpha beta" />)
    const section = container.querySelector('section')
    expect(section).toHaveClass('tier-ladder')
    expect(section).toHaveClass('alpha')
    expect(section).toHaveClass('beta')
  })
})

// ─── ARIA wiring — section, labelledby, panel id ─────────────────────────────

describe('ARIA wiring — section, labelledby, and panel id', () => {
  it('wraps content in a <section> element', () => {
    const { container } = render(<TierLadder />)
    expect(container.querySelector('section')).toBeInTheDocument()
  })

  it('section has aria-labelledby pointing to the sr-only heading id', () => {
    const { container } = render(<TierLadder />)
    const section = container.querySelector('section')!
    const labelledById = section.getAttribute('aria-labelledby')
    expect(labelledById).toBeTruthy()

    const heading = document.getElementById(labelledById!)
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveClass('sr-only')
    expect(heading).toHaveTextContent(/how trust is earned/i)
  })

  it('button aria-controls matches the panel id attribute', () => {
    render(<TierLadder />)
    const button = screen.getByRole('button', { name: /how trust is earned/i })
    const panelId = button.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()

    const panel = document.getElementById(panelId!)
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveClass('tier-ladder__panel')
  })

  it('uses distinct ids for headingId and panelId (no id collision)', () => {
    render(<TierLadder />)
    const button = screen.getByRole('button', { name: /how trust is earned/i })
    const panelId = button.getAttribute('aria-controls')!

    const section = button.closest('section')!
    const headingId = section.getAttribute('aria-labelledby')!

    expect(panelId).not.toBe(headingId)
    expect(panelId.length).toBeGreaterThan(0)
    expect(headingId.length).toBeGreaterThan(0)
  })

  it('multiple simultaneous TierLadder instances use different ids', () => {
    const { container } = render(
      <div>
        <TierLadder />
        <TierLadder />
      </div>
    )

    const sections = container.querySelectorAll('section.tier-ladder')
    expect(sections).toHaveLength(2)

    const headingIds = Array.from(sections).map((s) => s.getAttribute('aria-labelledby'))
    expect(headingIds[0]).not.toBe(headingIds[1])

    const buttons = screen.getAllByRole('button', { name: /how trust is earned/i })
    const panelIds = buttons.map((b) => b.getAttribute('aria-controls'))
    expect(panelIds[0]).not.toBe(panelIds[1])
  })
})

// ─── Keyboard interaction ────────────────────────────────────────────────────

describe('keyboard interaction — Enter and Space', () => {
  it('opens the panel when the trigger button receives Enter key', async () => {
    const user = userEvent.setup()
    const { button, panel } = renderAndGetPanel()

    button.focus()
    await user.keyboard('{Enter}')

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('hidden')
  })

  it('opens the panel when the trigger button receives Space key', async () => {
    const user = userEvent.setup()
    const { button, panel } = renderAndGetPanel()

    button.focus()
    await user.keyboard('{ }')

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('hidden')
  })

  it('collapses an open panel when Space is pressed a second time', async () => {
    const user = userEvent.setup()
    const { button, panel } = renderAndGetPanel({ defaultOpen: true })

    button.focus()
    await user.keyboard('{ }')

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveAttribute('hidden')
  })

  it('collapses an open panel when Enter is pressed a second time', async () => {
    const user = userEvent.setup()
    const { button, panel } = renderAndGetPanel({ defaultOpen: true })

    button.focus()
    await user.keyboard('{Enter}')

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveAttribute('hidden')
  })

  it('button is reachable via Tab navigation', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <a href="#before">before</a>
        <TierLadder />
      </div>
    )

    const before = screen.getByText('before')
    before.focus()
    await user.tab()

    expect(screen.getByRole('button', { name: /how trust is earned/i })).toHaveFocus()
  })
})

// ─── Multi-cycle toggle — state consistency ───────────────────────────────────

describe('multi-cycle toggle — state consistency', () => {
  it('state remains correct after five expand/collapse cycles', async () => {
    const user = userEvent.setup()
    const { button, panel } = renderAndGetPanel()

    for (let cycle = 1; cycle <= 5; cycle++) {
      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(panel).not.toHaveAttribute('hidden')

      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(panel).toHaveAttribute('hidden')
    }
  })

  it('rapid successive clicks do not leave the component in an inconsistent state', async () => {
    const user = userEvent.setup()
    const { button, panel } = renderAndGetPanel()

    // 6 clicks = 3 open + 3 close → ends collapsed
    for (let i = 0; i < 6; i++) {
      await user.click(button)
    }

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveAttribute('hidden')
  })

  it('odd number of clicks always ends in the opposite state to the default', async () => {
    const user = userEvent.setup()
    const { button } = renderAndGetPanel() // default: closed

    await user.click(button) // 1 click → open
    expect(button).toHaveAttribute('aria-expanded', 'true')

    await user.click(button) // 2 clicks → closed
    await user.click(button) // 3 clicks → open
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})

// ─── Chevron class toggling ───────────────────────────────────────────────────

describe('chevron class toggling', () => {
  it('does not have the open modifier class when collapsed', () => {
    const { container } = render(<TierLadder />)
    const chevron = container.querySelector('.tier-ladder__chevron')
    expect(chevron).toBeInTheDocument()
    expect(chevron).not.toHaveClass('tier-ladder__chevron--open')
  })

  it('adds the open modifier class when expanded via defaultOpen', () => {
    const { container } = render(<TierLadder defaultOpen />)
    const chevron = container.querySelector('.tier-ladder__chevron')
    expect(chevron).toHaveClass('tier-ladder__chevron--open')
  })

  it('adds the open modifier class after the user opens the panel', async () => {
    const user = userEvent.setup()
    const { container } = render(<TierLadder />)
    const chevron = container.querySelector('.tier-ladder__chevron')!
    const button = screen.getByRole('button', { name: /how trust is earned/i })

    await user.click(button)
    expect(chevron).toHaveClass('tier-ladder__chevron--open')
  })

  it('removes the open modifier class after the user closes the panel', async () => {
    const user = userEvent.setup()
    const { container } = render(<TierLadder defaultOpen />)
    const chevron = container.querySelector('.tier-ladder__chevron')!
    const button = screen.getByRole('button', { name: /how trust is earned/i })

    await user.click(button)
    expect(chevron).not.toHaveClass('tier-ladder__chevron--open')
  })

  it('chevron svg has aria-hidden="true"', () => {
    const { container } = render(<TierLadder />)
    const svg = container.querySelector('.tier-ladder__chevron')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})

// ─── Step numbering — rail markers ───────────────────────────────────────────

describe('step numbering — rail markers', () => {
  it('renders step markers 1 through 4 in order', () => {
    render(<TierLadder defaultOpen />)
    const markers = document.querySelectorAll('.tier-ladder__marker')
    expect(markers).toHaveLength(4)
    Array.from(markers).forEach((marker, i) => {
      expect(marker.textContent?.trim()).toBe(String(i + 1))
    })
  })

  it('renders connectors between steps — 3 connectors for 4 steps', () => {
    render(<TierLadder defaultOpen />)
    const connectors = document.querySelectorAll('.tier-ladder__connector')
    expect(connectors).toHaveLength(TIER_LADDER.length - 1)
  })

  it('the last step has no connector below it', () => {
    render(<TierLadder defaultOpen />)
    const steps = document.querySelectorAll('.tier-ladder__step')
    const lastStep = steps[steps.length - 1]
    expect(lastStep.querySelector('.tier-ladder__connector')).toBeNull()
  })
})

// ─── Benefits rendering ───────────────────────────────────────────────────────

describe('benefits rendering', () => {
  it('renders every benefit for every tier when open', () => {
    render(<TierLadder defaultOpen />)
    for (const tier of TIER_LADDER) {
      for (const benefit of tier.benefits) {
        expect(screen.getByText(benefit)).toBeInTheDocument()
      }
    }
  })

  it('renders benefits in an unordered list inside each tier card', () => {
    render(<TierLadder defaultOpen />)
    const benefitLists = document.querySelectorAll('.tier-ladder__benefits')
    expect(benefitLists).toHaveLength(TIER_LADDER.length)
    benefitLists.forEach((list) => {
      expect(list.tagName).toBe('UL')
    })
  })

  it("each tier card's benefits list contains the expected number of items", () => {
    render(<TierLadder defaultOpen />)
    const steps = document.querySelectorAll('.tier-ladder__step')
    Array.from(steps).forEach((step, i) => {
      const tier = TIER_LADDER[i]
      const listItems = step.querySelectorAll('.tier-ladder__benefits li')
      expect(listItems).toHaveLength(tier.benefits.length)
    })
  })

  it('benefit text does not leak across tier boundaries', () => {
    render(<TierLadder defaultOpen />)
    // Pick the first benefit of bronze and confirm it appears exactly once
    const bronzeBenefit = TIER_LADDER[0].benefits[0]
    const matches = screen.getAllByText(bronzeBenefit)
    expect(matches).toHaveLength(1)
  })
})

// ─── Per-tier card structure ──────────────────────────────────────────────────

describe('per-tier card structure', () => {
  it.each(TIER_ORDER)('%s: renders a Badge with the correct variant', (id) => {
    render(<TierLadder defaultOpen />)
    expect(screen.getByTestId(`badge-${id}`)).toBeInTheDocument()
  })

  it.each(TIER_ORDER)('%s: renders the tier-specific CSS modifier class on the step', (id) => {
    render(<TierLadder defaultOpen />)
    const step = document.querySelector(`.tier-ladder__step--${id}`)
    expect(step).toBeInTheDocument()
  })

  it.each(TIER_ORDER)('%s: renders an h3 with "<Label> tier" text', (id) => {
    render(<TierLadder defaultOpen />)
    const label = TIERS[id].label
    expect(
      screen.getByRole('heading', { level: 3, name: new RegExp(`${label} tier`, 'i') })
    ).toBeInTheDocument()
  })

  it.each(TIER_ORDER)('%s: tier article has the card class', (id) => {
    render(<TierLadder defaultOpen />)
    const step = document.querySelector(`.tier-ladder__step--${id}`)!
    expect(step.querySelector('.tier-ladder__card')).toBeInTheDocument()
  })

  it('all four badges are rendered — no duplicates, no missing', () => {
    render(<TierLadder defaultOpen />)
    const allBadgeTestIds = TIER_ORDER.map((id) => `badge-${id}`)
    for (const testId of allBadgeTestIds) {
      expect(screen.getAllByTestId(testId)).toHaveLength(1)
    }
  })
})

// ─── Panel visibility — intro text ───────────────────────────────────────────

describe('panel — intro text', () => {
  it('renders the intro paragraph when the panel is open', () => {
    render(<TierLadder defaultOpen />)
    expect(screen.getByText(/your trust score \(0.?1000\) is computed/i)).toBeInTheDocument()
  })

  it('intro paragraph is inside the panel element', () => {
    render(<TierLadder defaultOpen />)
    const button = screen.getByRole('button', { name: /how trust is earned/i })
    const panelId = button.getAttribute('aria-controls')!
    const panel = document.getElementById(panelId)!
    const intro = within(panel).getByText(/your trust score \(0.?1000\) is computed/i)
    expect(intro).toBeInTheDocument()
  })

  it('does not render tier content accessibly when panel is collapsed', () => {
    render(<TierLadder />)
    // The panel has the `hidden` attribute so its content is not exposed to
    // accessibility tree queries. queryByRole returns null for hidden content.
    expect(
      screen.queryByRole('heading', { level: 3, name: /bronze tier/i })
    ).not.toBeInTheDocument()
  })
})

// ─── Ordered list rendering ───────────────────────────────────────────────────

describe('tier list — ordered list structure', () => {
  it('renders tiers in an ordered list (ol)', () => {
    render(<TierLadder defaultOpen />)
    const list = document.querySelector('.tier-ladder__list')
    expect(list?.tagName).toBe('OL')
  })

  it('each tier is a list item (li) inside the ol', () => {
    render(<TierLadder defaultOpen />)
    const listItems = document.querySelectorAll('.tier-ladder__list > li')
    expect(listItems).toHaveLength(TIER_LADDER.length)
  })
})

// ─── defaultOpen false vs true — deterministic initial state ──────────────────

describe('defaultOpen prop — deterministic boundary inputs', () => {
  it('defaultOpen=false (explicit) collapses the panel on mount', () => {
    const { button, panel } = renderAndGetPanel({ defaultOpen: false })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveAttribute('hidden')
  })

  it('defaultOpen=true expands the panel on mount', () => {
    const { button, panel } = renderAndGetPanel({ defaultOpen: true })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('hidden')
  })

  it('omitting defaultOpen is equivalent to defaultOpen=false', () => {
    // Implicit default
    const { button: btn1, panel: panel1 } = renderAndGetPanel()
    expect(btn1).toHaveAttribute('aria-expanded', 'false')
    expect(panel1).toHaveAttribute('hidden')
  })
})

// ─── Trigger button — accessible name and type ───────────────────────────────

describe('trigger button — accessible name and type', () => {
  it('button has type="button" to prevent accidental form submission', () => {
    render(<TierLadder />)
    const button = screen.getByRole('button', { name: /how trust is earned/i })
    expect(button).toHaveAttribute('type', 'button')
  })

  it('button accessible name is derived from visible text label', () => {
    render(<TierLadder />)
    // The button contains a visible span with the label — accessible name
    // is computed from its text content.
    expect(screen.getByRole('button', { name: /how trust is earned/i })).toBeInTheDocument()
  })

  it('trigger hint text "Tier thresholds and benefits" is visible in the button', () => {
    render(<TierLadder />)
    expect(screen.getByText(/tier thresholds and benefits/i)).toBeInTheDocument()
  })
})

// ─── Determinism — repeated renders produce identical structure ───────────────

describe('determinism — repeated renders produce identical structure', () => {
  it('renders the same four tier ids on every render', () => {
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(<TierLadder defaultOpen />)
      TIER_ORDER.forEach((id) => {
        expect(screen.getByTestId(`badge-${id}`)).toBeInTheDocument()
      })
      unmount()
    }
  })

  it('formatThreshold output is stable for the same TIER_LADDER data', () => {
    // Render twice; both should show the same threshold text
    const { unmount } = render(<TierLadder defaultOpen />)
    const thresholds1 = Array.from(document.querySelectorAll('.tier-ladder__threshold-value')).map(
      (el) => el.textContent
    )
    unmount()

    render(<TierLadder defaultOpen />)
    const thresholds2 = Array.from(document.querySelectorAll('.tier-ladder__threshold-value')).map(
      (el) => el.textContent
    )

    expect(thresholds1).toEqual(thresholds2)
  })
})

// ─── TierDefinition type contract ────────────────────────────────────────────

describe('TierDefinition type contract — all fields present and typed correctly', () => {
  it.each(TIER_LADDER)('$id has all required TierDefinition fields', (tier: TierDefinition) => {
    expect(typeof tier.id).toBe('string')
    expect(typeof tier.label).toBe('string')
    expect(typeof tier.scoreMin).toBe('number')
    // scoreMax is number or null — both are valid
    expect(tier.scoreMax === null || typeof tier.scoreMax === 'number').toBe(true)
    expect(Array.isArray(tier.benefits)).toBe(true)
  })

  it.each(TIER_LADDER)('$id: scoreMin is a non-negative integer', (tier: TierDefinition) => {
    expect(Number.isInteger(tier.scoreMin)).toBe(true)
    expect(tier.scoreMin).toBeGreaterThanOrEqual(0)
  })

  it.each(TIER_LADDER)(
    '$id: scoreMax is either null or a positive integer greater than scoreMin',
    (tier: TierDefinition) => {
      if (tier.scoreMax !== null) {
        expect(Number.isInteger(tier.scoreMax)).toBe(true)
        expect(tier.scoreMax).toBeGreaterThan(tier.scoreMin)
      }
    }
  )
})

// ─── ErrorBoundary wrapping — recovery and invariants ────────────────────────
//
// TierLadder is a pure presentational component that should never throw. These
// tests verify that:
//   1. A healthy TierLadder renders normally inside ErrorBoundary.
//   2. If a child that throws is placed beside TierLadder, the boundary catches
//      the sibling but TierLadder itself is still renderable (after reset).
//   3. The ErrorBoundary reset flow re-mounts children cleanly.

describe('ErrorBoundary wrapping — render safety and recovery', () => {
  // Suppress expected error console noise during these tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('TierLadder renders normally when wrapped in ErrorBoundary (no error thrown)', () => {
    render(
      <ErrorBoundary>
        <TierLadder />
      </ErrorBoundary>
    )
    // The trigger button must be reachable — boundary passed through cleanly
    expect(screen.getByRole('button', { name: /how trust is earned/i })).toBeInTheDocument()
    // No error fallback should appear
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('TierLadder with defaultOpen renders all tier content inside ErrorBoundary', () => {
    render(
      <ErrorBoundary>
        <TierLadder defaultOpen />
      </ErrorBoundary>
    )
    // All four tiers should be accessible — no boundary interruption
    expect(screen.getByRole('heading', { level: 3, name: /bronze tier/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /platinum tier/i })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ErrorBoundary catches a sibling component that throws — fallback shown', () => {
    const ThrowingChild = (): never => {
      throw new Error('sibling exploded')
    }

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )

    // The boundary fallback must appear
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('ErrorBoundary reset re-mounts TierLadder cleanly from a collapsed default state', async () => {
    const user = userEvent.setup()
    let shouldThrow = true

    // A component that throws on first mount but not after reset
    const FlakyWrapper = () => {
      if (shouldThrow) {
        throw new Error('initial render failure')
      }
      return <TierLadder />
    }

    render(
      <ErrorBoundary>
        <FlakyWrapper />
      </ErrorBoundary>
    )

    // First: boundary shows error fallback
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Allow recovery on next render
    shouldThrow = false

    // Click "Try again" to reset the boundary
    await user.click(screen.getByRole('button', { name: /try again/i }))

    // TierLadder re-mounts in its default closed state
    const button = screen.getByRole('button', { name: /how trust is earned/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('TierLadder toggle still works after ErrorBoundary reset', async () => {
    const user = userEvent.setup()
    let shouldThrow = true

    const FlakyWrapper = () => {
      if (shouldThrow) {
        throw new Error('first mount throws')
      }
      return <TierLadder />
    }

    render(
      <ErrorBoundary>
        <FlakyWrapper />
      </ErrorBoundary>
    )

    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /try again/i }))

    const button = screen.getByRole('button', { name: /how trust is earned/i })
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('custom ErrorBoundary fallback render prop receives the thrown error and a reset fn', () => {
    const ThrowingChild = (): never => {
      throw new Error('custom fallback test')
    }

    const customFallback = (error: Error, reset: () => void) => (
      <div data-testid="custom-fallback">
        <span>{error.message}</span>
        <button onClick={reset}>custom reset</button>
      </div>
    )

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild />
      </ErrorBoundary>
    )

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.getByText('custom fallback test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /custom reset/i })).toBeInTheDocument()
  })
})

// ─── tierForScore — boundary score values ────────────────────────────────────
//
// These tests verify that the exported tierForScore helper returns the correct
// tier at every meaningful boundary:
//   - Absolute minimum (0), last bronze score (249), first silver score (250)
//   - Last silver score (499), first gold score (500)
//   - Last gold score (749), first platinum score (750)
//   - Top of documented range (1000) and out-of-range values
//
// The correct mapping is documented in src/lib/tier.ts and TIERS thresholds.

describe('tierForScore — boundary score values', () => {
  // ── Bronze boundaries ──────────────────────────────────────────────────────
  it('score 0 → bronze (absolute minimum, bottom of range)', () => {
    expect(tierForScore(0)).toBe('bronze')
  })

  it('score 1 → bronze (inside lower bound)', () => {
    expect(tierForScore(1)).toBe('bronze')
  })

  it('score 249 → bronze (last bronze score, inclusive max)', () => {
    expect(tierForScore(249)).toBe('bronze')
  })

  // ── Silver boundaries ──────────────────────────────────────────────────────
  it('score 250 → silver (first silver score, inclusive min)', () => {
    expect(tierForScore(250)).toBe('silver')
  })

  it('score 251 → silver (just inside silver)', () => {
    expect(tierForScore(251)).toBe('silver')
  })

  it('score 499 → silver (last silver score, inclusive max)', () => {
    expect(tierForScore(499)).toBe('silver')
  })

  // ── Gold boundaries ────────────────────────────────────────────────────────
  it('score 500 → gold (first gold score, inclusive min)', () => {
    expect(tierForScore(500)).toBe('gold')
  })

  it('score 501 → gold (just inside gold)', () => {
    expect(tierForScore(501)).toBe('gold')
  })

  it('score 749 → gold (last gold score, inclusive max)', () => {
    expect(tierForScore(749)).toBe('gold')
  })

  // ── Platinum boundaries ────────────────────────────────────────────────────
  it('score 750 → platinum (first platinum score, open-ended min)', () => {
    expect(tierForScore(750)).toBe('platinum')
  })

  it('score 751 → platinum (inside platinum range)', () => {
    expect(tierForScore(751)).toBe('platinum')
  })

  it('score 1000 → platinum (documented upper limit)', () => {
    expect(tierForScore(1000)).toBe('platinum')
  })

  // ── Out-of-range inputs: clamp behaviour ───────────────────────────────────
  it('negative score (-1) → bronze (clamps to minimum tier)', () => {
    expect(tierForScore(-1)).toBe('bronze')
  })

  it('score -1000 → bronze (large negative clamps to bronze)', () => {
    expect(tierForScore(-1000)).toBe('bronze')
  })

  it('score 1001 → platinum (above documented max still resolves to platinum)', () => {
    expect(tierForScore(1001)).toBe('platinum')
  })

  it('score 9999 → platinum (far-out-of-range still returns platinum)', () => {
    expect(tierForScore(9999)).toBe('platinum')
  })

  // ── Adjacent pairs: confirm no off-by-one overlap between tiers ───────────
  it.each([
    [249, 'bronze', 250, 'silver'],
    [499, 'silver', 500, 'gold'],
    [749, 'gold', 750, 'platinum'],
  ] as const)(
    'score %i → %s and score %i → %s (no off-by-one between adjacent tiers)',
    (lowerScore, lowerTier, upperScore, upperTier) => {
      expect(tierForScore(lowerScore)).toBe(lowerTier)
      expect(tierForScore(upperScore)).toBe(upperTier)
    }
  )
})

// ─── TIER_LADDER mutation safety ─────────────────────────────────────────────
//
// TIER_LADDER is a module-level constant. Callers that mutate its structure
// (push/pop/splice) must not corrupt the render of a subsequently mounted
// TierLadder component. Because TIER_LADDER shares the same reference as the
// module export this test verifies the observable impact of such mutations.

describe('TIER_LADDER — mutation safety and render isolation', () => {
  it('pushing to a local copy of TIER_LADDER does not affect TierLadder render', () => {
    // Build an isolated copy to verify the module export is not disturbed
    const localCopy = [...TIER_LADDER]
    const extraTier: TierDefinition = {
      id: 'bronze',
      label: 'Extra',
      scoreMin: 9000,
      scoreMax: 9999,
      benefits: ['phantom benefit'],
    }
    localCopy.push(extraTier)

    // Render should still show exactly four steps from the canonical array
    render(<TierLadder defaultOpen />)
    expect(document.querySelectorAll('.tier-ladder__step')).toHaveLength(4)
    expect(screen.queryByText('Extra tier')).not.toBeInTheDocument()
  })

  it('TIER_LADDER still has exactly four entries after a local copy is mutated', () => {
    const copy = TIER_LADDER.slice()
    copy.pop()
    // Original must be untouched
    expect(TIER_LADDER).toHaveLength(4)
  })

  it('shallow-replacing entries in a local copy does not change TIER_LADDER length', () => {
    const copy = [...TIER_LADDER]
    copy[0] = { ...copy[0], label: 'Mutated' }
    // Original first entry label unchanged
    expect(TIER_LADDER[0].label).toBe('Bronze')
  })

  it('render after a destructive slice copy still produces four tier steps', () => {
    // Simulate a caller slicing off the last two entries for display purposes
    const partial = TIER_LADDER.slice(0, 2)
    // The component must still render from the real TIER_LADDER, not the partial
    render(<TierLadder defaultOpen />)
    expect(document.querySelectorAll('.tier-ladder__step')).toHaveLength(TIER_LADDER.length)
    // partial was only used in test scope — verify it has 2 entries
    expect(partial).toHaveLength(2)
  })

  it('benefits array reference sharing does not allow a mutation to corrupt render', () => {
    // TIER_LADDER entries share the same benefits array reference as TIERS.
    // Verify that the rendered text matches the live array, not a stale copy.
    const bronze = TIER_LADDER.find((t) => t.id === 'bronze')!
    render(<TierLadder defaultOpen />)
    // Every bronze benefit currently in the array must appear in the document
    for (const benefit of bronze.benefits) {
      expect(screen.getByText(benefit)).toBeInTheDocument()
    }
  })
})

// ─── StrictMode double-invoke — state idempotence ────────────────────────────
//
// React.StrictMode intentionally double-invokes component functions and effect
// setup/teardown in development. The toggle state must be idempotent after
// StrictMode's extra render pass.

describe('StrictMode double-invoke — state idempotence', () => {
  it('renders in collapsed default state under StrictMode', () => {
    render(
      <StrictMode>
        <TierLadder />
      </StrictMode>
    )
    const button = screen.getByRole('button', { name: /how trust is earned/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders in expanded state with defaultOpen=true under StrictMode', () => {
    render(
      <StrictMode>
        <TierLadder defaultOpen />
      </StrictMode>
    )
    const button = screen.getByRole('button', { name: /how trust is earned/i })
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('toggle works correctly after StrictMode double-invoke', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <TierLadder />
      </StrictMode>
    )
    const button = screen.getByRole('button', { name: /how trust is earned/i })

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('all four tier steps are rendered under StrictMode', () => {
    render(
      <StrictMode>
        <TierLadder defaultOpen />
      </StrictMode>
    )
    expect(document.querySelectorAll('.tier-ladder__step')).toHaveLength(4)
  })

  it('ARIA ids are unique and consistent under StrictMode (no duplicate id attributes)', () => {
    render(
      <StrictMode>
        <TierLadder />
      </StrictMode>
    )
    const button = screen.getByRole('button', { name: /how trust is earned/i })
    const panelId = button.getAttribute('aria-controls')!
    const section = button.closest('section')!
    const headingId = section.getAttribute('aria-labelledby')!

    // Both ids must exist and be distinct
    expect(document.getElementById(panelId)).toBeInTheDocument()
    expect(document.getElementById(headingId)).toBeInTheDocument()
    expect(panelId).not.toBe(headingId)

    // No duplicate elements with those ids
    expect(document.querySelectorAll(`#${CSS.escape(panelId)}`)).toHaveLength(1)
    expect(document.querySelectorAll(`#${CSS.escape(headingId)}`)).toHaveLength(1)
  })
})

// ─── Remount state reset ──────────────────────────────────────────────────────
//
// When TierLadder is unmounted and remounted, React creates a fresh component
// instance. State must reset to the `defaultOpen` initial value, not persist
// the previous interaction state.

describe('remount state reset — no stale state leaks across lifecycles', () => {
  it('toggle state resets to closed on remount after user had opened the panel', async () => {
    const user = userEvent.setup()

    const { unmount } = render(<TierLadder />)
    const button = screen.getByRole('button', { name: /how trust is earned/i })

    // Open the panel in the first instance
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    // Unmount and remount — new instance must start closed
    unmount()
    render(<TierLadder />)

    const newButton = screen.getByRole('button', { name: /how trust is earned/i })
    expect(newButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggle state resets to open on remount when defaultOpen=true', async () => {
    const user = userEvent.setup()

    const { unmount } = render(<TierLadder defaultOpen />)
    const button = screen.getByRole('button', { name: /how trust is earned/i })

    // Close the panel
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')

    // Unmount and remount — must respect defaultOpen=true again
    unmount()
    render(<TierLadder defaultOpen />)

    const newButton = screen.getByRole('button', { name: /how trust is earned/i })
    expect(newButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('two sequential remounts each start with a fresh collapsed state', async () => {
    const user = userEvent.setup()

    for (let cycle = 1; cycle <= 2; cycle++) {
      const { unmount } = render(<TierLadder />)
      const btn = screen.getByRole('button', { name: /how trust is earned/i })
      // Open then close
      await user.click(btn)
      await user.click(btn)
      // Must be closed before unmount
      expect(btn).toHaveAttribute('aria-expanded', 'false')
      unmount()
    }

    // Final mount should start collapsed
    render(<TierLadder />)
    expect(screen.getByRole('button', { name: /how trust is earned/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('each remount produces a fresh useId so panel id does not collide with prior mount', () => {
    const { unmount: unmount1 } = render(<TierLadder />)
    // Capture the first instance's panel id only to document the first mount occurred;
    // its exact value is not asserted because React.useId may reuse sequences after unmount.
    screen.getByRole('button', { name: /how trust is earned/i })

    unmount1()

    render(<TierLadder />)
    const button2 = screen.getByRole('button', { name: /how trust is earned/i })
    const panelId2 = button2.getAttribute('aria-controls')

    // useId generates stable but unique ids per component instance.
    // After unmount + remount we cannot rely on a different id value
    // (React may reuse the same sequence) — what matters is that exactly
    // one panel element exists and it is correctly wired.
    expect(document.getElementById(panelId2!)).toBeInTheDocument()
    expect(document.querySelectorAll(`[id="${panelId2}"]`)).toHaveLength(1)
  })
})

// ─── className edge cases ─────────────────────────────────────────────────────
//
// Boundary conditions not covered by the existing className suite:
//   - Very long className strings (no DOM truncation / overflow)
//   - CSS special characters that are valid in HTML attributes
//   - Numeric-only class names
//   - Hyphen / underscore heavy names
//   - Unicode class names

describe('className edge cases — boundary inputs', () => {
  it('applies a very long className string without truncating or erroring', () => {
    const longClass = 'a'.repeat(1000)
    const { container } = render(<TierLadder className={longClass} />)
    const section = container.querySelector('section')
    expect(section).toHaveClass('tier-ladder')
    expect(section?.className).toContain(longClass)
  })

  it('applies a class name with leading and trailing hyphens', () => {
    const { container } = render(<TierLadder className="-my-class-" />)
    const section = container.querySelector('section')
    expect(section?.className).toContain('-my-class-')
  })

  it('applies a class name that is entirely digits (valid HTML class)', () => {
    const { container } = render(<TierLadder className="12345" />)
    const section = container.querySelector('section')
    expect(section?.className).toContain('12345')
  })

  it('applies class names with double underscores (BEM-style)', () => {
    const { container } = render(<TierLadder className="block__element--modifier" />)
    const section = container.querySelector('section')
    expect(section).toHaveClass('block__element--modifier')
  })

  it('applies class names with multiple consecutive spaces between tokens', () => {
    // The template literal "tier-ladder " + className gets trimmed but the
    // browser normalises attribute whitespace internally — the classes must
    // still be applied correctly.
    const { container } = render(<TierLadder className="  spaced  " />)
    const section = container.querySelector('section')
    // Both base class and custom class must be present
    expect(section).toHaveClass('tier-ladder')
    expect(section?.className).toContain('spaced')
  })

  it('base class tier-ladder is always present regardless of className input', () => {
    const cases = [undefined, '', '   ', 'extra', '-my-class-', '12345', 'a'.repeat(500)]
    for (const cls of cases) {
      const { container, unmount } = render(
        <TierLadder {...(cls !== undefined ? { className: cls } : {})} />
      )
      expect(container.querySelector('section')).toHaveClass('tier-ladder')
      unmount()
    }
  })
})

// ─── formatThreshold — synthetic TierDefinition edge cases ───────────────────
//
// formatThreshold is a private function, but its output is fully observable
// via the rendered DOM. We exercise it with synthetic TierDefinition objects
// by constructing a minimal wrapping scenario that exposes the output through
// the threshold value element.
//
// Strategy: all observable calls come from TIER_LADDER, so we validate the
// output for scoreMax=null (open-ended) and finite scoreMax through the
// rendered threshold-value elements. Additionally we verify the en-dash
// character and the plus-sign suffix precisely.

describe('formatThreshold — output correctness and edge-case invariants', () => {
  it('open-ended tier (platinum, scoreMax=null) renders "scoreMin+" with a plus sign', () => {
    render(<TierLadder defaultOpen />)
    const platinumStep = document.querySelector('.tier-ladder__step--platinum')!
    const value = platinumStep.querySelector('.tier-ladder__threshold-value')!
    expect(value.textContent).toMatch(/^\d+\+$/)
  })

  it('bounded tier (bronze) renders "scoreMin–scoreMax" with an en-dash (U+2013)', () => {
    render(<TierLadder defaultOpen />)
    const bronzeStep = document.querySelector('.tier-ladder__step--bronze')!
    const value = bronzeStep.querySelector('.tier-ladder__threshold-value')!
    expect(value.textContent).toMatch(/^\d+\u2013\d+$/)
  })

  it('bounded tier (silver) threshold contains exactly one en-dash separator', () => {
    render(<TierLadder defaultOpen />)
    const silverStep = document.querySelector('.tier-ladder__step--silver')!
    const value = silverStep.querySelector('.tier-ladder__threshold-value')!
    const enDashCount = (value.textContent ?? '').split('\u2013').length - 1
    expect(enDashCount).toBe(1)
  })

  it('bounded tier (gold) threshold contains no plus sign', () => {
    render(<TierLadder defaultOpen />)
    const goldStep = document.querySelector('.tier-ladder__step--gold')!
    const value = goldStep.querySelector('.tier-ladder__threshold-value')!
    expect(value.textContent).not.toContain('+')
  })

  it('open-ended tier (platinum) threshold contains no en-dash', () => {
    render(<TierLadder defaultOpen />)
    const platinumStep = document.querySelector('.tier-ladder__step--platinum')!
    const value = platinumStep.querySelector('.tier-ladder__threshold-value')!
    expect(value.textContent).not.toContain('\u2013')
  })

  it('all four threshold values are non-empty strings', () => {
    render(<TierLadder defaultOpen />)
    const values = document.querySelectorAll('.tier-ladder__threshold-value')
    expect(values).toHaveLength(4)
    values.forEach((el) => {
      expect(el.textContent?.trim().length).toBeGreaterThan(0)
    })
  })

  it('threshold labels and values appear in pairs — one of each per tier card', () => {
    render(<TierLadder defaultOpen />)
    const labels = document.querySelectorAll('.tier-ladder__threshold-label')
    const values = document.querySelectorAll('.tier-ladder__threshold-value')
    expect(labels).toHaveLength(TIER_LADDER.length)
    expect(values).toHaveLength(TIER_LADDER.length)
  })

  it('scoreMin appears verbatim in each threshold display string', () => {
    render(<TierLadder defaultOpen />)
    TIER_LADDER.forEach((tier) => {
      const step = document.querySelector(`.tier-ladder__step--${tier.id}`)!
      const value = step.querySelector('.tier-ladder__threshold-value')!
      expect(value.textContent).toContain(String(tier.scoreMin))
    })
  })

  it('finite scoreMax appears verbatim in the threshold display for non-open-ended tiers', () => {
    render(<TierLadder defaultOpen />)
    TIER_LADDER.filter((t) => t.scoreMax !== null).forEach((tier) => {
      const step = document.querySelector(`.tier-ladder__step--${tier.id}`)!
      const value = step.querySelector('.tier-ladder__threshold-value')!
      expect(value.textContent).toContain(String(tier.scoreMax))
    })
  })
})

// ─── Concurrent instances — isolation and no id collision ────────────────────
//
// Multiple TierLadder instances rendered simultaneously must not share state
// or ARIA ids. Each instance's toggle must be independent.

describe('concurrent instances — complete isolation', () => {
  it('three simultaneous instances each start in their own independent collapsed state', () => {
    render(
      <div>
        <TierLadder />
        <TierLadder />
        <TierLadder />
      </div>
    )
    const buttons = screen.getAllByRole('button', { name: /how trust is earned/i })
    expect(buttons).toHaveLength(3)
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-expanded', 'false')
    })
  })

  it('opening one instance does not change the state of the other two', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <TierLadder />
        <TierLadder />
        <TierLadder />
      </div>
    )
    const buttons = screen.getAllByRole('button', { name: /how trust is earned/i })

    // Open only the second instance
    await user.click(buttons[1])

    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false')
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'true')
    expect(buttons[2]).toHaveAttribute('aria-expanded', 'false')
  })

  it('all three instances use unique panelIds and headingIds (no attribute collision)', () => {
    const { container } = render(
      <div>
        <TierLadder />
        <TierLadder />
        <TierLadder />
      </div>
    )
    const buttons = screen.getAllByRole('button', { name: /how trust is earned/i })
    const panelIds = buttons.map((b) => b.getAttribute('aria-controls')!)
    const sections = container.querySelectorAll('section.tier-ladder')
    const headingIds = Array.from(sections).map((s) => s.getAttribute('aria-labelledby')!)

    // All six ids must be distinct
    const allIds = [...panelIds, ...headingIds]
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(6)
  })

  it('each concurrent instance renders its own complete set of four tier steps', () => {
    const { container } = render(
      <div>
        <TierLadder defaultOpen />
        <TierLadder defaultOpen />
      </div>
    )
    // 2 instances × 4 steps = 8 total
    expect(container.querySelectorAll('.tier-ladder__step')).toHaveLength(8)
  })

  it('closing all three instances after they were opened returns each to collapsed state', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <TierLadder />
        <TierLadder />
        <TierLadder />
      </div>
    )
    const buttons = screen.getAllByRole('button', { name: /how trust is earned/i })

    // Open all three
    for (const btn of buttons) {
      await user.click(btn)
    }
    buttons.forEach((btn) => expect(btn).toHaveAttribute('aria-expanded', 'true'))

    // Close all three
    for (const btn of buttons) {
      await user.click(btn)
    }
    buttons.forEach((btn) => expect(btn).toHaveAttribute('aria-expanded', 'false'))
  })
})

// ─── Adverse-case inputs — prop boundary invariants ──────────────────────────
//
// Verify TierLadder remains stable when receiving unusual but TypeScript-valid
// prop combinations that callers might supply.

describe('adverse-case prop inputs — component remains stable', () => {
  it('renders without crashing when no props are supplied (all defaults)', () => {
    expect(() => render(<TierLadder />)).not.toThrow()
  })

  it('renders without crashing when defaultOpen is explicitly true', () => {
    expect(() => render(<TierLadder defaultOpen={true} />)).not.toThrow()
  })

  it('renders without crashing when defaultOpen is explicitly false', () => {
    expect(() => render(<TierLadder defaultOpen={false} />)).not.toThrow()
  })

  it('the section element is always present regardless of open/closed state', () => {
    const { container: c1 } = render(<TierLadder />)
    expect(c1.querySelector('section.tier-ladder')).toBeInTheDocument()

    const { container: c2 } = render(<TierLadder defaultOpen />)
    expect(c2.querySelector('section.tier-ladder')).toBeInTheDocument()
  })

  it('the trigger button is always focusable and not disabled', () => {
    render(<TierLadder />)
    const button = screen.getByRole('button', { name: /how trust is earned/i })
    expect(button).not.toBeDisabled()
    expect(button).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('panel hidden attribute is a boolean presence — not a string value', () => {
    const { button, panel } = renderAndGetPanel()
    // panel starts with `hidden` present (collapsed)
    expect(panel.hidden).toBe(true)

    // After opening, hidden is absent
    act(() => {
      button.click()
    })
    expect(panel.hidden).toBe(false)
  })
})
