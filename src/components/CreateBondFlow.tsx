/**
 * @file CreateBondFlow.tsx
 * @description Multi-step wizard for creating a USDC bond on the Credence protocol.
 *
 * Step 1 – Enter bond amount (USDC)
 * Step 2 – Choose lock duration (30 / 90 / 180 days)
 * Step 3 – Review terms, including a quantified early-withdrawal penalty
 *           and the resulting balance (consistent with Bond.tsx ConfirmDialog)
 * Step 4 – Acknowledge disclaimer & confirm
 *
 * @see {@link ../lib/bondPenalty.ts} for penalty-rate policy and computation.
 * @see {@link ../lib/createBondFlowSteps.ts} for the step-navigation invariants.
 * @see {@link ../lib/format.ts} for shared USDC formatting.
 * @see {@link docs/risk-disclaimer.md} for the full risk/slashing policy.
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import AmountInput from './AmountInput'
import { FormField } from './forms/FormField'
import Button from './Button'
import Banner from './Banner'
import Disclaimer from './Disclaimer'
import { useToast } from './ToastProvider'
import { useWallet } from '../context/WalletContext'
import { useUsdcBalance } from '../hooks/useUsdcBalance'
import { computeBondSlashBreakdown, calcUnlockDate } from '../lib/bondPenalty'
import {
  BOND_FLOW_MIN_STEP,
  BOND_FLOW_MAX_STEP,
  BOND_FLOW_STEP_COUNT,
  BOND_FLOW_STEP_AMOUNT,
  BOND_FLOW_STEP_DURATION,
  BOND_FLOW_STEP_REVIEW,
  BOND_FLOW_STEP_CONFIRM,
  clampBondFlowStep,
  planBackTransition,
  planNextTransition,
} from '../lib/createBondFlowSteps'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { formatUsdc } from '../lib/format'
import { LoadingSkeleton } from './states'

import './CreateBondFlow.css'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CreateBondFlowProps {
  /**
   * Called after the authoritative bond mutation has committed. May return a
   * promise that resolves with the on-chain/backend result, or reject when the
   * wallet/network operation fails.
   */
  onComplete?: () => void | Promise<BondCommitResult | void>
  /** Called when the user cancels the flow */
  onCancel?: () => void
  /**
   * Optional sink for versioned bond audit records. Records are also retained in
   * localStorage and in memory so a failed wallet/network request can be recovered.
   */
  onAudit?: (record: BondAuditRecord) => void
}

export interface BondCommitResult {
  transactionHash?: string
  bondId?: string
}

export type BondAuditEvent =
  | 'BOND_CREATE_REQUESTED'
  | 'BOND_CREATE_COMMITTED'
  | 'BOND_CREATE_REJECTED'
  | 'BOND_CREATE_FAILED'

export interface BondAuditRecord {
  version: 1
  sequence: number
  correlationId: string
  event: BondAuditEvent
  timestamp: string
  payload: {
    amount: string
    duration: number | null
    acknowledged: boolean
    error?: string
  }
  result?: BondCommitResult
}

const AUDIT_STORAGE_KEY = 'credence.bond.audit.v1'

const createCorrelationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `bond-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const loadAuditLog = (): BondAuditRecord[] => {
  try {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as BondAuditRecord[]) : []
  } catch {
    return []
  }
}

const saveAuditLog = (records: BondAuditRecord[]): void => {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // localStorage can be unavailable (private mode, storage full). The in-memory
    // trail remains authoritative for the current session.
  }
}

// ----------------------------------------------------------------------------
// Divider used between review card sections
// ----------------------------------------------------------------------------

const ReviewDivider = () => <div className="createBondFlow__reviewDivider" />

/**
 * Emits a diagnostic when a wizard transition is refused because the wizard is
 * already on the boundary step.
 *
 * A refusal is unreachable through the rendered controls (Back is hidden on the
 * first step, Next is replaced by Confirm on the last), so seeing this in the
 * console means a duplicate, scripted or programmatic dispatch reached the
 * handler — exactly the kind of event that is invisible during normal operation
 * but breaks determinism if it is not handled.
 *
 * Privacy: the payload carries only the direction label and the step index. Bond
 * amounts, wallet addresses and any other user data are deliberately excluded.
 */
function logRefusedTransition(direction: 'Back' | 'Next', step: number): void {
  console.warn('[CreateBondFlow] Refused out-of-bounds transition', { direction, step })
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export default function CreateBondFlow({ onComplete, onCancel, onAudit }: CreateBondFlowProps) {
  const { addToast } = useToast()
  const { isConnected, connect } = useWallet()
  const {
    balance,
    status: balanceStatus,
    refetch: refetchBalance,
  } = useUsdcBalance()
  const prefersReducedMotion = useReducedMotion()

  const [step, setStep] = useState<number>(BOND_FLOW_MIN_STEP)
  const [amount, setAmount] = useState('')
  const [duration, setDuration] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [resetError, setResetError] = useState('')

  const auditRecordsRef = useRef<BondAuditRecord[]>(loadAuditLog())
  const correlationIdRef = useRef<string>('')
  const sequenceRef = useRef<number>(
    auditRecordsRef.current.reduce((max, record) => Math.max(max, record.sequence), -1) + 1,
  )
  const submittingRef = useRef(false)

  /**
   * Latest committed wizard step, mirrored outside React state.
   *
   * Transition handlers must plan against the step as of *click* time. Reading
   * the `step` state variable gives the value from the last committed render, so
   * several Back presses batched into a single React update would all compute
   * `step - 1` from the same value and collapse into one move (or, mixed with a
   * Next press, resolve to the wrong direction entirely). `applyStep` therefore
   * writes this ref *synchronously* before `setStep`, which makes duplicate and
   * interleaved invocations deterministic.
   *
   * The effect keeps the mirror honest if `step` is ever changed outside
   * `applyStep` (e.g. by a future prop-driven reset).
   */
  const stepRef = useRef(step)

  useEffect(() => {
    stepRef.current = step
  }, [step])

  /** Single writer for the wizard step. Enforces the [1, 4] range invariant. */
  const applyStep = useCallback((next: number) => {
    const clamped = clampBondFlowStep(next)
    stepRef.current = clamped
    setStep(clamped)
  }, [])

  const step1Ref = useRef<HTMLHeadingElement>(null)
  const step2Ref = useRef<HTMLHeadingElement>(null)
  const step3Ref = useRef<HTMLHeadingElement>(null)
  const step4Ref = useRef<HTMLHeadingElement>(null)

  /**
   * Appends a versioned audit record. Ordering is guaranteed by the monotonic
   * `sequence` value; `correlationId` ties every record to one user attempt.
   */
  const recordAudit = (
    event: BondAuditEvent,
    error?: string,
    result?: BondCommitResult,
  ): BondAuditRecord => {
    const record: BondAuditRecord = {
      version: 1,
      sequence: sequenceRef.current++,
      correlationId: correlationIdRef.current || createCorrelationId(),
      event,
      timestamp: new Date().toISOString(),
      payload: {
        amount,
        duration,
        acknowledged,
        ...(error ? { error } : {}),
      },
      ...(result ? { result } : {}),
    }
    auditRecordsRef.current = [...auditRecordsRef.current, record]
    saveAuditLog(auditRecordsRef.current)
    onAudit?.(record)
    return record
  }

  useEffect(() => {
    if (step === BOND_FLOW_STEP_AMOUNT) step1Ref.current?.focus()
    else if (step === BOND_FLOW_STEP_DURATION) step2Ref.current?.focus()
    else if (step === BOND_FLOW_STEP_REVIEW) step3Ref.current?.focus()
    else if (step === BOND_FLOW_STEP_CONFIRM) step4Ref.current?.focus()
  }, [step])

  /**
   * Deterministically resets the wizard to its initial state.
   *
   * Invariants enforced here:
   *  - `submittingRef` is the source of truth for in-flight submissions and is
   *    always cleared, so a stuck `submitting` state cannot permanently block
   *    the user from retrying or cancelling.
   *  - `correlationIdRef` is cleared so the next attempt gets a fresh id and
   *    audit records from a prior attempt cannot be attributed to a new one.
   *  - All user-visible error state is cleared to avoid stale messages leaking
   *    across attempts.
   *
   * The reset is idempotent: calling it multiple times (e.g. from a retry
   * boundary and from an unmount cleanup) yields the same state.
   */
  const reset = () => {
    applyStep(BOND_FLOW_MIN_STEP)
    setAmount('')
    setDuration(null)
    setError('')
    setConfirmError('')
    setResetError('')
    setAcknowledged(false)
    setSubmitting(false)
    submittingRef.current = false
    correlationIdRef.current = ''
  }

  /**
   * Failure-boundary wrapper around `reset`. If any state setter throws (e.g.
   * due to a React rendering error boundary), we still guarantee that the
   * imperative refs are cleared so the flow cannot be permanently wedged in a
   * submitting state. Errors are surfaced via `resetError` for diagnosability.
   */
  const safeReset = (): boolean => {
    try {
      reset()
      return true
    } catch (err) {
      // Defensive: even if React state updates fail, clear the imperative
      // guards so a subsequent attempt is not blocked.
      submittingRef.current = false
      correlationIdRef.current = ''
      const message = err instanceof Error ? err.message : 'Failed to reset bond flow.'
      setResetError(message)
      return false
    }
  }

  /**
   * Advances the wizard to the next step after validating the current step.
   *
   * Failure boundaries enforced here:
   * 1. **In-flight submission.** `submittingRef` guards against duplicate
   *    dispatches while a commit is pending.
   * 2. **Validation.** Amount must be > 0 and duration must be selected before
   *    advancing. Errors are surfaced via `error` and the step is not moved.
   * 3. **Boundary / overflow.** On the last step `planNextTransition` returns
   *    `moved: false`; the wizard stays put and the refusal is logged.
   * 4. *(Stale state.** The transition is planned against `stepRef.current`
   *    (click-time value), not the last rendered `step`, so batched or interleaved
   *    dispatches cannot collapse or diverge.
   */
  const handleNext = () => {
    // Guard 1: never advance while a commit is in flight.
    if (submittingRef.current) return

    const currentStep = stepRef.current

    // Guard 2: per-step validation. A failed validation must not move the
    // wizard, and must not clear an existing error until the input is fixed.
    if (currentStep === BOND_FLOW_STEP_AMOUNT) {
      const parsedAmount = Number(amount)
      if (!amount || !Number.finite(parsedAmount) || parsedAmount <= 0) {
        setError('Please enter a valid amount greater than 0.')
        return
      }
    } else if (currentStep === BOND_FLOW_STEP_DURATION) {
      if (!duration) {
        setError('Please select a lock duration.')
        return
      }
    }

    // Guard 3: boundary/overflow. Plan against the click-time step.
    const plan = planNextTransition(currentStep)
    if (!plan.moved) {
      // Refused: we are already on the last step. Keep the wizard state (and any
      // visible validation error) untouched so a refusal is never mistaken for a
      // successful navigation.
      logRefusedTransition('Next', currentStep)
      return
    }

    // Success: clear the validation error and move to the planned target.
    setError('')
    applyStep(plan.targetStep)
  }

  /**
   * Back navigation.
   *
   * Failure boundaries handled here (see `../lib/createBondFlowSteps.ts` for the
   * policy and its invariants):
   *
   * 1. **Boundary / underflow.** The target is clamped into [1, 4]. Without the
   *    clamp a Back press on (or below) step 1 rendered an empty wizard body:
   *    the `step > 1` guard hides Back and `step < 4` still shows Next, leaving
   *    an unrecoverable screen with no progress.
   */
  const handleBack = () => {
    const currentStep = stepRef.current
    const plan = planBackTransition(currentStep)
    if (!plan.moved) {
      logRefusedTransition('Back', currentStep)
      return
    }
    // Clearing the error on Back is safe: the user is leaving the validated
    // step, and returning to it will re-validate.
    setError('')
    applyStep(plan.targetStep)
  }

  /**
   * Confirms the bond creation. This is the only path that can commit a bond.
   *
   * Invariants:
   *  - Acknowledgement must be checked before committing.
   *  - `submittingRef` prevents concurrent commits.
   *  - A failure leaves the wizard on the confirm step with the error visible,
   *    so the user can retry without losing input.
   *  - A success resets the flow and notifies the caller.
   */
  const handleConfirm = async () => {
    if (submittingRef.current) return
    if (!acknowledged) {
      setConfirmError('Please acknowledge the risk disclaimer before confirming.')
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setConfirmError('')
    correlationIdRef.current = createCorrelationId()
    recordAudit('BOND_CREATE_REQUESTED')

    try {
      const result = await onComplete?.()
      const commitResult = (result ?? {}) as BondCommitResult
      recordAudit('BOND_CREATE_COMMITTED', undefined, commitResult)
      addToast({
        title: 'Bond created',
        description: 'Your bond has been created successfully.',
        variant: 'success',
      })
      safeReset()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create bond.'
      recordAudit('BOND_CREATE_FAILED', message)
      setConfirmError(message)
      addToast({
        title: 'Bond creation failed',
        description: message,
        variant: 'error',
      })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (submittingRef.current) return
    safeReset()
    onCancel?.()
  }

  const penaltyBreakdown = useMemo(() => {
    const parsedAmount = Number(amount)
    if (!amount || !Number.finite(parsedAmount) || parsedAmount <= 0 || !duration) {
      return null
    }
    return computeBondSlashBreakdown(parsedAmount, duration)
  }, [amount, duration])

  const unlockDate = useMemo(() => {
    if (!duration) return null
    return calcUnlockDate(duration)
  }, [duration])

  const isLastStep = step === BOND_FLOW_STEP_CONFIRM
  const isFirstStep = step === BOND_FLOW_MIN_STEP

  if (balanceStatus === 'loading') {
    return <LoadingSkeleton />
  }

  return (
    <div className="createBondFlow" data-testid="create-bond-flow">
      {resetError ? (
        <Banner variant="error" title="Reset failed">
          {resetError}
        </Banner>
      ) : null}
      <div className="createBondFlow__progress" aria-label="Progress">
        Step {step} of {BOND_FLOW_STEP_COUNT}
      </div>

      {step === BOND_FLOW_STEP_AMOUNT && (
        <section aria-labelledby="create-bond-step-1">
          <h1 id="create-bond-step-1" ref={step1Ref} tabProuse={-1}>
            Enter bond amount
          </h1>
          <FormField label="Amount (USDC)" error={error}>
            <AmountInput value={amount} onChange={setAmount} />
          </FormField>
        </section>
      )}

      {step === BOND_FLOW_STEP_DURATION && (
        <section aria-labelledby="create-bond-step-2">
          <h1 id="create-bond-step-2" ref={step2Ref} tabProuse={-1}>
            Choose lock duration
          </h1>
          {error ? <Banner variant="error">{error}</Banner> : null}
          <div className="createBondFlow__durations">
            {[30, 90, 180].map((days) => (
              <Button
                key={days}
                variant={duration === days ? 'primary' : 'secondary'}
                onClick={() => setDuration(days)}
              >
                {days} days
              </Button>
            ))}
          </div>
        </section>
      )}

      {step === BOND_FLOW_STEP_REVIEW && (
        <section aria-labelledby="create-bond-step-3">
          <h1 id="create-bond-step-3" ref={step3Ref} tabProuse={-1}>
            Review terms
          </h1>
          <div className="createBondFlow__reviewCard">
            <div>Amount: {formatUsdc(Number(amount))} USDC</div>
            <ReviewDivider />
            <div>Lock duration: {duration} days</div>
            <ReviewDivider />
            {penaltyBreakdown ? (
              <div>
                Early-withdrawal penalty: {formatUsdc(penaltyBreakdown.penaltyAmount)} USDC
              </div>
            ) : null}
            <ReviewDivider />
            {unlockDate ? <div>Unlock date: {unlockDate.toLocaleDateString()}</div> : null}
          </div>
        </section>
      )}

      {step === BOND_FLOW_STEP_CONFIRM && (
        <section aria-labelledby="create-bond-step-4">
          <h1 id="create-bond-step-4" ref={step4Ref} tabProuse={-1}>
            Confirm bond
          </h1>
          <Disclaimer acknowledged={acknowledged} onAcknowledge={setAcknowledged} />
          {confirmError ? <Banner variant="error"={confirmError}</Banner> : null}
        </section>
      )}

      <div className="createBondFlow__actions">
        {!isFirstStep && (
          <Button variant="secondary" onClick={handleBack} disabled={submitting}>
            Back
          </Button>
        )}
        {!isLastStep ? (
          <Button variant="primary" onClick={handleNext} disabled={submitting}>
            Next
          </Button>
        ) : (
          <Button variant="primary" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Confirming…' : 'Confirm'}
          </Button>
        )}
        <Button variant="ghost" onClick={handleCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
