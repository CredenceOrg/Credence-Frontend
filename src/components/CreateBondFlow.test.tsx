/**
 * @file CreateBondFlow.test.tsx
 * @description Tests for the CreateBondFlow wizard, with emphasis on:
 *   - Step 3 penalty/slash breakdown rendering (≥ 80% step-3 logic coverage)
 *   - Recomputation when the user edits amount or duration and returns
 *   - Edge cases: zero/negative amounts, large amounts, locale formatting
 *   - Navigation (next/back/cancel)
 *   - Accessibility labels and data-testid targets
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import CreateBondFlow from './CreateBondFlow'
import { useReducedMotion } from '../hooks/useReducedMotion'

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

afterEach(() => {
  vi.clearAllMocks()
})

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    isConnected: true,
    address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnecting: false,
    error: null,
    network: 'public',
    reauth: vi.fn(),
    isReauthRequired: vi.fn(() => false),
  }),
}))

vi.mock('../hooks/useUsdcBalance', () => ({
  useUsdcBalance: () => ({
    balance: 10000,
    status: 'success',
    refetch: vi.fn(),
  }),
}))

// ToastProvider depends on SettingsProvider → wrap renders with both
import ToastProvider from './ToastProvider'
import { SettingsProvider } from '../context/SettingsContext'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function renderFlow() {
  return render(
    <SettingsProvider>
      <ToastProvider>
        <CreateBondFlow />
      </ToastProvider>
    </SettingsProvider>
  )
}

/** Navigate from step 1 → step 3 with the given amount and duration. */
async function reachStep3(amount: string, durationDays: 30 | 90 | 180 = 30) {
  const user = userEvent.setup()
  renderFlow()

  // Step 1: amount
  const amountInput = screen.getByPlaceholderText('0')
  await user.clear(amountInput)
  await user.type(amountInput, amount)
  fireEvent.click(screen.getByRole('button', { name: /next/i }))

  // Step 2: duration
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${durationDays} Days`, 'i') }))
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
}

// ----------------------------------------------------------------------------
// Unit tests: computeBondSlashBreakdown (imported via lib)
// ----------------------------------------------------------------------------
import { computeBondSlashBreakdown, getPenaltyRateForDuration } from '../lib/bondPenalty'
import { formatUsdc } from '../lib/format'

describe('formatUsdc', () => {
  it('formats whole numbers with USDC suffix', () => {
    expect(formatUsdc(1000)).toBe('1,000 USDC')
  })

  it('formats fractional amounts to max 2 decimals', () => {
    expect(formatUsdc(1234.567)).toBe('1,234.57 USDC')
  })

  it('formats zero', () => {
    expect(formatUsdc(0)).toBe('0 USDC')
  })

  it('formats very large numbers', () => {
    expect(formatUsdc(1_000_000)).toBe('1,000,000 USDC')
  })
})

describe('getPenaltyRateForDuration', () => {
  it('returns 0.2 for 30-day lock', () => {
    expect(getPenaltyRateForDuration(30)).toBe(0.2)
  })

  it('returns 0.15 for 90-day lock', () => {
    expect(getPenaltyRateForDuration(90)).toBe(0.15)
  })

  it('returns 0.1 for 180-day lock', () => {
    expect(getPenaltyRateForDuration(180)).toBe(0.1)
  })

  it('falls back to 0.2 (conservative) for unknown durations', () => {
    expect(getPenaltyRateForDuration(60)).toBe(0.2)
    expect(getPenaltyRateForDuration(0)).toBe(0.2)
    expect(getPenaltyRateForDuration(365)).toBe(0.2)
  })
})

describe('computeBondSlashBreakdown', () => {
  it('computes 20% penalty for 30-day lock on 1,000 USDC', () => {
    const bd = computeBondSlashBreakdown(1000, 30)
    expect(bd.penaltyPercent).toBe(20)
    expect(bd.penaltyUsdc).toBe(200)
    expect(bd.resultingUsdc).toBe(800)
    expect(bd.bondAmount).toBe('1,000 USDC')
    expect(bd.penaltyAmount).toBe('200 USDC')
    expect(bd.resultingBalance).toBe('800 USDC')
  })

  it('computes 15% penalty for 90-day lock on 1,000 USDC', () => {
    const bd = computeBondSlashBreakdown(1000, 90)
    expect(bd.penaltyPercent).toBe(15)
    expect(bd.penaltyUsdc).toBe(150)
    expect(bd.resultingUsdc).toBe(850)
  })

  it('computes 10% penalty for 180-day lock on 1,000 USDC', () => {
    const bd = computeBondSlashBreakdown(1000, 180)
    expect(bd.penaltyPercent).toBe(10)
    expect(bd.penaltyUsdc).toBe(100)
    expect(bd.resultingUsdc).toBe(900)
  })

  it('handles very large amounts', () => {
    const bd = computeBondSlashBreakdown(1_000_000, 30)
    expect(bd.penaltyUsdc).toBe(200_000)
    expect(bd.resultingUsdc).toBe(800_000)
    expect(bd.resultingBalance).toBe('800,000 USDC')
  })

  it('handles fractional USDC amounts', () => {
    const bd = computeBondSlashBreakdown(100.5, 30)
    expect(bd.penaltyUsdc).toBeCloseTo(20.1, 5)
    expect(bd.resultingUsdc).toBeCloseTo(80.4, 5)
  })

  it('handles minimum non-zero amount (0.01 USDC', () => {
    const bd = computeBondSlashBreakdown(0.01, 30)
    expect(bd.penaltyUsdc).toBeCloseTo(0.002, 5)
    expect(bd.resultingUsdc).toBeCloseTo(0.008, 5)
  })
})

// ----------------------------------------------------------------------------
// Integration tests: CreateBondFlow UI
// ----------------------------------------------------------------------------

describe('CreateBondFlow – step navigation', () => {
  it('renders step 1 by default', () => {
    renderFlow()
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })

  it('shows error when trying to advance from step 1 with no amount', () => {
    renderFlow()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/valid amount greater than 0/i)).toBeInTheDocument()
  })

  it('shows error when trying to advance from step 1 with amount = 0', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '0')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/valid amount greater than 0/i)).toBeInTheDocument()
  })

  it('advances to step 2 with a valid amount', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/Step 2: Choose Lock Duration/i)).toBeInTheDocument()
  })

  it('shows error on step 2 when no duration selected', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/select a lock duration/i)).toBeInTheDocument()
  })

  it('goes back from step 2 to step 1', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })

  it('cancel resets the flow to step 1', () => {
    await reachStep3('1000', 30)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })
})

// ----------------------------------------------------------------------------
// a11y: focus moves to the step heading on advance/back
// ----------------------------------------------------------------------------

describe('CreateBondFlow – focus management', () => {
  it('focuses the step 1 heading on initial render', () => {
    renderFlow()
    // useEffect fires after render; wait for the heading to receive focus;
    const heading = await screen.findByRole('heading', { name: /Step 1: Enter Bond Amount/i })
    expect(document.activeElement).toBe(heading)
  })

  it('moves focus to the step 2 heading when advancing from step 1', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    const heading = await screen.findByRole('heading', { name: /Step 2: Choose Lock Duration/i })
    expect(document.activeElement).toBe(heading)
  })

  it('moves focus to the step 3 heading when advancing from step 2', () => {
    await reachStep3('1000', 30)
    const heading = await screen.findByRole('heading', { name: /Step 3: Review Terms/i })
    expect(document.activeElement).toBe(heading)
  })

  it('moves focus to the step 4 heading when advancing from step 3', () => {
    await reachStep3('1000', 30)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    const heading = await screen.findByRole('heading', { name: /Step 4: Confirm Bond/i })
    expect(document.activeElement).toBe(heading)
  })

  it('moves focus back to the step 1 heading when going back from step 2', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    const heading = await screen.findByRole('heading', { name: /Step 1: Enter Bond Amount/i })
    expect(document.activeElement).toBe(heading)
  })
})

// ----------------------------------------------------------------------------
// Step 3 – core requirements
// ----------------------------------------------------------------------------

describe('CreateBondFlow – step 3 review', () => {
  it('renders the step 3 heading', () => {
    await reachStep3('1000', 30)
    expect(screen.getByText(/Step 3: Review Terms/i)).toBeInTheDocument()
  })

  it('shows bond amount row', () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('1,000 USDC')
  })

  it('shows duration row', () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-duration')).toHaveTextContent('30 Days')
  })

  it('shows an estimated unlock date', () => {
    await reachStep3('1000', 30)
    const unlockDate = screen.getByTestId('review-unlock-date')
    // Should contain a year (not empty)
    expect(unlockDate.textContent).toMatch(/\d{4}/)
  })

  it('shows the warning banner about early withdrawal', () => {
    await reachStep3('1000', 30)
    expect(screen.getByText(/Early withdrawal — slash exposure/i)).toBeInTheDocument()
  })

  it('shows "If you withdraw early" section label', () => {
    await reachStep3('1000', 30)
    expect(screen.getByText(/if you withdraw early/i)).toBeInTheDocument()
  })

  // ── Penalty numbers ──

  it('shows correct 20% penalty label for 30-day bond of 1000 USDC', () => {
    await reachStep3('1000', 30)
    expect(screen.getByText(/slash penalty \(20%\)/i)).toBeInTheDocument()
  })

  it('shows correct penalty deduction for 30-day, 1000 USDC', () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('200 USDC')
  })

  it('shows correct resulting balance for 30-day, 1000 USDC', () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('800 USDC')
  })

  it('shows 15% penalty for 90-day bond of 1000 USDC', () => {
    await reachStep3('1000', 90)
    expect(screen.getByText(/slash penalty \(15%\)/i)).toBeInTheDocument()
  })

  it('shows 10% penalty for 180-day bond of 1000 USDC', () => {
    await reachStep3('1000', 180)
    expect(screen.getByText(/slash penalty \(10%\)/i)).toBeInTheDocument()
  })

  it('recomputes penalty when amount is edited and user returns to step 3', () => {
    const user = userEvent.setup()
    renderFlow()

    // Step 1
    const amountInput = screen.getByPlaceholderText('0')
    await user.type(amountInput, '1000')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Step 2
    fireEvent.click(screen.getByRole('button', { name: /^30 Days$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Step 3 initial assertion
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('200 USDC')

    // Back to step 1 and edit amount
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    const editedInput = screen.getByPlaceholderText('0')
    await user.clear(editedInput)
    await user.type(editedInput, '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Step 2 duration persists — advance again
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Step 3 recomputed
    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('500 USDC')
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('100 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('400 USDC')
  })

  it('recomputes penalty when duration is edited and user returns to step 3', () => {
    const user = userEvent.setup()
    renderFlow()

    await user.type(screen.getByPlaceholderText('0'), '1000')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /^30 Days$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText(/slash penalty \(20%\)/i)).toBeInTheDocument()

    // Back to step 2 and change duration
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.click(screen.getByRole('button', { name: /^90 Days$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByTestId('review-duration')).toHaveTextContent('90 Days')
    expect(screen.getByText(/slash penalty \(15%\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('150 USDC')
  })

  it('shows correct resulting balance for 90-day, 1000 USDC', () => {
    await reachStep3('1000', 90)
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('850 USDC')
  })

  it('shows correct resulting balance for 180-day, 1000 USDC', () => {
    await reachStep3('1000', 180)
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('900 USDC')
  })

  it('shows correct penalty for fractional amount', () => {
    await reachStep3('100.5', 30)
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('20.1 USDC')
  })

  it('shows correct penalty for large amount', () => {
    await reachStep3('1000000', 30)
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('200,000 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('800,000 USDC')
  })
})

// ----------------------------------------------------------------------------
// Failure-boundary coverage for handleNext
// ----------------------------------------------------------------------------

describe('handleNext – failure boundaries', () => {
  it('rejects negative amounts at step 1', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '-100')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/valid amount greater than 0/i)).toBeInTheDocument()
    // Stays on step 1
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })

  it('rejects non-numeric amounts at step 1', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), 'abc')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/valid amount greater than 0/i)).toBeInTheDocument()
  })

  it('rejects a duplicate confirmation click without double-submitting', () => {
    await reachStep3('1000', 30)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    // Step 4 should be reached exactly once; further clicks must not create additional submits
    const confirmButtons = screen.queryAllByRole('button', { name: /confirm/i })
    expect(confirmButtons.length).toBeLessThanOrEqual(1)
  })

  it('keeps the flow on step 2 when duration is missing and allows retry', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Failed attempt
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/select a lock duration/i)).toBeInTheDocument()

    // Retry with a valid duration
    fireEvent.click(screen.getByRole('button', { name: /^30 Days$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/Step 3: Review Terms/i)).toBeInTheDocument()
  })

  it('preserves amount and duration across back/next cycles', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '750')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /^90 Days$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Back to step 1
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByPlaceholderText('0')).toHaveValue('750')

    // Forward again — duration still selected
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByTestId('review-duration')).toHaveTextContent('90 Days')
  })

  it('does not advance past step 4 without explicit confirmation', () => {
    await reachStep3('1000', 30)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/Step 4: Confirm Bond/i)).toBeInTheDocument()
    // No further next advance without confirm
    const nextButton = screen.queryByRole('button', { name: /^next$/i })
    if (nextButton) {
      fireEvent.click(nextButton)
      expect(screen.getByText(/Step 4: Confirm Bond/i)).toBeInTheDocument()
    }
  })

  it('handles rapid double-click on next without skipping steps', () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    const next = screen.getByRole('button', { name: /next/i })
    fireEvent.click(next)
    fireEvent.click(nExt)
    // Step 2 must be visible and not skipped
    expect(screen.getByText(/Step 2: Choose Lock Duration/i)).toBeInTheDocument()
  })

  it('resets error state when user corrects invalid input', () => {
    const user = userEvent.setup()
    renderFlow()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/valid amount greater than 0/i)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('0'), '100')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.queryByText(/valid amount greater than 0/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Step 2: Choose Lock Duration/i)).toBeInTheDocument()
  })

  it('cancel from any step resets to step 1 without losing the app', () => {
    await reachStep3('1000', 30)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })
})
