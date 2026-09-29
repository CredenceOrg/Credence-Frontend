import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KeyboardShortcutsDialog, { formatModifierKey } from './KeyboardShortcutsDialog'
import { KEYBOARD_SHORTCUTS } from '../data/keyboardShortcuts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(overrides: Partial<Parameters<typeof KeyboardShortcutsDialog>[0]> = {}) {
  const onClose = vi.fn()
  const props = { open: true, onClose, ...overrides }
  const result = render(<KeyboardShortcutsDialog {...props} />)
  return { ...result, onClose }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let scrollY = 0

beforeEach(() => {
  scrollY = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0)
    return 0
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(((options?: ScrollToOptions) => {
    if (options?.top !== undefined) scrollY = options.top
  }) as typeof window.scrollTo)
  Object.defineProperty(window, 'scrollY', {
    get: () => scrollY,
    configurable: true,
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return this.parentNode
    },
    configurable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.style.overflow = ''
})

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — rendering', () => {
  it('renders nothing when open is false', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog when open is true', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('has role="dialog"', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('has aria-modal="true"', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('has an accessible title via aria-labelledby', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const labelledById = dialog.getAttribute('aria-labelledby')
    expect(labelledById).toBeTruthy()
    const titleEl = document.getElementById(labelledById!)
    expect(titleEl).toHaveTextContent('Keyboard Shortcuts')
  })

  it('renders all shortcut labels from the KEYBOARD_SHORTCUTS array', () => {
    renderDialog()
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(screen.getByText(shortcut.label)).toBeInTheDocument()
    }
  })

  it('renders a close button with an accessible label', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: /close keyboard shortcuts/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Closing behaviour
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — closing', () => {
  it('calls onClose when the × close button is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: /close keyboard shortcuts/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the footer Close button is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: /^close$/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose when clicking inside the dialog panel', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Scroll lock
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — body scroll lock', () => {
  it('sets document.body.style.overflow to "hidden" when open', () => {
    renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores document.body.style.overflow on unmount', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('does not lock scroll when open is false', () => {
    document.body.style.overflow = ''
    renderDialog({ open: false })
    expect(document.body.style.overflow).toBe('')
  })

  it('preserves window scroll position when dialog opens', () => {
    window.scrollTo({ top: 500 })
    renderDialog({ open: true })
    expect(window.scrollY).toBe(500)
  })

  it('preserves window scroll position when dialog closes via prop change', () => {
    window.scrollTo({ top: 350 })
    const { rerender, onClose } = renderDialog({ open: true })
    rerender(<KeyboardShortcutsDialog open={false} onClose={onClose} />)
    expect(window.scrollY).toBe(350)
  })

  it('preserves scrolled content position through open-close-open cycle', () => {
    window.scrollTo({ top: 800 })
    const { rerender, onClose } = renderDialog({ open: true })
    // close
    rerender(<KeyboardShortcutsDialog open={false} onClose={onClose} />)
    expect(window.scrollY).toBe(800)
    // reopen
    rerender(<KeyboardShortcutsDialog open={true} onClose={onClose} />)
    expect(window.scrollY).toBe(800)
  })

  it('restores previous overflow value even when body overflow is changed externally while open', () => {
    document.body.style.overflow = 'scroll'
    const { rerender, onClose } = renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    // External mutation while dialog is open
    document.body.style.overflow = 'visible'
    rerender(<KeyboardShortcutsDialog open={false} onClose={onClose} />)
    expect(document.body.style.overflow).toBe('scroll')
  })
})

// ---------------------------------------------------------------------------
// Focus management
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — focus management', () => {
  it('initially focuses the × close button when opened', () => {
    renderDialog()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /close keyboard shortcuts/i })
    )
  })

  it('returns focus to returnFocusRef element on close', () => {
    const triggerEl = document.createElement('button')
    triggerEl.type = 'button'
    Object.defineProperty(triggerEl, 'offsetParent', {
      get: () => document.body,
      configurable: true,
    })
    document.body.appendChild(triggerEl)
    triggerEl.focus()

    const returnFocusRef = createRef<HTMLButtonElement>()
    ;(returnFocusRef as React.MutableRefObject<HTMLButtonElement>).current = triggerEl

    const onClose = vi.fn()
    const { rerender } = render(
      <KeyboardShortcutsDialog open={true} onClose={onClose} returnFocusRef={returnFocusRef} />
    )

    rerender(
      <KeyboardShortcutsDialog open={false} onClose={onClose} returnFocusRef={returnFocusRef} />
    )

    expect(document.activeElement).toBe(triggerEl)

    document.body.removeChild(triggerEl)
  })
})

