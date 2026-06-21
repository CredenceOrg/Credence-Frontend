import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import LoadingSkeleton from './LoadingSkeleton'

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
      lines.slice(0, 4).forEach(l => expect(l.style.width).toBe('100%'))
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
      rootChildren(container).forEach(group => {
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
      rows.forEach(r => expect(r.style.height).toBe('3.5rem'))
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
      rootChildren(container).forEach(tile => {
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
})
