/**
 * @file createBondFlowSteps.ts
 * @description Step-index policy for the `CreateBondFlow` bond wizard.
 *
 * The wizard owns a single piece of navigation state: a 1-based step index.
 * Every transition therefore has to satisfy the same invariants regardless of
 * which control produced it (Back button, Next button, programmatic reset, or
 * a burst of duplicate events inside a single React batch):
 *
 * **I1 — Range.** A rendered step is always an integer in
 * `[BOND_FLOW_MIN_STEP, BOND_FLOW_MAX_STEP]`. Any out-of-range or non-finite
 * index is pulled back into range rather than propagated, so no transition can
 * render a blank wizard body or an out-of-bounds `aria-label`.
 *
 * **I2 — Monotonicity.** Back never increases the step and Next never decreases
 * it. A transition that cannot move in its requested direction is *refused*
 * (`moved === false`) instead of clamped into a move the caller never asked for.
 *
 * **I3 — Determinism under repetition.** These functions are pure and depend
 * only on their argument, so replaying a plan (React StrictMode double-invoke,
 * event batching, retry after a dropped frame) yields an identical result.
 * Repeatedly applying {@link planBackTransition} converges on
 * `BOND_FLOW_MIN_STEP` and is a fixed point there; the mirror holds for
 * {@link planNextTransition} and `BOND_FLOW_MAX_STEP`.
 *
 * **I4 — Consent scope.** Only the confirm step (`BOND_FLOW_STEP_CONFIRM`) holds
 * an acknowledgement of the slashing terms. A plan that leaves that step reports
 * `invalidatesConsent`, so the caller can re-arm the gate instead of letting a
 * stale acknowledgement authorise terms the user may since have edited.
 *
 * Nothing here reads or writes React state, so the policy can be unit tested
 * exhaustively without a DOM. Callers own the effects (clearing errors,
 * resetting the consent flag, persisting input) and must honour `moved` before
 * mutating anything.
 *
 * @see {@link ../components/CreateBondFlow.tsx} for the consumer.
 */

// ---------------------------------------------------------------------------
// Step indices
// ---------------------------------------------------------------------------

/** Step 1 — amount entry. */
export const BOND_FLOW_STEP_AMOUNT = 1
/** Step 2 — lock-duration selection. */
export const BOND_FLOW_STEP_DURATION = 2
/** Step 3 — terms review. */
export const BOND_FLOW_STEP_REVIEW = 3
/** Step 4 — disclaimer acknowledgement and submission. */
export const BOND_FLOW_STEP_CONFIRM = 4

/** Lowest valid step index. */
export const BOND_FLOW_MIN_STEP = BOND_FLOW_STEP_AMOUNT
/** Highest valid step index. */
export const BOND_FLOW_MAX_STEP = BOND_FLOW_STEP_CONFIRM
/** Number of steps in the wizard (drives the progress indicator). */
export const BOND_FLOW_STEP_COUNT = BOND_FLOW_MAX_STEP - BOND_FLOW_MIN_STEP + 1

/** Ordered step indices, for progress indicators and exhaustive iteration. */
export const BOND_FLOW_STEPS: readonly number[] = Object.freeze([
  BOND_FLOW_STEP_AMOUNT,
  BOND_FLOW_STEP_DURATION,
  BOND_FLOW_STEP_REVIEW,
  BOND_FLOW_STEP_CONFIRM,
])

// ---------------------------------------------------------------------------
// Clamping
// ---------------------------------------------------------------------------

/**
 * Coerces an arbitrary value into a valid wizard step index.
 *
 * Non-finite input (`NaN`, `Infinity`) has no meaningful position, so it is
 * treated as "before the first step" and clamped to {@link BOND_FLOW_MIN_STEP}.
 * Fractional input is truncated toward the valid range so the result is always
 * an integer, never a value that would render an empty step body.
 *
 * @example
 * clampBondFlowStep(3)   // → 3
 * clampBondFlowStep(0)   // → 1
 * clampBondFlowStep(99)  // → 4
 * clampBondFlowStep(NaN) // → 1
 */
