import React, { useState, useRef } from 'react'
import AddressInput from './AddressInput'
import Select from './controls/Select'
import { FormField } from './forms/FormField'
import Button from './Button'
import ConfirmDialog from './ConfirmDialog'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useToast } from './ToastProvider'
import { ATTESTATION_EVENTS, type AttestationPayload } from '../events'

/**
 * Props for the AttestationForm component.
 */
export interface AttestationFormProps {
  /**
   * Callback triggered when an attestation is successfully confirmed and submitted.
   * Receives the finalized attestation data.
   */
  onSubmitSuccess?: (payload: AttestationPayload) => void
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
export default function AttestationForm({
  onSubmitSuccess,
  disabled = false,
}: AttestationFormProps) {
  const { addToast } = useToast()
  const { copy, copied } = useCopyToClipboard()
  const reducedMotion = useReducedMotion()
  const [subject, setSubject] = useState('')
  const [isSubjectValid, setIsSubjectValid] = useState(false)
  const [type, setType] = useState<string>(ATTESTATION_EVENTS.TYPES.IDENTITY)
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
    } else if (new TextEncoder().encode(evidence).length > 28) {
      newErrors.evidence = 'Evidence cannot exceed 28 bytes.'
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
    setType(ATTESTATION_EVENTS.TYPES.IDENTITY)
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
              { value: ATTESTATION_EVENTS.TYPES.IDENTITY, label: 'Identity Verification' },
              { value: ATTESTATION_EVENTS.TYPES.PEER_VOUCH, label: 'Peer Vouch' },
              { value: ATTESTATION_EVENTS.TYPES.CREDENTIAL, label: 'Credential / Certification' },
            ]}
          />
        </FormField>

        <div style={{ display: 'grid', gap: 'var(--credence-space-2)' }}>
          <FormField
            id="evidence-input"
            label="Evidence"
            hint="Add supporting proof or description (max 28 bytes)"
            error={errors.evidence}
          >
            <textarea
              id="evidence-input"
              value={evidence}
              onChange={handleEvidenceChange}
              disabled={disabled}
              placeholder="Provide proof or verification details..."
              rows={4}
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
            {new TextEncoder().encode(evidence).length} / 28 bytes
          </div>
        </div>

        <Button ref={submitButtonRef} type="submit" variant="primary" disabled={disabled} fullWidth>
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
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--credence-space-2)' }}
              >
                <code
                  style={{
                    fontSize: 'var(--credence-font-size-sm)',
                    wordBreak: 'break-all',
                    flex: 1,
                  }}
                >
                  {subject}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    const success = await copy(subject)
                    if (success) {
                      addToast('success', 'Subject address copied to clipboard')
                    }
                  }}
                  aria-label={copied ? 'Copied' : 'Copy subject address'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--credence-space-1)',
                    border: 'none',
                    borderRadius: 'var(--credence-radius-sm)',
                    background: 'transparent',
                    color: 'var(--credence-text-secondary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: reducedMotion ? 'none' : 'all 0.2s ease',
                  }}
                >
                  {copied ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
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
                {type === ATTESTATION_EVENTS.TYPES.IDENTITY
                  ? 'Identity Verification'
                  : type === ATTESTATION_EVENTS.TYPES.PEER_VOUCH
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
