import { describe, expect, it } from 'vitest'
import { BREAKPOINTS, mediaQueries } from './breakpoints'

const maxWidthQueries = [
  ['xs', BREAKPOINTS.XS],
  ['sm', BREAKPOINTS.SM],
  ['md', BREAKPOINTS.MD],
  ['lg', BREAKPOINTS.LG],
  ['xl', BREAKPOINTS.XL],
] as const

const minWidthQueries = [
  ['smMin', BREAKPOINTS.SM],
  ['mdMin', BREAKPOINTS.MD],
  ['lgMin', BREAKPOINTS.LG],
  ['xlMin', BREAKPOINTS.XL],
] as const

describe('responsive breakpoint configuration', () => {
  it('defines unique, finite, positive integer widths in ascending order', () => {
    const widths = Object.values(BREAKPOINTS)

    expect(widths.every((width) => Number.isSafeInteger(width) && width > 0)).toBe(true)
    expect(new Set(widths).size).toBe(widths.length)
    expect(widths).toEqual([...widths].sort((left, right) => left - right))
  })

  it.each(maxWidthQueries)('%s ends immediately before its breakpoint', (name, width) => {
    expect(mediaQueries[name]).toBe(`@media (max-width: ${width - 1}px)`)
  })

  it.each(minWidthQueries)('%s starts inclusively at its breakpoint', (name, width) => {
    expect(mediaQueries[name]).toBe(`@media (min-width: ${width}px)`)
  })

  it('remains deterministic when read concurrently and imported again', async () => {
    const [first, second] = await Promise.all([import('./breakpoints'), import('./breakpoints')])

    expect(first.BREAKPOINTS).toEqual(BREAKPOINTS)
    expect(second.BREAKPOINTS).toEqual(BREAKPOINTS)
    expect(first.mediaQueries).toEqual(mediaQueries)
    expect(second.mediaQueries).toEqual(mediaQueries)
  })
})
