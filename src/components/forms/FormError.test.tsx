import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormError } from './FormError'

describe('FormError', () => {
  it('renders one shared alert shape for form validation messages', () => {
    render(<FormError id="address-error">Address is invalid</FormError>)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('id', 'address-error')
    expect(alert).toHaveTextContent('⚠ Address is invalid')
  })
})
