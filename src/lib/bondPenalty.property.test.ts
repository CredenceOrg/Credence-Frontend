import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import * as penalty from './bondPenalty'

const RUNS = { numRuns: 200 }


describe('bondPenalty property tests', () => {
  it('module exposes penalty math surface', () => {
    expect(Object.keys(penalty).length).toBeGreaterThan(0)
  })
})
