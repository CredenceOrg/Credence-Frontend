import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import LoadingSkeleton from './LoadingSkeleton'

function animatedBlocks(container: HTMLElement) {
  return Array.from(container.querySelectorAll('div')).filter((element) =>
    element.getAttribute('style')?.includes('var(--credence-motion-skeleton)')
  ) as HTMLElement[]
}

describe('LoadingSkeleton', () => {
  it('renders text rows with the requested width and shortened final line', () => {
    const { container } = render(<LoadingSkeleton rows={4} width="24rem" />)
    const wrapper = container.firstElementChild as HTMLElement
    const rows = animatedBlocks(container)

    expect(wrapper.style.width).toBe('24rem')
    expect(rows).toHaveLength(4)
    expect(rows[0].style.height).toBe('1rem')
    expect(rows[0].style.width).toBe('100%')
    expect(rows[3].style.width).toBe('60%')
    expect(rows[3].style.marginBottom).toBe('0px')
  })

  it('renders the card variant with a bordered card and three placeholder lines', () => {
    const { container } = render(<LoadingSkeleton variant="card" width="18rem" />)
    const card = container.firstElementChild as HTMLElement
    const blocks = animatedBlocks(container)

    expect(card.style.width).toBe('18rem')
    expect(card.style.border).toContain('var(--credence-border-default)')
    expect(card.style.padding).toBe('var(--credence-space-6)')
    expect(blocks).toHaveLength(3)
    expect(blocks[0].style.height).toBe('1.5rem')
    expect(blocks[0].style.width).toBe('40%')
    expect(blocks[2].style.width).toBe('80%')
  })

  it('renders the form variant as label and field placeholders per row', () => {
    const { container } = render(<LoadingSkeleton variant="form" rows={2} />)
    const blocks = animatedBlocks(container)

    expect(blocks).toHaveLength(4)
    expect(blocks[0].style.height).toBe('0.875rem')
    expect(blocks[0].style.width).toBe('30%')
    expect(blocks[1].style.height).toBe('2.75rem')
    expect(blocks[2].style.height).toBe('0.875rem')
    expect(blocks[3].style.height).toBe('2.75rem')
  })

  it('renders the table variant with one header and one body placeholder per row', () => {
    const { container } = render(<LoadingSkeleton variant="table" rows={3} />)
    const blocks = animatedBlocks(container)

    expect(blocks).toHaveLength(4)
    expect(blocks[0].style.height).toBe('3rem')
    expect(blocks.slice(1).map((block) => block.style.height)).toEqual([
      '3.5rem',
      '3.5rem',
      '3.5rem',
    ])
  })

  it('renders the dashboard variant as a responsive grid of cards', () => {
    const { container } = render(<LoadingSkeleton variant="dashboard" rows={5} />)
    const grid = container.firstElementChild as HTMLElement
    const cards = animatedBlocks(container)

    expect(grid.style.display).toBe('grid')
    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fit, minmax(250px, 1fr))')
    expect(cards).toHaveLength(5)
    expect(cards.every((card) => card.style.height === '120px')).toBe(true)
    expect(cards.every((card) => card.style.border.includes('var(--credence-border-default)'))).toBe(
      true
    )
  })

  it('falls back to a single block that honors custom dimensions for unknown variants', () => {
    const { container } = render(
      <LoadingSkeleton variant={'unknown' as 'text'} width="10rem" height="6rem" />
    )
    const fallback = container.firstElementChild as HTMLElement

    expect(animatedBlocks(container)).toHaveLength(1)
    expect(fallback.style.width).toBe('10rem')
    expect(fallback.style.height).toBe('6rem')
  })

  it('uses the shared skeleton shimmer token on every placeholder block', () => {
    const { container } = render(<LoadingSkeleton variant="form" rows={3} />)

    expect(animatedBlocks(container)).toHaveLength(6)
    expect(
      animatedBlocks(container).every(
        (block) => block.style.animation === 'var(--credence-motion-skeleton)'
      )
    ).toBe(true)
  })

  it('routes shimmer animation through the shared motion token for reduced-motion fallback', () => {
    const { container } = render(<LoadingSkeleton variant="dashboard" rows={2} />)

    expect(animatedBlocks(container)).toHaveLength(2)
    expect(
      animatedBlocks(container).every(
        (block) => block.style.animation === 'var(--credence-motion-skeleton)'
      )
    ).toBe(true)
  })
})
