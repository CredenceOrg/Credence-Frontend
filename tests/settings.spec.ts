import { test, expect, type Page } from '@playwright/test'

const STORAGE_KEY = 'credence:settings'
const defaults = {
  themeMode: 'system',
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

async function stubSettingsApi(page: Page) {
  await page.route('**/api/settings', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback()
      return
    }
    await route.fulfill({ status: 204 })
  })
}

const themeGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Theme mode' })
const addressGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Address format' })

// Each test gets a fresh browser context; pin language and OS theme instead of
// inheriting the developer's preferences. No storage initializer runs on reload.
test.use({ locale: 'en-US', colorScheme: 'light' })

test.describe('settings persistence', () => {
  test.beforeEach(async ({ page }) => {
    await stubSettingsApi(page)
  })

  for (const scenario of [
    { mode: 'light', label: 'Light', address: 'full', addressLabel: /^Full/, os: 'dark' },
    { mode: 'dark', label: 'Dark', address: 'friendly', addressLabel: 'Friendly', os: 'light' },
    { mode: 'system', label: 'System', address: 'full', addressLabel: /^Full/, os: 'dark' },
  ] as const) {
    test(`persists ${scenario.mode} theme, network and address format after reload`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scenario.os })
      await page.goto('/settings')
      await themeGroup(page).getByRole('radio', { name: scenario.label, exact: true }).click()
      await page.getByLabel('Stellar Network', { exact: true }).selectOption('test')
      await addressGroup(page).getByRole('radio', { name: scenario.addressLabel }).click()

      const expected = {
        ...defaults,
        themeMode: scenario.mode,
        network: 'test',
        addressDisplay: scenario.address,
      }
      // The auto-save hook also syncs the initial committed state. Match the
      // changed payload, not whichever request happens to arrive first.
      const patch = page.waitForRequest(
        (request) =>
          new URL(request.url()).pathname === '/api/settings' &&
          request.method() === 'PATCH' &&
          request.postDataJSON().network === 'test'
      )
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      const request = await patch
      expect(request.headers()['content-type']).toContain('application/json')
      expect(request.postDataJSON()).toEqual(expected)
      await expect
        .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY))
        .toEqual(expected)
      await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled()

      await page.reload()

      await expect(
        themeGroup(page).getByRole('radio', { name: scenario.label, exact: true })
      ).toBeChecked()
      await expect(page.getByLabel('Stellar Network', { exact: true })).toHaveValue('test')
      await expect(
        addressGroup(page).getByRole('radio', { name: scenario.addressLabel })
      ).toBeChecked()
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        scenario.mode === 'system' ? scenario.os : scenario.mode
      )
      expect(
        await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
      ).toEqual(expected)
    })
  }

  test('recovers from corrupt stored JSON and can save valid settings', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((key) => {
      // Seed only the first document: a reload must read the application's save.
      if (!sessionStorage.getItem('settings-corrupt-seeded')) {
        localStorage.setItem(key, '{invalid json')
        sessionStorage.setItem('settings-corrupt-seeded', 'true')
      }
    }, STORAGE_KEY)
    await page.goto('/settings')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Settings', exact: true })
    ).toBeVisible()
    await expect(themeGroup(page).getByRole('radio', { name: 'System', exact: true })).toBeChecked()
    await expect(addressGroup(page).getByRole('radio', { name: /^Short/ })).toBeChecked()
    await expect(page.getByLabel('Stellar Network', { exact: true })).toHaveValue('public')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await themeGroup(page).getByRole('radio', { name: 'Dark', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY))
      .toEqual({ ...defaults, themeMode: 'dark' })
    await page.reload()
    await expect(themeGroup(page).getByRole('radio', { name: 'Dark', exact: true })).toBeChecked()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(errors).toEqual([])
  })
})

test.describe('theme before hydration', () => {
  for (const scenario of [
    { mode: 'light', os: 'dark', expected: 'light' },
    { mode: 'dark', os: 'light', expected: 'dark' },
    { mode: 'system', os: 'light', expected: 'light' },
    { mode: 'system', os: 'dark', expected: 'dark' },
  ] as const) {
    test(`applies ${scenario.mode} with ${scenario.os} OS preference before React runs`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scenario.os })
      await page.addInitScript(
        ({ key, settings }) => {
          localStorage.setItem(key, JSON.stringify(settings))
        },
        { key: STORAGE_KEY, settings: { ...defaults, themeMode: scenario.mode } }
      )
      // Keep the real index.html inline bootstrap, but prevent the application
      // entry from executing. A post-hydration theme assertion cannot catch FOUC.
      const entryModule = /\/src\/main\.tsx(?:\?.*)?$/
      await page.route(entryModule, (route) => route.abort())
      const entry = page.waitForRequest(entryModule)
      await page.goto('/settings', { waitUntil: 'domcontentloaded' })
      await entry
      await expect(page.locator('#root')).toBeEmpty()
      await expect(page.locator('html')).toHaveAttribute('data-theme', scenario.expected)
    })
  }
})
