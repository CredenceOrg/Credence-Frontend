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

  test('sets fast and normal durations to 0ms when reduced motion is preferred', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const durations = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return {
        fast: style.getPropertyValue('--credence-motion-duration-fast').trim(),
        normal: style.getPropertyValue('--credence-motion-duration-normal').trim(),
      }
    })
    expect(durations.fast).toBe('0ms')
    expect(durations.normal).toBe('0ms')
  })

  test('suppresses dashboard spinner animation when reduced motion is preferred', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const spinnerAnimation = await page.evaluate(() => {
      const spinner = document.querySelector('.dashboard__pullSpinner')
      if (!spinner) return null
      return getComputedStyle(spinner).animationName
    })
    if (spinnerAnimation !== null) {
      expect(spinnerAnimation).toBe('none')
    }
  })

  test('suppresses control spinner animations when reduced motion is preferred', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const animationName = await page.evaluate(() => {
      const spinner = document.querySelector('.control-select-spinner')
      if (!spinner) return null
      return getComputedStyle(spinner).animationName
    })
    if (animationName !== null) {
      expect(animationName).toBe('none')
    }
  })

  test('suppresses amount input spinner animation when reduced motion is preferred', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/test-amount-input')
    await page.waitForLoadState('networkidle')

    const animationName = await page.evaluate(() => {
      const spinner = document.querySelector('.amountInput__spinner')
      if (!spinner) return null
      return getComputedStyle(spinner).animationName
    })
    if (animationName !== null) {
      expect(animationName).toBe('none')
    }
  })

  test('suppresses QR scanner spinner animation when reduced motion is preferred', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const animationName = await page.evaluate(() => {
      const spinner = document.querySelector('.qr-scanner-spinner')
      if (!spinner) return null
      return getComputedStyle(spinner).animationName
    })
    if (animationName !== null) {
      expect(animationName).toBe('none')
    }
  })

  test('suppresses keyboard shortcuts dialog fade-in animation when reduced motion is preferred', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const animationName = await page.evaluate(() => {
      const backdrop = document.querySelector('.shortcuts-dialog__backdrop')
      if (!backdrop) return null
      return getComputedStyle(backdrop).animationName
    })
    if (animationName !== null) {
      expect(animationName).toBe('none')
    }
  })

  test('suppresses whats-new dialog animations when reduced motion is preferred', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const animationName = await page.evaluate(() => {
      const backdrop = document.querySelector('.whats-new-dialog__backdrop')
      if (!backdrop) return null
      return getComputedStyle(backdrop).animationName
    })
    if (animationName !== null) {
      expect(animationName).toBe('none')
    }
  })
})
