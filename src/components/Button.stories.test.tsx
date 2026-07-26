import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Button, { ButtonProps } from './Button'
import { Primary, Disabled } from './Button.stories'

describe('Button Stories', () => {
  it('happy-path: renders the Primary story correctly', () => {
    // We test that the story args can be used to render the component correctly
    render(<Button {...(Primary.args as ButtonProps)} />)
    const button = screen.getByRole('button', { name: /Primary Button/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('failure-mode: Disabled story renders a disabled button', () => {
    // Tests an explicit "failure" or disabled mode of the component
    render(<Button {...(Disabled.args as ButtonProps)} />)
    const button = screen.getByRole('button', { name: /Disabled Button/i })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })
})
