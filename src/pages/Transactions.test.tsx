import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_IDS } from '../config/testIds'
import Transactions from './Transactions'

// ── Mocks ───────────────────────────────────────────────────────────
const mockUseTransactions = vi.fn()
vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => mockUseTransactions(),
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
  type: 'bond_create',
  amountUsdc: 1000,
  status: 'confirmed',
  timestamp: '2026-01-15T12:00:00Z',
}

const TX1 = { id: 'tx-1', ...TX_BASE } as const
const TX2 = {
  id: 'tx-2',
  type: 'withdraw',
  amountUsdc: null,
  status: 'failed',
  timestamp: '2026-01-16T08:30:00Z',
} as const
const TX3 = {
  id: 'tx-3',
  type: 'attest',
  amountUsdc: 250,
  status: 'pending',
  timestamp: '2026-01-17T09:45:00Z',
} as const

function mockLoaded(transactions = [TX1, TX2, TX3]) {
  mockUseTransactions.mockReturnValue({
    data: transactions,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
}

function mockLoading() {
  mockUseTransactions.mockReturnValue({
    data: [],
    isLoading: true,
    error: null,
    refetch: vi.fn(),
  })
}

function mockError() {
  mockUseTransactions.mockReturnValue({
    data: [],
    isLoading: false,
    error: { status: 500, message: 'Boom' },
    refetch: vi.fn(),
  })
}

function mockEmpty() {
  mockUseTransactions.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
}

beforeEach(() => {
  mockUseTransactions.mockReset()
  mockUseSettings.mockReset()
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
      expect(within(table).getByText('bond_create')).toBeInTheDocument()
      expect(within(table).getByText('withdraw')).toBeInTheDocument()
      expect(within(table).getByText('attest')).toBeInTheDocument()
      // Bulk bar renders but stays visually hidden while selection is empty.
      expect(getBulkBar().hasAttribute('hidden')).toBe(true)
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
      await user.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'failed')
      // Only the failed row remains visible.
      expect(screen.queryByText('bond_create')).not.toBeInTheDocument()
      expect(screen.getByText('withdraw')).toBeInTheDocument()
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
      mockLoaded([TX1, TX2, TX3, { ...TX2, id: 'tx-other', type: 'mint' }])
      render(<Transactions />)

      // Filter to "failed" so two rows are visible; select-all selects
      // both.
      await user.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'failed')
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
      await user.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'pending')
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
      await user.click(getBulkBar().querySelector(`[data-testid="${TEST_IDS.TX_BULK_CLEAR_BUTTON}"]`) as HTMLButtonElement)
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
      expect(addToastMock).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('3')
      )
    })
  })

  describe('bulk delete', () => {
    it('opens a ConfirmDialog when Delete is clicked', async () => {
      const user = userEvent.setup()
      mockLoaded()
      render(<Transactions />)
      await user.click(rowCheckboxFor('tx-1'))
      await user.click(screen.getByTestId(TEST_IDS.TX_BULK_DELETE_BUTTON))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
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
      expect(screen.getByText('bond_create')).toBeInTheDocument()
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
      expect(screen.queryByText('bond_create')).not.toBeInTheDocument()
      expect(screen.queryByText('attest')).not.toBeInTheDocument()
      // The non-selected row remains.
      expect(screen.getByText('withdraw')).toBeInTheDocument()
      // Selection clears + bar hides.
      expect(getBulkBar().hasAttribute('hidden')).toBe(true)
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
      expect(screen.getByText('bond_create')).toBeInTheDocument()
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
      await user.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'pending')
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
})
