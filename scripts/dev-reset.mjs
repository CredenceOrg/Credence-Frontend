#!/usr/bin/env node
/* eslint-env node */

async function main() {
  let playwright
  try {
    playwright = await import('playwright')
  } catch {
    console.error('Playwright is not installed. Run: npm install')
    process.exit(1)
  }

  const browser = await playwright.chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
    await page.evaluate(() => localStorage.clear())
    console.log('Local storage cleared successfully.')
  } catch (err) {
    console.error(
      'Failed to clear local storage. Is the dev server running on http://localhost:5173?',
    )
    console.error(err.message)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
