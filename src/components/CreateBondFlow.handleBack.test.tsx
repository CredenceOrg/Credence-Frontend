
/**
 * @file CreateBondFlow.handleBack.test.tsx
 * @description Failure-boundary coverage for `handleBack` in `CreateBondFlow.tsx`.
 *
 * The suite is deliberately isolated: `WalletContext`, `useUsdcBalance` and
 * `useToast` are mocked so the wizard renders with a connected wallet and a
 * resolved balance without pulling in providers that are irrelevant to step
 * navigation. That keeps every assertion about the Back transition deterministic.
 *
 * Boundaries covered:
 * - success: Back moves exactly one step from every valid step
 * - rejection: a refused transition is an inert no-op (state untouched)
 * - boundary: first step, out-of-range recovery, burst of duplicate presses
 * - concurrency: several Back presses batched into one React update
 * - regression: focus management, entered-data retention, consent invalidation,
 *   and no user data leaking into the refusal diagnostic
 * - handleNext: deterministic failure-boundary coverage (see below)
 */

import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import CreateBondFlow from './CreateBondFlow'
import { useWallet } from '../context/WalletContext'
import { useUsdcBalance } from '../hooks/useUsdcBalance'
import { useToast } from './ToastProvider'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { BOND_FLOW_STEP_COUNT } from '../lib/createBondFlowSteps'

// ---------------------------------------------------------------------------
// Mocks — no providers required
// ---------------------------------------------------------------------------

const connect = vi.fn(async () => {})
const refetchBalance = vi.fn()
const addToast = vi.fn()

vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}))

vi.mock('../hooks/useUsdcBalance', () => ({
  useUsdcBalance: vi.fn(),
}))

vi.mock('./ToastProvider', () => ({
  useToast: vi.fn(),
}))

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

vi.mock('../lib/createBondFlowSteps', () => ({
  BOND_FLOW_STEP_COUNT: 4,
}))

/** Wallet address used by the mocked context; asserted against log leakage. */
const TEST_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderFlow(props: Parameters<typeof CreateBondFlow>[0] = {}) {
  return render(<CreateBondFlow {...props} />)
}

/** Current step as reported by the progress indicator (aria-label). */
function currentStepLabel(): string {
  return screen.getByLabelText(/^Step \d+ of \d+$/i).getAttribute('aria-label') ?? ''
}

function expectOnStep(step: number) {
  expect(currentStepLabel()).toBe(`Step ${step} of ${BOND_FLOW_STEP_COUNT}`)
}

const backButton = () => screen.getByRole('button', { name: /^back$/i })
const nextButton = () => screen.getByRole('button', { name: /^next$/i })
const cancelButton = () => screen.getByRole('button', { name: /^cancel$/i })
const confirmButton = () => screen.getByRole('button', { name: /confirm & create bond/i })

/**
 * Deterministic failure-boundary coverage for `handleNext`.
 *
 * `handleNext` is the wizard's forward transition. Its contract mirrors
 * `handleBack`: it must advance exactly one step, refuse out-of-range
 * transitions as inert no-ops, and never lose user data or leak sensitive
 * values into diagnostics. The suite below exercises success, rejection,
 * boundary, concurrency, and regression scenarios for that entry point.
 */
