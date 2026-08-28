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
 * @see {@link ../lib/format.ts} for shared USDC formatting.
 * @see {@link docs/risk-disclaimer.md} for the full risk/slashing policy.
 */

import { useMemo, useState, useRef, useEffect } from 'react'
import AmountInput from './AmountInput'
import { FormField } from './forms/FormField'
import Button from './Button'
import Banner from './Banner'
import Disclaimer from './Disclaimer'
import { useToast } from './ToastProvider'
import { useWallet } from '../context/WalletContext'
import { useUsdcBalance } from '../hooks/useUsdcBalance'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { formatUsdc } from '../lib/format'
import { LoadingSkeleton } from './states'
import { computeBondSlashBreakdown, calcUnlockDate } from '../lib/bondPenalty'

import './CreateBondFlow.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBondFlowProps {
  /** Called after the user confirms and the bond is "created" */
  onComplete?: () => void
  /** Called when the user cancels the flow */
  onCancel?: () => void
}

// ---------------------------------------------------------------------------
// Divider used between review card sections
// ---------------------------------------------------------------------------

const ReviewDivider = () => <div className="createBondFlow__reviewDivider" />

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateBondFlow({ onComplete, onCancel }: CreateBondFlowProps) {
  const { addToast } = useToast()
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

  const step1Ref = useRef<HTMLHeadingElement>(null)
  const step2Ref = useRef<HTMLHeadingElement>(null)
  const step3Ref = useRef<HTMLHeadingElement>(null)
  const step4Ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (step === 1) step1Ref.current?.focus()
    else if (step === 2) step2Ref.current?.focus()
    else if (step === 3) step3Ref.current?.focus()
    else if (step === 4) step4Ref.current?.focus()
  }, [step])

  const reset = () => {
    setStep(1)
    setAmount('')
    setDuration(null)
    setError('')
    setAcknowledged(false)
  }

  const handleNext = () => {
    if (step === 1) {
      if (!amount || Number(amount) <= 0) {
        setError('Please enter a valid amount greater than 0.')
        return
      }
    }
    if (step === 2) {
      if (!duration) {
        setError('Please select a lock duration.')
        return
      }
    }
    setError('')
    setStep(step + 1)
  }

  const handleBack = () => {
    setError('')
    setStep(step - 1)
  }

  const handleCancel = () => {
    reset()
    onCancel?.()
  }

  const handleConfirm = () => {
    addToast('success', 'Bond created successfully.')
    reset()
    onComplete?.()
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
      {step === 1 && (
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
      {step === 2 && (
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
      {step === 3 && (
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
      {step === 4 && (
        <div className="createBondFlow__step">
          <h2 ref={step4Ref} tabIndex={-1} className="createBondFlow__heading">
            Step 4: Confirm Bond
          </h2>

          <Disclaimer
            context="Bonding USDC locks funds in a non-custodial smart contract. Slashing conditions apply."
            termsHref="#"
          />
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
        {step > 1 && (
          <Button
            type="button"
            onClick={handleBack}
            className="createBondFlow__navButton createBondFlow__backButton"
          >
            Back
          </Button>
        )}

        {step < 4 ? (
          <Button
            type="button"
            onClick={handleNext}
            className="createBondFlow__navButton createBondFlow__nextButton"
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!acknowledged}
            className="createBondFlow__navButton createBondFlow__confirmButton"
          >
            Confirm &amp; Create Bond
          </Button>
        )}

        <Button
          type="button"
          onClick={handleCancel}
          className="createBondFlow__navButton createBondFlow__cancelButton"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
