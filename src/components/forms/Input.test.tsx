import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FormField } from './FormField'
import { Input } from './Input'
import { Textarea } from './Textarea'

describe('Input', () => {
  it('renders a textbox with form-input class', () => {
    render(<Input aria-label="Amount" />)
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveClass('form-input')
  })

  it('applies compact modifier', () => {
    render(<Input aria-label="Time" compact />)
    expect(screen.getByRole('textbox', { name: 'Time' })).toHaveClass('form-input--compact')
  })

  it('receives FormField accessibility attributes', () => {
    render(
      <FormField id="bond-amount" label="Bond amount" hint="USDC" error="Required">
        <Input />
      </FormField>
    )

    const input = screen.getByRole('textbox', { name: 'Bond amount' })
    expect(input).toHaveAttribute('id', 'bond-amount')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'bond-amount-hint bond-amount-error')
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
  })

  it('announces success via FormField without aria-invalid', () => {
    render(
      <FormField id="quiet-end" label="End time" success="Looks good">
        <Input compact />
      </FormField>
    )

    const input = screen.getByRole('textbox', { name: 'End time' })
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toHaveAttribute('aria-describedby', 'quiet-end-success')
    expect(screen.getByRole('status')).toHaveTextContent('Looks good')
  })
})

describe('Textarea', () => {
  it('renders with form-textarea class and FormField wiring', () => {
    render(
      <FormField id="evidence" label="Evidence" error="Too long">
        <Textarea />
      </FormField>
    )

    const area = screen.getByRole('textbox', { name: 'Evidence' })
    expect(area.tagName).toBe('TEXTAREA')
    expect(area).toHaveClass('form-textarea')
    expect(area).toHaveAttribute('aria-invalid', 'true')
    expect(area).toHaveAttribute('aria-describedby', 'evidence-error')
  })
})
