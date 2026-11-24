// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppearanceSection from './AppearanceSection'

describe('AppearanceSection', () => {
  it('renders heading and theme options and invokes onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<AppearanceSection themeMode="light" onChange={onChange} />)

    expect(screen.getByRole('heading', { level: 2, name: /appearance/i })).toBeInTheDocument()
    const darkOption = screen.getByRole('radio', { name: /dark/i })
    await user.click(darkOption)

    expect(onChange).toHaveBeenCalledWith('dark')
  })
})
