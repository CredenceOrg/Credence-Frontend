/**
 * @file CreateBondFlow.test.tsx
 * @description Tests for the CreateBondFlow wizard, with emphasis on:
 *   - Step 3 penalty/slash breakdown rendering (≥ 80% step-3 logic coverage)
 *   - Recomputation when the user edits amount or duration and returns
 *   - Edge cases: zero/negative amounts, large amounts, locale formatting
 *   - Navigation (next/back/cancel)
 *   - Accessibility labels and data-testid targets
 *   - Deterministic failure-boundary coverage for handleNext
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import CreateBondFlow from './CreateBondFlow'
import { useReducedMotion } from '../hooks/useReducedMotion'

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

afterEach(() => {
  vi.clearAllMocks()
})

// -----------------------------------------------------------------------------
// Wallet context mock — mutable so failure-boundary tests can flip connection
// state and verify handleNext refuses to advance without losing user data.
// -----------------------------------------------------------------------------

const walletState = {
  isConnected: true,
  address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA' as string | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnecting: false,
  error: null as string | null,
  network: 'public',
  reauth: vi.fn(),
  isReauthRequired: vi.fn(() => false),
}

vi.mock('../context/WalletContext', () => ({
  useWallet: () => walletState,
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

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

beforeEach(() => {
  // Reset mutable wallet mock to a known-good baseline between tests.
  walletState.isConnected = true
  walletState.address = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA' ;
  walletState.error = null
  walletState.network = 'public'
  walletState.isReauthRequired = vi.fn(() => false)
})

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

// -----------------------------------------------------------------------------
// Unit tests: computeBondSlashBreakdown (imported via lib)
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Integration tests: CreateBondFlow UI
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// a11y: focus moves to the step heading on advance/back
// -----------------------------------------------------------------------------

describe('CreateBondFlow – focus management', () => {
  it('focuses the step 1 heading on initial render', async () => {
    renderFlow()
    // useEffect fires after render; wait for the heading to receive focus
    const heading = await screen.findByRole('heading', { name: /Step 1: Enter Bond Amount/i })
    expect(document.activeElement).toBe(heading)
  })

  it('moves focus to the step 2 heading when advancing from step 1', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    const heading = await screen.findByRole('heading', { name: /Step 2: Choose Lock Duration/i })
    expect(document.activeElement).toBe(heading)
  })

  it('moves focus to the step 3 heading when advancing from step 2', async () => {
    await reachStep3('1000', 30)
    const heading = await screen.findByRole('heading', { name: /Step 3: Review Terms/i })
    expect(document.activeElement).toBe(heading)
  })

  it('moves focus to the step 4 heading when advancing from step 3', async () => {
    await reachStep3('1000', 30)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    const heading = await screen.findByRole('heading', { name: /Step 4: Confirm Bond/i })
    expect(document.activeElement).toBe(heading)
  })

  it('moves focus back to the step 1 heading when going back from step 2', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    const heading = await screen.findByRole('heading', { name: /Step 1: Enter Bond Amount/i })
    expect(document.activeElement).toBe(heading)
  })
})

// -----------------------------------------------------------------------------
// Step 3 – core requirements
// -----------------------------------------------------------------------------

describe('CreateBondFlow – step 3 review', () => {
  it('renders the step 3 heading', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByText(/Step 3: Review Terms/i)).toBeInTheDocument()
  })

  it('shows bond amount row', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('1,000 USDC')
  })

  it('shows duration row', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-duration')).toHaveTextContent('30 Days')
  })

  it('shows an estimated unlock date', async () => {
    await reachStep3('1000', 30)
    const unlockDate = screen.getByTestId('review-unlock-date')
    // Should contain a year (not empty)
    expect(unlockDate.textContent).toMatch(/\d/{4}/)
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
  })

  it('shows 10% penalty for 180-day bond of 1000 USDC', async () => {
    await reachStep3('1000', 180)
    expect(screen.getByText(/slash penalty \(10%\)/i)).toBeInTheDocument()
  })

  it('recomputes penalty when the user edits the amount and returns', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('200 USDC')

    // Go back to step 1 and edit the amount.
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    const amountInput = screen.getByPlaceholderText('0')
    const user = userEvent.setup()
    await user.clear(amountInput)
    await user.type(amountInput, '2000')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('2,000 USDC')
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('400 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('1,600 USDC')
  })

  it('recomputes penalty when the user changes the duration and returns', async () => {
    await reachStep3('1000', 30)
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('200 USDC')

    // Go back to step 2 and choose a different duration.
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.click(screen.getByRole('button', { name: /90 Days/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByTestId('review-duration')).toHaveTextContent('90 Days')
    expect(screen.getByTestId('review-penalty-amount')).toHaveTextContent('150 USDC')
    expect(screen.getByTestId('review-resulting-balance')).toHaveTextContent('850 USDC')
  })
})

// -----------------------------------------------------------------------------
// Failure boundaries for handleNext
//
// These tests pin down the deterministic contract of handleNext:
//   1. Invalid input never advances the step and never drops entered data.
//   2. Repeated / concurrent invocations are idempotent (double-click safety).
//   3. Wallet disconnection blocks advancement without losing form state.
//   4. Boundary amounts (tiny, huge, negative, malformed) are rejected or accepted
//      deterministically.
// -----------------------------------------------------------------------------

describe('CreateBondFlow – handleNext failure boundaries', () => {
  it('rejects a negative amount and keeps the user on step 1', async () => {
    const user = userEvent.setup()
    renderFlow()
    const input = screen.getByPlaceholderText('0')
    await user.type(input, '-100')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText(/valid amount greater than 0/i)).toBeInTheDocument()
    // Still on step 1 — no silent advance.
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
    // User data is preserved for correction.
    expect(input).toHaveValue('-100')
  })

  it('rejects a non-numeric amount and keeps the user on step 1', async () => {
    const user = userEvent.setup()
    renderFlow()
    const input = screen.getByPlaceholderText('0')
    await user.type(input, 'abc')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText(/valid amount greater than 0/t)).toBeInTheDocument()
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })

  it('rejects whitespace-only amount and keeps the user on step 1', async () => {
    const user = userEvent.setup()
    renderFlow()
    const input = screen.getByPlaceholderText('0')
    await user.type(input, '   ')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText(/valid amount greater than 0/t)).toBeInTheDocument()
    expect(screen.getByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })

  it('accepts a tiny but valid amount (0.01) and advances to step 2', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '0.01')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/Step 2: Choose Lock Duration/i)).toBeInTheDocument()
  })

  it('accepts a large amount and advances to step 2', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '1000000')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/Step 2: Choose Lock Duration/i)).toBeInTheDocument()
  })

  it('is idempotent under double-click on next from step 1', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    const next = screen.getByRole('button', { name: /next/i })
    fireEvent.click(next)
    fireEvent.click(next)

    // Exactly one step 2 heading — no double advance.
    expect(screen.getAllByText(/Step 2: Choose Lock Duration/i)).toHaveLength(1)
    expect(screen.queryByText(/Step 3: Review Terms/i)).not.toBeInTheDocument()
  })

  it('is idempotent under double-click on next from step 2', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /30 Days/i }))
    const next = screen.getByRole('button', { name: /next/i })
    fireEvent.click(next)
    fireEvent.click(next)

    // Exactly one step 3 heading — no double advance to step 4.
    expect(screen.getAllByText(/Step 3: Review Terms/i)).toHaveLength(1)
    expect(screen.queryByText(/Step 4: Confirm Bond/i)).not.toBeInTheDocument()
  })

  it('blocks advancement when the wallet disconnects and preserves entered amount', async () => {
    const user = userEvent.setup()
    renderFlow()
    const input = screen.getByPlaceholderText('0')
    await user.type(input, '500')

    // Simulate a disconnect midway through the flow.
    walletState.isConnected = false
    walletState.address = null

    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // The flow must not silently advance with a stale wallet state.
    expect(screen.queryByText(/Step 2: Choose Lock Duration/i)).not.toBeInTheDocument()
    // User data is preserved for recovery after reconnect.
    expect(input).toHaveValue('500')
  })

  it('recovers deterministically after wallet reconnection', async () => {
    const user = userEvent.setup()
    renderFlow()
    const input = screen.getByPlaceholderText('0')
    await user.type(input, '500')

    walletState.isConnected = false
    walletState.address = null
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.queryByText(/Step 2: Choose Lock Duration/i)).not.toBeInTheDocument()

    // Reconnect and retry: the same input now advances exactly once.
    walletState.isConnected = true
    walletState.address = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getAllByText(/Step 2: Choose Lock Duration/i)).toHaveLength(1)
  })

  it('rejects advancing from step 2 without a duration and preserves amount', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '500')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText(/select a lock duration/i)).toBeInTheDocument()
    // Still on step 2.
    expect(screen.getByText(/Step 2: Choose Lock Duration/i)).toBeInTheDocument()

    // Going back reveals the original amount was preserved.
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByPlaceholderText('0')).toHaveValue('500')
  })

  it('does not advance past step 4 on repeated next', async () => {
    await reachStep3('1000', 30)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(/Step 4: Confirm Bond/i)).toBeInTheDocument()

    // Step 4 is terminal for handleNext; repeated clicks must not corrupt state.
    const next = screen.queryByRole('button', { name: /^Next$/i })
    if (next) {
      fireEvent.click(next)
      fireEvent.click(next)
    }
    expect(screen.getAllByText(/Step 4: Confirm Bond/i)).toHaveLength(1)
  })

  it('preserves entered data across a full back/forward cycle', async () => {
    await reachStep3('1234.56', 90)
    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('1,234.56 USDC')

    // Back to step 1, then forward again without editing.
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.click(screen.getByTole('button', { name: /back/i }))
    expect(screen.getByPlaceholderText('0')).toHaveValue('1234.56')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('1,234.56 USDC')
    expect(screen.getByTestId('review-duration')).toHaveTextContent('90 Days')
  })

  it('exposes a user-visible error without leaking wallet address on rejection', async () => {
    const user = userEvent.setup()
    renderFlow()
    await user.type(screen.getByPlaceholderText('0'), '0')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    const error = screen.getByText(/valid amount greater than 0/t)
    expect(error).toBeInTheDocument()
    // Error message must not leak the wallet address.
    expect(error.textContent).not.toMatch(/GAAZI4TCR3TY5OJHCTJC/)
  })
})