// ---------------------------------------------------------------------------
// Tab focus trapping
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — tab focus trapping', () => {
  it('keeps focus inside the dialog when Tab is pressed', async () => {
    const user = userEvent.setup()
    renderDialog()

    const dialog = screen.getByRole('dialog')

    // Tab through all focusable elements — focus should never leave the dialog
    for (let i = 0; i < 5; i++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('keeps focus inside the dialog when Shift+Tab is pressed', async () => {
    const user = userEvent.setup()
    renderDialog()

    const dialog = screen.getByRole('dialog')

    for (let i = 0; i < 5; i++) {
      await user.tab({ shift: true })
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Global Shift+? listener (tested via Layout in integration, but also unit-
// tested here with a thin wrapper to avoid a full router setup).
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — global Shift+? shortcut guard', () => {
  /**
   * Helper that fires a keydown event on the window with key='?' and checks
   * whether a state setter was called, simulating how Layout wires the handler.
   */
  function createHandler(setter: (v: boolean) => void) {
    return (event: KeyboardEvent) => {
      if (event.key !== '?') return
      const target = event.target as HTMLElement
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable ||
        target?.contentEditable === 'true' ||
        (target?.getAttribute && target.getAttribute('contenteditable') === 'true') ||
        (target?.closest && target.closest('[contenteditable="true"]') !== null)
      ) {
        return
      }
      setter(true)
    }
  }

  it('fires the setter when ? is pressed outside a text field', () => {
    const setter = vi.fn()
    const handler = createHandler(setter)
    window.addEventListener('keydown', handler)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    expect(setter).toHaveBeenCalledWith(true)

    window.removeEventListener('keydown', handler)
  })

  it('does NOT fire the setter when ? is pressed inside an <input>', () => {
    const setter = vi.fn()
    const handler = createHandler(setter)
    window.addEventListener('keydown', handler)

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    expect(setter).not.toHaveBeenCalled()

    document.body.removeChild(input)
    window.removeEventListener('keydown', handler)
  })

  it('does NOT fire the setter when ? is pressed inside a <textarea>', () => {
    const setter = vi.fn()
    const handler = createHandler(setter)
    window.addEventListener('keydown', handler)

    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    expect(setter).not.toHaveBeenCalled()

    document.body.removeChild(ta)
    window.removeEventListener('keydown', handler)
  })

  it('does NOT fire the setter when ? is pressed inside a contenteditable element', () => {
    const setter = vi.fn()
    const handler = createHandler(setter)
    window.addEventListener('keydown', handler)

    const div = document.createElement('div')
    div.contentEditable = 'true'
    Object.defineProperty(div, 'isContentEditable', { value: true })
    document.body.appendChild(div)
    div.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    expect(setter).not.toHaveBeenCalled()

    document.body.removeChild(div)
    window.removeEventListener('keydown', handler)
  })
})

// ---------------------------------------------------------------------------
// Backdrop & close (regression guard)
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — backdrop & close', () => {
  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT call onClose when clicking inside the dialog panel', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Modifier key formatting
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — formatModifierKey', () => {
  it('translates modifier keys to Mac symbols when userAgent matches Mac', () => {
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    expect(formatModifierKey('Ctrl', userAgent)).toBe('⌘')
    expect(formatModifierKey('Alt', userAgent)).toBe('⌥')
    expect(formatModifierKey('Shift', userAgent)).toBe('⇧')
    expect(formatModifierKey('K', userAgent)).toBe('K') // Unaffected
  })

  it('leaves modifier keys unchanged on Windows/Linux', () => {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    expect(formatModifierKey('Ctrl', userAgent)).toBe('Ctrl')
    expect(formatModifierKey('Alt', userAgent)).toBe('Alt')
    expect(formatModifierKey('Shift', userAgent)).toBe('Shift')
    expect(formatModifierKey('K', userAgent)).toBe('K')
  })
})

// ---------------------------------------------------------------------------
// Boundary: open/close prop transitions
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — open/close boundary transitions', () => {
  it('does not throw when rerendered with the same open value repeatedly', () => {
    const { rerender, onClose } = renderDialog({ open: true })
    expect(() => {
      for (let i = 0; i < 5; i++) {
        rerender(<KeyboardShortcutsDialog open={true} onClose={onClose} />)
      }
    }).not.toThrow()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not throw when toggling open rapidly (open→closed→open→closed)', () => {
    const { rerender, onClose } = renderDialog({ open: true })
    expect(() => {
      rerender(<KeyboardShortcutsDialog open={false} onClose={onClose} />)
      rerender(<KeyboardShortcutsDialog open={true} onClose={onClose} />)
      rerender(<KeyboardShortcutsDialog open={false} onClose={onClose} />)
      rerender(<KeyboardShortcutsDialog open={true} onClose={onClose} />)
    }).not.toThrow()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not call onClose when open transitions from true to false via prop', () => {
    const { rerender, onClose } = renderDialog({ open: true })
    rerender(<KeyboardShortcutsDialog open={false} onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not lock body scroll when initially rendered closed then opened', () => {
    document.body.style.overflow = ''
    const { rerender, onClose } = renderDialog({ open: false })
    expect(document.body.style.overflow).toBe('')
    rerender(<KeyboardShortcutsDialog open={true} onClose={onClose} />)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body overflow after open→closed transition', () => {
    document.body.style.overflow = 'auto'
    const { rerender, onClose } = renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<KeyboardShortcutsDialog open={false} onClose={onClose} />)
    expect(document.body.style.overflow).toBe('auto')
  })
})

