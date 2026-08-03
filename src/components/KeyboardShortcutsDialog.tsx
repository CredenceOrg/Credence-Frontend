import { useCallback, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useScrollPreserver } from '../hooks/useScrollPreserver'
import { KEYBOARD_SHORTCUTS, type KeyboardShortcut } from '../data/keyboardShortcuts'
import Button from './Button'
import Kbd from './Kbd'
import './KeyboardShortcutsDialog.css'

export interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
  /**
   * Optional ref whose element will receive focus after the dialog closes.
   * When omitted, focus returns to whichever element was active before opening.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

/** Groups an array of shortcuts by their `group` field, preserving insertion order. */
function groupShortcuts(shortcuts: KeyboardShortcut[]): Map<string, KeyboardShortcut[]> {
  const map = new Map<string, KeyboardShortcut[]>()
  for (const shortcut of shortcuts) {
    const existing = map.get(shortcut.group)
    if (existing) {
      existing.push(shortcut)
    } else {
      map.set(shortcut.group, [shortcut])
    }
  }
  return map
}

/** Translates modifier keys to their platform-specific symbols (e.g. Mac). */
export function formatModifierKey(
  key: string,
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): string {
  const isMac = /Mac|iPod|iPhone|iPad/.test(userAgent)
  if (!isMac) return key

  switch (key) {
    case 'Ctrl':
      return '⌘'
    case 'Alt':
      return '⌥'
    case 'Shift':
      return '⇧'
    default:
      return key
  }
}

const GROUPED = groupShortcuts(KEYBOARD_SHORTCUTS)

/**
 * Dialog dialog listing all global keyboard shortcuts.
 *
 * - Renders via a React portal into `document.body`.
 * - Focus is trapped inside while open; restored on close.
 * - Escape closes the dialog.
 * - Backdrop click closes the dialog.
 */
export default function KeyboardShortcutsDialog({
  open,
  onClose,
  returnFocusRef,
}: KeyboardShortcutsDialogProps) {
  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useScrollPreserver({ isActive: open })

  useFocusTrap({
    containerRef: dialogRef,
    isActive: open,
    initialFocusRef: closeButtonRef,
    returnFocusRef,
    onEscape: handleClose,
  })

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose()
    }
  }

  if (!open) return null

  return createPortal(
    <div className="shortcuts-dialog__backdrop" onClick={handleBackdropClick} aria-hidden={false}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="shortcuts-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shortcuts-dialog__header">
          <h2 id={titleId} className="shortcuts-dialog__title">
            Keyboard Shortcuts
          </h2>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            className="shortcuts-dialog__close"
            aria-label="Close keyboard shortcuts"
            onClick={handleClose}
          >
            {/* × character */}
            <span aria-hidden="true">&#x2715;</span>
            <span className="sr-only">Close keyboard shortcuts</span>
          </Button>
        </header>

        <div id={descId} className="shortcuts-dialog__body">
          {Array.from(GROUPED.entries()).map(([group, shortcuts]) => (
            <section key={group} className="shortcuts-dialog__group">
              <h3 className="shortcuts-dialog__group-heading">{group}</h3>
              <ul className="shortcuts-dialog__list" role="list">
                {shortcuts.map((shortcut) => (
                  <li key={shortcut.label} className="shortcuts-dialog__item">
                    <span className="shortcuts-dialog__label">{shortcut.label}</span>
                    <span className="shortcuts-dialog__keys" aria-label={shortcut.keys.join(' + ')}>
                      {shortcut.keys.map((key, index) => (
                        <span key={key} className="shortcuts-dialog__key-group">
                          {index > 0 && (
                            <span className="shortcuts-dialog__key-plus" aria-hidden="true">
                              +
                            </span>
                          )}
                          <Kbd className="shortcuts-dialog__kbd">{formatModifierKey(key)}</Kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="shortcuts-dialog__footer">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