export function clampBondFlowStep(step: number): number {
  if (!Number.isFinite(step)) return BOND_FLOW_MIN_STEP
  if (step <= BOND_FLOW_MIN_STEP) return BOND_FLOW_MIN_STEP
  if (step >= BOND_FLOW_MAX_STEP) return BOND_FLOW_MAX_STEP
  return Math.trunc(step)
}

/**
 * Returns `true` when `step` is already a valid, integral step index.
 * Used to detect a corrupted or out-of-range index before planning a transition.
 */
export function isValidBondFlowStep(step: number): boolean {
  return Number.isInteger(step) && step >= BOND_FLOW_MIN_STEP && step <= BOND_FLOW_MAX_STEP
}

// ---------------------------------------------------------------------------
// Transition plans
// ---------------------------------------------------------------------------

/**
 * Outcome of planning a single wizard transition.
 */
export interface BondFlowTransitionPlan {
  /** Step the wizard should render. Always within `[BOND_FLOW_MIN_STEP, BOND_FLOW_MAX_STEP]`. */
  targetStep: number
  /** `false` when the transition was refused; `targetStep` then equals `currentStep`. */
  moved: boolean
  /** `true` when `currentStep` was outside the valid range and is being recovered. */
  recovered: boolean
  /** `true` when the plan leaves the disclaimer-acknowledgement step. */
  invalidatesConsent: boolean
}

/**
 * Plans one step backwards from `currentStep`.
 *
 * Applies invariants I1–I4:
 * - the target is clamped, so an index at or below step 1 can never underflow
 *   into a blank, unrecoverable screen;
 * - a transition that would not change the step is refused (`moved === false`)
 *   rather than silently re-rendering, which lets callers keep visible
 *   validation messages intact when nothing actually happened;
 * - an out-of-range `currentStep` is repaired (`recovered === true`);
 * - leaving the confirm step reports `invalidatesConsent` so the caller can
 *   revoke a stale acknowledgement.
 *
 * Entered data (`amount`, `duration`) is never part of the plan — back
 * navigation is required to preserve it, so returning to an earlier step cannot
 * discard what the user typed.
 *
 * @param currentStep - Step index the wizard is believed to be on.
 *
 * @example
 * planBackTransition(4) // → { targetStep: 3, moved: true,  recovered: false, invalidatesConsent: true }
 * planBackTransition(1) // → { targetStep: 1, moved: false, recovered: false, invalidatesConsent: false }
 * planBackTransition(0) // → { targetStep: 1, moved: true,  recovered: true,  invalidatesConsent: false }
 */
export function planBackTransition(currentStep: number): BondFlowTransitionPlan {
  const targetStep = clampBondFlowStep(currentStep - 1)
  const recovered = !isValidBondFlowStep(currentStep)

  return {
    targetStep,
    moved: targetStep !== currentStep,
    recovered,
    // Only a *valid* confirm step carries consent; a corrupted index is never
    // treated as "we were on the confirm step".
    invalidatesConsent: !recovered && currentStep === BOND_FLOW_STEP_CONFIRM,
  }
}

/**
 * Plans one step forwards from `currentStep`.
 *
 * Validation of the individual fields (amount, duration) is the caller's
 * responsibility and happens *before* this plan is requested; this function only
 * owns the index arithmetic. As with {@link planBackTransition}, a transition
 * that cannot advance is refused and an out-of-range index is repaired.
 *
 * @example
 * planNextTransition(1) // → { targetStep: 2, moved: true,  recovered: false, invalidatesConsent: false }
 * planNextTransition(4) // → { targetStep: 4, moved: false, recovered: false, invalidatesConsent: false }
 */
export function planNextTransition(currentStep: number): BondFlowTransitionPlan {
  const targetStep = clampBondFlowStep(currentStep + 1)
  const recovered = !isValidBondFlowStep(currentStep)

  return {
    targetStep,
    moved: targetStep !== currentStep,
    recovered,
    invalidatesConsent: false,
  }
}
