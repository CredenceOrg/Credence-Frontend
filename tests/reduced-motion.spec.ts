import { test, expect } from '@playwright/test'

test.describe('prefers-reduced-motion', () => {
  test('disables animations and transitions when reduced motion is preferred', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const baseDuration = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--credence-motion-duration-base')
        .trim(),
    )
    expect(baseDuration).toBe('0ms')
  })

  test('allows animations and transitions by default', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const baseDuration = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--credence-motion-duration-base')
        .trim(),
    )
    expect(baseDuration).toBe('250ms')
  })
})
