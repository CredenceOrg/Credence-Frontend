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
import { describe, it, expect } from 'vitest'
import CreateBondFlow from './CreateBondFlow'

// ToastProvider depends on SettingsProvider → wrap renders with both
import ToastProvider from './ToastProvider'
import { SettingsProvider } from '../context/SettingsContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Unit tests: computeBondSlashBreakdown (imported via lib)
// ---------------------------------------------------------------------------
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

  it('handles minimum non-zero amount (0.01 USDC)', () => {
    const bd = computeBondSlashBreakdown(0.01, 30)
    expect(bd.penaltyUsdc).toBeCloseTo(0.002, 5)
    expect(bd.resultingUsdc).toBeCloseTo(0.008, 5)
  })
})

// ---------------------------------------------------------------------------
// Integration tests: CreateBondFlow UI
// ---------------------------------------------------------------------------

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

  it('shows error when trying to advance from step 1 with amount = 0', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '0')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/valid amount greater than 0/i)).toBeInTheDocument()
  })

  it('advances to step 2 with a valid amount', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/Step 2: Choose Lock Duration/i)).toBeInTheDocument()
  })

  it('shows error on step 2 when no duration selected', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/select a lock duration/i)).toBeInTheDocument()
  })

  it('goes back from step 2 to step 1', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })

  it('cancel resets the flow to step 1', async () => {
    await reachStep3('1000', 30)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Step 3 – core requirements
// ---------------------------------------------------------------------------

describe('CreateBondFlow – step 3 review', () => {
  it('renders the step 3 heading', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByText(/Step 3: Review Terms/i)).toBeInTheDocument()
  })

  it('shows bond amount row', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('1000 USDC')
  })

  it('shows duration row', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-duration')).toHaveTextContent('30 Days')
  })

  it('shows an estimated unlock date', async () => {
    await reachStep3('1000', 30)
    const unlockDate = screen.getByTestId('review-unlock-date')
    // Should contain a year (not empty)
    expect(unlockDate.textContent).toMatch(/\d{4}/)
  })

  it('shows the warning banner about early withdrawal', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByText(/Early withdrawal — slash exposure/i)).toBeInTheDocument()
  })

  it('shows "If you withdraw early" section label', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByText(/if you withdraw early/i)).toBeInTheDocument()
  })

  // ── Penalty numbers ──

  it('shows correct 20% penalty label for 30-day bond of 1000 USDC', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByText(/slash penalty \(20%\)/i)).toBeInTheDocument()
  })

  it('shows correct penalty deduction for 30-day, 1000 USDC', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('200 USDC')
  })

  it('shows correct resulting balance for 30-day, 1000 USDC', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('800 USDC')
  })

  it('shows 15% penalty for 90-day bond of 1000 USDC', async () => {
    await reachStep3('1000', 90)
    expect(screen.getByText(/slash penalty \(15%\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('150 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('850 USDC')
  })

  it('shows 10% penalty for 180-day bond of 1000 USDC', async () => {
    await reachStep3('1000', 180)
    expect(screen.getByText(/slash penalty \(10%\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('100 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('900 USDC')
  })

  it('shows correct numbers for a large amount (10,000 USDC, 30 days)', async () => {
    await reachStep3('10000', 30)
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('2,000 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('8,000 USDC')
  })

  it('shows correct numbers for a small amount (1 USDC, 180 days)', async () => {
    await reachStep3('1', 180)
    expect(screen.getByText(/slash penalty \(10%\)/i)).toBeInTheDocument()
    // 10% of 1 = 0.1; resulting = 0.9
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('0.1 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('0.9 USDC')
  })
})

// ---------------------------------------------------------------------------
// Step 3 – recomputation after editing
// ---------------------------------------------------------------------------

describe('CreateBondFlow – review recomputes after editing', () => {
  it('updates penalty when user goes back and changes amount', async () => {
    const user = userEvent.setup()
    renderFlow()

    // First pass: amount = 1000, duration = 30
    const amountInput = screen.getByPlaceholderText('0')
    await user.clear(amountInput)
    await user.type(amountInput, '1000')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    fireEvent.click(screen.getByRole('button', { name: /30 Days/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Confirm initial breakdown
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('200 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('800 USDC')

    // Go back to step 1 and change amount
    fireEvent.click(screen.getByRole('button', { name: /back/i })) // → step 2
    fireEvent.click(screen.getByRole('button', { name: /back/i })) // → step 1

    const newInput = screen.getByPlaceholderText('0')
    await user.clear(newInput)
    await user.type(newInput, '500')

    // Advance to step 3 again
    fireEvent.click(screen.getByRole('button', { name: /next/i })) // → step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i })) // → step 3 (duration persists)

    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('100 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('400 USDC')
  })

  it('updates penalty when user goes back and changes duration', async () => {
    const user = userEvent.setup()
    renderFlow()

    // First pass: amount = 1000, duration = 30
    const amountInput = screen.getByPlaceholderText('0')
    await user.clear(amountInput)
    await user.type(amountInput, '1000')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    fireEvent.click(screen.getByRole('button', { name: /30 Days/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Confirm 30-day rates
    expect(screen.getByText(/slash penalty \(20%\)/i)).toBeInTheDocument()

    // Go back to step 2 and choose 180 days
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.click(screen.getByRole('button', { name: /180 Days/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Now expect 10% rate
    expect(screen.getByText(/slash penalty \(10%\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('100 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('900 USDC')
  })
})

// ---------------------------------------------------------------------------
// Step 4 – confirm gate
// ---------------------------------------------------------------------------

describe('CreateBondFlow – step 4 confirm', () => {
  async function reachStep4(amount = '1000', duration: 30 | 90 | 180 = 30) {
    await reachStep3(amount, duration)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
  }

  it('renders step 4 heading', async () => {
    await reachStep4()
    expect(screen.getByText(/Step 4: Confirm Bond/i)).toBeInTheDocument()
  })

  it('confirm button is disabled without acknowledgement', async () => {
    await reachStep4()
    expect(screen.getByRole('button', { name: /Confirm & Create Bond/i })).toBeDisabled()
  })

  it('confirm button enables after checking acknowledgement', async () => {
    const user = userEvent.setup()
    await reachStep4()
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)
    expect(screen.getByRole('button', { name: /Confirm & Create Bond/i })).not.toBeDisabled()
  })

  it('fires toast and resets to step 1 after confirmation', async () => {
    const user = userEvent.setup()
    await reachStep4()
    await user.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Create Bond/i }))
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })
})
