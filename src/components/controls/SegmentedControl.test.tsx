import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SegmentedControl, { type SegmentedControlOption } from './SegmentedControl'

type Theme = 'light' | 'dark' | 'system'

const OPTIONS: SegmentedControlOption<Theme>[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

/** Controlled harness: selection only moves when the consumer accepts it. */
function Harness({
  initial = 'light',
  direction,
  disabled,
  onChange,
}: {
  initial?: Theme
  direction?: 'ltr' | 'rtl'
  disabled?: boolean
  onChange?: (next: Theme) => void
}) {
  const [value, setValue] = useState<Theme>(initial)
  return (
    <div dir={direction}>
      <SegmentedControl
        ariaLabel="Theme mode"
        value={value}
        options={OPTIONS}
        disabled={disabled}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
    </div>
  )
}

function option(name: string) {
  return screen.getByRole('radio', { name })
}

describe('SegmentedControl', () => {
  it('exposes a radiogroup with the checked option marked checked', () => {
    render(<Harness initial="dark" />)

    expect(screen.getByRole('radiogroup', { name: 'Theme mode' })).toBeInTheDocument()
    expect(option('Dark')).toHaveAttribute('aria-checked', 'true')
    expect(option('Light')).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps a single tab stop on the checked option', () => {
    render(<Harness initial="dark" />)

    expect(option('Dark')).toHaveAttribute('tabindex', '0')
    expect(option('Light')).toHaveAttribute('tabindex', '-1')
    expect(option('System')).toHaveAttribute('tabindex', '-1')
  })

  it('falls back to the first option as the tab stop when no option is checked', () => {
    render(
      <SegmentedControl
        ariaLabel="Theme mode"
        value={'unknown' as Theme}
        options={OPTIONS}
        onChange={vi.fn()}
      />
    )

    expect(option('Light')).toHaveAttribute('tabindex', '0')
    expect(option('Dark')).toHaveAttribute('tabindex', '-1')
  })

  it('moves focus into the group at the checked option with Tab', async () => {
    const user = userEvent.setup()
    render(<Harness initial="system" />)

    await user.tab()

    expect(option('System')).toHaveFocus()
  })

  it('moves focus and selection to the next option with ArrowRight', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Harness initial="light" onChange={handleChange} />)

    option('Light').focus()
    await user.keyboard('{ArrowRight}')

    expect(handleChange).toHaveBeenCalledWith('dark')
    expect(option('Dark')).toHaveFocus()
    expect(option('Dark')).toHaveAttribute('aria-checked', 'true')
    expect(option('Dark')).toHaveAttribute('tabindex', '0')
    expect(option('Light')).toHaveAttribute('tabindex', '-1')
  })

  it('wraps from the last option to the first with ArrowRight', async () => {
    const user = userEvent.setup()
    render(<Harness initial="system" />)

    option('System').focus()
    await user.keyboard('{ArrowRight}')

    expect(option('Light')).toHaveFocus()
    expect(option('Light')).toHaveAttribute('aria-checked', 'true')
  })

  it('moves backwards with ArrowLeft and wraps from the first option to the last', async () => {
    const user = userEvent.setup()
    render(<Harness initial="dark" />)

    option('Dark').focus()
    await user.keyboard('{ArrowLeft}')
    expect(option('Light')).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(option('System')).toHaveFocus()
    expect(option('System')).toHaveAttribute('aria-checked', 'true')
  })

  it('supports ArrowDown and ArrowUp as vertical equivalents', async () => {
    const user = userEvent.setup()
    render(<Harness initial="light" />)

    option('Light').focus()
    await user.keyboard('{ArrowDown}')
    expect(option('Dark')).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(option('Light')).toHaveFocus()
  })

  it('jumps to the first and last option with Home and End', async () => {
    const user = userEvent.setup()
    render(<Harness initial="dark" />)

    option('Dark').focus()
    await user.keyboard('{End}')
    expect(option('System')).toHaveFocus()
    expect(option('System')).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{Home}')
    expect(option('Light')).toHaveFocus()
    expect(option('Light')).toHaveAttribute('aria-checked', 'true')
  })

  it('reverses the horizontal arrows in a right-to-left container', async () => {
    const user = userEvent.setup()
    render(<Harness initial="dark" direction="rtl" />)

    option('Dark').focus()
    await user.keyboard('{ArrowRight}')

    expect(option('Light')).toHaveFocus()
    expect(option('Light')).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(option('Dark')).toHaveFocus()
  })

  it('does not handle arrow keys or fire onChange while disabled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Harness initial="light" disabled onChange={handleChange} />)

    expect(option('Light')).toBeDisabled()
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{End}')

    expect(handleChange).not.toHaveBeenCalled()
    expect(option('Light')).toHaveAttribute('aria-checked', 'true')
  })

  it('marks the group aria-disabled when disabled', () => {
    render(<Harness disabled />)

    expect(screen.getByRole('radiogroup', { name: 'Theme mode' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })
})
type ThemeMode = 'light' | 'dark' | 'system'
const THEME_OPTIONS: SegmentedControlOption<ThemeMode>[] = [
  it('renders a radiogroup with the provided ariaLabel and radio options', () => {
        id="theme-mode"
        value="light"
        options={THEME_OPTIONS}
    const group = screen.getByRole('radiogroup', { name: 'Theme mode' })
    expect(group).toBeInTheDocument()
    expect(group).toHaveAttribute('id', 'theme-mode')
    expect(group).not.toHaveAttribute('aria-disabled')
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(radios.map((radio) => radio.textContent)).toEqual(['Light', 'Dark', 'System'])
  it('sets aria-checked and selected styling only on the active option', () => {
        value="dark"
        options={THEME_OPTIONS}
    const light = screen.getByRole('radio', { name: 'Light' })
    const dark = screen.getByRole('radio', { name: 'Dark' })
    const system = screen.getByRole('radio', { name: 'System' })
    expect(light).toHaveAttribute('aria-checked', 'false')
    expect(dark).toHaveAttribute('aria-checked', 'true')
    expect(system).toHaveAttribute('aria-checked', 'false')
    expect(dark).toHaveClass('control-segmented__option--selected')
    expect(light).not.toHaveClass('control-segmented__option--selected')
    expect(system).not.toHaveClass('control-segmented__option--selected')
  it('calls onChange with the clicked option value when selecting a non-selected option', async () => {
        value="light"
        onChange={handleChange}
        options={THEME_OPTIONS}
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(handleChange).toHaveBeenCalledTimes(1)
  it('does not re-fire onChange when clicking the already selected option', async () => {
        value="system"
        onChange={handleChange}
        options={THEME_OPTIONS}
    await user.click(screen.getByRole('radio', { name: 'System' }))
  it('disables all options and prevents callbacks when disabled is true', async () => {
        value="light"
        onChange={handleChange}
        options={THEME_OPTIONS}
        disabled
    const group = screen.getByRole('radiogroup', { name: 'Theme mode' })
    expect(group).toHaveAttribute('aria-disabled', 'true')
    const radios = screen.getAllByRole('radio')
    for (const radio of radios) {
      expect(radio).toBeDisabled()
      await user.click(radio)
    }
