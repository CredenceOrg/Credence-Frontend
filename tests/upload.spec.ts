import { test, expect } from '@playwright/test'

test.describe('attestation evidence files', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/attestations')
  })

  test('hashes an accepted file locally and displays its SHA-256', async ({ page }) => {
    const input = page.getByTestId('file-picker-input')
    await input.setInputFiles({
      name: 'evidence.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('local evidence'),
    })

    await expect(page.getByText('Evidence file SHA-256 ready.')).toBeVisible()
    await expect(page.getByLabel('Evidence SHA-256')).toHaveText(/^[a-f0-9]{64}$/)
    await expect(page.getByText('evidence.txt')).toBeVisible()
  })

  test('rejects unsupported file types with a visible message', async ({ page }) => {
    await page.getByTestId('file-picker-input').setInputFiles({
      name: 'evidence.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('unsupported'),
    })

    await expect(page.getByRole('alert')).toContainText('File type not accepted')
    await expect(page.getByText('evidence.gif')).toHaveCount(0)
  })

  test('rejects files larger than 10 MiB with a visible message', async ({ page }) => {
    await page.getByTestId('file-picker-input').setInputFiles({
      name: 'large.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    })

    await expect(page.getByRole('alert')).toContainText('File exceeds the maximum size of 10.0 MB')
    await expect(page.getByText('large.pdf')).toHaveCount(0)
  })

  test('removing a selected file clears its hash from the form', async ({ page }) => {
    await page.getByTestId('file-picker-input').setInputFiles({
      name: 'evidence.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('local evidence'),
    })
    await expect(page.getByLabel('Evidence SHA-256')).toHaveText(/^[a-f0-9]{64}$/)

    await page.getByRole('button', { name: 'Remove evidence.txt' }).click()
    await expect(page.getByLabel('Evidence SHA-256')).toHaveCount(0)
    await expect(page.getByText('evidence.txt')).toHaveCount(0)
  })
})
