import { test, expect } from '@playwright/test'

test.describe('prefers-reduced-transparency', () => {
  test('replaces semi-transparent backdrops with opaque equivalents when reduced transparency is preferred', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'none' })
    // Inject the media-query override before navigation so the CSS responds
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({
          matches: query === '(prefers-reduced-transparency: reduce)',
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const backdropLight = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--credence-backdrop-light')
        .trim(),
    )
    // Under prefers-reduced-transparency the token resolves to a fully-opaque colour
    expect(backdropLight).toBe('#0f172a')
  })

  test('uses semi-transparent backdrops by default', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const backdropLight = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--credence-backdrop-light')
        .trim(),
    )
    expect(backdropLight).toBe('rgba(15, 23, 42, 0.55)')
  })
})
