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

  it('renders a visually hidden sr-only label when srOnlyLabel is true', () => {
    render(
      <FormField id="search-field" label="Search" srOnlyLabel>
        <input placeholder="Search attestations…" />
      </FormField>
    )

    const label = screen.getByText('Search')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveClass('sr-only')
    expect(label).toHaveAttribute('for', 'search-field')
  })

  it('associates sr-only label with the control for screen reader accessible name', () => {
    render(
      <FormField id="search-field" label="Search" srOnlyLabel>
        <input placeholder="Search attestations…" />
      </FormField>
    )

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveAttribute('id', 'search-field')
  })

  it('does not apply sr-only class to the label by default', () => {
    render(
      <FormField id="test-field" label="Test Label">
        <input />
      </FormField>
    )

    const label = screen.getByText('Test Label')
    expect(label).not.toHaveClass('sr-only')
  })

  it('handles success-only path with role="status" and aria-describedby', () => {
    render(
      <FormField id="test-field" label="Test Label" success="Looks good">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-success')
    expect(input).not.toHaveAttribute('aria-invalid')

    const success = screen.getByRole('status')
    expect(success).toHaveAttribute('id', 'test-field-success')
    expect(success).toHaveClass('form-success')
    expect(success).toHaveTextContent('Looks good')
    expect(document.querySelector('.form-field')).toHaveAttribute('data-state', 'success')
  })

  it('merges hint and success IDs into aria-describedby', () => {
    render(
      <FormField id="test-field" label="Test Label" hint="Helpful hint" success="Looks good">
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-hint test-field-success')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('suppresses success when error is present (error takes precedence)', () => {
    render(
      <FormField
        id="test-field"
        label="Test Label"
        hint="Helpful hint"
        error="Required"
        success="Looks good"
      >
        <input data-testid="child-input" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-describedby', 'test-field-hint test-field-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('⚠ Required')
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelector('.form-field')).toHaveAttribute('data-state', 'error')
  })

  it('marks required fields with aria-required and a visible asterisk', () => {
    render(
      <FormField id="test-field" label="Test Label" required>
        <input data-testid="child-input" />
      </FormField>
    )

    expect(screen.getByTestId('child-input')).toHaveAttribute('aria-required', 'true')
    expect(document.querySelector('.form-required')).toHaveTextContent('*')
  })

  it('preserves child aria-invalid when FormField has no error of its own', () => {
    render(
      <FormField id="end-time" label="End time">
        <input data-testid="child-input" aria-invalid="true" aria-describedby="start-time-error" />
      </FormField>
    )

    const input = screen.getByTestId('child-input')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'start-time-error')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
