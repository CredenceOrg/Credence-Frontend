import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import { render as rtlRender, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_IDS } from '../config/testIds'
import i18n from '../i18n/config'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_IDS } from '../config/testIds'
import { ApiRateLimitError } from '../api/client'
import Transactions from './Transactions'
import type { Transaction } from '../api/types'
import type { TransactionWithNetwork } from '../lib/pendingTransactionsStorage'

// ── Mocks ───────────────────────────────────────────────────────────
const mockUseTransactions = vi.fn()
const mockFetchTransactionsPage = vi.fn()
vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => mockUseTransactions(),
  fetchTransactionsPage: (...args: unknown[]) => mockFetchTransactionsPage(...args),
  MAX_PAGES: 1000,
}))

const mockUseWallet = vi.fn()
vi.mock('../context/WalletContext', () => ({
  useWallet: () => mockUseWallet(),
}))

// Avoid PPR side-effects on the document title by stubbing the hook.
vi.mock('../hooks/useDocumentTitle', () => ({
  useDocumentTitle: () => undefined,
}))

// SettingsContext supplies the network used to build explorer links.
const mockUseSettings = vi.fn()
vi.mock('../context/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}))

// Stub CSV download so tests can assert on side effects without
// actually creating a real DOM anchor + downloading a blob.
const downloadCsvMock = vi.fn()
vi.mock('../lib/transactionsExport', async () => {
  const actual = await vi.importActual<typeof import('../lib/transactionsExport')>(
    '../lib/transactionsExport'
  )
  return {
    ...actual,
    downloadCsv: (...args: unknown[]) => downloadCsvMock(...args),
  }
})

// Toast context — capture calls so we can verify user feedback.
const addToastMock = vi.fn()
vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}))

// Stub the URL.createObjectURL to keep jsdom quiet; we never trigger
// a real download because downloadCsv is already mocked.
beforeEach(() => {
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => 'blob:mock-url',
      writable: true,
    })
  }
})

const TX_BASE = {
  type: 'bond',
  amountUsdc: 1000,
  status: 'confirmed',
  timestamp: '2026-01-15T12:00:00Z',
}

const TX1 = { id: 'tx-1', hash: 'hash-tx-1', ...TX_BASE } as const
const TX2 = {
  id: 'tx-2',
  hash: 'hash-tx-2',
  type: 'withdraw',
  amountUsdc: undefined,
  status: 'failed',
  timestamp: '2026-01-16T08:30:00Z',
} as const
const TX3 = {
  id: 'tx-3',
  hash: 'hash-tx-3',
  type: 'attestation',
  amountUsdc: 250,
  status: 'pending',
  timestamp: '2026-01-17T09:45:00Z',
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockLoaded(transactions: any = [TX1, TX2, TX3]) {
  mockUseTransactions.mockReturnValue({
    data: transactions,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    addPendingTransaction: vi.fn(),
    removePendingTransaction: vi.fn(),
    page: 1,
    totalPages: 1,
    hasNextPage: false,
    nextCursor: undefined,
    goToPage: vi.fn(),
    prefetchPage: vi.fn(),
  })
}

function mockLoading() {
  mockUseTransactions.mockReturnValue({
    data: [],
    isLoading: true,
    error: null,
    refetch: vi.fn(),
    addPendingTransaction: vi.fn(),
    removePendingTransaction: vi.fn(),
    page: 1,
    totalPages: 0,
    hasNextPage: true,
    nextCursor: undefined,
    goToPage: vi.fn(),
    prefetchPage: vi.fn(),
  })
}

function mockError() {
  mockUseTransactions.mockReturnValue({
    data: [],
    isLoading: false,
    error: { status: 500, message: 'Boom' },
    refetch: vi.fn(),
    addPendingTransaction: vi.fn(),
    removePendingTransaction: vi.fn(),
    page: 1,
    totalPages: 0,
    hasNextPage: false,
    nextCursor: undefined,
    goToPage: vi.fn(),
    prefetchPage: vi.fn(),
  })
}

function mockEmpty() {
  mockUseTransactions.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    addPendingTransaction: vi.fn(),
    removePendingTransaction: vi.fn(),
    page: 1,
    totalPages: 0,
    hasNextPage: false,
    nextCursor: undefined,
    goToPage: vi.fn(),
    prefetchPage: vi.fn(),
  })
}

