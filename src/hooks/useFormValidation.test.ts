import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import useFormValidation from './useFormValidation'

interface TestFormValues {
  name: string
  email: string
}

// ---- Helpers ----

function requiredFieldsValidator(values: TestFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.name.trim()) {
    errors.name = 'Name is required.'
  }
  if (!values.email.trim()) {
    errors.email = 'Email is required.'
  }
  return errors
}

async function asyncRequiredFieldsValidator(
  values: TestFormValues,
): Promise<Record<string, string>> {
  // Simulate a network round-trip (e.g. checking email uniqueness)
  await new Promise((r) => setTimeout(r, 10))
  const errors: Record<string, string> = {}
  if (!values.name.trim()) {
    errors.name = 'Name is required.'
  }
  if (!values.email.trim()) {
    errors.email = 'Email is required.'
  }
  return errors
}

// ---- Happy path ----

describe('useFormValidation happy path', () => {
  it('calls_onSubmit_when_all_fields_are_valid', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: 'Alice', email: 'alice@example.com' },
        validate: requiredFieldsValidator,
        onSubmit,
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Alice',
      email: 'alice@example.com',
    })
    expect(result.current.isValid).toBe(true)
    expect(result.current.submitError).toBeNull()
  })

  it('sets_isSubmitting_false_after_valid_submit_completes', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: 'Alice', email: 'alice@example.com' },
        validate: requiredFieldsValidator,
        onSubmit,
      }),
    )

    expect(result.current.isSubmitting).toBe(false)

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('calls_onSubmit_when_async_validation_passes', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: 'Alice', email: 'alice@example.com' },
        validate: asyncRequiredFieldsValidator,
        onSubmit,
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Alice',
      email: 'alice@example.com',
    })
  })
})

// ---- Sad path ----

describe('useFormValidation sad path', () => {
  it('does_not_call_onSubmit_when_validation_fails', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: '', email: '' },
        validate: requiredFieldsValidator,
        onSubmit,
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(result.current.errors).toEqual({
      name: 'Name is required.',
      email: 'Email is required.',
    })
    expect(result.current.isValid).toBe(false)
  })

  it('does_not_call_onSubmit_when_one_field_is_invalid', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: 'Alice', email: '' },
        validate: requiredFieldsValidator,
        onSubmit,
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(result.current.errors).toEqual({
      email: 'Email is required.',
    })
    expect(result.current.errors.name).toBeUndefined()
    expect(result.current.isValid).toBe(false)
  })

  it('does_not_call_onSubmit_when_async_validation_fails', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: '', email: '' },
        validate: asyncRequiredFieldsValidator,
        onSubmit,
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(result.current.errors).toEqual({
      name: 'Name is required.',
      email: 'Email is required.',
    })
    expect(result.current.isValid).toBe(false)
  })

  it('captures_submitError_when_onSubmit_throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: 'Alice', email: 'alice@example.com' },
        validate: requiredFieldsValidator,
        onSubmit,
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(result.current.submitError).toBe('Network error')
    expect(result.current.isSubmitting).toBe(false)
  })

  it('captures_submitError_when_onSubmit_throws_non_error', async () => {
    const onSubmit = vi.fn().mockRejectedValue('plain string error')
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: 'Alice', email: 'alice@example.com' },
        validate: requiredFieldsValidator,
        onSubmit,
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(result.current.submitError).toBe('plain string error')
  })
})

// ---- Field management ----

describe('useFormValidation field management', () => {
  it('setFieldValue_updates_a_single_field', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: '', email: '' },
        validate: requiredFieldsValidator,
        onSubmit: vi.fn(),
      }),
    )

    act(() => {
      result.current.setFieldValue('name', 'Bob')
    })

    expect(result.current.values.name).toBe('Bob')
    expect(result.current.values.email).toBe('')
  })

  it('resetForm_restores_initial_values_and_clears_errors', async () => {
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: '', email: '' },
        validate: requiredFieldsValidator,
        onSubmit,
      }),
    )

    // Trigger validation errors
    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(result.current.errors).not.toEqual({})

    // Reset
    act(() => {
      result.current.resetForm()
    })

    expect(result.current.values).toEqual({ name: '', email: '' })
    expect(result.current.errors).toEqual({})
    expect(result.current.submitError).toBeNull()
    expect(result.current.isValid).toBe(true)
  })

  it('resetForm_clears_submitError', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: 'Alice', email: 'alice@example.com' },
        validate: requiredFieldsValidator,
        onSubmit,
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(result.current.submitError).not.toBeNull()

    act(() => {
      result.current.resetForm()
    })

    expect(result.current.submitError).toBeNull()
  })
})

// ---- Async validation specifics ----

describe('useFormValidation async validation', () => {
  it('awaits_async_validation_before_calling_onSubmit', async () => {
    let validationStarted = false
    let validationFinished = false

    async function trackingValidate(
      _values: TestFormValues,
    ): Promise<Record<string, string>> {
      validationStarted = true
      await new Promise((r) => setTimeout(r, 20))
      validationFinished = true
      return {}
    }

    const onSubmit = vi.fn().mockImplementation(() => {
      // onSubmit should only fire after validation finishes
      expect(validationFinished).toBe(true)
    })

    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: 'Alice', email: 'alice@example.com' },
        validate: trackingValidate,
        onSubmit,
      }),
    )

    expect(validationStarted).toBe(false)

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(validationStarted).toBe(true)
    expect(validationFinished).toBe(true)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('handles_async_validation_rejection_as_submitError', async () => {
    async function throwingValidate(): Promise<Record<string, string>> {
      throw new Error('Validation service unavailable')
    }

    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: { name: 'Alice', email: 'alice@example.com' },
        validate: throwingValidate,
        onSubmit,
      }),
    )

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(result.current.submitError).toBe('Validation service unavailable')
    expect(result.current.isSubmitting).toBe(false)
  })
})