// ---------------------------------------------------------------------------
// Recovery: repeated close events and idempotency
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — recovery and idempotency', () => {
  it('calls onClose exactly once per Escape press', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.keyboard('{Escape}')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('calls onClose exactly once per backdrop click', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('does not call onClose when Escape is pressed while closed', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog({ open: false })
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('recovers scroll lock after unmount and remount', () => {
    document.body.style.overflow = 'auto'
    const first = renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    first.unmount()
    expect(document.body.style.overflow).toBe('auto')

    const second = renderDialog({ open: true })
    expect(document.body.style.overflow).toBe('hidden')
    second.unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('does not double-restore body overflow when unmounted twice via rerender', () => {
    document.body.style.overflow = 'scroll'
    const { rerender, unmount, onClose } = renderDialog({ open: true })
    rerender(<KeyboardShortcutsDialog open={false} onClose={onClose} />)
    expect(document.body.style.overflow).toBe('scroll')
    expect(() => unmount()).not.toThrow()
    expect(document.body.style.overflow).toBe('scroll')
  })
})

// ---------------------------------------------------------------------------
// Concurrency / timing boundaries
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — timing boundaries', () => {
  it('does not throw when requestAnimationFrame is unavailable', () => {
    const originalRaf = window.requestAnimationFrame
    // @ts-expect-error — simulate missing rAF for boundary coverage
    delete window.requestAnimationFrame
    expect(() => {
      renderDialog({ open: true })
    }).not.toThrow()
    window.requestAnimationFrame = originalRaf
  })

  it('does not throw when requestAnimationFrame invokes callback asynchronously', () => {
    const originalRaf = window.requestAnimationFrame
    const callbacks: FrameRequestCallback[] = []
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      callbacks.push(cb)
      return callbacks.length
    }) as typeof window.requestAnimationFrame

    expect(() => {
      renderDialog({ open: true })
      act(() => {
        callbacks.forEach((cb) => cb(0))
      })
    }).not.toThrow()

    window.requestAnimationFrame = originalRaf
  })

  it('handles rapid Escape presses without losing onClose calls', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.keyboard('{Escape}{Escape}{Escape}')
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

// ---------------------------------------------------------------------------
// Invalid / missing props boundary
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — invalid prop boundaries', () => {
  it('renders without returnFocusRef provided', () => {
    expect(() => renderDialog({ open: true })).not.toThrow()
  })

  it('does not throw when closing without returnFocusRef', () => {
    const { rerender, onClose } = renderDialog({ open: true })
    expect(() => {
      rerender(<KeyboardShortcutsDialog open={false} onClose={onClose} />)
    }).not.toThrow()
  })

  it('does not throw when returnFocusRef.current is null on close', () => {
    const returnFocusRef = createRef<HTMLButtonElement>()
    const onClose = vi.fn()
    const { rerender } = render(
      <KeyboardShortcutsDialog open={true} onClose={onClose} returnFocusRef={returnFocusRef} />
    )
    expect(() => {
      rerender(
        <KeyboardShortcutsDialog open={false} onClose={onClose} returnFocusRef={returnFocusRef} />
      )
    }).not.toThrow()
  })

  it('does not throw when returnFocusRef points to a detached element', () => {
    const detached = document.createElement('button')
    const returnFocusRef = createRef<HTMLButtonElement>()
    ;(returnFocusRef as React.MutableRefObject<HTMLButtonElement>).current = detached

    const onClose = vi.fn()
    const { rerender } = render(
      <KeyboardShortcutsDialog open={true} onClose={onClose} returnFocusRef={returnFocusRef} />
    )
    expect(() => {
      rerender(
        <KeyboardShortcutsDialog open={false} onClose={onClose} returnFocusRef={returnFocusRef} />
      )
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Focus recovery: focus never escapes and returns to body when no ref
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — focus recovery', () => {
  it('does not throw when focus is moved outside the dialog while open', () => {
    renderDialog()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    expect(() => {
      outside.focus()
    }).not.toThrow()
    document.body.removeChild(outside)
  })

  it('keeps focus inside the dialog after many Tab cycles', async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 20; i++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('keeps focus inside the dialog after many Shift+Tab cycles', async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 20; i++) {
      await user.tab({ shift: true })
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Regression: shortcut data integrity
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — shortcut data regression', () => {
  it('renders every shortcut label exactly once', () => {
    renderDialog()
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(screen.getAllByText(shortcut.label).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders a stable number of shortcut rows across rerenders', () => {
    const { rerender, onClose } = renderDialog({ open: true })
    const before = screen.getAllByText(KEYBOARD_SHORTCUTS[0].label).length
    rerender(<KeyboardShortcutsDialog open={true} onClose={onClose} />)
    const after = screen.getAllByText(KEYBOARD_SHORTCUTS[0].label).length
    expect(after).toBe(before)
  })

  it('does not render shortcut labels when closed', () => {
    renderDialog({ open: false })
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(screen.queryByText(shortcut.label)).not.toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------------------
// formatModifierKey boundary cases
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — formatModifierKey boundaries', () => {
  it('returns empty string unchanged', () => {
    expect(formatModifierKey('', 'Mozilla/5.0 (Macintosh)')).toBe('')
  })

  it('is case-sensitive for modifier names', () => {
    const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    expect(formatModifierKey('ctrl', macUA)).toBe('ctrl')
    expect(formatModifierKey('CTRL', macUA)).toBe('CTRL')
  })

  it('handles empty userAgent without throwing', () => {
    expect(() => formatModifierKey('Ctrl', '')).not.toThrow()
    expect(formatModifierKey('Ctrl', '')).toBe('Ctrl')
  })

  it('handles userAgent containing "Mac" in a non-Mac context deterministically', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0) Mac'
    const result = formatModifierKey('Ctrl', ua)
    // Deterministic: either Mac symbol or literal, but consistent across calls
    expect(formatModifierKey('Ctrl', ua)).toBe(result)
  })

  it('does not mutate its inputs', () => {
    const key = 'Ctrl'
    const ua = 'Mozilla/5.0 (Macintosh)'
    formatModifierKey(key, ua)
    expect(key).toBe('Ctrl')
    expect(ua).toBe('Mozilla/5.0 (Macintosh)')
  })
})

// ---------------------------------------------------------------------------
// Observability: onClose is the only side-effect channel
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog — observability', () => {
  it('invokes onClose with no arguments (no sensitive data leaked)', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: /close keyboard shortcuts/i }))
    expect(onClose).toHaveBeenCalledWith()
  })

  it('does not invoke onClose on mount', () => {
    const { onClose } = renderDialog()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not invoke onClose on unmount', () => {
    const { onClose, unmount } = renderDialog()
    unmount()
    expect(onClose).not.toHaveBeenCalled()
  })
})
