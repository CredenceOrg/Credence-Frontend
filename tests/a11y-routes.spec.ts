import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { A11Y_AUDIT_PATHS } from '../src/config/routes'

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const

const THEMES = ['light', 'dark'] as const

// These pages have wallet-dependent content. The Vite Playwright server already
// enables tests/mocks/freighter-api.mock.ts (E2E_MOCK_WALLET=true).
const WALLET_ROUTES = new Set([
  '/',
  '/dashboard',
  '/bond',
  '/bond/new',
  '/trust',
  '/attestations',
  '/transactions',
  '/settings',
])

// Deliberately empty: add only a reviewed false positive with an exact route,
// axe rule ID, CSS target, and justification. Never blanket-disable an axe rule.
const ALLOWLIST: ReadonlyArray<{
  path: string
  rule: string
  target: string
  reason: string
}> = []

async function seedTheme(page: Page, themeMode: 'light' | 'dark') {
  await page.addInitScript((theme) => {
    localStorage.setItem(
      'credence:settings',
      JSON.stringify({
        themeMode: theme,
        network: 'public',
        addressDisplay: 'short',
        toastsEnabled: true,
        autoDismiss: '5s',
        quietHoursEnabled: false,
      })
    )
    // Avoid testing the first-run tutorial overlay instead of the dashboard.
    localStorage.setItem('credence:onboarding:onboardedAt', '2026-11-23T00:00:00Z')
  }, themeMode)
}

async function connectMockWallet(page: Page) {
  await page.getByTestId('wallet-connect-btn').click()
  const dialog = page.getByRole('dialog', { name: 'Connect Freighter Wallet' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByTestId('wallet-connected-trigger')).toBeVisible()
}

test.describe('whole-route axe accessibility', () => {
  for (const path of A11Y_AUDIT_PATHS) {
    for (const theme of THEMES) {
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        test(`${path} / ${theme} / ${viewportName}`, async ({ page }) => {
          await page.setViewportSize(viewport)
          await page.emulateMedia({ colorScheme: theme })
          await seedTheme(page, theme)

          // The project already mocks Freighter in its Playwright Vite server.
          // Do not request live account balances or expose wallet credentials.
          await page.route('https://horizon.stellar.org/accounts/**', (route) =>
            route.fulfill({ json: { balances: [] } })
          )

          await page.goto(path)
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
          await expect(page.locator('main#main-content')).toBeVisible()

          if (WALLET_ROUTES.has(path)) {
            await connectMockWallet(page)
          }

          // Wait for React.lazy route content, not the Suspense "Loading..."
          // fallback. A successful audit of a loading spinner would be useless.
          await expect(
            page.locator('#main-content h1, #main-content h2, #main-content h3').first()
          ).toBeVisible()
          await page.waitForLoadState('networkidle')

          const results = await new AxeBuilder({ page }).analyze()
          const seriousOrCritical = results.violations
            .filter(
              (violation) => violation.impact === 'serious' || violation.impact === 'critical'
            )
            .flatMap((violation) =>
              violation.nodes.map((node) => ({
                rule: violation.id,
                impact: violation.impact,
                target: node.target.join(', '),
                summary: node.failureSummary,
              }))
            )
            .filter(
              (violation) =>
                !ALLOWLIST.some(
                  (entry) =>
                    entry.path === path &&
                    entry.rule === violation.rule &&
                    entry.target === violation.target
                )
            )

          expect(
            seriousOrCritical,
            `axe violations for ${path} (${theme}, ${viewportName}):\n${JSON.stringify(seriousOrCritical, null, 2)}`
          ).toEqual([])
        })
      }
    }
  }
})
