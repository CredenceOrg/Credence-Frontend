import { test, expect } from '@playwright/test'

const ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

const MOCK_TRUST_SCORE = {
  address: ADDRESS,
  score: 840,
  tier: 'gold',
  attestations: 12,
  updatedAt: '2026-06-29T10:00:00Z',
}

// The lookup form gates fetches behind a connected Freighter wallet, which
// isn't available in CI. Seeding a recent-lookup entry lets the test trigger
// a real trust-score fetch through the "Recent Lookups" list instead, which
// doesn't require a wallet connection.
async function seedRecentLookup(page: import('@playwright/test').Page) {
  await page.addInitScript((address) => {
    window.localStorage.setItem(
      'credence:recent-lookups',
      JSON.stringify([{ address, timestamp: Date.now() }])
    )
  }, ADDRESS)
}

test.describe('trust score page', () => {
  test('loads with mocked data and renders key numbers', async ({ page }) => {
    await seedRecentLookup(page)

    await page.route('**/api/trust-score/**', async (route) => {
      await route.fulfill({ json: MOCK_TRUST_SCORE })
    })

    await page.goto('/trust')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Trust Score', level: 1 })).toBeVisible()

    await page.getByRole('button', { name: /^Look up address/ }).click()

    const gauge = page.getByRole('progressbar', { name: /Trust score: 840 out of 1000, gold tier/i })
    await expect(gauge).toBeVisible()

    await expect(page.locator('.trust-gauge__score-value')).toHaveText('840')
    await expect(page.locator('.trust-gauge__tier-badge')).toHaveText('Gold')
    await expect(page.locator('.tier-badge')).toHaveText('Gold Tier')
  })

  test('shows an error state when the lookup fails', async ({ page }) => {
    await seedRecentLookup(page)

    await page.route('**/api/trust-score/**', async (route) => {
      await route.fulfill({ status: 500, json: { message: 'Internal server error' } })
    })

    await page.goto('/trust')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /^Look up address/ }).click()

    await expect(
      page.getByRole('region', { name: 'Trust score results' }).getByRole('alert')
    ).toContainText('Unable to load trust score')
    await expect(page.locator('.trust-gauge__score-value')).toHaveCount(0)
  })
})
