import React from 'react'
import './FormField.css'

export type FormFieldState = 'default' | 'error' | 'success'

interface FormFieldProps {
  id: string
  label: string
  hint?: string
  error?: string
  /**
   * Inline confirmation message for a valid field.
   * Suppressed when `error` is set (error takes precedence).
   */
  success?: string
  /** When true, the label is visually hidden but remains linked to the control via htmlFor/id. */
  srOnlyLabel?: boolean
  /** Marks the field as required in the label and sets aria-required on the control. */
  required?: boolean
  className?: string
  children: React.ReactElement
}

export function FormField({
  id,
  label,
  hint,
  error,
  success,
  srOnlyLabel = false,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  // Error wins over success so invalid fields never announce a success message.
  const successMessage = error ? undefined : success
  const successId = successMessage ? `${id}-success` : undefined
  const existingDescribedBy = children.props['aria-describedby'] as string | undefined

  const state: FormFieldState = error ? 'error' : successMessage ? 'success' : 'default'
  const rootClassName = ['form-field', className].filter(Boolean).join(' ')

  return (
    <div className={rootClassName} data-state={state}>
      <label htmlFor={id} className={srOnlyLabel ? 'sr-only' : undefined}>
        {label}
        {required && !srOnlyLabel && (
          <span className="form-required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>

      {hint && (
        <span id={hintId} className="form-hint">
          {hint}
        </span>
      )}

      {React.cloneElement(children, {
        id,
        'aria-describedby':
          [existingDescribedBy, hintId, errorId, successId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? 'true' : undefined,
        'aria-required': required ? 'true' : children.props['aria-required'],
      })}

      {error && (
        <span id={errorId} className="form-error" role="alert">
          ⚠ {error}
        </span>
      )}

      {successMessage && (
        <span id={successId} className="form-success" role="status">
          <span aria-hidden="true">✓</span> {successMessage}
        </span>
      )}
    </div>
  )
}
