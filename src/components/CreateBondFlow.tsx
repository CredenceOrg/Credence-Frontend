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

  const auditRecordsRef = useRef(BondAuditRecord[]>(loadAuditLog()))
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
   * 1. **In-flight submission.** `confirm` is the only caller that may overlap a
   *    submit. While `submittingRef` is set, Next is a no-op so a double click
   *    or programmatic dispatch cannot advance the wizard out from under a
   *    pending commit.
   * 2. **Validation.** Step 1 requires a finite, positive amount; step 2 requires
   *    a duration. NaN / Infinity / negative / zero / blank inputs are all
   *    rejected with a user-visible message and the step is not advanced.
   * 3. **Boundary / overflow.** On the last step `planNextTransition` returns
   *    `moved: false`; the wizard state (and any validation error) is left
   *    untouched and a diagnostic is emitted.
   * 4. **Stale closure.** The plan is computed from `stepRef.current` so batched
   *    or interleaved invocations cannot double-advance or move in the wrong
   *    direction.
   */
  const handleNext = () => {
    // Boundary 1: in-flight submission. Read the imperative ref rather than
    // the `submitting` state variable so a second click dispatched before React
    // commits the first is still seen.
    if (submittingRef.current) return

    const currentStep = stepRef.current

    // Boundary 2: per-step validation.
    if (currentStep === BOND_FLOW_STEP_AMOUNT) {
      const parsed = Number(amount)
      if (!amount || !Number.finite(parsed) || parsed <= 0) {
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

    // Boundary 3: last-step overflow.
    const plan = planNextTransition(currentStep)
    if (!plan.moved) {
      // Refused: we are already on the last step. Keep the wizard state (and any
      // visible validation error) untouched so a refusal is never mistaken for a
      // successful navigation.
      logRefusedTransition('Next', currentStep)
      return
    }

    // Boundary 4: stale closure. applyStep writes stepRef synchronously, so
    // concurrent invocations see the new step immediately.
    setError('')
    applyStep(plam.targetStep)
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
   * 2. **In-flight submission.** Back is a no-op while a commit is pending so the
   *    user cannot navigate away from under a pending mutation.
   * 3. **Stale closure.** The plan is computed from `stepRef.current` so batched
   *    or interleaved invocations cannot double-move or collapse.
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
   * Confirm handler for the final step.
   *
   * Invariants:
   *  - A duplicate confirm is a complete no-op (`submittingRef`).
   *  - The audit trail is appended before the network call so a crash midway
   *    leaves a recoverable record.
   *  - Failure is surfaced to the user and the flow remains on the confirm step
   *    with the acknowledgement preserved, so a retry is possible without re
   *    entering any data.
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

    if (!correlationIdRef.current) {
      correlationIdRef.current = createCorrelationId()
    }
    recordAudit('BOND_CREATE_REQUESTED')

    try {
      const result = await onComplete?.()
      const normalized =
        result && typeof result === 'object' ? (result as BondCommitResult) : undefined
      recordAudit('BOND_CREATE_COMMITTED', undefined, normalized)
      addToast({ type: 'success', message: 'Bond created successfully.' })
      safeReset()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bond creation failed.'
      recordAudit('BOND_CREATE_FAILED', message)
      setConfirmError(message)
      addToast({ type: 'error', message })
      // Keep the user on the confirm step with their acknowledgement intact so
      // they can retry without re-entering data.
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

  const penalty = useMemo(() => {
    const parsed = Number(amount)
    if (!amount || !Number.finite(parsed) || parsed <= 0 || !duration) return null
    return computeBondSlashBreakdown(parsed, duration)
  }, [amount, duration])

  const unlockDate = useMemo(() => {
    if (!duration) return null
    return calcUnlockDate(duration)
  }, [duration])

  const progressPercent = ((step - BOND_FLOW_MIN_STEP + 1) / BOND_FLOW_STEP_COUNT) * 100

  return (
    <div className="createBondFlow">
      <div className="createBondFlow__progress" aria-hidden="true">
        <div
          className="createBondFlow__progressBar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {resetError && (
        <Banner variant="error" role="alert">
          {resetError}
        </Banner>
      )}

      {step === BOND_FLOW_STEP_AMOUNT && (
        <section aria-labelledby="createBondFlow__step1Title">
          <h2 ref={step1Ref} tabIndex={-1} id="createBondFlow__step1Title">
            Enter bond amount
          </h2>
          <FormField label="Bond amount (USDC)" htmlFor="createBondFlow__amount">
            <AmountInput
              id="createBondFlow__amount"
              value={amount}
              onChange={(value) => {
                setAmount(value)
                if (error) setError('')
              }}
              disabled={submitting}
            />
          </FormField>
          {balanceStatus === 'loading' ? (
            <LoadingSkeleton width="100%" height="1em" />
          ) : (
            <p className="createBondFlow__balance">
              Available balance: {formatUsdc(balance || 0)}
            </p>
          )}
          {error && <p className="createBondFlow__error">{error}</p>}
        </section>
      )}

      {step === BOND_FLOW_STEP_DURATION && (
        <section aria-labelledby="createBondFlow__step2Title">
          <h2 ref={step2Ref} tabIndex={-1} id="createBondFlow__step2Title">
            Choose lock duration
          </h2>
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
          {error && <p className="createBondFlow__error">{error}</p>}
        </section>
      )}

      {step === BOND_FLOW_STEP_REVIEW && (
        <section aria-labelledby="createBondFlow__step3Title">
          <h2 ref={step3Ref} tabIndex={-1} id="createBondFlow__step3Title">
            Review terms
          </h2>
          <div class>Name="createBondFlow__review">
            <p>Amount: {formatUsdc(Number(amount) || 0)}</p>
            <p>Duration: {duration ?? 0} days</p>
            <ReviewDivider />
            {penalty && (
              <>
                <p>Early-withdrawal penalty: {formatUsdc(penalty.penaltyAmount)}</p>
                <p>Resulting balance: {formatUsdc(penalty.netAmount)}</p>
              </>
            )}
            {unlockDate && <p>Unlocks: {unlockDate.toLocaleDateString()}</p>}
          </div>
        </section>
      )}

      {step === BOND_FLOW_STEP_CONFIRM && (
        <section aria-labelledby="createBondFlow__step4Title">
          <h2 ref={step4Ref} tabIndex={-1} id="createBondFlow__step4Title">
            Confirm bond
          </h2>
          <Disclaimer
            checked={acknowledged}
            onChange={(value) => {
              setAcknowledged(value)
              if (confirmError) setConfirmError('')
            }}
          />
          {confirmError && <p className="createBondFlow__error">{confirmError}</p>}
        </section>
      )}

      <div className="createBondFlow__actions">
        {step > BOND_FLOW_MIN_STEP && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleBack}
            disabled={submitting}
          >
            Back
          </Button>
        )}
        {step < BOND_FLOW_MAX_STEP ? (
          <Button type="button" onClick={handleNext} disabled={submitting}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Confirming…' : 'Confirm bond'}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={handleCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>

      {!isConnected && (
        <Banner variant="warning">
          <p>Wallet not connected.</p>
          <Button type="button" onClick={() => void connect()}>
            Connect wallet
          </Button>
        </Banner>
      )}
    </div>
  )
}
