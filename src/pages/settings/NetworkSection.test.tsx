// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NetworkSection from './NetworkSection'

describe('NetworkSection', () => {
  it('renders network select and invokes onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<NetworkSection network="public" onChange={onChange} />)

    expect(screen.getByRole('heading', { level: 2, name: /network/i })).toBeInTheDocument()
    const select = screen.getByLabelText(/stellar network/i)
    await user.selectOptions(select, 'test')

    expect(onChange).toHaveBeenCalledWith('test')
  })
})
