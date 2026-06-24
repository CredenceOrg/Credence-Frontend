import React, { useState, useRef } from 'react'
import AddressInput from './AddressInput'
import Select from './controls/Select'
import { FormField } from './forms/FormField'
import Button from './Button'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './ToastProvider'

/**
 * Props for the AttestationForm component.
 */
export interface AttestationFormProps {
  /**
   * Callback triggered when an attestation is successfully confirmed and submitted.
   * Receives the finalized attestation data.
   */
  onSubmitSuccess?: (payload: { subject: string; type: string; evidence: string }) => void
  /**
   * Disables form fields and the submit action during submission or external loading.
   */
  disabled?: boolean
}

/**
 * AttestationForm handles the input and validation for submitting attestations.
 * Validation Contract:
 * - A valid Stellar subject public key address is required.
 * - Evidence text is required and cannot exceed 500 characters.
 * - Confirms the submission using a customized ConfirmDialog.
 */
export default function AttestationForm({ onSubmitSuccess, disabled = false }: AttestationFormProps) {
  const { addToast } = useToast()
  const [subject, setSubject] = useState('')
  const [isSubjectValid, setIsSubjectValid] = useState(false)
  const [type, setType] = useState('identity')
  const [evidence, setEvidence] = useState('')
  const [errors, setErrors] = useState<{ subject?: string; evidence?: string }>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  const handleSubjectChange = (val: string) => {
    setSubject(val)
    if (errors.subject) {
      setErrors((prev) => ({ ...prev, subject: undefined }))
    }
  }

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setEvidence(val)
    if (errors.evidence) {
      setErrors((prev) => ({ ...prev, evidence: undefined }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { subject?: string; evidence?: string } = {}

    if (!subject.trim()) {
      newErrors.subject = 'Subject address is required.'
    } else if (!isSubjectValid) {
      newErrors.subject = 'Invalid address. Stellar public keys are 56 characters starting with G.'
    }

    if (!evidence.trim()) {
      newErrors.evidence = 'Evidence is required.'
    } else if (evidence.length > 500) {
      newErrors.evidence = 'Evidence cannot exceed 500 characters.'
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      return
    }

    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    setConfirmOpen(false)
    addToast('success', 'Attestation submitted successfully.')
    onSubmitSuccess?.({ subject, type, evidence })
    setSubject('')
    setEvidence('')
    setType('identity')
    setErrors({})
  }

  const handleCancel = () => {
    setConfirmOpen(false)
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gap: 'var(--credence-space-5)',
          background: 'var(--credence-surface-card)',
          border: '1px solid var(--credence-border-default)',
          borderRadius: 'var(--credence-radius-xl)',
          padding: 'var(--credence-space-5)',
        }}
        aria-label="Submit Attestation"
      >
        <AddressInput
          id="subject-input"
          label="Subject Address"
          value={subject}
          onChange={handleSubjectChange}
          onValidationChange={setIsSubjectValid}
          disabled={disabled}
          error={errors.subject}
        />

        <FormField id="type-select" label="Attestation Type" hint="Category of trust payload">
          <Select
            id="type-select"
            value={type}
            onChange={setType}
            options={[
              { value: 'identity', label: 'Identity Verification' },
              { value: 'peer-vouch', label: 'Peer Vouch' },
              { value: 'credential', label: 'Credential / Certification' },
            ]}
          />
        </FormField>

        <div style={{ display: 'grid', gap: 'var(--credence-space-2)' }}>
          <FormField
            id="evidence-input"
            label="Evidence"
            hint="Add supporting proof or description (max 500 characters)"
            error={errors.evidence}
          >
            <textarea
              id="evidence-input"
              value={evidence}
              onChange={handleEvidenceChange}
              disabled={disabled}
              placeholder="Provide proof or verification details..."
              rows={4}
              maxLength={500}
              style={{
                width: '100%',
                padding: 'var(--credence-space-3)',
                borderRadius: 'var(--credence-radius-lg)',
                border: '1px solid var(--credence-border-default)',
                background: 'var(--credence-surface-card)',
                color: 'var(--credence-text-primary)',
                minHeight: '100px',
                fontFamily: 'var(--credence-font-family-base)',
                fontSize: 'var(--credence-font-size-base)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </FormField>
          <div
            style={{
              textAlign: 'right',
              fontSize: 'var(--credence-font-size-xs)',
              color: 'var(--credence-text-secondary)',
              marginTop: 'calc(var(--credence-space-1) * -1)',
            }}
            aria-live="polite"
          >
            {evidence.length} / 500 characters
          </div>
        </div>

        <Button
          ref={submitButtonRef}
          type="submit"
          variant="primary"
          disabled={disabled}
          fullWidth
        >
          Submit Attestation
        </Button>
      </form>

      {confirmOpen && (
        <ConfirmDialog
          open
          title="Confirm Attestation Submission"
          subtitle="Please review the attestation details below before signing."
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          confirmLabel="Submit Attestation"
          returnFocusRef={submitButtonRef}
          variant="info"
          confirmInputLabel={
            <>
              Type <strong>CONFIRM</strong> to submit attestation
            </>
          }
          confirmInputHint="Submitting this attestation records it on your trust profile. This action cannot be undone."
        >
          <div
            style={{
              display: 'grid',
              gap: 'var(--credence-space-3)',
              padding: 'var(--credence-space-4)',
              border: '1px solid var(--credence-border-default)',
              borderRadius: 'var(--credence-radius-lg)',
              background: 'var(--credence-surface-page)',
              color: 'var(--credence-text-primary)',
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: 'var(--credence-font-size-xs)',
                  color: 'var(--credence-text-secondary)',
                  display: 'block',
                  textTransform: 'uppercase',
                  marginBottom: 'var(--credence-space-1)',
                }}
              >
                Subject
              </strong>
              <code style={{ fontSize: 'var(--credence-font-size-sm)', wordBreak: 'break-all' }}>
                {subject}
              </code>
            </div>
            <div>
              <strong
                style={{
                  fontSize: 'var(--credence-font-size-xs)',
                  color: 'var(--credence-text-secondary)',
                  display: 'block',
                  textTransform: 'uppercase',
                  marginBottom: 'var(--credence-space-1)',
                }}
              >
                Type
              </strong>
              <span style={{ fontSize: 'var(--credence-font-size-sm)' }}>
                {type === 'identity'
                  ? 'Identity Verification'
                  : type === 'peer-vouch'
                    ? 'Peer Vouch'
                    : 'Credential / Certification'}
              </span>
            </div>
            <div>
              <strong
                style={{
                  fontSize: 'var(--credence-font-size-xs)',
                  color: 'var(--credence-text-secondary)',
                  display: 'block',
                  textTransform: 'uppercase',
                  marginBottom: 'var(--credence-space-1)',
                }}
              >
                Evidence
              </strong>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--credence-font-size-sm)',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--credence-text-primary)',
                }}
              >
                {evidence}
              </p>
            </div>
          </div>
        </ConfirmDialog>
      )}
    </>
  )
}
