import { useState, useRef, useEffect } from 'react'
import { FormField } from './forms/FormField'
import Button from './Button'
import Banner from './Banner'
import Disclaimer from './Disclaimer'
import { useToast } from './ToastProvider'

const calcUnlockDate = (days: number) => {
  const today = new Date()
  const unlock = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)
  return unlock.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function CreateBondFlow() {
  const { addToast } = useToast()
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

  const handleConfirm = () => {
    addToast('success', 'Bond created successfully.')
    reset()
  }

  const StepIndicator = () => (
    <div 
      style={{ display: 'flex', gap: 'var(--credence-space-2)', marginBottom: 'var(--credence-space-4)' }} 
      aria-label={`Step ${step} of 4`}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: '4px',
            borderRadius: 'var(--credence-radius-full)',
            background: i <= step ? 'var(--color-primary)' : 'var(--border-default)',
            transition: 'background 0.2s ease',
          }}
        />
      ))}
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 'var(--credence-space-6)' }}>
      <StepIndicator />

      {step === 1 && (
        <div style={{ display: 'grid', gap: 'var(--credence-space-4)' }}>
          <h2 ref={step1Ref} tabIndex={-1} style={{ outline: 'none', color: 'var(--text-primary)' }}>
            Step 1: Enter Bond Amount
          </h2>
          <Banner severity="info">
            Bonds are locked for a minimum of 30 days. Early withdrawal incurs a slash penalty.
          </Banner>
          <FormField id="bond-amount" label="Amount (USDC)" error={error}>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (error) setError('')
              }}
              placeholder="0"
              min="0"
              step="1"
              className="focus-visible"
              style={{
                width: '100%',
                padding: 'var(--credence-space-3) var(--credence-space-4)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--credence-radius-lg)',
                fontSize: 'var(--credence-font-size-base)',
                background: 'var(--bg-page)',
                color: 'var(--text-primary)',
              }}
            />
          </FormField>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'grid', gap: 'var(--credence-space-4)' }}>
          <h2 ref={step2Ref} tabIndex={-1} style={{ outline: 'none', color: 'var(--text-primary)' }}>
            Step 2: Choose Lock Duration
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Select how long you want to lock your USDC:</p>
          
          {error && (
            <div role="alert" style={{ color: 'var(--color-danger)', fontWeight: 'var(--credence-font-weight-semibold)' }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--credence-space-3)' }}>
            {[30, 90, 180].map((d) => (
              <Button
                key={d}
                type="button"
                onClick={() => {
                  setDuration(d)
                  if (error) setError('')
                }}
                style={{
                  flex: 1,
                  padding: 'var(--credence-space-4)',
                  background: duration === d ? 'var(--color-primary)' : 'var(--bg-page)',
                  color: duration === d ? 'var(--bg-page)' : 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--credence-radius-lg)',
                  fontWeight: 'var(--credence-font-weight-semibold)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {d} Days
              </Button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'grid', gap: 'var(--credence-space-4)' }}>
          <h2 ref={step3Ref} tabIndex={-1} style={{ outline: 'none', color: 'var(--text-primary)' }}>
            Step 3: Review Terms
          </h2>
          <Banner severity="warning">
            Warning: Early withdrawal prior to lock maturity incurs a slash penalty on principal.
          </Banner>
          <div
            style={{
              padding: 'var(--credence-space-4)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--credence-radius-lg)',
              background: 'var(--bg-page)',
              display: 'grid',
              gap: 'var(--credence-space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Bond Amount:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{amount} USDC</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Lock Duration:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{duration} Days</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Estimated Unlock Date:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{duration ? calcUnlockDate(duration) : ''}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Slash Terms:</span>
              <strong style={{ color: 'var(--color-danger)' }}>Penalties Apply</strong>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: 'grid', gap: 'var(--credence-space-4)' }}>
          <h2 ref={step4Ref} tabIndex={-1} style={{ outline: 'none', color: 'var(--text-primary)' }}>
            Step 4: Confirm Bond
          </h2>
          <Disclaimer
            context="Bonding USDC locks funds in a non-custodial smart contract. Slashing conditions apply."
            termsHref="#"
          />
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--credence-space-2)',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              marginTop: 'var(--credence-space-2)',
            }}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
            />
            <span>I explicitly acknowledge the slashing terms and lock conditions.</span>
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--credence-space-3)', marginTop: 'var(--credence-space-4)' }}>
        {step > 1 && (
          <Button
            type="button"
            onClick={handleBack}
            style={{
              flex: 1,
              padding: 'var(--credence-space-3)',
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--credence-radius-lg)',
              cursor: 'pointer',
            }}
          >
            Back
          </Button>
        )}
        {step < 4 ? (
          <Button
            type="button"
            onClick={handleNext}
            style={{
              flex: 1,
              padding: 'var(--credence-space-3)',
              background: 'var(--color-primary)',
              color: 'var(--bg-page)',
              border: 'none',
              borderRadius: 'var(--credence-radius-lg)',
              fontWeight: 'var(--credence-font-weight-semibold)',
              cursor: 'pointer',
            }}
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!acknowledged}
            style={{
              flex: 1,
              padding: 'var(--credence-space-3)',
              background: acknowledged ? 'var(--color-primary)' : 'var(--border-default)',
              color: acknowledged ? 'var(--bg-page)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--credence-radius-lg)',
              fontWeight: 'var(--credence-font-weight-semibold)',
              cursor: acknowledged ? 'pointer' : 'not-allowed',
            }}
          >
            Confirm & Create Bond
          </Button>
        )}
        <Button
          type="button"
          onClick={reset}
          style={{
            padding: 'var(--credence-space-3) var(--credence-space-4)',
            background: 'var(--bg-page)',
            color: 'var(--color-danger)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--credence-radius-lg)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
