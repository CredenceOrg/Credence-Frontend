import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SegmentedControl, { type SegmentedControlOption } from './SegmentedControl'

type ThemeMode = 'light' | 'dark' | 'system'

const THEME_OPTIONS: SegmentedControlOption<ThemeMode>[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

describe('SegmentedControl', () => {
  it('renders a radiogroup with the provided ariaLabel and radio options', () => {
    render(
      <SegmentedControl
        id="theme-mode"
        ariaLabel="Theme mode"
        value="light"
        onChange={vi.fn()}
        options={THEME_OPTIONS}
      />
    )

    const group = screen.getByRole('radiogroup', { name: 'Theme mode' })
    expect(group).toBeInTheDocument()
    expect(group).toHaveAttribute('id', 'theme-mode')
    expect(group).not.toHaveAttribute('aria-disabled')

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(radios.map((radio) => radio.textContent)).toEqual(['Light', 'Dark', 'System'])
  })

  it('sets aria-checked and selected styling only on the active option', () => {
    render(
      <SegmentedControl
        ariaLabel="Theme mode"
        value="dark"
        onChange={vi.fn()}
        options={THEME_OPTIONS}
      />
    )

    const light = screen.getByRole('radio', { name: 'Light' })
    const dark = screen.getByRole('radio', { name: 'Dark' })
    const system = screen.getByRole('radio', { name: 'System' })

    expect(light).toHaveAttribute('aria-checked', 'false')
    expect(dark).toHaveAttribute('aria-checked', 'true')
    expect(system).toHaveAttribute('aria-checked', 'false')

    expect(dark).toHaveClass('control-segmented__option--selected')
    expect(light).not.toHaveClass('control-segmented__option--selected')
    expect(system).not.toHaveClass('control-segmented__option--selected')
  })

  it('calls onChange with the clicked option value when selecting a non-selected option', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <SegmentedControl
        ariaLabel="Theme mode"
        value="light"
        onChange={handleChange}
        options={THEME_OPTIONS}
      />
    )

    await user.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith('dark')
  })

  it('does not re-fire onChange when clicking the already selected option', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <SegmentedControl
        ariaLabel="Theme mode"
        value="system"
        onChange={handleChange}
        options={THEME_OPTIONS}
      />
    )

    await user.click(screen.getByRole('radio', { name: 'System' }))

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('disables all options and prevents callbacks when disabled is true', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <SegmentedControl
        ariaLabel="Theme mode"
        value="light"
        onChange={handleChange}
        options={THEME_OPTIONS}
        disabled
      />
    )

    const group = screen.getByRole('radiogroup', { name: 'Theme mode' })
    expect(group).toHaveAttribute('aria-disabled', 'true')

    const radios = screen.getAllByRole('radio')
    for (const radio of radios) {
      expect(radio).toBeDisabled()
      await user.click(radio)
    }

    expect(handleChange).not.toHaveBeenCalled()
  })
})
