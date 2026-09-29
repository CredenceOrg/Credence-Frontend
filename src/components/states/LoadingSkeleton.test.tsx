import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import LoadingSkeleton from './LoadingSkeleton'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// Default the reduced-motion hook to "no preference" so the existing
// shimmer-token contract tests continue to assert the `var(...)` reference.
vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

// Helper: all direct children of the root element
const rootChildren = (container: HTMLElement) =>
  Array.from(container.firstElementChild!.children) as HTMLElement[]

describe('LoadingSkeleton', () => {
  // ─── text ────────────────────────────────────────────────────────────────

  describe('variant="text"', () => {
    it('renders `rows` line blocks', () => {
      const { container } = render(<LoadingSkeleton variant="text" rows={4} />)
      expect(rootChildren(container)).toHaveLength(4)
    })

    it('last line is narrower (60%)', () => {
      const { container } = render(<LoadingSkeleton variant="text" rows={3} />)
      const lines = rootChildren(container)
      expect(lines[2].style.width).toBe('60%')
    })

    it('all lines except the last are full-width', () => {
      const { container } = render(<LoadingSkeleton variant="text" rows={3} />)
      const lines = rootChildren(container)
      expect(lines[0].style.width).toBe('100%')
      expect(lines[1].style.width).toBe('100%')
    })

    it('rows=1: single line is the last line (60%)', () => {
      const { container } = render(<LoadingSkeleton variant="text" rows={1} />)
      const lines = rootChildren(container)
      expect(lines).toHaveLength(1)
      expect(lines[0].style.width).toBe('60%')
    })

    it('rows=5: five lines, only the last is narrow', () => {
      const { container } = render(<LoadingSkeleton variant="text" rows={5} />)
      const lines = rootChildren(container)
      expect(lines).toHaveLength(5)
      lines.slice(0, 4).forEach((l) => expect(l.style.width).toBe('100%'))
      expect(lines[4].style.width).toBe('60%')
    })

    it('applies the width prop to the wrapper', () => {
      const { container } = render(<LoadingSkeleton variant="text" width="480px" />)
      expect((container.firstElementChild as HTMLElement).style.width).toBe('480px')
    })

    it('last line has no bottom margin', () => {
      const { container } = render(<LoadingSkeleton variant="text" rows={2} />)
      const lines = rootChildren(container)
      expect(lines[1].style.marginBottom).toMatch(/^0(px)?$/)
    })

    it('non-last lines have bottom margin', () => {
      const { container } = render(<LoadingSkeleton variant="text" rows={2} />)
      const lines = rootChildren(container)
      expect(lines[0].style.marginBottom).toBe('0.75rem')
    })
  })

  // ─── card ─────────────────────────────────────────────────────────────────

  describe('variant="card"', () => {
    it('renders exactly 3 shimmer blocks', () => {
      const { container } = render(<LoadingSkeleton variant="card" />)
      expect(rootChildren(container)).toHaveLength(3)
    })

    it('title block (first) is 40% wide', () => {
      const { container } = render(<LoadingSkeleton variant="card" />)
      expect(rootChildren(container)[0].style.width).toBe('40%')
    })

    it('third block is 80% wide', () => {
      const { container } = render(<LoadingSkeleton variant="card" />)
      expect(rootChildren(container)[2].style.width).toBe('80%')
    })

    it('ignores the rows prop — structure is always 3 blocks', () => {
      const { container: c1 } = render(<LoadingSkeleton variant="card" rows={1} />)
      const { container: c2 } = render(<LoadingSkeleton variant="card" rows={10} />)
      expect(rootChildren(c1)).toHaveLength(3)
      expect(rootChildren(c2)).toHaveLength(3)
    })

    it('applies the width prop to the card wrapper', () => {
      const { container } = render(<LoadingSkeleton variant="card" width="320px" />)
      expect((container.firstElementChild as HTMLElement).style.width).toBe('320px')
    })
  })

  // ─── form ─────────────────────────────────────────────────────────────────

  describe('variant="form"', () => {
    it('renders `rows` field groups', () => {
      const { container } = render(<LoadingSkeleton variant="form" rows={3} />)
      expect(rootChildren(container)).toHaveLength(3)
    })

    it('each field group contains a label shimmer and an input shimmer', () => {
      const { container } = render(<LoadingSkeleton variant="form" rows={2} />)
      rootChildren(container).forEach((group) => {
        expect(group.children).toHaveLength(2)
      })
    })

    it('label shimmer is 30% wide', () => {
      const { container } = render(<LoadingSkeleton variant="form" rows={1} />)
      const labelShimmer = rootChildren(container)[0].children[0] as HTMLElement
      expect(labelShimmer.style.width).toBe('30%')
    })

    it('rows=1: a single field group', () => {
      const { container } = render(<LoadingSkeleton variant="form" rows={1} />)
      expect(rootChildren(container)).toHaveLength(1)
    })
  })

  // ─── table ────────────────────────────────────────────────────────────────

  describe('variant="table"', () => {
    it('renders 1 header block + `rows` data-row blocks', () => {
      const { container } = render(<LoadingSkeleton variant="table" rows={3} />)
      expect(rootChildren(container)).toHaveLength(4) // 1 header + 3 rows
    })

    it('rows=1: 2 total blocks (header + 1 row)', () => {
      const { container } = render(<LoadingSkeleton variant="table" rows={1} />)
      expect(rootChildren(container)).toHaveLength(2)
    })

    it('rows=5: 6 total blocks', () => {
      const { container } = render(<LoadingSkeleton variant="table" rows={5} />)
      expect(rootChildren(container)).toHaveLength(6)
    })

    it('header block is taller than data-row blocks', () => {
      const { container } = render(<LoadingSkeleton variant="table" rows={2} />)
      const [header, ...rows] = rootChildren(container)
      expect(header.style.height).toBe('3rem')
      rows.forEach((r) => expect(r.style.height).toBe('3.5rem'))
    })
  })

  // ─── dashboard ────────────────────────────────────────────────────────────

  describe('variant="dashboard"', () => {
    it('renders `rows` card tiles', () => {
      const { container } = render(<LoadingSkeleton variant="dashboard" rows={3} />)
      expect(rootChildren(container)).toHaveLength(3)
    })

    it('uses CSS grid layout', () => {
      const { container } = render(<LoadingSkeleton variant="dashboard" />)
      expect((container.firstElementChild as HTMLElement).style.display).toBe('grid')
    })

    it('each tile is 120px tall', () => {
      const { container } = render(<LoadingSkeleton variant="dashboard" rows={2} />)
      rootChildren(container).forEach((tile) => {
        expect(tile.style.height).toBe('120px')
      })
    })

    it('applies the width prop to the grid wrapper', () => {
      const { container } = render(<LoadingSkeleton variant="dashboard" width="600px" />)
      expect((container.firstElementChild as HTMLElement).style.width).toBe('600px')
    })
  })

  // ─── default fallback (unrecognised variant) ──────────────────────────────

  describe('default fallback (unrecognised variant)', () => {
    it('renders a single block', () => {
      const { container } = render(
        // @ts-expect-error — intentionally bypassing the variant union to exercise the fallback branch — intentionally bypassing the union to exercise the fallback branch
        <LoadingSkeleton variant="__unknown__" />
      )
      expect(container.firstElementChild).not.toBeNull()
      expect(container.children).toHaveLength(1)
    })

    it('applies the width prop', () => {
      const { container } = render(
        // @ts-expect-error — intentionally bypassing the variant union to exercise the fallback branch
        <LoadingSkeleton variant="__unknown__" width="250px" />
      )
      expect((container.firstElementChild as HTMLElement).style.width).toBe('250px')
    })

    it('applies the height prop', () => {
      const { container } = render(
        // @ts-expect-error — intentionally bypassing the variant union to exercise the fallback branch
        <LoadingSkeleton variant="__unknown__" height="80px" />
      )
      expect((container.firstElementChild as HTMLElement).style.height).toBe('80px')
    })

    it('defaults to 4rem height when height is omitted', () => {
      const { container } = render(
        // @ts-expect-error — intentionally bypassing the variant union to exercise the fallback branch
        <LoadingSkeleton variant="__unknown__" />
      )
      expect((container.firstElementChild as HTMLElement).style.height).toBe('4rem')
    })
  })

  // ─── shimmer / reduced-motion contract ───────────────────────────────────
  //
  // The component sets `animation: 'var(--credence-motion-skeleton)'` on every
  // shimmer block. It intentionally delegates animation control to the CSS
  // token rather than hardcoding a value. The global `prefers-reduced-motion`
  // media-query in src/index.css then suppresses the shimmer for users who
  // prefer reduced motion by forcing `animation-duration: 0.01ms !important`
  // on all elements. Tests here pin the delegation contract; the media-query
  // itself is a CSS-layer concern outside the RTL test boundary.

  describe('shimmer animation token contract', () => {
    it('text variant shimmer blocks reference the --credence-motion-skeleton token', () => {
      const { container } = render(<LoadingSkeleton variant="text" rows={2} />)
      expect(container.innerHTML).toContain('var(--credence-motion-skeleton)')
    })

    it('card variant shimmer blocks reference the token', () => {
      const { container } = render(<LoadingSkeleton variant="card" />)
      const matches = (container.innerHTML.match(/credence-motion-skeleton/g) ?? []).length
      // 3 shimmer blocks — each must reference the token
      expect(matches).toBeGreaterThanOrEqual(3)
    })

    it('form variant references the token once per shimmer within each field group', () => {
      const { container } = render(<LoadingSkeleton variant="form" rows={2} />)
      const matches = (container.innerHTML.match(/credence-motion-skeleton/g) ?? []).length
      // 2 rows × 2 shimmers = 4 references
      expect(matches).toBeGreaterThanOrEqual(4)
    })

    it('table variant header and data rows reference the token', () => {
      const { container } = render(<LoadingSkeleton variant="table" rows={3} />)
      const matches = (container.innerHTML.match(/credence-motion-skeleton/g) ?? []).length
      // 1 header + 3 rows = 4 references
      expect(matches).toBeGreaterThanOrEqual(4)
    })

    it('dashboard variant tiles reference the token', () => {
      const { container } = render(<LoadingSkeleton variant="dashboard" rows={3} />)
      const matches = (container.innerHTML.match(/credence-motion-skeleton/g) ?? []).length
      expect(matches).toBeGreaterThanOrEqual(3)
    })

    it('default fallback block references the token', () => {
      const { container } = render(
        // @ts-expect-error — intentionally bypassing the variant union to exercise the fallback branch
        <LoadingSkeleton variant="__unknown__" />
      )
      expect(container.innerHTML).toContain('var(--credence-motion-skeleton)')
    })

    it('does not hardcode an animation value — ensures global CSS can suppress it', () => {
      const { container } = render(<LoadingSkeleton variant="text" rows={1} />)
      // shimmer 1.5s is the token's VALUE in index.css — it must not appear
      // directly in the component's inline style; only the var() reference should
      expect(container.innerHTML).not.toContain('shimmer 1.5s')
    })
  })

  // ─── prefers-reduced-motion JS gating ────────────────────────────────
  //
  // LoadingSkeleton honors the user's motion preference at the JS layer so
  // components that drive animation through inline styles don't have to wait
  // for the global CSS !important override. The hook complements the CSS-only
  // approach documented in docs/motion-guidelines.md.
  describe('prefers-reduced-motion JS gating', () => {
    afterEach(() => {
      // Reset the mocked hook between tests so the default (`false`) is
      // restored and the contract assertions in earlier describe blocks
      // continue to see the `var(--credence-motion-skeleton)` token.
      vi.mocked(useReducedMotion).mockReset()
    })

    it('omits the shimmer animation entirely when reduce is on (text variant)', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true)
      const { container } = render(<LoadingSkeleton variant="text" rows={2} />)
      // The var(--credence-motion-skeleton) reference must NOT appear inline
      expect(container.innerHTML).not.toContain('var(--credence-motion-skeleton)')
      // No inline `animation:` declaration should be present on any shimmer block
      Array.from(container.querySelectorAll('div')).forEach((el) => {
        expect(el.style.animation).toBe('')
      })
    })

    it('omits the shimmer animation when reduce is on (card variant)', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true)
      const { container } = render(<LoadingSkeleton variant="card" />)
      expect(container.innerHTML).not.toContain('var(--credence-motion-skeleton)')
    })

    it('omits the shimmer animation when reduce is on (default fallback variant)', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true)
      const { container } = render(
        // @ts-expect-error — intentionally bypassing the variant union to exercise the fallback branch
        <LoadingSkeleton variant="__unknown__" />
      )
      expect(container.innerHTML).not.toContain('var(--credence-motion-skeleton)')
    })

    it('keeps the shimmer animation token when reduce is off (default)', () => {
      vi.mocked(useReducedMotion).mockReturnValue(false)
      const { container } = render(<LoadingSkeleton variant="text" rows={1} />)
      expect(container.innerHTML).toContain('var(--credence-motion-skeleton)')
    })
  })
})

  // ─── stat-widget ──────────────────────────────────────────────────────────

  describe('variant="stat-widget"', () => {
    it('renders stat-widget wrapper with class skeleton--stat-widget', () => {
      const { container } = render(<LoadingSkeleton variant="stat-widget" />)
      expect(container.querySelector('.skeleton--stat-widget')).not.toBeNull()
    })

    it('contains shimmer block for label', () => {
      const { container } = render(<LoadingSkeleton variant="stat-widget" />)
      expect(container.querySelector('.skeleton--stat-label')).not.toBeNull()
    })

    it('contains shimmer block for value', () => {
      const { container } = render(<LoadingSkeleton variant="stat-widget" />)
      expect(container.querySelector('.skeleton--stat-value')).not.toBeNull()
    })

    it('contains shimmer block for sub-text', () => {
      const { container } = render(<LoadingSkeleton variant="stat-widget" />)
      expect(container.querySelector('.skeleton--stat-sub')).not.toBeNull()
    })

    it('applies width prop to the wrapper', () => {
      const { container } = render(<LoadingSkeleton variant="stat-widget" width="220px" />)
      const wrapper = container.querySelector('.skeleton--stat-widget') as HTMLElement
      expect(wrapper.style.width).toBe('220px')
    })

    it('shimmer children have class "skeleton" when reduced motion is off', () => {
      vi.mocked(useReducedMotion).mockReturnValue(false)
      const { container } = render(<LoadingSkeleton variant="stat-widget" />)
      const label = container.querySelector('.skeleton--stat-label') as HTMLElement
      expect(label.classList.contains('skeleton')).toBe(true)
      expect(label.classList.contains('skeleton--no-animation')).toBe(false)
    })

    it('shimmer children have class "skeleton--no-animation" when reduced motion is on', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true)
      const { container } = render(<LoadingSkeleton variant="stat-widget" />)
      const label = container.querySelector('.skeleton--stat-label') as HTMLElement
      expect(label.classList.contains('skeleton--no-animation')).toBe(true)
    })
  })

  // ─── list-row ─────────────────────────────────────────────────────────────

  describe('variant="list-row"', () => {
    it('renders `rows` list-row items', () => {
      const { container } = render(<LoadingSkeleton variant="list-row" rows={4} />)
      expect(container.querySelectorAll('.skeleton--list-row')).toHaveLength(4)
    })

    it('each row contains an avatar circle', () => {
      const { container } = render(<LoadingSkeleton variant="list-row" rows={2} />)
      expect(container.querySelectorAll('.skeleton--list-avatar')).toHaveLength(2)
    })

    it('each row contains a content area with title and sub lines', () => {
      const { container } = render(<LoadingSkeleton variant="list-row" rows={2} />)
      expect(container.querySelectorAll('.skeleton--list-content')).toHaveLength(2)
      expect(container.querySelectorAll('.skeleton--list-title')).toHaveLength(2)
      expect(container.querySelectorAll('.skeleton--list-sub')).toHaveLength(2)
    })

    it('each row contains a meta block', () => {
      const { container } = render(<LoadingSkeleton variant="list-row" rows={2} />)
      expect(container.querySelectorAll('.skeleton--list-meta')).toHaveLength(2)
    })

    it('applies reduced motion class to shimmer children when useReducedMotion returns true', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true)
      const { container } = render(<LoadingSkeleton variant="list-row" rows={1} />)
      const avatar = container.querySelector('.skeleton--list-avatar') as HTMLElement
      expect(avatar.classList.contains('skeleton--no-animation')).toBe(true)
    })

    it('does not apply reduced motion class when useReducedMotion returns false', () => {
      vi.mocked(useReducedMotion).mockReturnValue(false)
      const { container } = render(<LoadingSkeleton variant="list-row" rows={1} />)
      const avatar = container.querySelector('.skeleton--list-avatar') as HTMLElement
      expect(avatar.classList.contains('skeleton--no-animation')).toBe(false)
      expect(avatar.classList.contains('skeleton')).toBe(true)
    })
  })

  // ─── bond-row ─────────────────────────────────────────────────────────────

  describe('variant="bond-row"', () => {
    it('renders `rows` bond-row items (default rows=3)', () => {
      const { container } = render(<LoadingSkeleton variant="bond-row" />)
      expect(container.querySelectorAll('.skeleton--bond-row')).toHaveLength(3)
    })

    it('renders the specified number of bond-row items', () => {
      const { container } = render(<LoadingSkeleton variant="bond-row" rows={5} />)
      expect(container.querySelectorAll('.skeleton--bond-row')).toHaveLength(5)
    })

    it('each row has a left section with amount placeholder', () => {
      const { container } = render(<LoadingSkeleton variant="bond-row" rows={2} />)
      expect(container.querySelectorAll('.skeleton--bond-left')).toHaveLength(2)
      expect(container.querySelectorAll('.skeleton--bond-amount')).toHaveLength(2)
    })

    it('each row has a left section with status placeholder', () => {
      const { container } = render(<LoadingSkeleton variant="bond-row" rows={2} />)
      expect(container.querySelectorAll('.skeleton--bond-status')).toHaveLength(2)
    })

    it('each row has a right section with button placeholder(s)', () => {
      const { container } = render(<LoadingSkeleton variant="bond-row" rows={2} />)
      expect(container.querySelectorAll('.skeleton--bond-right')).toHaveLength(2)
      // Each right section has 2 button placeholders
      expect(container.querySelectorAll('.skeleton--bond-btn')).toHaveLength(4)
    })

    it('applies reduced motion class to shimmer children when useReducedMotion returns true', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true)
      const { container } = render(<LoadingSkeleton variant="bond-row" rows={1} />)
      const amount = container.querySelector('.skeleton--bond-amount') as HTMLElement
      expect(amount.classList.contains('skeleton--no-animation')).toBe(true)
    })

    it('does not apply reduced motion class when useReducedMotion returns false', () => {
      vi.mocked(useReducedMotion).mockReturnValue(false)
      const { container } = render(<LoadingSkeleton variant="bond-row" rows={1} />)
      const amount = container.querySelector('.skeleton--bond-amount') as HTMLElement
      expect(amount.classList.contains('skeleton--no-animation')).toBe(false)
      expect(amount.classList.contains('skeleton')).toBe(true)
    })
  })

  // ─── trust-score ──────────────────────────────────────────────────────────

  describe('variant="trust-score"', () => {
    it('renders the trust score page skeleton', () => {
      const { container } = render(<LoadingSkeleton variant="trust-score" />)
      expect(container.querySelector('.skeleton--trust-score-page')).not.toBeNull()
    })

    it('contains the gauge circle element with class skeleton--trust-gauge', () => {
      const { container } = render(<LoadingSkeleton variant="trust-score" />)
      expect(container.querySelector('.skeleton--trust-gauge')).not.toBeNull()
    })

    it('contains the stats row container', () => {
      const { container } = render(<LoadingSkeleton variant="trust-score" />)
      expect(container.querySelector('.skeleton--trust-stats-row')).not.toBeNull()
    })

    it('renders `rows` stat cards inside the stats row', () => {
      const { container } = render(<LoadingSkeleton variant="trust-score" rows={4} />)
      expect(container.querySelectorAll('.skeleton--trust-stat-card')).toHaveLength(4)
    })

    it('honors reduced motion — gauge has skeleton--no-animation class when reduce is on', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true)
      const { container } = render(<LoadingSkeleton variant="trust-score" />)
      const gauge = container.querySelector('.skeleton--trust-gauge') as HTMLElement
      expect(gauge.classList.contains('skeleton--no-animation')).toBe(true)
    })

    it('gauge has "skeleton" class (not no-animation) when reduce is off', () => {
      vi.mocked(useReducedMotion).mockReturnValue(false)
      const { container } = render(<LoadingSkeleton variant="trust-score" />)
      const gauge = container.querySelector('.skeleton--trust-gauge') as HTMLElement
      expect(gauge.classList.contains('skeleton')).toBe(true)
      expect(gauge.classList.contains('skeleton--no-animation')).toBe(false)
    })
  })

  // ─── accessibility ────────────────────────────────────────────────────────

  describe('accessibility', () => {
    const allVariants = [
      'text',
      'card',
      'form',
      'table',
      'dashboard',
      'stat-widget',
      'list-row',
      'bond-row',
      'trust-score',
    ] as const

    it.each(allVariants)('variant="%s" root element has role="status"', (variant) => {
      const { container } = render(<LoadingSkeleton variant={variant} />)
      const statusEl = container.querySelector('[role="status"]')
      expect(statusEl).not.toBeNull()
    })

    it.each(allVariants)('variant="%s" root element has aria-label="Loading"', (variant) => {
      const { container } = render(<LoadingSkeleton variant={variant} />)
      const labelledEl = container.querySelector('[aria-label="Loading"]')
      expect(labelledEl).not.toBeNull()
    })

    it('default fallback block has role="status"', () => {
      const { container } = render(
        // @ts-expect-error — intentionally bypassing the variant union
        <LoadingSkeleton variant="__unknown__" />
      )
      expect(container.querySelector('[role="status"]')).not.toBeNull()
    })

    it('default fallback block has aria-label="Loading"', () => {
      const { container } = render(
        // @ts-expect-error — intentionally bypassing the variant union
        <LoadingSkeleton variant="__unknown__" />
      )
      expect(container.querySelector('[aria-label="Loading"]')).not.toBeNull()
    })
  })
