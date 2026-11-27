import { useCallback, useState } from 'react'

/**
 * Shape of a generic form values store.
 */
export type FormValues = Record<string, unknown>

/**
 * Validation function: receives current form values and returns a map of
 * field-name → error message. An empty record means no errors (valid).
 * Supports both synchronous and asynchronous (Promise-returning) validation.
 */
export type ValidateFn<T extends FormValues> = (
  values: T,
) => Record<string, string> | Promise<Record<string, string>>

export interface UseFormValidationOptions<T extends FormValues> {
  /** Initial field values for the form. */
  initialValues: T
  /**
   * Validation function that runs before submission.
   * Return an object mapping field names to error messages.
   * An empty object signifies valid input.
   */
  validate: ValidateFn<T>
  /**
   * Called when the form passes validation.
   * May be synchronous or async.
   */
  onSubmit: (values: T) => void | Promise<void>
}

export interface UseFormValidationReturn<T extends FormValues> {
  /** Current field values. */
  values: T
  /** Per-field validation error messages. */
  errors: Record<string, string>
  /** True while handleSubmit or onSubmit is running. */
  isSubmitting: boolean
  /**
   * Error thrown by the onSubmit callback (not validation errors).
   * null when no submit error has occurred.
   */
  submitError: string | null
  /** True when there are zero validation errors. */
  isValid: boolean
  /** Update a single field's value. */
  setFieldValue: <K extends keyof T>(name: K, value: T[K]) => void
  /**
   * Trigger validation and, if valid, call onSubmit.
   * Should be called from a form's onSubmit handler with preventDefault already called.
   */
  handleSubmit: () => Promise<void>
  /** Reset the form to its initial values and clear all errors. */
  resetForm: () => void
}

export default function useFormValidation<T extends FormValues>(
  options: UseFormValidationOptions<T>,
): UseFormValidationReturn<T> {
  const { initialValues, validate, onSubmit } = options

  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setFieldValue = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const validationResult = await validate(values)
      const hasErrors = Object.keys(validationResult).length > 0

      setErrors(validationResult)

      if (!hasErrors) {
        await onSubmit(values)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validate, onSubmit])

  const resetForm = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setSubmitError(null)
  }, [initialValues])

  const isValid = Object.keys(errors).length === 0

  return {
    values,
    errors,
    isSubmitting,
    submitError,
    isValid,
    setFieldValue,
    handleSubmit,
    resetForm,
  }
}
