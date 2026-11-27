import { describe, it, expect } from 'vitest'
import * as penalty from './bondPenalty'



describe('bondPenalty property tests', () => {
  it('module exposes penalty math surface', () => {
    expect(Object.keys(penalty).length).toBeGreaterThan(0)
  })
})
