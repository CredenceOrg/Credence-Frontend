import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Button, { ButtonProps } from './Button'
import { Primary, Disabled, Link, Small, Large } from './Button.stories'

describe('Button Stories', () => {
  it('happy-path: renders the Primary story correctly', () => {
    render(<Button {...(Primary.args as ButtonProps)} />)
    const button = screen.getByRole('button', { name: /Primary Button/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('failure-mode: Disabled story renders a disabled button', () => {
    render(<Button {...(Disabled.args as ButtonProps)} />)
    const button = screen.getByRole('button', { name: /Disabled Button/i })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('Link story renders a link-variant button', () => {
    render(<Button {...(Link.args as ButtonProps)} />)
    const button = screen.getByRole('button', { name: /Link Button/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('credence-button--link')
    expect(button).not.toBeDisabled()
  })

  it('Small story renders with sm size class', () => {
    render(<Button {...(Small.args as ButtonProps)} />)
    const button = screen.getByRole('button', { name: /Small/i })
    expect(button).toHaveClass('credence-button--sm')
  })

  it('Large story renders with lg size class', () => {
    render(<Button {...(Large.args as ButtonProps)} />)
    const button = screen.getByRole('button', { name: /Large/i })
    expect(button).toHaveClass('credence-button--lg')
  })
})
