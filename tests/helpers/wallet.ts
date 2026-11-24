import { expect, type Page } from '@playwright/test'

export async function connectMockWallet(page: Page) {
  await page.getByRole('button', { name: 'Connect wallet' }).first().click()
  await page.getByRole('dialog', { name: 'Connect Freighter Wallet' })
    .getByRole('button', { name: 'Connect', exact: true })
    .click()
  await expect(page.getByRole('button', { name: /wallet menu for/i })).toBeVisible()
}

export async function mockHorizonBalance(page: Page, balance = '5000.0000000') {
  await page.route('https://horizon.stellar.org/accounts/**', async (route) => {
    await route.fulfill({
      json: {
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
            balance,
          },
        ],
      },
    })
  })
}
