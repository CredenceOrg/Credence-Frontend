import React, { Component, ReactNode } from 'react'
import { FormError } from './FormError'
import './FormField.css'

export type FormFieldState = 'default' | 'error' | 'success' | 'loading' | 'stale' | 'permission'

interface FormFieldErrorBoundaryProps {
  children: ReactNode
  onRetry?: () => void
  errorId?: string
}

interface FormFieldErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class FormFieldErrorBoundary extends Component<FormFieldErrorBoundaryProps, FormFieldErrorBoundaryState> {
  state: FormFieldErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): FormFieldErrorBoundaryState {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="form-field-boundary" role="alert" id={this.props.errorId}>
          <FormError id={this.props.errorId ? `${this.props.errorId}-boundary` : undefined}>
            An unexpected error occurred rendering this field.
          </FormError>
          <button type="button" onClick={this.handleRetry} className="form-field-retry-btn" aria-label="Retry loading field">
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Resolves a caller-supplied message prop to the value that should be treated
 * as present, or `undefined` when the message carries no information.
 *
 * Boundary invariant: `hint`, `error`, and `success` are routinely derived
 * (`msg || undefined`, template interpolation, `[a, b].filter(Boolean).join(' ')`),
 * so a value that is empty *after trimming* reaches this component often enough
 * to need a defined meaning. A blank message is treated as absent so it can
 * never:
 *   - mark the control `aria-invalid` while showing the user no text,
 *   - mount an empty `role="alert"`, or
 *   - suppress a real `success` message via the error-precedence rule below.
 *
 * The original string is returned unmodified so that a message with intentional
 * leading/trailing whitespace still renders verbatim; only the presence decision
 * is trim-based. `label` is deliberately NOT normalized: a blank label is a
 * separate (and separately invalid) case, and silently dropping it would change
 * the accessible name of every control in the field.
 */
function resolveMessage(message?: string): string | undefined {
  return message?.trim() ? message : undefined
}

/**
 * Merges a caller-supplied `aria-describedby` with the ids this component owns
 * into a single well-formed ID reference list.
 *
 * Invariants (in priority order):
 *  1. The caller's own tokens are never dropped or reordered; ids owned here are
 *     appended after them, so existing a11y wiring keeps working unchanged.
 *  2. Every id appears at most once, first occurrence wins. Wrappers legitimately
 *     pre-compute the very ids FormField derives (see the quiet-hours pair in
 *     src/pages/Settings.tsx), and a repeated IDREF makes assistive technology
 *     announce the same description twice.
 *  3. Tokens are split on any whitespace run and rejoined with single spaces.
 *     `aria-describedby` is an ID reference list, not free text, so an empty or
 *     irregularly spaced caller value must not be forwarded verbatim.
 *  4. The attribute is omitted entirely when the merged list is empty, rather
 *     than rendered as `aria-describedby=""`.
 */
function mergeDescribedBy(
  existing: string | undefined,
  owned: (string | undefined)[]
): string | undefined {
  const merged: string[] = []
  for (const source of [existing, ...owned]) {
    if (!source) continue
    for (const id of source.split(/\s+/)) {
      if (id && !merged.includes(id)) merged.push(id)
    }
  }
  return merged.length > 0 ? merged.join(' ') : undefined
}

interface FormFieldProps {
  id: string
  label: string
  /**
   * Optional guidance rendered above the control and linked to it via
   * `aria-describedby`. A value that is empty or whitespace-only is treated as
   * absent — see {@link resolveMessage}.
   */
  hint?: string
  /**
   * Validation failure message. When present the control is marked
   * `aria-invalid` and the field enters the `error` state. A value that is empty
   * or whitespace-only is treated as absent, so a blank error can never mark a
   * field invalid with no visible explanation — see {@link resolveMessage}.
   */
  error?: string
  /**
   * Inline confirmation message for a valid field.
   * Suppressed when `error` is set (error takes precedence).
   */
  success?: string
  
  /** Indicates the field is waiting for an asynchronous operation. */
  loading?: boolean
  /** Indicates the field's value may be out of date. */
  stale?: boolean
  /** Provide a string to show a permission warning, or boolean true for generic permission block. */
  permission?: string | boolean
  /** Callback for when the user asks to retry an operation (or recovering from an error boundary). */
  onRetry?: () => void

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
  loading = false,
  stale = false,
  permission,
  onRetry,
  srOnlyLabel = false,
  required = false,
  className,
  children,
}: FormFieldProps) {
  // `children` is a single element by contract (see `children: React.ReactElement`).
  // Children.only converts a runtime misuse — an array, a fragment wrapper, or
  // undefined — into a deterministic error at this boundary instead of a
  // cryptic failure further down inside cloneElement, and it does not alter
  // behavior for the single-element case every in-repo caller passes.
  const control = React.Children.only(children)

  const presentHint = resolveMessage(hint)
  const presentError = resolveMessage(error)
  const presentSuccess = resolveMessage(success)

  const hintId = presentHint ? `${id}-hint` : undefined
  const errorId = presentError ? `${id}-error` : undefined
  // Error wins over success so invalid fields never announce a success message.
  const successMessage = presentError ? undefined : presentSuccess
  const successId = successMessage ? `${id}-success` : undefined
  const existingDescribedBy = control.props['aria-describedby'] as string | undefined

  const state: FormFieldState = presentError ? 'error' : successMessage ? 'success' : 'default'
  // Reject a whitespace-only className for the same reason mergeDescribedBy
  // rejects empty tokens: joining it would leave a stray double space in the
  // class attribute, which breaks exact class-list matching downstream.
  const rootClassName = ['form-field', className].filter((c) => c?.trim()).join(' ')

  return (
    <div className={rootClassName} data-state={state} aria-busy={loading ? 'true' : undefined}>
      <label htmlFor={id} className={srOnlyLabel ? 'sr-only' : undefined}>
        {label}
        {required && !srOnlyLabel && (
          <span className="form-required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>

      {presentHint && (
        <span id={hintId} className="form-hint">
          {presentHint}
        </span>
      )}
      
      {permissionMessage && (
        <span id={permissionId} className="form-permission" role="status">
          {permissionMessage}
        </span>
      )}

      {React.cloneElement(control, {
        id,
        'aria-describedby': mergeDescribedBy(existingDescribedBy, [hintId, errorId, successId]),
        'aria-invalid': presentError ? 'true' : control.props['aria-invalid'],
        'aria-required': required ? 'true' : control.props['aria-required'],
      })}

      {presentError && <FormError id={errorId}>{presentError}</FormError>}

      {successMessage && (
        <span id={successId} className="form-success" role="status">
          <span aria-hidden="true">✓</span> {successMessage}
        </span>
      )}
    </div>
  )
}
