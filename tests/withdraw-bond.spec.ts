import { test, expect } from '@playwright/test'
import { connectMockWallet, mockHorizonBalance } from './helpers/wallet'

const MOCK_LOCKED_BOND = {
  id: 'early-withdrawal',
  borrower: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  amount: '100',
  asset: 'USDC',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  maturesAt: '2099-01-01T00:00:00.000Z',
}

test.describe('withdraw bond flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockHorizonBalance(page)
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ json: { items: [MOCK_LOCKED_BOND] } })
    })
    await page.goto('/bond')
    await connectMockWallet(page)
    await expect(page.getByRole('button', { name: 'Withdraw', exact: true })).toBeVisible()
  })

  test('shows early-withdrawal penalty and confirms withdrawal', async ({ page }) => {
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Confirm bond withdrawal' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/Slash penalty \(20%\)/i)).toBeVisible()
    await expect(dialog.getByText('20 USDC')).toBeVisible()
    await expect(dialog.getByText('80 USDC')).toBeVisible()

    await dialog.getByRole('textbox').fill('CONFIRM')
    await dialog.getByRole('button', { name: 'Withdraw bond' }).click()

    await expect(
      page.getByRole('status').filter({ hasText: '20 USDC was slashed per early withdrawal policy.' })
    ).toBeVisible()
  })

  test('cancels withdrawal without showing a success toast', async ({ page }) => {
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Confirm bond withdrawal' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(dialog).not.toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: 'Bond withdrawn successfully.' })
    ).toHaveCount(0)
  })
})
