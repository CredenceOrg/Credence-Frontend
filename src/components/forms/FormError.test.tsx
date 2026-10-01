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

  it('omits the id attribute when no id is supplied', () => {
    // Behavior under test: FormField only renders the id when it also renders
    // the message, so a message rendered without an id must not emit an empty
    // id="" that a stale aria-describedby IDREF could still match against.
    render(<FormError>Address is invalid</FormError>)

    const alert = screen.getByRole('alert')
    expect(alert.hasAttribute('id')).toBe(false)
    expect(alert).toHaveTextContent('⚠ Address is invalid')
  })
})