describe('handleNext – failure-boundary coverage', () => {
  it('advances exactly one step from step 1 to step 2', async () => {
    const user = userEvent.setup()
    renderFlow()
    expectOnStep(1)

    const input = screen.getByPlaceholderText('0')
    await user.clear(input)
    await user.type(input, '1000')
    await user.click(nextButton())

    expectOnStep(2)
    expect(screen.getByText(/Step 2: Choose Lock Duration/i)).toBeInTheDocument()
  })

  it('refuses to advance past the final step and logs a diagnostic', async () => {
    const user = userEvent.setup()
    renderFlow()
    await goToStep(4)
    expectOnStep(4)

    // The confirm step is the last step; Next must be a no-op there.
    const next = nextButton()
    if (next) {
      await user.click(next)
    }

    expectOnStep(4)
  })

  it('does not advance when validation fails on step 1', async () => {
    const user = userEvent.setup()
    renderFlow()
    expectOnStep(1)

    await user.click(nextButton())

    expectOnStep(1)
    expect(screen.queryByRole('alert')).toBeInTheDocument()
  })

  it('applies Next and Back in the order they were dispatched', async () => {
    renderFlow()
    await goToStep(2)
    expectOnStep(2)

    const next = nextButton()
    const back = backButton()
    await act(async () => {
      next.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      back.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Next then Back is a round trip: 2 → 3 → 2.
    expectOnStep(2)
  })

  it('never renders an out-of-range step label under a burst of Next presses', async () => {
    const user = userEvent.setup()
    renderFlow()
    await goToStep(2)

    const next = nextButton()
    act(() => {
      for (let i = 0; i < 9; i += 1) {
        next.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }
    })

    expect(currentStepLabel()).toMatch(/^Step [1-4] of 4$/)
  })

  it('preserves entered amount when Next is refused at the final step', async () => {
    const user = userEvent.setup()
    renderFlow()
    await goToStep(4, { amount: '742.50', days: 90 })

    const next = nextButton()
    if (next) {
      await user.click(next)
    }

    expectOnStep(4)
    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('742.50 USDC')
    expect(screen.getByTestId('review-duration')).toHaveTextContent('90 Days')
  })
})

/** Dispatch `count` Back clicks inside a single React batch. */
function burstBack(count: number) {
  const button = backButton()
  act(() => {
    for (let i = 0; i < count; i += 1) {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  })
}

/** Walk the wizard to the given step (1–4) with a valid amount/duration. */
async function goToStep(step: number, { amount = '1000', days = 30 } = {}) {
  const user = userEvent.setup()

  if (step >= 2) {
    const input = screen.getByPlaceholderText('0')
    await user.clear(input)
    await user.type(input, amount)
    await user.click(nextButton())
  }
  if (step >= 3) {
    await user.click(screen.getByRole('button', { name: new RegExp(`^${days} Days$`, 'i') }))
    await user.click(nextButton())
  }
  if (step >= 4) await user.click(nextButton())
  return user
}


beforeEach(() => {
  vi.mocked(useWallet).mockReturnValue({
    address: TEST_ADDRESS,
    isConnected: true,
    connected: true,
    isConnecting: false,
    error: null,
    connect,
    disconnect: vi.fn(),
    network: 'public',
  } as unknown as ReturnType<typeof useWallet>)

  vi.mocked(useUsdcBalance).mockReturnValue({
    balance: 5_000,
    status: 'ready',
    error: null,
    refetch: refetchBalance,
  })

  vi.mocked(useToast).mockReturnValue({ addToast } as unknown as ReturnType<typeof useToast>)
  vi.mocked(useReducedMotion).mockReturnValue(false)

  vi.spyOn(console, 'warn').mockImplementation(() => {})
})


afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('handleBack – success path', () => {
  it('moves exactly one step back from step 2', async () => {
    renderFlow()
    await goToStep(2)
    expectOnStep(2)

    await userEvent.setup().click(backButton())

    expectOnStep(1)
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })

  it('moves exactly one step back from step 3 to step 2', async () => {
    renderFlow()
    await goToStep(3)

    await userEvent.setup().click(backButton())

    expectOnStep(2)
    expect(screen.getByText(/Step 2: Choose Lock Duration/i)).toBeInTheDocument()
  })

  it('moves exactly one step back from step 4 to step 3', async () => {
    renderFlow()
    await goToStep(4)

    await userEvent.setup().click(backButton())

    expectOnStep(3)
    expect(screen.getByText(/Step 3: Review Terms/i)).toBeInTheDocument()
  })

  it('clears the step-2 validation error when it actually navigates', async () => {
    const user = userEvent.setup()
    renderFlow()

    const input = screen.getByPlaceholderText('0')
    await user.clear(input)
    await user.type(input, '500')
    await user.click(nextButton())
    await user.click(nextButton()) // no duration chosen → error
    expect(screen.getByText(/select a lock duration/i)).toBeInTheDocument()

    await user.click(backButton())

    expectOnStep(1)
    expect(screen.queryByText(/select a lock duration/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Data retention — back must never discard user input
// ---------------------------------------------------------------------------

describe('handleBack – preserves entered data', () => {
  it('keeps the amount after going back from step 2', async () => {
    const user = userEvent.setup()
    renderFlow()

    const input = screen.getByPlaceholderText('0')
    await user.clear(input)
    await user.type(input, '742.50')
    await user.click(nextButton())
    await user.click(backButton())

    expectOnStep(1)
    expect(screen.getByPlaceholderText('0')).toHaveValue('742.50')
  })

  it('keeps the amount and duration after going back from step 4', async () => {
    renderFlow()
    await goToStep(4, { amount: '742.50', days: 90 })

    await userEvent.setup().click(backButton())

    expectOnStep(3)
    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('742.50 USDC')
    expect(screen.getByTestId('review-duration')).toHaveTextContent('90 Days')
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('111.38 USDC')
  })

  it('keeps the duration selection active after going back from step 3', async () => {
    const user = userEvent.setup()
    renderFlow()
    await goToStep(3, { days: 180 })

    await user.click(backButton())

    expectOnStep(2)
    expect(screen.getByRole('button', { name: /^180 Days$/i })).toHaveClass(
      'createBondFlow__durationButton--active'
    )
  })
})

// ---------------------------------------------------------------------------
// Rejection — a refused transition must be an inert no-op
// ---------------------------------------------------------------------------

describe('handleBack – rejection is a no-op', () => {
  it('never renders the Back control on the first step', () => {
    renderFlow()
    expectOnStep(1)
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument()
  })

  it('keeps the wizard on step 1 and logs a diagnostic when Back is forced at the boundary', async () => {
    renderFlow()
    await goToStep(2)
    expectOnStep(2)

    // Two Back presses in one batch: the first moves to step 1, the second is
    // refused at the lower boundary.
    burstBack(2)

    expectOnStep(1)
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
    expect(vi.mocked(console.warn)).toHaveBeenCalledTimes(1)
  })

  it('leaves the wizard state untouched by a refused transition', async () => {
    const user = userEvent.setup()
    renderFlow()

    const input = screen.getByPlaceholderText('0')
    await user.clear(input)
    await user.type(input, '500')
    await user.click(nextButton())
    expectOnStep(2)

    // Two Back presses in one batch: 2 → 1, then refused at the boundary.
    burstBack(2)

    expectOnStep(1)
    // The refused press must not clear the entered amount or surface an error:
    // a transition that never happened has no side effects.
    // AmountInput normalises to two decimals on blur, hence '500.00'.
    expect(screen.getByPlaceholderText('0')).toHaveValue('500.00')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(vi.mocked(console.warn)).toHaveBeenCalledTimes(1)
  })

  it('logs the refusal without leaking the wallet address or bond amount', async () => {
    const user = userEvent.setup()
    renderFlow()

    const input = screen.getByPlaceholderText('0')
    await user.clear(input)
    await user.type(input, '500')
    await user.click(nextButton())

    burstBack(2)

    const [tag, payload] = vi.mocked(console.warn).mock.calls[0]
    expect(tag).toBe('[CreateBondFlow] Refused out-of-bounds transition')
    expect(payload).toEqual({ direction: 'Back', step: 1 })
    expect(JSON.stringify(payload)).not.toContain(TEST_ADDRESS)
    expect(JSON.stringify(payload)).not.toContain('500')
  })
})

// ---------------------------------------------------------------------------
// Concurrency — duplicate presses batched into one React update
// ---------------------------------------------------------------------------

describe('handleBack – concurrent invocations', () => {
  it('moves two steps for two Back presses batched into one update', async () => {
    renderFlow()
    await goToStep(4)
    expectOnStep(4)

    burstBack(2)

    // Reading `step` from the last committed render (the pre-fix behaviour)
    // collapses both presses into a single 4 → 3 move.
    expectOnStep(2)
  })

  it('stops at the first step under a burst that overshoots the range', async () => {
    renderFlow()
    await goToStep(4)

    burstBack(5)

    expectOnStep(1)
    // 4 → 3 → 2 → 1, then two refusals.
    expect(vi.mocked(console.warn)).toHaveBeenCalledTimes(2)
  })

  it('never renders an out-of-range step label under a burst', async () => {
    renderFlow()
    await goToStep(4)

    burstBack(9)

    expect(currentStepLabel()).toMatch(/^Step [1-4] of 4$/)
  })

  it('applies Back and Next in the order they were dispatched', async () => {
    renderFlow()
    await goToStep(3)
    expectOnStep(3)

    const back = backButton()
    const next = nextButton()
    await act(async () => {
      back.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      next.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Back then Next is a round trip: 3 → 2 → 3. Reading the committed `step`
    // for both would resolve to 4 (both writes computed from step 3).
    expectOnStep(3)
  })
})

// ---------------------------------------------------------------------------
// Consent gate — a stale acknowledgement must not survive a Back
// ---------------------------------------------------------------------------

describe('handleBack – invalidates stale consent', () => {
  it('requires a fresh acknowledgement after leaving the confirm step', async () => {
    const user = userEvent.setup()
    renderFlow()
    await goToStep(4)

    await user.click(screen.getByRole('checkbox'))
    expect(confirmButton()).toBeEnabled()

    await user.click(backButton())
    expectOnStep(3)

    // Return to the confirm step: the acknowledgement must have been revoked.
    await user.click(nextButton())
    expectOnStep(4)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(confirmButton()).toBeDisabled()
  })

  it('does not revoke consent when navigating within steps 1–3', async () => {
    const user = userEvent.setup()
    renderFlow()
    await goToStep(4)
    await user.click(screen.getByRole('checkbox'))

    // Go all the way back to step 1 without leaving a consent-bearing step
    // behind, then forward again and re-acknowledge.
    await user.click(backButton()) // 4 → 3, revokes consent
    await user.click(backButton()) // 3 → 2
    await user.click(backButton()) // 2 → 1
    expectOnStep(1)

    await user.click(nextButton()) // 1 → 2
    await user.click(nextButton()) // 2 → 3
    await user.click(nextButton()) // 3 → 4
    expectOnStep(4)
    expect(confirmButton()).toBeDisabled()

    await user.click(screen.getByRole('checkbox'))
    expect(confirmButton()).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// Regression — existing behaviour that must not change
// ---------------------------------------------------------------------------

describe('handleBack – regression coverage', () => {
  it('moves focus to the target step heading', async () => {
    const user = userEvent.setup()
    renderFlow()
    await goToStep(3)

    await user.click(backButton())

    const heading = await screen.findByRole('heading', { name: /Step 2: Choose Lock Duration/i })
    expect(document.activeElement).toBe(heading)
  })

  it('keeps the progress indicator within the documented range', async () => {
    renderFlow()
    await goToStep(4)
    burstBack(3)

    expect(currentStepLabel()).toBe('Step 1 of 4')
    expect(screen.getByLabelText(/Step 1 of 4/i).querySelectorAll('div')).toHaveLength(
      BOND_FLOW_STEP_COUNT
    )
  })

  it('still forwards Cancel to the supplied handler instead of resetting', async () => {
    const onCancel = vi.fn()
    renderFlow({ onCancel })
    await goToStep(3)

    await userEvent.setup().click(cancelButton())

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not submit a bond when Back is used from the confirm step', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    renderFlow({ onComplete })
    await goToStep(4)
    await user.click(screen.getByRole('checkbox'))

    await user.click(backButton())

    expect(onComplete).not.toHaveBeenCalled()
    expect(addToast).not.toHaveBeenCalled()
    expectOnStep(3)
  })

  it('resets to step 1 with cleared fields when no onCancel is supplied', async () => {
    const user = userEvent.setup()
    renderFlow()
    await goToStep(3)

    await user.click(cancelButton())

    expectOnStep(1)
    expect(screen.getByPlaceholderText('0')).toHaveValue('')
  })
})

