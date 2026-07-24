import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
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

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0)
    return 0
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
    expect(
      screen.getByRole('button', { name: /close keyboard shortcuts/i })
    ).toBeInTheDocument()
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
    document.body.appendChild(div)
    div.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    expect(setter).not.toHaveBeenCalled()

    document.body.removeChild(div)
    window.removeEventListener('keydown', handler)
  })
})
