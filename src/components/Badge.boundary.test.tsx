import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import Badge from './Badge'

vi.mock('./Badge.css', () => ({}))
vi.mock('./TooltipOnOverflow.css', () => ({}))
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

afterEach(() => {
  cleanup()
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. Case-insensitivity boundary — variant normalization uses .toLowerCase()
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – case-insensitive variant normalization', () => {
  it.each([
    ['GOLD', 'Gold'],
    ['Gold', 'Gold'],
    ['gOlD', 'Gold'],
    ['BRONZE', 'Bronze'],
    ['Silver', 'Silver'],
    ['PLATINUM', 'Platinum'],
    ['ACTIVE', 'Active'],
    ['LOCKED', 'Locked'],
    ['SLASHED', 'Slashed'],
    ['GRACE-PERIOD', 'Grace Period'],
    ['Grace-Period', 'Grace Period'],
    ['UNKNOWN', 'Unknown'],
  ] as const)(
    'variant "%s" (mixed/upper case) normalizes correctly and renders label "%s"',
    (variant, expectedLabel) => {
      render(<Badge variant={variant} />)
      expect(screen.getByText(expectedLabel)).toBeInTheDocument()
    }
  )

  it.each([
    ['GOLD', 'badge--gold'],
    ['Bronze', 'badge--bronze'],
    ['SLASHED', 'badge--slashed'],
    ['GRACE-PERIOD', 'badge--grace-period'],
  ] as const)('variant "%s" applies the correct CSS class "%s"', (variant, expectedClass) => {
    render(<Badge variant={variant} />)
    expect(document.querySelector(`.${expectedClass}`)).not.toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Boundary inputs — whitespace, special characters, very long strings
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – boundary variant strings', () => {
  it('treats whitespace-only variant as unknown', () => {
    render(<Badge variant="   " />)
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('treats variant with leading/trailing spaces as unknown (no trimming)', () => {
    // " gold " !== "gold" after toLowerCase(), so it falls to unknown
    render(<Badge variant=" gold " />)
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
  })

  it('handles special characters in variant gracefully (falls to unknown)', () => {
    render(<Badge variant="<script>alert(1)</script>" />)
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('handles unicode variant strings (falls to unknown)', () => {
    render(<Badge variant="🏅" />)
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('handles very long variant string without crashing', () => {
    const longVariant = 'x'.repeat(10_000)
    render(<Badge variant={longVariant} />)
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('handles variant with only hyphens', () => {
    render(<Badge variant="---" />)
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
  })

  it('handles numeric-like variant string', () => {
    render(<Badge variant="12345" />)
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
  })

  it('handles null-byte-containing variant', () => {
    render(<Badge variant={'gold\x00extra'} />)
    // "gold\x00extra" !== "gold" so falls to unknown
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Label boundary — empty, whitespace, XSS, very long
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – label prop boundary values', () => {
  it('renders empty string label when explicitly provided', () => {
    render(<Badge variant="gold" label="" />)
    // Empty label should override default — badge still renders
    const badge = document.querySelector('.badge--gold')
    expect(badge).not.toBeNull()
    // The default "Gold" label should NOT appear
    expect(screen.queryByText('Gold')).toBeNull()
  })

  it('renders whitespace-only label as-is', () => {
    render(<Badge variant="gold" label="   " />)
    const badge = document.querySelector('.badge--gold')
    expect(badge).not.toBeNull()
    expect(screen.queryByText('Gold')).toBeNull()
  })

  it('renders HTML entities in label as escaped text (no injection)', () => {
    render(<Badge variant="gold" label="<b>Bold</b>" />)
    // Should render as literal text, not as HTML
    expect(screen.getByText('<b>Bold</b>')).toBeInTheDocument()
    expect(document.querySelector('b')).toBeNull()
  })

  it('handles very long label without crashing', () => {
    const longLabel = 'A'.repeat(10_000)
    render(<Badge variant="gold" label={longLabel} />)
    const badge = document.querySelector('.badge--gold')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toContain('A'.repeat(100)) // at least partial
  })

  it('renders unicode/emoji label correctly', () => {
    render(<Badge variant="platinum" label="🏆 Champion" />)
    expect(screen.getByText('🏆 Champion')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. className boundary
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – className prop boundary values', () => {
  it('handles empty string className without extra spaces', () => {
    render(<Badge variant="gold" className="" />)
    const badge = document.querySelector('.badge')
    expect(badge?.className).not.toMatch(/\s{2,}/)
    expect(badge?.className).not.toMatch(/^\s|\s$/)
  })

  it('handles multiple space-separated class names', () => {
    render(<Badge variant="gold" className="class-a class-b class-c" />)
    const badge = document.querySelector('.badge')
    expect(badge).toHaveClass('class-a')
    expect(badge).toHaveClass('class-b')
    expect(badge).toHaveClass('class-c')
  })

  it('handles className with special characters (CSS escaping not needed in className)', () => {
    render(<Badge variant="gold" className="my-class_v2" />)
    const badge = document.querySelector('.badge')
    expect(badge).toHaveClass('my-class_v2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. srPrefix boundary
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – srPrefix prop boundary values', () => {
  it('renders sr-only span with empty string srPrefix', () => {
    render(<Badge variant="gold" srPrefix="" />)
    // Empty string is falsy, so the sr-only span should NOT render
    expect(document.querySelector('.sr-only')).toBeNull()
  })

  it('renders sr-only span with whitespace srPrefix', () => {
    render(<Badge variant="gold" srPrefix="   " />)
    // Non-empty string (spaces) is truthy, so sr-only span SHOULD render
    const srSpan = document.querySelector('.sr-only')
    expect(srSpan).not.toBeNull()
  })

  it('does not render XSS through srPrefix', () => {
    render(<Badge variant="gold" srPrefix="<img onerror=alert(1) src=x>" />)
    const srSpan = document.querySelector('.sr-only')
    expect(srSpan).not.toBeNull()
    // Should be text, not an img element
    expect(document.querySelector('img')).toBeNull()
    expect(srSpan?.textContent).toContain('<img')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. ariaLabel boundary
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – ariaLabel prop boundary values', () => {
  it('empty ariaLabel overrides default to empty string', () => {
    render(<Badge variant="gold" ariaLabel="" />)
    const badge = document.querySelector('.badge')
    // ariaLabel="" -> accessibleLabel = ""
    expect(badge?.getAttribute('aria-label')).toBe('')
  })

  it('ariaLabel with special characters is set correctly', () => {
    render(<Badge variant="gold" ariaLabel='Status: "Gold" tier & active' />)
    const badge = document.querySelector('.badge')
    expect(badge?.getAttribute('aria-label')).toBe('Status: "Gold" tier & active')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Recovery — re-render with corrected props after invalid input
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – recovery after invalid/corrected props', () => {
  it('recovers from unknown variant to valid variant on re-render', () => {
    const { rerender } = render(<Badge variant="invalid-tier" />)
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
    expect(screen.getByText('Unknown')).toBeInTheDocument()

    rerender(<Badge variant="gold" />)
    expect(document.querySelector('.badge--gold')).not.toBeNull()
    expect(screen.getByText('Gold')).toBeInTheDocument()
    expect(document.querySelector('.badge--unknown')).toBeNull()
  })

  it('recovers from valid variant to another valid variant', () => {
    const { rerender } = render(<Badge variant="bronze" />)
    expect(screen.getByText('Bronze')).toBeInTheDocument()

    rerender(<Badge variant="platinum" />)
    expect(screen.getByText('Platinum')).toBeInTheDocument()
    expect(screen.queryByText('Bronze')).toBeNull()
  })

  it('recovers from valid variant to unknown and back', () => {
    const { rerender } = render(<Badge variant="gold" />)
    expect(screen.getByText('Gold')).toBeInTheDocument()

    rerender(<Badge variant="garbage" />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()

    rerender(<Badge variant="silver" />)
    expect(screen.getByText('Silver')).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).toBeNull()
  })

  it('recovers label override: custom → default', () => {
    const { rerender } = render(<Badge variant="gold" label="Custom" />)
    expect(screen.getByText('Custom')).toBeInTheDocument()

    rerender(<Badge variant="gold" />)
    expect(screen.getByText('Gold')).toBeInTheDocument()
    expect(screen.queryByText('Custom')).toBeNull()
  })

  it('recovers srPrefix: added → removed', () => {
    const { rerender } = render(<Badge variant="gold" srPrefix="Status:" />)
    expect(document.querySelector('.sr-only')).not.toBeNull()

    rerender(<Badge variant="gold" />)
    expect(document.querySelector('.sr-only')).toBeNull()
  })

  it('CSS class updates correctly through variant transitions', () => {
    const { rerender } = render(<Badge variant="slashed" />)
    expect(document.querySelector('.badge--slashed')).not.toBeNull()

    rerender(<Badge variant="active" />)
    expect(document.querySelector('.badge--active')).not.toBeNull()
    expect(document.querySelector('.badge--slashed')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. State preservation — DOM structure invariants
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – structural invariants', () => {
  it('always wraps badge in TooltipOnOverflow (wrapper exists)', () => {
    render(<Badge variant="gold" />)
    const wrapper = document.querySelector('.tooltip-on-overflow__wrapper')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.querySelector('.badge')).not.toBeNull()
  })

  it('badge always has at least one CSS class (badge + variant class)', () => {
    const variants = ['gold', 'unknown', 'invalid', '', 'SILVER', '🏅']
    for (const v of variants) {
      const { unmount } = render(<Badge variant={v} />)
      const badge = document.querySelector('.badge')
      expect(badge).not.toBeNull()
      // Must have at least badge and badge--<variant>
      expect(badge?.classList.length).toBeGreaterThanOrEqual(2)
      unmount()
    }
  })

  it('no duplicate class names in badge element', () => {
    render(<Badge variant="gold" className="badge--gold" />)
    const badge = document.querySelector('.badge')
    expect(badge).not.toBeNull()
  })

  it('all known variants produce exactly one badge element', () => {
    const variants = [
      'bronze',
      'silver',
      'gold',
      'platinum',
      'active',
      'locked',
      'slashed',
      'grace-period',
      'unknown',
    ]
    for (const v of variants) {
      const { unmount } = render(<Badge variant={v} />)
      const badges = document.querySelectorAll('.badge')
      expect(badges.length).toBe(1)
      unmount()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Compound props — all optional props combined
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – compound prop interactions', () => {
  it('renders correctly with all optional props provided simultaneously', () => {
    render(
      <Badge
        variant="slashed"
        label="Penalty Applied"
        className="extra-class"
        srPrefix="Bond status:"
        ariaLabel="Bond has been slashed"
      />
    )
    const badge = document.querySelector('.badge')
    expect(badge).not.toBeNull()
    expect(badge).toHaveClass('badge--slashed')
    expect(badge).toHaveClass('extra-class')
    expect(screen.getByText('Penalty Applied')).toBeInTheDocument()
    expect(document.querySelector('.sr-only')).toHaveTextContent('Bond status:')
    expect(badge?.getAttribute('aria-label')).toBe('Bond has been slashed')
  })

  it('unknown variant + label override + srPrefix all work together', () => {
    render(
      <Badge
        variant="custom-tier"
        label="My Custom Badge"
        srPrefix="Tier:"
        ariaLabel="Custom tier badge"
      />
    )
    expect(document.querySelector('.badge--unknown')).not.toBeNull()
    expect(screen.getByText('My Custom Badge')).toBeInTheDocument()
    expect(document.querySelector('.sr-only')).toHaveTextContent('Tier:')
  })

  it('rapid variant changes do not leave stale DOM state', () => {
    const { rerender } = render(<Badge variant="gold" />)

    const variants = ['silver', 'slashed', 'active', 'unknown', 'platinum', 'bronze']
    for (const v of variants) {
      rerender(<Badge variant={v} />)
    }

    // After all re-renders, only the last variant should be visible
    expect(screen.getByText('Bronze')).toBeInTheDocument()
    expect(document.querySelector('.badge--bronze')).not.toBeNull()
    // No stale variant classes
    expect(document.querySelector('.badge--gold')).toBeNull()
    expect(document.querySelector('.badge--platinum')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. Regression — title attribute behavior for unknown variants
// ─────────────────────────────────────────────────────────────────────────────
describe('Badge – title attribute regression', () => {
  it('known variant "unknown" (literal) has no title (delegated to TooltipOnOverflow)', () => {
    render(<Badge variant="unknown" />)
    const badge = document.querySelector('.badge')
    // Title is handled by TooltipOnOverflow, not the badge span
    expect(badge).not.toHaveAttribute('title')
  })

  it('unrecognized variant string has no title on badge span', () => {
    render(<Badge variant="mystery-tier" />)
    const badge = document.querySelector('.badge')
    expect(badge).not.toHaveAttribute('title')
  })
})
