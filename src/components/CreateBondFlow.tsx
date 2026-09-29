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
import { computeBondSlashBreakdown, calcUnlockDate } from '../lib/bondPenalty'

import './CreateBondFlow.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Divider used between review card sections
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateBondFlow({ onComplete, onCancel, onAudit }: CreateBondFlowProps) {
  const { addToast } = useToast()
  const { isConnected, connect } = useWallet()
  const { balance, status: balanceStatus, refetch: refetchBalance } = useUsdcBalance()
  const [step, setStep] = useState<number>(BOND_FLOW_MIN_STEP)
  const { isConnected } = useWallet()
  const {
    balance,
    status: balanceStatus,
    refetch: refetchBalance,
  } = useUsdcBalance()
  const prefersReducedMotion = useReducedMotion()

  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState('')
  const [duration, setDuration] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState('')

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

  const reset = () => {
    applyStep(BOND_FLOW_MIN_STEP)
    setAmount('')
    setDuration(null)
    setError('')
    setConfirmError('')
    setAcknowledged(false)
    setSubmitting(false)
    submittingRef.current = false
    correlationIdRef.current = ''
  }

  const handleNext = () => {
    const currentStep = stepRef.current
    if (currentStep === BOND_FLOW_STEP_AMOUNT) {
    if (submittingRef.current) return

    if (step === 1) {
      if (!amount || Number(amount) <= 0) {
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
    const plan = planNextTransition(currentStep)
    if (!plan.moved) {
      // Refused: we are already on the last step. Keep the wizard state (and any
      // visible validation error) untouched so a refusal is never mistaken for a
      // successful navigation.
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
   * 2. **Refusal is a no-op.** When the plan cannot move, wizard state — including
   *    the visible validation error — is left untouched, so an error can never be
   *    silently cleared by a navigation that never happened.
   * 3. **Duplicate / concurrent invocation.** The plan is evaluated against
   *    `stepRef`, which is updated synchronously, so two Back presses batched
   *    into one React update move two steps instead of collapsing into one.
   * 4. **Stale consent.** Leaving the confirm step re-arms the disclaimer
   *    checkbox, so `Confirm & Create Bond` can never stay enabled against terms
   *    the user has edited since acknowledging them.
   * 5. **Out-of-range recovery.** A corrupted or legacy step index is pulled back
   *    into range rather than propagated.
   *
   * **No data loss:** `amount` and `duration` are deliberately preserved, so
   * going back never discards what the user entered.
   */
  const handleBack = () => {
    const currentStep = stepRef.current
    const plan = planBackTransition(currentStep)

    if (!plan.moved) {
      // Unreachable through the UI (Back is hidden on step 1) but reachable via
      // duplicate/programmatic dispatch. Log the step index only — never amounts,
      // addresses or any other user data.
      logRefusedTransition('Back', currentStep)
      return
    }

    if (plan.invalidatesConsent) setAcknowledged(false)
    if (submittingRef.current) return

    setError('')
    applyStep(plan.targetStep)
  }

  const handleCancel = () => {
    if (submittingRef.current) return

    reset()
    onCancel?.()
  }

  const handleConfirm = async () => {
    if (submittingRef.current) return

    if (!acknowledged) {
      setConfirmError('Please acknowledge the slashing terms and lock conditions before creating a bond.')
      correlationIdRef.current = createCorrelationId()
      recordAudit('BOND_CREATE_REJECTED', 'ACKNOWLEDGEMENT_REQUIRED')
      return
    }

    if (!isConnected) {
      setConfirmError('Wallet disconnected. Reconnect your wallet and try again.')
      correlationIdRef.current = createCorrelationId()
      recordAudit('BOND_CREATE_REJECTED', 'WALLET_DISCONNECTED')
      return
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setConfirmError('Network offline. Reconnect your network and try again.')
      correlationIdRef.current = createCorrelationId()
      recordAudit('BOND_CREATE_FAILED', 'NETWORK_OFFLINE')
      return
    }

    correlationIdRef.current = createCorrelationId()
    submittingRef.current = true
    setSubmitting(true)
    setConfirmError('')
    recordAudit('BOND_CREATE_REQUESTED')

    try {
      const result = await onComplete?.()
      recordAudit('BOND_CREATE_COMMITTED', undefined, result)
      addToast('success', 'Bond created successfully.')
      reset()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bond creation failed. Please try again.'
      setConfirmError(message)
      recordAudit('BOND_CREATE_FAILED', message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  /**
   * Penalty breakdown derived from the current amount + duration.
   * Re-computed whenever the user edits either field (including going
   * back from step 3 and changing values).
   *
   * Returns `null` when either input is not yet valid.
   */
  const slashBreakdown = useMemo(() => {
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0 || !duration) return null
    return computeBondSlashBreakdown(numericAmount, duration)
  }, [amount, duration])

  // ---------------------------------------------------------------------------
  // Step indicator
  // ---------------------------------------------------------------------------

  const stepIndicatorTransition = prefersReducedMotion ? 'none' : 'background 0.2s ease'
  const durationButtonTransition = prefersReducedMotion ? 'none' : 'all 0.2s ease'

  const StepIndicator = () => (
    <div
      className="createBondFlow__stepIndicator"
      aria-label={`Step ${step} of ${BOND_FLOW_STEP_COUNT}`}
    >
      {Array.from({ length: BOND_FLOW_STEP_COUNT }, (_, index) => index + BOND_FLOW_MIN_STEP).map(
        (i) => (
          <div
            key={i}
            className={`createBondFlow__stepBar${i <= step ? ' createBondFlow__stepBar--active' : ''}`}
            style={{
              transition: prefersReducedMotion ? 'none' : undefined,
            }}
          />
        )
      )}
    <div className="createBondFlow__stepIndicator" aria-label={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={['createBondFlow__stepBar', i <= step ? 'createBondFlow__stepBar--active' : '']
            .filter(Boolean)
            .join(' ')}
          style={{ transition: stepIndicatorTransition }}
        />
      ))}
    </div>
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="createBondFlow">
      <StepIndicator />

      {/* ── Step 1: Amount ── */}
      {step === BOND_FLOW_STEP_AMOUNT && (
        <div className="createBondFlow__step">
          <h2 ref={step1Ref} tabIndex={-1} className="createBondFlow__heading">
            Step 1: Enter Bond Amount
          </h2>

          <Banner severity="info">
            Bonds are locked for a minimum of 30 days. Early withdrawal incurs a slash penalty.
          </Banner>

          {/* ── Balance display ── */}
          <div className="createBondFlow__balanceRow" aria-live="polite" aria-atomic="true">
            {!isConnected ? (
              <span className="createBondFlow__balanceText">
                Connect your wallet to see your available balance.
              </span>
            ) : balanceStatus === 'loading' ? (
              <LoadingSkeleton variant="text" rows={1} width="12rem" />
            ) : balanceStatus === 'error' ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                }}
              >
                <span role="alert" style={{ color: 'var(--credence-color-danger)' }}>
              <span className="createBondFlow__balanceErrorRow">
                <span className="createBondFlow__balanceText" role="alert" style={{ color: 'var(--credence-color-danger)' }}>
                  Could not load balance.
                </span>
                <Button
                  type="button"
                  onClick={refetchBalance}
                  className="createBondFlow__retryButton"
                  style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem' }}
                >
                  Retry
                </Button>
              </span>
            ) : (
              <span className="createBondFlow__balanceText">
                Available: {formatUsdc(balance)}
              </span>
            )}
          </div>

          <FormField id="bond-amount" label="Amount (USDC)" error={error || undefined}>
            <AmountInput
              value={amount}
              onChange={(next) => {
                setAmount(next)
                if (error) setError('')
              }}
              balance={balance}
              placeholder="0"
              presets={[100, 500, 1000]}
              currencyLabel="USDC"
              disabled={!isConnected}
              hideErrorMessage={Boolean(error)}
              aria-disabled={!isConnected || undefined}
            />
          </FormField>
        </div>
      )}

      {/* ── Step 2: Duration ── */}
      {step === BOND_FLOW_STEP_DURATION && (
        <div className="createBondFlow__step">
          <h2 ref={step2Ref} tabIndex={-1} className="createBondFlow__heading">
            Step 2: Choose Lock Duration
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Select how long you want to lock your USDC:
          </p>

          {error && (
            <div className="createBondFlow__error" role="alert">
              ⚠ {error}
            </div>
          )}

          <div className="createBondFlow__durationRow">
            {[30, 90, 180].map((d) => {
              const isActive = duration === d
              return (
                <Button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDuration(d)
                    if (error) setError('')
                  }}
                  className={
                    isActive
                      ? 'createBondFlow__durationButton createBondFlow__durationButton--active'
                      : 'createBondFlow__durationButton'
                  }
                  style={{ transition: durationButtonTransition }}
                >
                  {d} Days
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Step 3: Review Terms ── */}
      {step === BOND_FLOW_STEP_REVIEW && (
        <div className="createBondFlow__step">
          <h2 ref={step3Ref} tabIndex={-1} className="createBondFlow__heading">
            Step 3: Review Terms
          </h2>

          <Banner severity="warn" title="Early withdrawal — slash exposure">
            Withdrawing before lock maturity incurs a slash penalty on your principal. The figures
            below show exactly what you would receive if you exit early.
          </Banner>

          {/* ── Bond summary card ── */}
          <div className="createBondFlow__reviewCard">
            {/* Bond amount */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Bond Amount:</span>
              <strong style={{ color: 'var(--text-primary)' }} data-testid="review-bond-amount">
                {formatUsdc(Number(amount))}
              </strong>
            </div>

            {/* Lock duration */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Lock Duration:</span>
              <strong style={{ color: 'var(--text-primary)' }} data-testid="review-duration">
                {duration} Days
              </strong>
            </div>

            {/* Unlock date */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Estimated Unlock Date:</span>
              <strong style={{ color: 'var(--text-primary)' }} data-testid="review-unlock-date">
                {duration ? calcUnlockDate(duration) : ''}
              </strong>
            </div>

            <ReviewDivider />

            {/* ── Early-withdrawal slash section ── */}
            <div style={{ display: 'grid', gap: 'var(--credence-space-1)' }}>
              <span className="createBondFlow__reviewBadgeLabel">If you withdraw early</span>
            </div>

            {slashBreakdown ? (
              <>
                {/* Slash penalty % + amount */}
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Slash Penalty ({slashBreakdown.penaltyPercent}%):
                  </span>
                  <strong
                    style={{ color: 'var(--color-danger)' }}
                    data-testid="review-penalty-amount"
                  >
                    −{slashBreakdown.penaltyAmount}
                  </strong>
                </div>

                {/* Resulting balance */}
                <div className="createBondFlow__reviewResult">
                  <span
                    style={{
                      color: 'var(--text-secondary)',
                      fontWeight: 'var(--credence-font-weight-semibold)',
                    }}
                  >
                    You would receive:
                  </span>

                  <strong
                    style={{
                      color:
                        slashBreakdown.resultingUsdc < Number(amount)
                          ? 'var(--color-danger)'
                          : 'var(--text-primary)',
                      fontSize: 'var(--credence-font-size-lg, 1.125rem)',
                    }}
                    data-testid="review-resulting-balance"
                  >
                    {slashBreakdown.resultingBalance}
                  </strong>
                </div>
              </>
            ) : (
              /* Fallback: breakdown unavailable (should not normally be reached in step 3) */
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Slash Terms:</span>
                <strong style={{ color: 'var(--color-danger)' }}>Penalties Apply</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Confirm ── */}
      {step === BOND_FLOW_STEP_CONFIRM && (
        <div className="createBondFlow__step">
          <h2 ref={step4Ref} tabIndex={-1} className="createBondFlow__heading">
            Step 4: Confirm Bond
          </h2>

          <Disclaimer
            context="Bonding USDC locks funds in a non-custodial smart contract. Slashing conditions apply."
            termsHref="#"
          />
          {confirmError && (
            <div className="createBondFlow__error" role="alert">
              ⚠ {confirmError}
            </div>
          )}
          <label className="createBondFlow__ackLabel">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>I explicitly acknowledge the slashing terms and lock conditions.</span>
          </label>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="createBondFlow__nav">
        {step > BOND_FLOW_MIN_STEP && (
          <Button
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="createBondFlow__navButton createBondFlow__backButton"
          >
            Back
          </Button>
        )}

        {step < BOND_FLOW_MAX_STEP ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={submitting}
            className="createBondFlow__navButton createBondFlow__nextButton"
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!acknowledged || submitting}
            className="createBondFlow__navButton createBondFlow__confirmButton"
          >
            {submitting ? 'Creating Bond…' : 'Confirm &amp; Create Bond'}
          </Button>
        )}

        <Button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className="createBondFlow__navButton createBondFlow__cancelButton"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
