import { test, expect } from '@playwright/test'
import { connectMockWallet, mockHorizonBalance } from './helpers/wallet'

test.describe('create bond flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockHorizonBalance(page)
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ json: { items: [] } })
    })
    await page.goto('/bond/new')
    await expect(page.getByRole('heading', { name: 'Step 1: Enter Bond Amount' })).toBeVisible()
    await connectMockWallet(page)
    await expect(page.getByText('Available: 5,000 USDC')).toBeVisible()
  })

  test('rejects an empty amount', async ({ page }) => {
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(
      'Please enter a valid amount greater than 0.'
    )
    await expect(page.getByRole('heading', { name: 'Step 1: Enter Bond Amount' })).toBeVisible()
  })

  test('completes the four-step flow and preserves the amount when navigating back', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Set amount to 90 USDC' }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Step 2: Choose Lock Duration' })).toBeVisible()

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Please select a lock duration.')

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Step 1: Enter Bond Amount' })).toBeVisible()
    await expect(page.getByLabel('Amount (USDC)')).toHaveValue('90')

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('button', { name: '90 Days', exact: true }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Step 3: Review Terms' })).toBeVisible()
    await expect(page.getByTestId('review-bond-amount')).toHaveText('90 USDC')
    await expect(page.getByTestId('review-duration')).toHaveText('90 Days')

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Step 4: Confirm Bond' })).toBeVisible()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Confirm & Create Bond' }).click()

    await expect(
      page.getByRole('status').filter({ hasText: 'Bond created successfully.' })
    ).toBeVisible()
    await expect(page).toHaveURL(/\/bond$/)
  })
})
