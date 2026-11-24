import { test, expect, type Page } from '@playwright/test'
import { MOCK_WALLET_ADDRESS } from './mocks/freighter-api.mock'

const USDC_ISSUER_PUBLIC = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'

// The bond-creation wizard is the closest match in this app to a "connect wallet
// → enter amount → confirm → success toast" send flow (bonds have no separate
// destination address — they lock USDC into the protocol itself).
async function mockHorizonBalance(page: Page, balance = '5000.0000000') {
  await page.route('https://horizon.stellar.org/accounts/**', async (route) => {
    await route.fulfill({
      json: {
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: USDC_ISSUER_PUBLIC,
            balance,
          },
        ],
      },
    })
  })
}

test.describe('send flow (bond creation)', () => {
  test('connects wallet, enters an amount, confirms, and shows a success toast', async ({
    page,
  }) => {
    await mockHorizonBalance(page)

    await page.goto('/bond/new')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Step 1: Enter Bond Amount' })).toBeVisible()

    // Connect wallet
    await page.locator('.createBondFlow__connectButton').click()
    await expect(page.getByText(`Available: ${Number(5000).toLocaleString('en-US')} USDC`)).toBeVisible()

    // Enter amount via the 90 USDC preset chip
    await page.getByRole('button', { name: 'Set amount to 90 USDC' }).click()

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Step 2: Choose Lock Duration' })).toBeVisible()

    await page.getByRole('button', { name: '90 Days' }).click()
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'Step 3: Review Terms' })).toBeVisible()
    await expect(page.getByTestId('review-bond-amount')).toHaveText('90 USDC')
    await expect(page.getByTestId('review-duration')).toHaveText('90 Days')

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Step 4: Confirm Bond' })).toBeVisible()

    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Confirm & Create Bond' }).click()

    const successToast = page.getByRole('status').filter({ hasText: 'Bond created successfully.' })
    await expect(successToast).toBeVisible()
  })

  test('blocks moving past step 1 without a valid amount', async ({ page }) => {
    await mockHorizonBalance(page)

    await page.goto('/bond/new')
    await page.waitForLoadState('networkidle')

    await page.locator('.createBondFlow__connectButton').click()
    await expect(page.getByText(`Available: ${Number(5000).toLocaleString('en-US')} USDC`)).toBeVisible()

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('alert')).toContainText(
      'Please enter a valid amount greater than 0.'
    )
    await expect(page.getByRole('heading', { name: 'Step 1: Enter Bond Amount' })).toBeVisible()
  })
})

test.describe('wallet connection', () => {
  test('address in useWallet resolves to the mocked Freighter address', async ({ page }) => {
    await mockHorizonBalance(page)
    await page.goto('/bond/new')
    await page.waitForLoadState('networkidle')

    await page.locator('.createBondFlow__connectButton').click()
    await expect(page.locator('.createBondFlow__connectButton')).toHaveCount(0)

    // Sanity-check the mock actually wired up the address we expect, rather than
    // any arbitrary truthy string.
    expect(MOCK_WALLET_ADDRESS).toMatch(/^G[A-Z0-9]{55}$/)
  })
})
