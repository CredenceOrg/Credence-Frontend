import { expect, test, type Page } from '@playwright/test'
import { connectMockWallet } from './helpers/wallet'

const SUBJECT = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
const CREATED_AT = '2026-11-20T12:00:00.000Z'

interface MockAttestation {
  id: string
  subject: string
  type: string
  evidence: string
  actor: string
  status: 'accepted' | 'needs-update' | 'in-review'
  createdAt: string
}

async function mockAttestationsApi(page: Page, initialItems: MockAttestation[] = []) {
  const submissions: Record<string, unknown>[] = []

  await page.route('**/api/attestations**', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.fulfill({ json: { items: initialItems } })
      return
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>
      submissions.push(payload)
      await route.fulfill({
        status: 201,
        json: {
          id: 'attestation-created-1',
          subject: payload.subject,
          type: payload.type,
          evidence: payload.evidence,
          actor: SUBJECT,
          status: 'accepted',
          createdAt: CREATED_AT,
        },
      })
      return
    }

    await route.continue()
  })

  return submissions
}

test.describe('attestations page', () => {
  test('shows validation feedback and does not submit an invalid Stellar address', async ({
    page,
  }) => {
    const submissions = await mockAttestationsApi(page)

    await page.goto('/attestations')
    await expect(page.getByRole('heading', { name: 'Attestations', level: 1 })).toBeVisible()
    await connectMockWallet(page)

    await page.getByRole('textbox', { name: 'Subject Address' }).fill('not-a-stellar-address')
    await page.getByRole('textbox', { name: 'Evidence' }).fill('Evidence for the invalid address')
    await page.getByRole('button', { name: 'Submit Attestation', exact: true }).click()

    await expect(page.getByText(/Invalid address\. Stellar public keys are 56 characters/)).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Confirm Attestation Submission' })).toHaveCount(0)
    expect(submissions).toHaveLength(0)
  })

  test('submits a valid attestation once and renders it in the timeline', async ({ page }) => {
    const submissions = await mockAttestationsApi(page)

    await page.goto('/attestations')
    await expect(page.getByRole('heading', { name: 'Attestations', level: 1 })).toBeVisible()
    await connectMockWallet(page)

    const evidence = 'Playwright verified the attestation submission flow.'
    await page.getByRole('textbox', { name: 'Subject Address' }).fill(SUBJECT)
    await page.getByRole('textbox', { name: 'Evidence' }).fill(evidence)
    await page.getByRole('button', { name: 'Submit Attestation', exact: true }).click()

    const confirmation = page.getByRole('dialog', { name: 'Confirm Attestation Submission' })
    await expect(confirmation).toBeVisible()
    await confirmation.getByLabel(/type confirm to submit attestation/i).fill('CONFIRM')
    await confirmation.getByRole('button', { name: 'Submit Attestation', exact: true }).click()

    await expect.poll(() => submissions.length).toBe(1)
    expect(submissions[0]).toMatchObject({
      subject: SUBJECT,
      type: 'identity',
      evidence,
    })
    await expect(page.getByText(evidence)).toBeVisible()
    await expect(confirmation).toHaveCount(0)
  })

  test('filters the timeline by status tone', async ({ page }) => {
    const items: MockAttestation[] = [
      {
        id: 'attestation-accepted',
        subject: SUBJECT,
        type: 'identity',
        evidence: 'Accepted attestation evidence',
        actor: 'Validator One',
        status: 'accepted',
        createdAt: CREATED_AT,
      },
      {
        id: 'attestation-needs-update',
        subject: SUBJECT,
        type: 'peer-vouch',
        evidence: 'Needs update attestation evidence',
        actor: 'Validator Two',
        status: 'needs-update',
        createdAt: '2026-11-19T12:00:00.000Z',
      },
      {
        id: 'attestation-in-review',
        subject: SUBJECT,
        type: 'credential',
        evidence: 'In review attestation evidence',
        actor: 'Validator Three',
        status: 'in-review',
        createdAt: '2026-11-18T12:00:00.000Z',
      },
    ]
    await mockAttestationsApi(page, items)

    await page.goto('/attestations')
    await expect(page.getByRole('heading', { name: 'Attestations', level: 1 })).toBeVisible()
    await expect(page.getByText('Accepted attestation evidence')).toBeVisible()
    await expect(page.getByText('Needs update attestation evidence')).toBeVisible()
    await expect(page.getByText('In review attestation evidence')).toBeVisible()

    await page.getByRole('combobox', { name: 'Filter attestations by status' }).selectOption('warning')

    await expect(page.getByText('Needs update attestation evidence')).toBeVisible()
    await expect(page.getByText('Accepted attestation evidence')).toHaveCount(0)
    await expect(page.getByText('In review attestation evidence')).toHaveCount(0)
  })
})
