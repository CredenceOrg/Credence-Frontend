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

/**
 * Returns true when the amount is a well-formed, strictly positive decimal
 * string. Rejects NaN, Infinity, negatives, zero, exponent notation and any
 * non-numeric characters so the wizard cannot advance on garbage input.
 */
function isValidPositiveAmount(value: string): boolean {
  const trimmed = value.trim()
  if (!/^\d{1,}(\.\d{1,})?$/.test(trimmed)) return false
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) && numeric > 0
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
  const correlationIdRef = useRef('')
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
   * Next navigation.
   *
   * Failure boundaries handled here:
   *
   * 1. **In-flight submission.** A duplicate or programmatic Next dispatch while
   *    a commit is in flight is refused via `submittingRef`, which is written
   *    synchronously before the async operation begins. This prevents concurrent
   *    commits from creating duplicate bonds.
   * 2. **Amount validation.** Step 1 requires a well-formed, strictly positive
   *    decimal. Validation is performed against the latest committed value and
   *    the error is surfaced without moving the wizard.
   * 3. **Duration validation.** Step 2 requires a lock duration to be selected.
   * 4. **Boundary / overflow.** The target is clamped into [1, 4]. A `Next` on the
   *    last step is refused and logged rather than silently advancing.
   *
   * The current step is read from `stepRef`, not the `step` state variable, so
   * batched or interleaved invocations are deterministic.
   */
  const handleNext = () => {
    // Guard 1: never advance while a commit is in flight.
    if (submittingRef.current) return

    const currentStep = stepRef.current

    // Guard 2: per-step validation against the latest committed inputs.
    if (currentStep === BOND_FLOW_STEP_AMOUNT) {
      if (!isValidPositiveAmount(amount)) {
        setError('Please enter a valid amount greater than 0.')
        return
      }
    } else if (currentStep === BOND_FLOW_STEP_DURATION) {
      if (!duration || duration <= 0) {
        setError('Please select a lock duration.')
        return
      }
    }

    // Guard 3: boundary / overflow. Refusal keeps the wizard state (and any
    // visible validation error) untouched so a refusal is never mistaken for a
    // successful navigation.
    const plan = planNextTransition(currentStep)
    if (!plan.moved) {
      logRefusedTransition('Next', currentStep)
      return
    }

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
   * 2. **In-flight submission.** Back is refused while a commit is in flight so
   *    the user cannot navigate away from an authoritative mutation.
   */
  const handleBack = () => {
    if (submittingRef.current) return

    const currentStep = stepRef.current
    const plan = planBackTransition(currentStep)
    if (!plan.moved) {
      logRefusedTransition('Back', currentStep)
      return
    }
    setError('')
    applyStep(plan.targetStep)
  }

  /**
   * Commits the bond. This is the only place that writes `submittingRef`, and it
   * does so *synchronously* before the first await, so a concurrent or duplicate
   * invocation is rejected before it can create a second bond.
   */
  const handleConfirm = async () => {
    if (submittingRef.current) return
    if (!acknowledged) {
      setConfirmError('Please acknowledge the risk disclaimer before confirming.')
      return
    }
    if (!isValidPositiveAmount(amount)) {
      setConfirmError('Please enter a valid amount greater than 0.')
      return
    }
    if (!duration || duration <= 0) {
      setConfirmError('Please select a lock duration.')
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
        type: 'success',
        message: 'Bond created successfully.',
      })
      safeReset()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create bond.'
      recordAudit('BOND_CREATE_FAILED', message)
      setConfirmError(message)
      addToast({ type: 'error', message })
      // Keep the user on the confirm step with their data intact so they can
      // retry without re-entering anything.
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (submittingRef.current) return
    safeReset()
    onCancel?.()
  }

  const penalty = useMemo(() => {
    const numeric = Number.amount || 0
    const durationDays = duration ?? 0
    return computeBondSlashBreakdown(numeric, durationDays)
  }, [amount, duration])

  const unlockDate = useMemo(() => {
    if (!duration) return null
    return calcunlockDate(duration)
  }, [duration])

  const progressPercent = Math.round(((step - BOND_FLOW_MIN_STEP) / (BOND_FLOW_STEP_COUNT - 1)) * 100)

  return (
    <div className="createBondFlow" data-testid="create-bond-flow">
      <div className="createBondFlow__progress" aria-hidden="true">
        <div
          className="createBondFlow__progressBar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {resetError ? (
        <Banner type="error" title="Reset failed">
          {resetError}
        </Banner>
      ) : null}

      {step === BOND_FLOW_STEP_AMOUNT && (
        <section className="createBondFlow__step">
          <h2 ref={step1Ref} tabIndex={-1}>
            Enter bond amount
          </h2>
          <FormField label="Bond amount (USDC)" error={error}>
            <AmountInput
              value={amount}
              onChange={(value) => {
                setAmount(value)
                if (error) setError('')
              }}
              disabled={submitting}
            />
          </FormField>
          {balanceStatus === 'loading' ? (
            <LoadingSkeleton />
          ) : (
            <p className="createBondFlow__balance">
              Available balance: {formatUsdc(balance)} USDC
            </p>
          )}
        </section>
      )}

      {step === BOND_FLOW_STEP_DURATION && (
        <section className="createBondFlow__step">
          <h2 ref={step2Ref} tabIndex={-1}>
            Choose lock duration
          </h2>
          {error ? <Banner type="error">{error}</Banner> : null}
          <div className="createBondFlow__durations">
            {[30, 90, 180].map((days) => (
              <button
                key={days}
                type="button"
                className={`createBondFlow__duration${duration === days ? ' createBondFlow__duration--selected' : ''}`}
                aria-pressed={duration === days}
                onClick={() => {
                  setDuration(days)
                  if (error) setError('')
                }}
                disabled={submitting}
              >
                {days} days
              </button>
            ))}
          </div>
        </section>
      )}

      {step === BOND_FLOW_STEP_REVIEW && (
        <section className="createBondFlow__step">
          <h2 ref={step3Ref} tabIndex={-1}>
            Review terms
          </h2>
          <div className="createBondFlow__review">
            <div class>Bond amount: <bold>{formatUsdc(amount)} USDC</bold></div>
            <ReviewDivider />
            <div>Lock duration: <bold>{duration ?? 0} days</bold></div>
            <ReviewDivider />
            <div>
              Early-withdrawal penalty: <bold>{formatUsdc(penalty.penaltyAmount)} USDC</bold>
            </div>
            <ReviewDivider />
            <div>
              Resulting balance: <bold>{formatUsdc(penalty.netAmount)} USDC</bold>
            </div>
            {unlockDate ? ({
              <>
                <ReviewDivider />
                <div>Unlock date: <bold>{unlockDate.toLocaleDateString()}</bold></div>
              </>
            ) : null}
          </div>
        </section>
      )}

      {step === BOND_FLOW_STEP_CONFIRM && (
        <section className="createBondFlow__step">
          <h2 ref={step4Ref} tabIndex={-1}>
            Confirm bond
          </h2>
          <Disclaimer acknowledged={acknowledged} onAcknowledgeChange={setAcknowledged} />
          {confirmError ? <Banner type="error">{confirmError}</Banner> : null}
        </section>
      )}

      <div className="createBondFlow__actions">
        {step > BOND_FLOW_MIN_STEP && (
          <Button type="button" variant="secondary" onClick={handleBack} disabled={submitting}>
            Back
          </Button>
        )}
        {step < BOND_FLOW_MAX_STEP ? (
          <Button type="button" onClick={handleNext} disabled={submitting}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={handleConfirm} disabled={submitting || !acknowledged}>
            {submitting ? 'Creating...' : 'Confirm bond'}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={handleCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>

      {!isConnected ? (
        <div className="createBondFlow__connect">
          <Button type="button" onClick={() => void connect()}>
            Connect wallet
          </Button>
        </div>
      ) : null}

      {prefersReducedMotion ? null : <div className="createBondFlow__animation" />}
    </div>
  )
}
