/**
 * @file createBondFlowSteps.test.ts
 * @description Exhaustive tests for the bond-wizard step policy.
 *
 * Covers the failure boundaries that make `handleBack` deterministic:
 * clamping (out-of-range / non-finite input), refusal at the boundaries,
 * recovery of a corrupted index, consent invalidation, and convergence when a
 * plan is replayed (duplicate events, React batching, retries).
 */

import { describe, it, expect } from 'vitest'
import {
  BOND_FLOW_MAX_STEP,
  BOND_FLOW_MIN_STEP,
  BOND_FLOW_STEP_AMOUNT,
  BOND_FLOW_STEP_CONFIRM,
  BOND_FLOW_STEP_COUNT,
  BOND_FLOW_STEP_DURATION,
  BOND_FLOW_STEP_REVIEW,
  BOND_FLOW_STEPS,
  clampBondFlowStep,
  isValidBondFlowStep,
  planBackTransition,
  planNextTransition,
} from './createBondFlowSteps'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('bond flow step constants', () => {
  it('numbers the four wizard steps 1..4', () => {
    expect(BOND_FLOW_STEP_AMOUNT).toBe(1)
    expect(BOND_FLOW_STEP_DURATION).toBe(2)
    expect(BOND_FLOW_STEP_REVIEW).toBe(3)
    expect(BOND_FLOW_STEP_CONFIRM).toBe(4)
    expect(BOND_FLOW_STEPS).toEqual([1, 2, 3, 4])
  })

  it('derives the bounds and count from the step list', () => {
    expect(BOND_FLOW_MIN_STEP).toBe(1)
    expect(BOND_FLOW_MAX_STEP).toBe(4)
    expect(BOND_FLOW_STEP_COUNT).toBe(4)
  })

  it('freezes the step list so callers cannot mutate the policy', () => {
    expect(Object.isFrozen(BOND_FLOW_STEPS)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// clampBondFlowStep — invariant I1 (range)
// ---------------------------------------------------------------------------

describe('clampBondFlowStep', () => {
  it('leaves every valid step untouched', () => {
    for (const step of BOND_FLOW_STEPS) {
      expect(clampBondFlowStep(step)).toBe(step)
    }
  })

  it('clamps below the first step up to it (no underflow)', () => {
    expect(clampBondFlowStep(0)).toBe(1)
    expect(clampBondFlowStep(-1)).toBe(1)
    expect(clampBondFlowStep(-9999)).toBe(1)
  })

  it('clamps above the last step down to it (no overflow)', () => {
    expect(clampBondFlowStep(5)).toBe(4)
    expect(clampBondFlowStep(9999)).toBe(4)
  })

  it('maps non-finite input to the first step', () => {
    expect(clampBondFlowStep(Number.NaN)).toBe(1)
    expect(clampBondFlowStep(Number.POSITIVE_INFINITY)).toBe(1)
    expect(clampBondFlowStep(Number.NEGATIVE_INFINITY)).toBe(1)
  })

  it('always returns an integer inside the valid range', () => {
    const probes = [-10, -0.5, 0, 0.9, 1.5, 2.9, 3.5, 4.1, 7.7, 1e9, -1e9]
    for (const probe of probes) {
      const result = clampBondFlowStep(probe)
      expect(Number.isInteger(result)).toBe(true)
      expect(isValidBondFlowStep(result)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// isValidBondFlowStep
// ---------------------------------------------------------------------------

describe('isValidBondFlowStep', () => {
  it('accepts every integer in range', () => {
    expect(BOND_FLOW_STEPS.every(isValidBondFlowStep)).toBe(true)
  })

  it('rejects out-of-range, fractional and non-finite values', () => {
    for (const value of [0, -1, 5, 1.5, 4.0001, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isValidBondFlowStep(value)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// planBackTransition — the handleBack policy
// ---------------------------------------------------------------------------

describe('planBackTransition', () => {
  it('steps back one position from each valid step', () => {
    for (let step = BOND_FLOW_MIN_STEP + 1; step <= BOND_FLOW_MAX_STEP; step += 1) {
      const plan = planBackTransition(step)
      expect(plan.targetStep).toBe(step - 1)
      expect(plan.moved).toBe(true)
      expect(plan.recovered).toBe(false)
    }
  })

  it('refuses to leave the first step instead of underflowing', () => {
    const plan = planBackTransition(BOND_FLOW_MIN_STEP)
    expect(plan.moved).toBe(false)
    expect(plan.targetStep).toBe(BOND_FLOW_MIN_STEP)
    expect(plan.recovered).toBe(false)
    expect(plan.invalidatesConsent).toBe(false)
  })

  it('never proposes a target outside the valid range', () => {
    for (let step = -50; step <= 50; step += 1) {
      const plan = planBackTransition(step)
      expect(isValidBondFlowStep(plan.targetStep)).toBe(true)
    }
  })

  it('recovers an index below the first step instead of propagating it', () => {
    for (const corrupted of [0, -1, -25]) {
      const plan = planBackTransition(corrupted)
      expect(plan.targetStep).toBe(BOND_FLOW_MIN_STEP)
      expect(plan.moved).toBe(true)
      expect(plan.recovered).toBe(true)
    }
  })

  it('recovers an index above the last step', () => {
    const plan = planBackTransition(BOND_FLOW_MAX_STEP + 10)
    expect(plan.targetStep).toBe(BOND_FLOW_MAX_STEP)
    expect(plan.moved).toBe(true)
    expect(plan.recovered).toBe(true)
  })

  it('recovers non-finite and fractional indices', () => {
    expect(planBackTransition(Number.NaN)).toMatchObject({
      targetStep: 1,
      moved: true,
      recovered: true,
    })
    expect(planBackTransition(Number.POSITIVE_INFINITY)).toMatchObject({
      targetStep: 1,
      moved: true,
      recovered: true,
    })
    expect(planBackTransition(1.5)).toMatchObject({
      targetStep: 1,
      moved: true,
      recovered: true,
    })
  })

  it('invalidates consent only when leaving the confirm step', () => {
    expect(planBackTransition(BOND_FLOW_STEP_CONFIRM).invalidatesConsent).toBe(true)
    for (const step of [1, 2, 3]) {
      expect(planBackTransition(step).invalidatesConsent).toBe(false)
    }
  })

  it('does not treat a corrupted index as the confirm step', () => {
    expect(planBackTransition(BOND_FLOW_STEP_CONFIRM + 5).invalidatesConsent).toBe(false)
  })

  it('is deterministic: the same input always yields the same plan', () => {
    for (const step of [1, 2, 3, 4, 0, 9, Number.NaN]) {
      expect(planBackTransition(step)).toEqual(planBackTransition(step))
    }
  })

  it('is idempotent at the first step (refusal is a fixed point)', () => {
    const once = planBackTransition(BOND_FLOW_MIN_STEP)
    const twice = planBackTransition(once.targetStep)
    expect(twice).toEqual(once)
  })

  it('converges on the first step when replayed (duplicate events / retries)', () => {
    let step = BOND_FLOW_MAX_STEP
    for (let i = 0; i < 100; i += 1) {
      const plan = planBackTransition(step)
      if (!plan.moved) break
      step = plan.targetStep
    }
    expect(step).toBe(BOND_FLOW_MIN_STEP)
  })

  it('never increases the step for any valid input (invariant I2)', () => {
    for (const step of BOND_FLOW_STEPS) {
      expect(planBackTransition(step).targetStep).toBeLessThanOrEqual(step)
    }
  })

  it('reports moved === false exactly when the target equals the source', () => {
    for (let step = -50; step <= 50; step += 1) {
      const plan = planBackTransition(step)
      expect(plan.moved).toBe(plan.targetStep !== step)
    }
  })
})

// ---------------------------------------------------------------------------
// planNextTransition — the symmetric forward policy
// ---------------------------------------------------------------------------

describe('planNextTransition', () => {
  it('advances one position from every step before the last', () => {
    for (let step = BOND_FLOW_MIN_STEP; step < BOND_FLOW_MAX_STEP; step += 1) {
      const plan = planNextTransition(step)
      expect(plan.targetStep).toBe(step + 1)
      expect(plan.moved).toBe(true)
      expect(plan.recovered).toBe(false)
    }
  })

  it('refuses to advance past the confirm step instead of overflowing', () => {
    const plan = planNextTransition(BOND_FLOW_MAX_STEP)
    expect(plan.moved).toBe(false)
    expect(plan.targetStep).toBe(BOND_FLOW_MAX_STEP)
  })

  it('never invalidates consent', () => {
    for (let step = -50; step <= 50; step += 1) {
      expect(planNextTransition(step).invalidatesConsent).toBe(false)
    }
  })

  it('recovers an out-of-range index', () => {
    expect(planNextTransition(-3)).toMatchObject({ targetStep: 1, moved: true, recovered: true })
    expect(planNextTransition(Number.NaN)).toMatchObject({
      targetStep: 1,
      moved: true,
      recovered: true,
    })
  })

  it('never proposes a target outside the valid range', () => {
    for (let step = -50; step <= 50; step += 1) {
      expect(isValidBondFlowStep(planNextTransition(step).targetStep)).toBe(true)
    }
  })

  it('never decreases the step for any valid input (invariant I2)', () => {
    for (const step of BOND_FLOW_STEPS) {
      expect(planNextTransition(step).targetStep).toBeGreaterThanOrEqual(step)
    }
  })

  it('converges on the last step when replayed', () => {
    let step = BOND_FLOW_MIN_STEP
    for (let i = 0; i < 100; i += 1) {
      const plan = planNextTransition(step)
      if (!plan.moved) break
      step = plan.targetStep
    }
    expect(step).toBe(BOND_FLOW_MAX_STEP)
  })
})
