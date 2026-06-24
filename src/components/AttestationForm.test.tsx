import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import AttestationForm from './AttestationForm'
import { SettingsProvider } from '../context/SettingsContext'
import ToastProvider from './ToastProvider'

// A valid 56-character Stellar public key
const VALID_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

function renderForm(onSubmitSuccess = vi.fn()) {
  const result = render(
    <SettingsProvider>
      <ToastProvider>
        <AttestationForm onSubmitSuccess={onSubmitSuccess} />
      </ToastProvider>
    </SettingsProvider>
  )
  return { ...result, onSubmitSuccess }
}

describe('AttestationForm', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validation and error reporting', () => {
    it('shows error messages for empty fields on submit', async () => {
      const user = userEvent.setup()
      renderForm()

      const submitButton = screen.getByRole('button', { name: /submit attestation/i })
      await user.click(submitButton)

      expect(screen.getByText(/Subject address is required/)).toBeInTheDocument()
      expect(screen.getByText(/Evidence is required/)).toBeInTheDocument()
    })

    it('shows error message for invalid subject Stellar address prefix', async () => {
      const user = userEvent.setup()
      renderForm()

      const addressInput = screen.getByRole('textbox', { name: /subject address/i })
      const evidenceTextarea = screen.getByRole('textbox', { name: /evidence/i })
      const submitButton = screen.getByRole('button', { name: /submit attestation/i })

      // Enter invalid address starting with 'A' and some evidence
      await user.type(addressInput, 'A' + VALID_KEY.substring(1))
      await user.type(evidenceTextarea, 'Some evidence description')
      await user.click(submitButton)

      expect(
        screen.getByText(/Invalid address\. Stellar public keys are 56 characters starting with G/)
      ).toBeInTheDocument()
    })

    it('shows character count while entering evidence', async () => {
      const user = userEvent.setup()
      renderForm()

      const evidenceTextarea = screen.getByRole('textbox', { name: /evidence/i })
      const countEl = document.querySelector('[aria-live="polite"]')

      expect(countEl?.textContent?.trim()).toBe('0 / 500 characters')

      await user.type(evidenceTextarea, 'hello')
      expect(countEl?.textContent?.trim()).toBe('5 / 500 characters')
    })
  })

  describe('ConfirmDialog submission flow', () => {
    it('opens confirm dialog with summary upon submitting valid inputs', async () => {
      const user = userEvent.setup()
      renderForm()

      const addressInput = screen.getByRole('textbox', { name: /subject address/i })
      const evidenceTextarea = screen.getByRole('textbox', { name: /evidence/i })
      const submitButton = screen.getByRole('button', { name: /submit attestation/i })

      await user.type(addressInput, VALID_KEY)
      await user.type(evidenceTextarea, 'This is valid evidence.')
      await user.click(submitButton)

      // Confirm dialog should be open
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(screen.getByText('Confirm Attestation Submission')).toBeInTheDocument()

      // Should summarize inputs inside the dialog scope to avoid duplicate matches
      expect(within(dialog).getByText(VALID_KEY)).toBeInTheDocument()
      expect(within(dialog).getByText('Identity Verification')).toBeInTheDocument()
      expect(within(dialog).getByText('This is valid evidence.')).toBeInTheDocument()
    })

    it('requires typing "CONFIRM" to enable submit in the dialog', async () => {
      const user = userEvent.setup()
      renderForm()

      const addressInput = screen.getByRole('textbox', { name: /subject address/i })
      const evidenceTextarea = screen.getByRole('textbox', { name: /evidence/i })
      const submitButton = screen.getByRole('button', { name: /submit attestation/i })

      await user.type(addressInput, VALID_KEY)
      await user.type(evidenceTextarea, 'This is valid evidence.')
      await user.click(submitButton)

      const confirmInput = screen.getByLabelText(/type confirm to submit/i)
      const submitAttestationButton = screen.getAllByRole('button', { name: /submit attestation/i })[1]

      // Initially disabled
      expect(submitAttestationButton).toBeDisabled()

      // Type wrong case confirm
      await user.type(confirmInput, 'confirm')
      expect(submitAttestationButton).toBeDisabled()

      // Type correct case CONFIRM
      await user.clear(confirmInput)
      await user.type(confirmInput, 'CONFIRM')
      expect(submitAttestationButton).toBeEnabled()
    })

    it('triggers callback and displays success toast when confirmed', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderForm(onSubmit)

      const addressInput = screen.getByRole('textbox', { name: /subject address/i })
      const evidenceTextarea = screen.getByRole('textbox', { name: /evidence/i })
      const submitButton = screen.getByRole('button', { name: /submit attestation/i })

      await user.type(addressInput, VALID_KEY)
      await user.type(evidenceTextarea, 'This is valid evidence.')
      await user.click(submitButton)

      const confirmInput = screen.getByLabelText(/type confirm to submit/i)
      const submitAttestationButton = screen.getAllByRole('button', { name: /submit attestation/i })[1]

      await user.type(confirmInput, 'CONFIRM')
      await user.click(submitAttestationButton)

      // Dialog should close
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      // Callback should be fired
      expect(onSubmit).toHaveBeenCalledWith({
        subject: VALID_KEY,
        type: 'identity',
        evidence: 'This is valid evidence.',
      })

      // Success toast should show
      expect(screen.getByText('Attestation submitted successfully.')).toBeInTheDocument()

      // Form fields should reset
      expect(addressInput).toHaveValue('')
      expect(evidenceTextarea).toHaveValue('')
    })

    it('returns focus to trigger button on cancelling confirm dialog', async () => {
      const user = userEvent.setup()
      renderForm()

      const addressInput = screen.getByRole('textbox', { name: /subject address/i })
      const evidenceTextarea = screen.getByRole('textbox', { name: /evidence/i })
      const submitButton = screen.getByRole('button', { name: /submit attestation/i })

      await user.type(addressInput, VALID_KEY)
      await user.type(evidenceTextarea, 'This is valid evidence.')
      await user.click(submitButton)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Dialog closes
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      // Focus returns to submitButton
      expect(document.activeElement).toBe(submitButton)
    })
  })

  describe('accessibility and error wiring', () => {
    it('sets aria-invalid and aria-describedby for errors', async () => {
      const user = userEvent.setup()
      renderForm()

      const evidenceTextarea = screen.getByRole('textbox', { name: /evidence/i })
      const submitButton = screen.getByRole('button', { name: /submit attestation/i })

      await user.click(submitButton)

      expect(evidenceTextarea).toHaveAttribute('aria-invalid', 'true')
      const describedBy = evidenceTextarea.getAttribute('aria-describedby')
      expect(describedBy).toBeDefined()

      const errorText = screen.getByText(/Evidence is required/)
      const errorId = errorText.getAttribute('id')
      expect(describedBy).toContain(errorId)
    })
  })
})
