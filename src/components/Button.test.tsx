/**
 * @file Button.test.tsx
 * @description Tests for the Button primitive component.
 *
 * Coverage targets (≥ 90% branches per acceptance criteria):
 *   - Variant class composition: primary / secondary / ghost / danger
 *   - fullWidth class toggling
 *   - isLoading: aria-busy, disabled gating, spinner rendered, content class
 *   - disabled prop alone gates interaction
 *   - isLoading + disabled both set simultaneously
 *   - forwardRef resolves to the underlying <button> element
 *   - default type="button" and explicit type overrides
 *   - onClick suppressed when disabled or isLoading
 *   - custom className appended, not overwritten
 *   - children always rendered inside content span
 *
 * @see {@link docs/button-system.md} for full behavioral specification.
 * @see {@link Button.tsx} for the implementation under test.
 */

import { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Button from './Button'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the rendered <button> element by its accessible role.
 * Optionally matches by accessible name when `name` is supplied.
 */
function getBtn(name?: string | RegExp) {
  return name
    ? screen.getByRole('button', { name })
    : screen.getByRole('button')
}

// ---------------------------------------------------------------------------
// 1. Default rendering
// ---------------------------------------------------------------------------

describe('Button – default rendering', () => {
  it('renders the children text inside a span', () => {
    render(<Button>Click me</Button>)
    expect(getBtn()).toBeInTheDocument()
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('wraps children in a content span (always present)', () => {
    const { container } = render(<Button>Content</Button>)
    const btn = container.querySelector('button')
    const contentSpan = btn?.querySelector('span:not(.credence-button__spinner)')
    expect(contentSpan).toBeInTheDocument()
    expect(contentSpan?.textContent).toBe('Content')
  })

  it('defaults to type="button" to prevent accidental form submission', () => {
    render(<Button>Submit</Button>)
    expect(getBtn()).toHaveAttribute('type', 'button')
  })

  it('accepts an explicit type="submit" override', () => {
    render(<Button type="submit">Go</Button>)
    expect(getBtn()).toHaveAttribute('type', 'submit')
  })

  it('accepts an explicit type="reset" override', () => {
    render(<Button type="reset">Reset</Button>)
    expect(getBtn()).toHaveAttribute('type', 'reset')
  })

  it('applies the base credence-button class', () => {
    render(<Button>Base</Button>)
    expect(getBtn()).toHaveClass('credence-button')
  })

  it('is not disabled by default', () => {
    render(<Button>Enabled</Button>)
    expect(getBtn()).not.toBeDisabled()
  })

  it('does not carry aria-busy when neither isLoading nor disabled', () => {
    render(<Button>Normal</Button>)
    // aria-busy defaults to false (falsy) — attribute either absent or "false"
    const btn = getBtn()
    const ariaBusy = btn.getAttribute('aria-busy')
    expect(ariaBusy === null || ariaBusy === 'false').toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. Variant class composition
// ---------------------------------------------------------------------------

describe('Button – variant class composition', () => {
  it('applies credence-button--primary class for variant="primary" (default)', () => {
    render(<Button variant="primary">Primary</Button>)
    expect(getBtn()).toHaveClass('credence-button--primary')
  })

  it('applies credence-button--secondary class for variant="secondary"', () => {
    render(<Button variant="secondary">Secondary</Button>)
    expect(getBtn()).toHaveClass('credence-button--secondary')
    expect(getBtn()).not.toHaveClass('credence-button--primary')
  })

  it('applies credence-button--ghost class for variant="ghost"', () => {
    render(<Button variant="ghost">Ghost</Button>)
    expect(getBtn()).toHaveClass('credence-button--ghost')
    expect(getBtn()).not.toHaveClass('credence-button--primary')
  })

  it('applies credence-button--danger class for variant="danger"', () => {
    render(<Button variant="danger">Danger</Button>)
    expect(getBtn()).toHaveClass('credence-button--danger')
    expect(getBtn()).not.toHaveClass('credence-button--primary')
  })

  it('applies primary variant by default when variant prop is omitted', () => {
    render(<Button>No variant</Button>)
    expect(getBtn()).toHaveClass('credence-button--primary')
  })

  it('each variant produces exactly one variant class', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger'] as const
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>V</Button>)
      const btn = getBtn()
      const variantClasses = ['primary', 'secondary', 'ghost', 'danger'].filter((v) =>
        btn.classList.contains(`credence-button--${v}`)
      )
      expect(variantClasses).toHaveLength(1)
      expect(variantClasses[0]).toBe(variant)
      unmount()
    }
  })
})

// ---------------------------------------------------------------------------
// 3. fullWidth class
// ---------------------------------------------------------------------------

describe('Button – fullWidth prop', () => {
  it('does not apply full-width class by default', () => {
    render(<Button>Inline</Button>)
    expect(getBtn()).not.toHaveClass('credence-button--full-width')
  })

  it('applies credence-button--full-width when fullWidth=true', () => {
    render(<Button fullWidth>Wide</Button>)
    expect(getBtn()).toHaveClass('credence-button--full-width')
  })

  it('does not apply full-width class when fullWidth=false', () => {
    render(<Button fullWidth={false}>Narrow</Button>)
    expect(getBtn()).not.toHaveClass('credence-button--full-width')
  })
})

// ---------------------------------------------------------------------------
// 4. Custom className
// ---------------------------------------------------------------------------

describe('Button – custom className', () => {
  it('appends a custom className without removing base classes', () => {
    render(<Button className="my-custom">Custom</Button>)
    const btn = getBtn()
    expect(btn).toHaveClass('credence-button')
    expect(btn).toHaveClass('credence-button--primary')
    expect(btn).toHaveClass('my-custom')
  })

  it('appends multiple custom classes', () => {
    render(<Button className="foo bar">Multi</Button>)
    const btn = getBtn()
    expect(btn).toHaveClass('foo')
    expect(btn).toHaveClass('bar')
    expect(btn).toHaveClass('credence-button')
  })
})

// ---------------------------------------------------------------------------
// 5. disabled prop
// ---------------------------------------------------------------------------

describe('Button – disabled prop', () => {
  it('disables the button when disabled=true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(getBtn()).toBeDisabled()
  })

  it('does not fire onClick when disabled', async () => {
    const handler = vi.fn()
    render(
      <Button disabled onClick={handler}>
        Disabled
      </Button>
    )
    // fireEvent bypasses browser disabled guard; userEvent respects it
    await userEvent.click(getBtn())
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not fire onClick via fireEvent when disabled (native gate)', () => {
    const handler = vi.fn()
    render(
      <Button disabled onClick={handler}>
        Disabled
      </Button>
    )
    fireEvent.click(getBtn())
    expect(handler).not.toHaveBeenCalled()
  })

  it('is not aria-busy when only disabled (not loading)', () => {
    render(<Button disabled>Disabled only</Button>)
    const btn = getBtn()
    const ariaBusy = btn.getAttribute('aria-busy')
    expect(ariaBusy === null || ariaBusy === 'false').toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. isLoading state
// ---------------------------------------------------------------------------

describe('Button – isLoading state', () => {
  it('sets aria-busy="true" when isLoading=true', () => {
    render(<Button isLoading>Loading</Button>)
    expect(getBtn()).toHaveAttribute('aria-busy', 'true')
  })

  it('disables the button while loading (isDisabled = disabled || isLoading)', () => {
    render(<Button isLoading>Loading</Button>)
    expect(getBtn()).toBeDisabled()
  })

  it('renders the spinner element when isLoading=true', () => {
    const { container } = render(<Button isLoading>Loading</Button>)
    const spinner = container.querySelector('.credence-button__spinner')
    expect(spinner).toBeInTheDocument()
  })

  it('spinner has aria-hidden="true" so screen readers ignore the SVG', () => {
    const { container } = render(<Button isLoading>Loading</Button>)
    const spinner = container.querySelector('.credence-button__spinner')
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the spinner SVG with the correct class', () => {
    const { container } = render(<Button isLoading>Loading</Button>)
    const svg = container.querySelector('.credence-button__spinner-icon')
    expect(svg).toBeInTheDocument()
  })

  it('applies credence-button__content--loading class to the content span', () => {
    const { container } = render(<Button isLoading>Content</Button>)
    const contentSpan = container.querySelector('.credence-button__content--loading')
    expect(contentSpan).toBeInTheDocument()
    expect(contentSpan?.textContent).toBe('Content')
  })

  it('does NOT apply credence-button__content--loading when not loading', () => {
    const { container } = render(<Button>Normal</Button>)
    expect(container.querySelector('.credence-button__content--loading')).toBeNull()
  })

  it('does not render the spinner when isLoading=false', () => {
    const { container } = render(<Button isLoading={false}>Normal</Button>)
    expect(container.querySelector('.credence-button__spinner')).toBeNull()
  })

  it('does not render the spinner when isLoading is omitted', () => {
    const { container } = render(<Button>Normal</Button>)
    expect(container.querySelector('.credence-button__spinner')).toBeNull()
  })

  it('suppresses onClick while loading (userEvent)', async () => {
    const handler = vi.fn()
    render(
      <Button isLoading onClick={handler}>
        Loading
      </Button>
    )
    await userEvent.click(getBtn())
    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses onClick while loading (fireEvent — native disabled gate)', () => {
    const handler = vi.fn()
    render(
      <Button isLoading onClick={handler}>
        Loading
      </Button>
    )
    fireEvent.click(getBtn())
    expect(handler).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 7. isLoading + disabled both set simultaneously
// ---------------------------------------------------------------------------

describe('Button – isLoading AND disabled both set', () => {
  it('is disabled when both isLoading and disabled are true', () => {
    render(
      <Button isLoading disabled>
        Both
      </Button>
    )
    expect(getBtn()).toBeDisabled()
  })

  it('has aria-busy="true" when isLoading=true even if disabled is also true', () => {
    render(
      <Button isLoading disabled>
        Both
      </Button>
    )
    expect(getBtn()).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the spinner when both isLoading and disabled are set', () => {
    const { container } = render(
      <Button isLoading disabled>
        Both
      </Button>
    )
    expect(container.querySelector('.credence-button__spinner')).toBeInTheDocument()
  })

  it('suppresses onClick when both isLoading and disabled are set', () => {
    const handler = vi.fn()
    render(
      <Button isLoading disabled onClick={handler}>
        Both
      </Button>
    )
    fireEvent.click(getBtn())
    expect(handler).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 8. onClick fires correctly when enabled
// ---------------------------------------------------------------------------

describe('Button – onClick when enabled', () => {
  it('fires onClick when clicked and not disabled or loading', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Click</Button>)
    await userEvent.click(getBtn())
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('fires onClick multiple times on multiple clicks', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Multi</Button>)
    await userEvent.click(getBtn())
    await userEvent.click(getBtn())
    await userEvent.click(getBtn())
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it('receives the MouseEvent on click', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Event</Button>)
    await userEvent.click(getBtn())
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }))
  })
})

// ---------------------------------------------------------------------------
// 9. forwardRef — resolves to the underlying <button> DOM element
// ---------------------------------------------------------------------------

describe('Button – forwardRef', () => {
  it('forwards a ref and resolves to an HTMLButtonElement', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Ref target</Button>)
    expect(ref.current).not.toBeNull()
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('ref points to the same node as the rendered button', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Node check</Button>)
    const btn = getBtn()
    expect(ref.current).toBe(btn)
  })

  it('ref can be used to call focus() — simulating ConfirmDialog initial focus', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Focus target</Button>)
    ref.current?.focus()
    expect(document.activeElement).toBe(ref.current)
  })

  it('ref is stable across re-renders that do not change variant', () => {
    const ref = createRef<HTMLButtonElement>()
    const { rerender } = render(<Button ref={ref}>Stable</Button>)
    const first = ref.current
    rerender(<Button ref={ref}>Stable updated</Button>)
    expect(ref.current).toBe(first)
  })

  it('forwarded ref works with all variants', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger'] as const
    for (const variant of variants) {
      const ref = createRef<HTMLButtonElement>()
      const { unmount } = render(
        <Button ref={ref} variant={variant}>
          {variant}
        </Button>
      )
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
      unmount()
    }
  })
})

// ---------------------------------------------------------------------------
// 10. Prop pass-through (spread via ...props)
// ---------------------------------------------------------------------------

describe('Button – arbitrary prop pass-through', () => {
  it('passes data-* attributes through to the button element', () => {
    render(<Button data-testid="my-btn">Data</Button>)
    expect(screen.getByTestId('my-btn')).toBeInTheDocument()
  })

  it('passes aria-label through to the button element', () => {
    render(<Button aria-label="Close dialog">×</Button>)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument()
  })

  it('passes id through to the button element', () => {
    render(<Button id="submit-btn">Go</Button>)
    expect(document.getElementById('submit-btn')).toBeInTheDocument()
  })

  it('passes tabIndex through to the button element', () => {
    render(<Button tabIndex={-1}>Hidden from tab</Button>)
    expect(getBtn()).toHaveAttribute('tabindex', '-1')
  })
})

// ---------------------------------------------------------------------------
// 11. Keyboard interaction
// ---------------------------------------------------------------------------

describe('Button – keyboard interaction', () => {
  it('fires onClick on Enter key when focused and enabled', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Keyboard</Button>)
    getBtn().focus()
    await userEvent.keyboard('{Enter}')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('fires onClick on Space key when focused and enabled', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Space</Button>)
    getBtn().focus()
    await userEvent.keyboard(' ')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick on Enter when disabled', async () => {
    const handler = vi.fn()
    render(
      <Button disabled onClick={handler}>
        Disabled Keyboard
      </Button>
    )
    getBtn().focus()
    await userEvent.keyboard('{Enter}')
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not fire onClick on Enter when isLoading', async () => {
    const handler = vi.fn()
    render(
      <Button isLoading onClick={handler}>
        Loading Keyboard
      </Button>
    )
    // Button is disabled while loading, so focus won't land there naturally
    fireEvent.keyDown(getBtn(), { key: 'Enter' })
    expect(handler).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 12. Snapshot — class string shape
// ---------------------------------------------------------------------------

describe('Button – class string shape (no stray spaces regression)', () => {
  it('class string has no leading/double spaces for all variant+fullWidth combos', () => {
    const cases = [
      { variant: 'primary' as const, fullWidth: false },
      { variant: 'primary' as const, fullWidth: true },
      { variant: 'secondary' as const, fullWidth: false },
      { variant: 'ghost' as const, fullWidth: false },
      { variant: 'danger' as const, fullWidth: false },
    ]
    for (const { variant, fullWidth } of cases) {
      const { unmount } = render(
        <Button variant={variant} fullWidth={fullWidth}>
          Test
        </Button>
      )
      const cls = getBtn().className
      // Should not have consecutive spaces
      expect(cls).not.toMatch(/\s{2,}/)
      unmount()
    }
  })
})
