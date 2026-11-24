import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { TEST_IDS } from '../src/config/testIds'
import { EXPORT_COLUMNS } from '../src/lib/transactionsExport'
import type { Transaction } from '../src/api/types'

const FIXTURE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-confirmed-1',
    type: 'bond',
    amountUsdc: 250,
    status: 'confirmed',
    timestamp: '2026-01-15T12:00:00Z',
    hash: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  },
  {
    id: 'tx-pending-1',
    type: 'top_up',
    amountUsdc: 100,
    status: 'pending',
    timestamp: '2026-01-16T09:30:00Z',
    hash: 'GBPENDINGTXHASH00000000000000000000000000000000000000001',
  },
  {
    id: 'tx-failed-1',
    type: 'withdraw',
    amountUsdc: 75,
    status: 'failed',
    timestamp: '2026-01-17T14:15:00Z',
    hash: '=CMD|\' /C calc\'!A0',
  },
  {
    id: 'tx-pending-2',
    type: 'bond',
    amountUsdc: 500,
    status: 'pending',
    timestamp: '2026-01-18T16:45:00Z',
    hash: 'GBPENDINGTXHASH00000000000000000000000000000000000000002',
  },
]

async function mockTransactionsApi(page: Page, items: Transaction[] = FIXTURE_TRANSACTIONS) {
  await page.route('**/api/transactions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: { items },
    })
  })
}

test.describe('Transactions page', () => {
  test('filters by status, clamps bulk selection on filter change, and downloads neutralised CSV', async ({
    page,
  }) => {
    await mockTransactionsApi(page)

    await page.goto('/transactions')
    await page.waitForLoadState('networkidle')

    const rows = page.locator('table.transactions__table tbody tr')
    await expect(rows).toHaveCount(FIXTURE_TRANSACTIONS.length)

    // Filter by pending and verify row count
    const statusFilter = page.locator('#tx-status-filter')
    await statusFilter.selectOption('pending')
    await expect(rows).toHaveCount(2)

    // Filter by failed and verify row count
    await statusFilter.selectOption('failed')
    await expect(rows).toHaveCount(1)

    // Return to all rows and select all
    await statusFilter.selectOption('all')
    await expect(rows).toHaveCount(4)

    const selectAll = page.getByTestId(TEST_IDS.TX_SELECT_ALL_CHECKBOX)
    const bulkBar = page.getByTestId(TEST_IDS.TX_BULK_ACTIONS_BAR)
    await selectAll.check()
    await expect(bulkBar).toBeVisible()
    await expect(bulkBar).toContainText('4 selected')

    // Changing filter clamps selection to currently visible rows
    await statusFilter.selectOption('pending')
    await expect(rows).toHaveCount(2)
    await expect(bulkBar).toContainText('2 selected')
    await expect(selectAll).toBeChecked()

    // Filter to failed (contains the formula-injection fixture) and export CSV
    await statusFilter.selectOption('all')
    await selectAll.check()
    await expect(bulkBar).toContainText('4 selected')

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId(TEST_IDS.TX_BULK_EXPORT_BUTTON).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/^credence-transactions-\d{4}-\d{2}-\d{2}\.csv$/)

    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()
    const csv = await readFile(downloadPath!, 'utf8')

    const expectedHeader = EXPORT_COLUMNS.map((c) => c.header).join(',')
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe(expectedHeader)
    expect(lines).toHaveLength(FIXTURE_TRANSACTIONS.length + 1)
    expect(csv).toContain(
      'tx-confirmed-1,bond,confirmed,250,2026-01-15T12:00:00Z,GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    )
    // Formula-injection fixture must be neutralised with a leading single quote
    expect(csv).toContain("tx-failed-1,withdraw,failed,75,2026-01-17T14:15:00Z,'=CMD|' /C calc'!A0")
    expect(csv).not.toContain(",=CMD|' /C calc'!A0")
  })
})