beforeEach(() => {
  mockUseTransactions.mockReset()
  mockFetchTransactionsPage.mockReset()
  mockUseSettings.mockReset()
  mockUseWallet.mockReset()
  mockUseWallet.mockReturnValue({ address: 'GABC123', network: 'test' })
  mockUseSettings.mockReturnValue({ network: 'public' })
  addToastMock.mockReset()
  downloadCsvMock.mockReset()
  // ConfirmDialog uses requestAnimationFrame for focus transitions.
  // Stub it synchronously so focus shifts and confirm/cancel interactions
  // are deterministic across test ordering.
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0)
    return 0
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Helpers ────────────────────────────────────────────────────────
function getBulkBar(): HTMLElement {
  return screen.getByTestId(TEST_IDS.TX_BULK_ACTIONS_BAR)
}
function getSelectAll(): HTMLInputElement {
  return screen.getByTestId(TEST_IDS.TX_SELECT_ALL_CHECKBOX)
}
function getRowCheckbox(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement
}
function rowCheckboxFor(id: string): HTMLInputElement {
  return getRowCheckbox(`Select transaction ${id}`)
}

// ── Tests ──────────────────────────────────────────────────────────
describe('Transactions page', () => {
  describe('existing functionality preserved (no-selection path)', () => {
    it('renders a loading-only shell when isLoading is true', () => {
      mockLoading()
      render(<Transactions />)
      // The bar is gated on having data, so it is not in the DOM yet.
      expect(screen.queryByTestId(TEST_IDS.TX_BULK_ACTIONS_BAR)).not.toBeInTheDocument()
    })

    it('renders empty state when there are no transactions', () => {
      mockEmpty()
      render(<Transactions />)
      // EmptyState provides the "No transactions yet" copy — ensure the
      // table isn't rendered alongside it (backwards compat).
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.queryByTestId(TEST_IDS.TX_BULK_ACTIONS_BAR)).not.toBeInTheDocument()
    })

    it('renders an error state with retry when the hook reports failure', () => {
      mockError()
      render(<Transactions />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.queryByTestId(TEST_IDS.TX_BULK_ACTIONS_BAR)).not.toBeInTheDocument()
    })

    it('renders every transaction row when no selection is active', () => {
      mockLoaded()
      render(<Transactions />)
      const table = screen.getByRole('table')
      expect(within(table).getByText('bond')).toBeInTheDocument()
      expect(within(table).getByText('withdraw')).toBeInTheDocument()
      expect(within(table).getByText('attestation')).toBeInTheDocument()
      // Bulk bar renders but stays visually hidden while selection is empty.
      expect(getBulkBar().hasAttribute('hidden')).toBe(true)
      expect(within(getBulkBar()).getByText('0 selected')).toBeInTheDocument()
    })

    it('renders the table when the filter is "all" by default', () => {
      mockLoaded()
      render(<Transactions />)
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('preserves selection-free behaviour when bulk actions are inactive', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      // Bulk bar should be hidden initially.
      expect(getBulkBar().hasAttribute('hidden')).toBe(true)
      // Filter select remains usable exactly like before the feature.
      await user.selectOptions(
        screen.getByRole('combobox', { name: /filter by status/i }),
        'failed'
      )
      // Only the failed row remains visible.
      expect(screen.queryByText('bond')).not.toBeInTheDocument()
      expect(screen.getByText('withdraw')).toBeInTheDocument()
    })

    it('keeps DOM node count bounded for very large transaction lists', () => {
      const manyTransactions = Array.from({ length: 5000 }, (_, index) => ({
        id: `tx-${index}`,
        type: 'bond_create',
        amountUsdc: 1000,
        status: 'confirmed',
        timestamp: '2026-01-15T12:00:00Z',
        hash: `hash-${index}`,
      })) as unknown as Transaction[]

      mockLoaded(manyTransactions)
      render(<Transactions />)

      const rows = document.querySelectorAll('tbody tr')
      expect(rows.length).toBeLessThan(120)
      expect(screen.getByLabelText('Select transaction tx-0')).toBeInTheDocument()
      expect(screen.queryByLabelText('Select transaction tx-4999')).not.toBeInTheDocument()
    })
  })

  describe('row-level selection', () => {
    it('renders a checkbox per row', () => {
      mockLoaded()
      render(<Transactions />)
      expect(rowCheckboxFor('tx-1')).toBeInTheDocument()
      expect(rowCheckboxFor('tx-2')).toBeInTheDocument()
      expect(rowCheckboxFor('tx-3')).toBeInTheDocument()
    })

    it('toggling a row updates the bulk Actions bar count', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)

      expect(getBulkBar().hasAttribute('hidden')).toBe(true)

      await user.click(rowCheckboxFor('tx-1'))
      expect(getBulkBar().hasAttribute('hidden')).toBe(false)
      expect(within(getBulkBar()).getByText('1 selected')).toBeInTheDocument()

      await user.click(rowCheckboxFor('tx-2'))
      expect(within(getBulkBar()).getByText('2 selected')).toBeInTheDocument()
    })

    it('toggling a row twice deselects it', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      const cb = rowCheckboxFor('tx-1')
      await user.click(cb)
      await user.click(cb)
      expect(getBulkBar().hasAttribute('hidden')).toBe(true)
    })

    it('applies a selected row style on the row', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      const cb = rowCheckboxFor('tx-1')
      await user.click(cb)
      // The row exposes its selected state via class + data-selected.
      const row = cb.closest('tr')!
      expect(row.className).toContain('transactions__row--selected')
      expect(row.getAttribute('data-selected')).toBe('true')
    })
  })

  describe('localized plural counts', () => {
    beforeEach(async () => {
      i18n.addResourceBundle(
        'fr',
        'translation',
        {
          transactions: {
            bulk: {
              selected_one: '{{count}} sélectionné',
              selected_other: '{{count}} sélectionnés',
            },
          },
        },
        true,
        true
      )
      await i18n.changeLanguage('fr')
    })

    afterEach(async () => {
      cleanup()
      await i18n.changeLanguage('en')
      i18n.removeResourceBundle('fr', 'translation')
    })

    it('uses the active locale plural rules for zero, one, and many selections', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)

      expect(within(getBulkBar()).getByText('0 sélectionné')).toBeInTheDocument()

      await user.click(rowCheckboxFor('tx-1'))
      expect(within(getBulkBar()).getByText('1 sélectionné')).toBeInTheDocument()

      await user.click(rowCheckboxFor('tx-2'))
      expect(within(getBulkBar()).getByText('2 sélectionnés')).toBeInTheDocument()
    })
  })

  describe('select-all checkbox', () => {
    it('starts unchecked and not indeterminate with no selection', () => {
      mockLoaded()
      render(<Transactions />)
      const sel = getSelectAll()
      expect(sel.checked).toBe(false)
      expect(sel.indeterminate).toBe(false)
    })

    it('is partially checked (indeterminate) when only some rows are selected', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      expect(getSelectAll().checked).toBe(false)
      expect(getSelectAll().indeterminate).toBe(true)
    })

    it('clicks select-all to mark every visible row selected', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(getSelectAll())

      expect(getSelectAll().checked).toBe(true)
      expect(getSelectAll().indeterminate).toBe(false)
      expect(rowCheckboxFor('tx-1').checked).toBe(true)
      expect(rowCheckboxFor('tx-2').checked).toBe(true)
      expect(rowCheckboxFor('tx-3').checked).toBe(true)
      expect(within(getBulkBar()).getByText('3 selected')).toBeInTheDocument()
    })

    it('clicks a fully-checked select-all to clear visible rows only', async () => {
      const user = userEvent.setup()
      // Two failed-status rows + one confirmed + one pending make the
      // 'failed' filter scope the select-all to exactly two rows.
      mockLoaded([TX1, TX2, TX3, { ...TX2, id: 'tx-other' } as unknown as Transaction])
      render(<Transactions />)

      // Filter to "failed" so two rows are visible; select-all selects
      // both.
      await user.selectOptions(
        screen.getByRole('combobox', { name: /filter by status/i }),
        'failed'
      )
      await user.click(getSelectAll())
      expect(rowCheckboxFor('tx-2').checked).toBe(true)
      expect(rowCheckboxFor('tx-other').checked).toBe(true)
      expect(within(getBulkBar()).getByText('2 selected')).toBeInTheDocument()

      // Toggle off: scoped to the filtered subset.
      await user.click(getSelectAll())
      expect(getBulkBar().hasAttribute('hidden')).toBe(true)
    })

    it('keeps select-all scoped to the visible filter subset', async () => {
      const user = userEvent.setup()
      mockLoaded([TX1, TX2, TX3])
      render(<Transactions />)
      // Select all (3 rows)
      await user.click(getSelectAll())
      // Now narrow the filter; selection is pruned to the subset.
      await user.selectOptions(
        screen.getByRole('combobox', { name: /filter by status/i }),
        'pending'
      )
      // Only TX3 is visible/selected.
      expect(within(getBulkBar()).getByText('1 selected')).toBeInTheDocument()
      // The select-all should be checked (the filtered subset is fully selected).
      expect(getSelectAll().checked).toBe(true)
    })
  })

  describe('bulk actions bar visibility', () => {
    it('is hidden when nothing is selected', () => {
      mockLoaded()
      render(<Transactions />)
      expect(getBulkBar().hasAttribute('hidden')).toBe(true)
    })

    it('becomes visible when at least one row is selected', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      expect(getBulkBar().hasAttribute('hidden')).toBe(false)
    })

    it('hides again after clearing selection', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      await user.click(
        getBulkBar().querySelector(
          `[data-testid="${TEST_IDS.TX_BULK_CLEAR_BUTTON}"]`
        ) as HTMLButtonElement
      )
      expect(getBulkBar().hasAttribute('hidden')).toBe(true)
    })

    it('renders Export and Delete buttons plus a Clear button', () => {
      mockLoaded()
      render(<Transactions />)
      expect(screen.getByTestId(TEST_IDS.TX_BULK_EXPORT_BUTTON)).toBeInTheDocument()
      expect(screen.getByTestId(TEST_IDS.TX_BULK_DELETE_BUTTON)).toBeInTheDocument()
      expect(screen.getByTestId(TEST_IDS.TX_BULK_CLEAR_BUTTON)).toBeInTheDocument()
    })
  })

  describe('bulk export', () => {
    it('exports the selected subset as a CSV file', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      await user.click(rowCheckboxFor('tx-3'))
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_EXPORT_BUTTON))

      expect(downloadCsvMock).toHaveBeenCalledTimes(1)
      const [csv, filename] = downloadCsvMock.mock.calls[0]
      expect(typeof csv).toBe('string')
      expect(csv).toContain('id,type,status,amountUSDC,timestamp,hash')
      expect(csv).toContain('tx-1')
      expect(csv).toContain('tx-3')
      expect(csv).not.toContain('tx-2')
      expect(filename).toMatch(/^credence-transactions-\d{4}-\d{2}-\d{2}\.csv$/)
    })

    it('surfaces a singular success toast for a single-row export', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_EXPORT_BUTTON))
      expect(addToastMock).toHaveBeenCalledWith('success', '1 transaction exported')
    })

    it('surfaces a plural success toast for multi-row export', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(getSelectAll())
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_EXPORT_BUTTON))
      expect(addToastMock).toHaveBeenCalledWith('success', '3 transactions exported')
    })
  })

  describe('bulk delete', () => {
    it('opens a ConfirmDialog when Delete is clicked', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_DELETE_BUTTON))
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(
        within(dialog).getByText('You are about to remove 1 transaction from this list.')
      ).toBeInTheDocument()
    })

    it('uses a plural subtitle for multiple selected transactions', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(getSelectAll())
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_DELETE_BUTTON))
      expect(
        within(screen.getByRole('dialog')).getByText(
          'You are about to remove 3 transactions from this list.'
        )
      ).toBeInTheDocument()
    })

    it('cancels from the dialog without removing anything', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_DELETE_BUTTON))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      // The row is still visible.
      expect(screen.getByText('bond')).toBeInTheDocument()
    })

    it('removes selected rows after typing DELETE and confirming', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      await user.click(rowCheckboxFor('tx-3'))
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_DELETE_BUTTON))
      const dialog = screen.getByRole('dialog')
      const confirmInput = within(dialog).getByRole('textbox')
      await user.type(confirmInput, 'DELETE')
      await user.click(within(dialog).getByRole('button', { name: /delete transactions/i }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByText('bond')).not.toBeInTheDocument()
      expect(screen.queryByText('attestation')).not.toBeInTheDocument()
      // The non-selected row remains.
      expect(screen.getByText('withdraw')).toBeInTheDocument()
      // Selection clears + bar hides.
      expect(getBulkBar().hasAttribute('hidden')).toBe(true)
      expect(addToastMock).toHaveBeenCalledWith('success', '2 transactions removed from view')
    })

    it('disables the confirm button until DELETE is typed', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_DELETE_BUTTON))
      const dialog = screen.getByRole('dialog')
      const confirmBtn = within(dialog).getByRole('button', {
        name: /delete transactions/i,
      })
      expect(confirmBtn).toBeDisabled()
      // A partial / wrong-case input never enables it.
      await user.type(within(dialog).getByRole('textbox'), 'DELE')
      expect(confirmBtn).toBeDisabled()
      await user.type(within(dialog).getByRole('textbox'), 'TE')
      expect(confirmBtn).toBeEnabled()
    })

    it('does not remove anything if Cancel is clicked after some entries', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_DELETE_BUTTON))
      await user.type(within(screen.getByRole('dialog')).getByRole('textbox'), 'DELETE')
      // Cancel via Escape instead of clicking the confirm button.
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('bond')).toBeInTheDocument()
    })
  })

  describe('empty-selection edge cases', () => {
    it('Clear button never appears while the bulk bar is hidden', () => {
      mockLoaded()
      render(<Transactions />)
      const bar = getBulkBar()
      expect(bar.hasAttribute('hidden')).toBe(true)
    })

    it('selecting rows after a filter change keeps the bar visible', async () => {
      const user = userEvent.setup()
      mockLoaded([TX1, TX2, TX3])
      render(<Transactions />)
      await user.selectOptions(
        screen.getByRole('combobox', { name: /filter by status/i }),
        'pending'
      )
      await user.click(rowCheckboxFor('tx-3'))
      expect(getBulkBar().hasAttribute('hidden')).toBe(false)
      expect(within(getBulkBar()).getByText('1 selected')).toBeInTheDocument()
    })
  })

  describe('accessibility hooks', () => {
    it('select-all checkbox has a stable accessible name', () => {
      mockLoaded()
      render(<Transactions />)
      expect(screen.getByRole('checkbox', { name: /select all transactions/i })).toBe(
        getSelectAll()
      )
    })

    it('per-row checkboxes include the transaction id in their label', () => {
      mockLoaded()
      render(<Transactions />)
      expect(screen.getByRole('checkbox', { name: /select transaction tx-1/i })).toBeInTheDocument()
    })

    it('bulk actions bar exposes the actions region label', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      // Hidden regions are not in the accessibility tree — make the bar
      // visible by toggling a row first.
      await user.click(rowCheckboxFor('tx-1'))
      expect(screen.getByRole('region', { name: /bulk actions/i })).toBe(getBulkBar())
    })
  })

  describe('column sorting', () => {
    function bodyCellTexts(columnIndex: number): string[] {
      const table = screen.getByRole('table')
      return within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[columnIndex].textContent?.trim() ?? '')
    }

    function ariaSortFor(column: string): string | null {
      return screen
        .getByRole('button', { name: new RegExp(`^${column}`, 'i') })
        .closest('th')!
        .getAttribute('aria-sort')
    }

    it('keeps the server order and aria-sort="none" by default', () => {
      mockLoaded()
      render(<Transactions />)

      expect(bodyCellTexts(1)).toEqual(['bond_create', 'withdraw', 'attest'])
      expect(ariaSortFor('sort by type')).toBe('none')
      expect(ariaSortFor('sort by amount')).toBe('none')
    })

    it('cycles ascending → descending → server order on repeated header clicks', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)

      await user.click(screen.getByRole('button', { name: /sort by type/i }))
      expect(bodyCellTexts(1)).toEqual(['attest', 'bond_create', 'withdraw'])
      expect(ariaSortFor('type, sorted ascending')).toBe('ascending')

      await user.click(screen.getByRole('button', { name: /type, sorted ascending/i }))
      expect(bodyCellTexts(1)).toEqual(['withdraw', 'bond_create', 'attest'])
      expect(ariaSortFor('type, sorted descending')).toBe('descending')

      await user.click(screen.getByRole('button', { name: /type, sorted descending/i }))
      expect(bodyCellTexts(1)).toEqual(['bond_create', 'withdraw', 'attest'])
      expect(ariaSortFor('sort by type')).toBe('none')
    })

    it('sorts by amount and keeps rows without an amount last in both directions', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)

      await user.click(screen.getByRole('button', { name: /sort by amount/i }))
      expect(bodyCellTexts(1)).toEqual(['attest', 'bond_create', 'withdraw'])
      expect(bodyCellTexts(2)).toEqual(['250 USDC', '1,000 USDC', '—'])

      await user.click(screen.getByRole('button', { name: /amount, sorted ascending/i }))
      expect(bodyCellTexts(1)).toEqual(['bond_create', 'attest', 'withdraw'])
      expect(bodyCellTexts(2)).toEqual(['1,000 USDC', '250 USDC', '—'])
    })

    it('sorts the loaded page by date', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)

      await user.click(screen.getByRole('button', { name: /sort by when/i }))
      expect(bodyCellTexts(1)).toEqual(['bond_create', 'withdraw', 'attest'])
      expect(ariaSortFor('when, sorted ascending')).toBe('ascending')

      await user.click(screen.getByRole('button', { name: /when, sorted ascending/i }))
      expect(bodyCellTexts(1)).toEqual(['attest', 'withdraw', 'bond_create'])
      expect(ariaSortFor('when, sorted descending')).toBe('descending')
    })

    it('preserves the selection and bulk actions across a sort', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)

      await user.click(rowCheckboxFor('tx-1'))
      await user.click(screen.getByRole('button', { name: /sort by amount/i }))

      expect(rowCheckboxFor('tx-1').checked).toBe(true)
      expect(getBulkBar().hasAttribute('hidden')).toBe(false)
      expect(within(getBulkBar()).getByText('1 selected')).toBeInTheDocument()
    })
  })

  describe('pending row explorer links', () => {
    it('pending row recorded on testnet links to testnet explorer even when settings are on public', () => {
      const pendingTx = {
        ...TX3,
        _network: 'test' as const,
      } as unknown as TransactionWithNetwork

      mockLoaded([TX1, TX2, pendingTx])
      mockUseSettings.mockReturnValue({ network: 'public' })

      render(<Transactions />)

      const testnetExplorerLink = screen
        .getAllByRole('link')
        .find((link) => link.getAttribute('href')?.includes('testnet'))

      expect(testnetExplorerLink).toBeInTheDocument()
      expect(testnetExplorerLink?.getAttribute('href')).toContain(
        'https://stellar.expert/explorer/testnet/tx'
      )
    })

    it('pending row recorded on public links to public explorer', () => {
      const pendingTx = {
        ...TX3,
        _network: 'public' as const,
      } as unknown as TransactionWithNetwork

      mockLoaded([TX1, TX2, pendingTx])
      mockUseSettings.mockReturnValue({ network: 'public' })

      render(<Transactions />)

      const publicExplorerLink = screen
        .getAllByRole('link')
        .find((link) => link.getAttribute('href')?.includes('public/tx'))

      expect(publicExplorerLink).toBeInTheDocument()
      expect(publicExplorerLink?.getAttribute('href')).toContain(
        'https://stellar.expert/explorer/public/tx'
      )
    })
  })

  describe('export all transactions', () => {
    it('walks multiple cursor pages, downloads full CSV, and shows success toast', async () => {
      const user = userEvent.setup()
      mockLoaded([TX1])
      mockUseSettings.mockReturnValue({ network: 'test' })

      const page1Items: Transaction[] = [
        {
          id: 'tx-p1',
          type: 'bond',
          amountUsdc: 100,
          status: 'confirmed',
          timestamp: '2026-01-15T12:00:00Z',
          hash: 'HASH_P1',
        },
      ]
      const page2Items: Transaction[] = [
        {
          id: 'tx-p2',
          type: 'withdraw',
          amountUsdc: 50,
          status: 'confirmed',
          timestamp: '2026-01-16T12:00:00Z',
          hash: '=SUM(A1:A2)',
        },
      ]

      mockFetchTransactionsPage
        .mockResolvedValueOnce({ items: page1Items, nextCursor: 'cursor-2' })
        .mockResolvedValueOnce({ items: page2Items, nextCursor: undefined })

      render(<Transactions />)

      const exportAllBtn = screen.getByTestId(TEST_IDS.TX_EXPORT_ALL_BUTTON)
      await user.click(exportAllBtn)

      await waitFor(() => {
        expect(downloadCsvMock).toHaveBeenCalledTimes(1)
      })

      const [csvContent] = downloadCsvMock.mock.calls[0] as [string, string]
      expect(csvContent).toContain('tx-p1')
      expect(csvContent).toContain('tx-p2')
      expect(csvContent).toContain("'=SUM(A1:A2)")
      expect(addToastMock).toHaveBeenCalledWith('success', expect.stringContaining('2'))
    })

    it('cancels an in-flight export promptly and does not download CSV', async () => {
      const user = userEvent.setup()
      mockLoaded([TX1])
      mockUseSettings.mockReturnValue({ network: 'test' })

      let resolveFirstPage!: (value: { items: Transaction[]; nextCursor?: string }) => void
      mockFetchTransactionsPage.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstPage = resolve
          })
      )

      render(<Transactions />)

      await user.click(screen.getByTestId(TEST_IDS.TX_EXPORT_ALL_BUTTON))

      expect(screen.getByTestId(TEST_IDS.TX_EXPORT_ALL_STATUS)).toBeInTheDocument()

      await user.click(screen.getByTestId(TEST_IDS.TX_EXPORT_ALL_CANCEL_BUTTON))

      resolveFirstPage({
        items: [
          {
            id: 'tx-p1',
            type: 'bond',
            amountUsdc: 100,
            status: 'confirmed',
            timestamp: '2026-01-15T12:00:00Z',
            hash: 'HASH_P1',
          },
        ],
        nextCursor: 'cursor-2',
      })

      await waitFor(() => {
        expect(screen.queryByTestId(TEST_IDS.TX_EXPORT_ALL_STATUS)).not.toBeInTheDocument()
      })

      expect(mockFetchTransactionsPage).toHaveBeenCalledTimes(1)
      expect(downloadCsvMock).not.toHaveBeenCalled()
      expect(addToastMock).toHaveBeenCalledWith('info', expect.stringMatching(/cancel/i))
    })

    it('surfaces a retry message when rate-limited', async () => {
      const user = userEvent.setup()
      mockLoaded([TX1])
      mockUseSettings.mockReturnValue({ network: 'test' })

      mockFetchTransactionsPage.mockRejectedValueOnce(new ApiRateLimitError(5000))

      render(<Transactions />)

      await user.click(screen.getByTestId(TEST_IDS.TX_EXPORT_ALL_BUTTON))

      await waitFor(() => {
        expect(addToastMock).toHaveBeenCalledWith(
          'error',
          expect.stringMatching(/rate limit.*5s/i)
        )
      })
      expect(downloadCsvMock).not.toHaveBeenCalled()
    })

    it('aborts an in-flight export when the wallet changes', async () => {
      const user = userEvent.setup()
      mockLoaded([TX1])
      mockUseSettings.mockReturnValue({ network: 'test' })

      let capturedSignal: AbortSignal | undefined
      mockFetchTransactionsPage.mockImplementationOnce(
        (_cursor: unknown, opts?: { signal?: AbortSignal }) => {
          capturedSignal = opts?.signal
          return new Promise(() => {})
        }
      )

      const { rerender } = render(<Transactions />)

      await user.click(screen.getByTestId(TEST_IDS.TX_EXPORT_ALL_BUTTON))
      expect(capturedSignal?.aborted).toBe(false)

      mockUseWallet.mockReturnValue({ address: 'GNEWWALLET', network: 'test' })
      rerender(<Transactions />)

      expect(capturedSignal?.aborted).toBe(true)
      expect(screen.queryByTestId(TEST_IDS.TX_EXPORT_ALL_STATUS)).not.toBeInTheDocument()
    })
  })
})

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: MemoryRouter })
}

