// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DisplaySection from './DisplaySection'

describe('DisplaySection', () => {
  it('renders display address format options and invokes onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DisplaySection addressDisplay="short" onChange={onChange} />)

    expect(screen.getByRole('heading', { level: 2, name: /display/i })).toBeInTheDocument()
    const fullOption = screen.getByRole('radio', { name: /full/i })
    await user.click(fullOption)

    expect(onChange).toHaveBeenCalledWith('full')
  })
})
