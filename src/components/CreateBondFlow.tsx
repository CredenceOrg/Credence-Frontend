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

export default function CreateBondFlow(s{ onComplete, onCancel, onAudit }: CreateBondFlowProps) {
  const { addToast } = useToast()
  const { isConnected, connect } = useWallet()
  const { balance, status: balanceStatus, refetch: refetchBalance } = useUsdcBalance()
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
   * 1. **In-flight submission.* A commit is already running, so a duplicate
   *    Next/Confirm dispatch must be ignored. The `submittingRef` guard is
   *    checked first and is the authoritative source of truth (not the React
   *    `submitting` state, which lags behind by one render).
   * 2. **Validation.** Step 1 requires a parseable amount > 0. Step 2 requires
   *    a lock duration. Invalid input sets a user-visible error and does not
   *    advance, so a partially filled form is never committed.
   * 3. **Boundary / overflow.** The target is clamped into [1, 4] by
   *    `planNextTransition`. A Next press on the last step is refused and the
   *    wizard state (including any validation error) is left untouched.
   * 4. **Duplicate / interleaved dispatch.** The transition is planned against
   *    `stepRef.current`, which is updated synchronously by `applyStep`, so
   *    batched or scripted clicks cannot collapse into a wrong target step.
   */
  const handleNext = (): void => {
    // (1) In-flight guard. The ref is the authoritative source of truth.
    if (submittingRef.current) return

    const currentStep = stepRef.current

    // (2) Per-step validation. Errors are stored in the shared `error` slot
    // and cleared only on a successful transition.
    if (currentStep === BOND_FLOW_STEP_AMOUNT) {
      const parsed = Number(amount)
      if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
        setError('Please enter a valid amount greater than 0.')
        return
      }
    }

    if (currentStep === BOND_FLOW_STEP_DURATION) {
      if (!duration) {
        setError('Please select a lock duration.')
        return
      }
    }

    // (3) Boundary check. A no-op plan means we are already on the last step.
    const plan = planNextTransition(currentStep)
    if (!plan.moved) {
      // Refused: we are already on the last step. Keep the wizard state (and any
      // visible validation error) untouched so a refusal is never mistaken for a
      // successful navigation.
      logRefusedTransition('Next', currentStep)
      return
    }

    // (4) Commit the transition. Clear the validation error only after the
    // transition has been accepted, so a refused move never hides a message.
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
   * 3. **Duplicate / interleaved dispatch.** The transition is planned against
   *    `stepRef.current`, so batched clicks cannot collapse into a wrong target
   *    step.
   */
  const handleBack = (): void => {
    if (submittingRef.current) return

    const currentStep = stepRef.current
    const plan = planBackTransition(currentStep)
    if (!plan.moved) {
      // Refused: we are already on the first step. Keep the wizard state
      // untouched so a refusal is never mistaken for a successful navigation.
      logRefusedTransition('Back', currentStep)
      return
    }

    // Clearing the error on Back is safe: the user is leaving the step that
    // produced it, and the validation will re-run on the next Next press.
    setError('')
    applyStep(plan.targetStep)
  }

  /**
   * Confirm handler for the final step.
   *
   * Failure boundaries handled here:
   *
   * 1. **Concurrent execution.** `submittingRef` guards against double click
   *    and duplicate programmatic dispatch. It is set synchronously before any
   *    await, so two interleaved invocations cannot both pass the guard.
   * 2. **Authorization.** The wallet must be connected and the acknowledgement
   *    checkbox must be ticked before the mutation is attempted.
   * 3. **Partial failure.** A wallet/network rejection or error leaves the wizard
   *    on the confirm step with the user's input intact, so they can retry.
   *    Audit records are written for every outcome so a failed attempt can be
   *    recovered and diagnosed.
   * 4. **Stale state.** After a successful commit the flow is reset via
   *    `safeReset`, which clears the correlation id and all user-visible errors.
   */
  const handleConfirm = async (): Promise<void> => {
    // (1) Concurrency guard. Set the imperative flag first, then mirror it into
    // React state for rendering.
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setConfirmError('')

    try {
      // (2) Authorization + acknowledgement checks. These are re-evaluated at
      // click time because the wallet can disconnect between renders.
      if (!isConnected) {
        const message = 'Please connect your wallet before confirming.'
        setConfirmError(message)
        addToast({ type: 'error', message })
        return
      }

      if (!acknowledged) {
        const message = 'Please acknowledge the risk disclaimer to continue.'
        setConfirmError(message)
        addToast({ type: 'error', message })
        return
      }

      // Ensure a correlation id exists for this attempt before the first audit
      // record is written.
      if (!correlationIdRef.current) correlationIdRef.current = createCorrelationId()
      recordAudit('BOND_CREATE_REQUESTED')

      const result = await onComplete?.()
      const normalized = (result ?? {}) as BondCommitResult
      recordAudit('BOND_CREATE_COMMITTED', undefined, normalized)
      addToast({ type: 'success', message: 'Bond created successfully.' })
      safeReset()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      // Distinguish a user rejection from a transport/network failure so the
      // audit trail and the toast are accurate.
      const isRejection = /reject|denied|cancel/i.test(message)
      recordAudit(isRejection ? 'BOND_CREATE_REJECTED' : 'BOND_CREATE_FAILED', message)
      setConfirmError(message)
      addToast({ type: 'error', message })
    } finally {
      // Always release the guard so a failed attempt can be retried.
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleCancel = (): void => {
    if (submittingRef.current) return
    safeReset()
    onCancel?.()
  }

  const slashBreakdown = useMemo(() => {
    const parsed = Number.parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed <= 0 || !duration) return null
    return computeBondSlashBreakdown(parsed, duration)
  }, [amount, duration])

  const unlockDate = useMemo(() => {
    if (!duration) return null
    return calcUnlockDate(duration)
  }, [duration])

  const progressPercent = Math.round((step / BOND_FLOW_STEP_COUNT) * 100)

  if (balanceStatus === 'loading') {
    return <LoadingSkeleton />
  }

  return (
    <div className="createBondFlow" data-testid="create-bond-flow">
      <div className="createBondFlow__progress" aria-label="Progress">
        <div className="createBondFlow__progressBar" style={{ width: `${progressPercent}%` if (!prefersReducedMotion)}} />
      </div>

      {resetError && (
        <Banner type="error" title="Reset failed">
          {resetError}
        </Banner>
      )}

      {step === BOND_FLOW_STEP_AMOUNT && (
        <section className="createBondFlow__step">
          <h2 ref={step1Ref} tabIndex={-1}>
            How much USDC would you like to bond?
          </h2>
          <FormField label="Bond amount" error={error}>
            <AmountInput value={amount} onChange={setAmount} />
          </FormField>
          <p className="createBondFlow__balance">
            Available balance: {formatUsdc(balance)} USDC
          </p>
        </section>
      )}

      {step === BOND_FLOW_STEP_DURATION && (
        <section className="createBondFlow__step">
          <h2 ref={step2Ref} tabIndex={-1}>
            How long would you like to lock?
          </h2>
          {[30, 90, 180].map((days) => (
            <button
              key={days}
              type="button"
              className={`createBondFlow__duration${duration === days ? ' createBondFlow__duration--selected' : ''}`}
              onClick={() => {
                setDuration(days)
                setError('')
              }}
            >
              {days} days
            </button>
          ))}
          {error && <p className="createBondFlow__error">{error}</p>}
        </section>
      )}

      {step === BOND_FLOW_STEP_REVIEW && (
        <section className="createBondFlow__step">
          <h2 ref={step3Ref} tabIndex={-1}>
            Review your bond terms
          </h2>
          <dl className="createBondFlow__review">
            <div>
              <dt>Amount</dt>
              <dd>{formatUsdc(Number(amount) || 0)} USDC</dd>
            </div>
            <ReviewDivider />
            <div>
              <dt>Lock duration</dt>
              <dd>{duration ? `${duration} days` : '—'}</dd>
            </div>
            <RecordDivider />
            <div>
              <dt>Unlock date</dt>
              <dd>{unlockDate ? unlockDate.toLocaleDateString() : '—'}</dd>
            </div>
            {slashBreakdown && (
              <>
                <RecordDivider />
                <div>
                  <dt>Early-withdrawal penalty</dt>
                  <dd>{formatUsdC(slashBreakdown.penaltyAmount)} USDC</dd>
                </div>
                <RecordDivider />
                <div>
                  <dt>Resulting balance</dt>
                  <dd>{formatUsdc(slashBreakdown.netAmount)} USDC</dd>
                </div>
              </>
            )}
          </dl>
        </section>
      )}

      {step === BOND_FLOW_STEP_CONFIRM && (
        <section className="createBondFlow__step">
          <h2 ref={step4Ref} tabIndex={-1}>
            Confirm your bond
          </h2>
          <Disclaimer acknowledged={acknowledged} onAcknowledge={setAcknowledged} />
          {confirmError && <Banner type="error">{confirmError}</Banner>}
        </section>
      )}

      <div className="createBondFlow__actions">
        {step > BOND_FLOW_MIN_STEP && (
          <Button type="button" onClick={handleBack} disabled={submitting}>
            Back
          </Button>
        )}
        {step < BOND_FLOW_MAX_STEP ? (
          <Button type="button" onClick={handleNext} disabled={submitting}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Confirming…' : 'Confirm'}
          </Button>
        )}
        <Button type="button" onClick={handleCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