const FILTER_ROWS: Transaction[] = [
  {
    id: 'filter-1',
    hash: 'ABC111',
    type: 'bond',
    status: 'confirmed',
    timestamp: '2026-01-15T00:00:00Z',
  },
  {
    id: 'filter-2',
    hash: 'DEF222',
    type: 'withdraw',
    status: 'failed',
    timestamp: '2026-01-16T23:59:59Z',
  },
  {
    id: 'filter-3',
    hash: 'ABC333',
    type: 'bond',
    status: 'confirmed',
    timestamp: '2026-01-17T12:00:00Z',
  },
]

function FilterLocation() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="filter-url">{location.search}</output>
      <button onClick={() => navigate(-1)}>Back in history</button>
      <button onClick={() => navigate(1)}>Forward in history</button>
    </>
  )
}

function renderFilters(query = '') {
  return rtlRender(
    <MemoryRouter initialEntries={[`/transactions${query}`]}>
      <Transactions />
      <FilterLocation />
    </MemoryRouter>
  )
}

function filterUrl() {
  return new URLSearchParams(screen.getByTestId('filter-url').textContent ?? '')
}

describe('Transactions URL filters', () => {
  beforeEach(() => mockLoaded(FILTER_ROWS))

  it('hydrates combined filters from a shared URL and restores them on remount', () => {
    const query = '?status=confirmed&type=bond&from=2026-01-15&to=2026-01-15&q=abc'
    const view = renderFilters(query)
    expect(screen.getByLabelText('Transaction type')).toHaveValue('bond')
    expect(screen.getByLabelText('From date (UTC)')).toHaveValue('2026-01-15')
    expect(screen.getByLabelText('Search transactions')).toHaveValue('abc')
    expect(screen.getByLabelText('Select transaction filter-1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Select transaction filter-3')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 3 loaded transactions')).toHaveAttribute('aria-live', 'polite')
    const persisted = `?${filterUrl()}`
    view.unmount()
    renderFilters(persisted)
    expect(screen.getByLabelText('Select transaction filter-1')).toBeInTheDocument()
    expect(screen.getByLabelText('Search transactions')).toHaveValue('abc')
  })

  it('ignores bad URL parameters and keeps unrelated parameters when clearing filters', async () => {
    const user = userEvent.setup()
    renderFilters('?status=bogus&type=bogus&from=2026-02-30&tab=history')
    expect(screen.getByLabelText('Transaction type')).toHaveValue('all')
    expect(screen.getByText('3 of 3 loaded transactions')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Transaction type'), 'withdraw')
    expect(filterUrl().get('type')).toBe('withdraw')
    expect(screen.getByText('1 of 3 loaded transactions')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(filterUrl().toString()).toBe('tab=history')
    expect(screen.getByText('3 of 3 loaded transactions')).toBeInTheDocument()
  })

  it('combines controls, debounces text matching, and provides a recoverable empty state', async () => {
    const user = userEvent.setup()
    renderFilters()
    await user.selectOptions(screen.getByLabelText('Transaction type'), 'bond')
    fireEvent.change(screen.getByLabelText('From date (UTC)'), { target: { value: '2026-01-16' } })
    expect(screen.getByText('1 of 3 loaded transactions')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'missing' } })
    expect(filterUrl().get('q')).toBe('missing')
    expect(screen.getByLabelText('Select transaction filter-3')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument()
    )
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByLabelText('Search transactions')).toHaveValue('')
    expect(screen.getByText('3 of 3 loaded transactions')).toBeInTheDocument()
  })

  it('clamps bulk selection when type and date filters hide selected rows', async () => {
    const user = userEvent.setup()
    renderFilters()
    await user.click(getSelectAll())
    await user.selectOptions(screen.getByLabelText('Transaction type'), 'bond')
    expect(within(getBulkBar()).getByText('2 selected')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('To date (UTC)'), { target: { value: '2026-01-15' } })
    expect(within(getBulkBar()).getByText('1 selected')).toBeInTheDocument()
    expect(rowCheckboxFor('filter-1')).toBeChecked()
  })

  it('follows back and forward navigation without rewriting the URL', async () => {
    const user = userEvent.setup()
    renderFilters()
    await user.selectOptions(screen.getByLabelText('Transaction type'), 'withdraw')
    await user.click(screen.getByRole('button', { name: 'Back in history' }))
    expect(screen.getByLabelText('Transaction type')).toHaveValue('all')
    expect(screen.getByText('3 of 3 loaded transactions')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Forward in history' }))
    expect(screen.getByLabelText('Transaction type')).toHaveValue('withdraw')
    expect(screen.getByText('1 of 3 loaded transactions')).toBeInTheDocument()
  })

  it('keeps clear filters available when the loaded dataset is empty', async () => {
    mockEmpty()
    const user = userEvent.setup()
    renderFilters('?type=bond')
    expect(screen.getByText('0 of 0 loaded transactions')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(filterUrl().has('type')).toBe(false)
  })
})
