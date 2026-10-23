import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Profiler } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_IDS } from '../config/testIds'
import Transactions from './Transactions'
import { apiFetch, ApiError } from '../api/client'
import type { Transaction } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const apiFetchMock = vi.mocked(apiFetch)

vi.mock('../hooks/useDocumentTitle', () => ({
  useDocumentTitle: () => undefined,
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ network: 'public' }),
}))

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../lib/transactionsExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/transactionsExport')>()
  return {
    ...actual,
    downloadCsv: vi.fn(),
  }
})

const TX_BASE = {
  type: 'bond_create',
  amountUsdc: 1000,
  status: 'confirmed',
  timestamp: '2026-01-15T12:00:00Z',
} as const

const TX1: Transaction = { id: 'tx-1', ...TX_BASE }
const TX2: Transaction = {
  id: 'tx-2',
  type: 'withdraw',
  amountUsdc: null,
  status: 'failed',
  timestamp: '2026-01-16T08:30:00Z',
}
const TX3: Transaction = {
  id: 'tx-3',
  type: 'attest',
  amountUsdc: 250,
  status: 'pending',
  timestamp: '2026-01-17T09:45:00Z',
}

describe('Transactions render loop regression (issue #1377)', () => {
  beforeEach(() => {
    localStorage.clear()
    apiFetchMock.mockReset()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a bounded number of times and settles with 0 commits after 200 ms', async () => {
    apiFetchMock.mockResolvedValue({
      items: [TX1, TX2, TX3],
      nextCursor: undefined,
    })

    let commitCount = 0
    render(
      <Profiler
        id="transactions"
        onRender={() => {
          commitCount++
        }}
      >
        <Transactions />
      </Profiler>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Select transaction tx-1')).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    const settledCommits = commitCount
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(commitCount - settledCommits).toBe(0)
  })

  it('clicking the checkbox for tx #2 leaves it checked, the bulk bar loses hidden, and it reads "1 selected"', async () => {
    const user = userEvent.setup()
    apiFetchMock.mockResolvedValue({
      items: [TX1, TX2, TX3],
      nextCursor: undefined,
    })

    render(<Transactions />)

    await waitFor(() => {
      expect(screen.getByLabelText('Select transaction tx-2')).toBeInTheDocument()
    })

    const checkbox2 = screen.getByLabelText('Select transaction tx-2') as HTMLInputElement
    expect(checkbox2.checked).toBe(false)

    await user.click(checkbox2)

    expect(checkbox2.checked).toBe(true)
    const bulkBar = screen.getByTestId(TEST_IDS.TX_BULK_ACTIONS_BAR)
    expect(bulkBar).not.toHaveAttribute('hidden')
    expect(bulkBar).toHaveTextContent('1 selected')
  })

  it('clicking "Try again" (refetch) clears an existing selection exactly once', async () => {
    const user = userEvent.setup()
    apiFetchMock.mockResolvedValueOnce({
      items: [TX1, TX2, TX3],
      nextCursor: 'cursor-page-2',
    })

    render(<Transactions />)

    await waitFor(() => {
      expect(screen.getByLabelText('Select transaction tx-2')).toBeInTheDocument()
    })

    const checkbox2 = screen.getByLabelText('Select transaction tx-2') as HTMLInputElement
    await user.click(checkbox2)
    expect(checkbox2.checked).toBe(true)

    const bulkBar = screen.getByTestId(TEST_IDS.TX_BULK_ACTIONS_BAR)
    expect(bulkBar).not.toHaveAttribute('hidden')
    expect(bulkBar).toHaveTextContent('1 selected')

    // Navigate to next page with failure to surface the ErrorState "Try again" action
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, 'Page 2 load failure'))
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    const tryAgainButton = await screen.findByRole('button', { name: /try again/i })

    // Provide successful recovery payload for refetch
    apiFetchMock.mockResolvedValueOnce({
      items: [TX1, TX2, TX3],
      nextCursor: undefined,
    })

    await user.click(tryAgainButton)

    await waitFor(() => {
      expect(screen.getByLabelText('Select transaction tx-2')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
    })

    const reloadedCheckbox2 = screen.getByLabelText('Select transaction tx-2') as HTMLInputElement
    expect(reloadedCheckbox2.checked).toBe(false)
    const reloadedBulkBar = screen.getByTestId(TEST_IDS.TX_BULK_ACTIONS_BAR)
    expect(reloadedBulkBar).toHaveAttribute('hidden')
  })
})
