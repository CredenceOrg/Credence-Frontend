import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FormField } from './FormField'

describe('FormField Accessibility', () => {
  it('propagates the id from FormField to its child input', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('id', 'test-field')
  })

  it('renders the label element pointing to the input id', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input />
      </FormField>
    )

    const label = screen.getByText('Test Label')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', 'test-field')
  })

  it('handles the path when there is no hint and no error', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(input).not.toHaveAttribute('aria-invalid')

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('handles hint-only path and sets aria-describedby', () => {
    render(
      <FormField id="test-field" label="Test Label" hint="This is a hint">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-hint')
    expect(input).not.toHaveAttribute('aria-invalid')

    const hint = screen.getByText('This is a hint')
    expect(hint).toHaveAttribute('id', 'test-field-hint')
    expect(hint).toHaveClass('form-hint')
  })

  it('handles error-only path, sets aria-describedby, and sets aria-invalid="true"', () => {
    render(
      <FormField id="test-field" label="Test Label" error="This is an error">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    const errorMsg = screen.getByText('⚠ This is an error')
    expect(errorMsg).toHaveAttribute('id', 'test-field-error')
    expect(errorMsg).toHaveAttribute('role', 'alert')
    expect(errorMsg).toHaveClass('form-error')
  })

  it('merges both hint and error IDs into aria-describedby on the child input', () => {
    render(
      <FormField id="test-field" label="Test Label" hint="This is a hint" error="This is an error">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-hint test-field-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('preserves pre-existing aria-describedby value on the child input', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input data-testid="child-input" aria-describedby="existing-desc" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'existing-desc')
  })

  it('merges pre-existing aria-describedby with hint and error IDs', () => {
    render(
      <FormField id="test-field" label="Test Label" hint="This is a hint" error="This is an error">
        <input data-testid="child-input" aria-describedby="existing-desc" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute(
      'aria-describedby',
      'existing-desc test-field-hint test-field-error'
    )
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
})
