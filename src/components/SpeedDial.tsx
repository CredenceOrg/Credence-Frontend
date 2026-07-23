import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './SpeedDial.css'

/** A single action shown in the speed-dial menu. */
export interface SpeedDialAction {
  /** Machine-readable id, used as the React key. */
  id: string
  /** Human-readable label shown in the pill next to the icon. */
  label: string
  /** Route to navigate to when the action is activated. */
  to: string
  /** Icon rendered inside the mini button (SVG element). */
  icon: React.ReactNode
  /** Accessible label for the icon button (overrides `label` if provided). */
  ariaLabel?: string
}

export interface SpeedDialProps {
  /**
   * Override the default actions (Send / Receive / Swap).
   * Primarily useful for testing or white-labelling.
   */
  actions?: SpeedDialAction[]
}

/* ── Default icons ───────────────────────────────────────────────────────── */

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ReceiveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3v14M5 14l7 7 7-7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 19h18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

const SwapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7 16V4m0 0L3 8m4-4l4 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 8v12m0 0l4-4m-4 4l-4-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

/* ── Default actions ─────────────────────────────────────────────────────── */

const DEFAULT_ACTIONS: SpeedDialAction[] = [
  {
    id: 'send',
    label: 'Send',
    to: '/transactions?action=send',
    icon: <SendIcon />,
    ariaLabel: 'Send funds',
  },
  {
    id: 'receive',
    label: 'Receive',
    to: '/transactions?action=receive',
    icon: <ReceiveIcon />,
    ariaLabel: 'Receive funds',
  },
  {
    id: 'swap',
    label: 'Swap',
    to: '/transactions?action=swap',
    icon: <SwapIcon />,
    ariaLabel: 'Swap assets',
  },
]

/* ── Component ───────────────────────────────────────────────────────────── */

/**
 * SpeedDial – mobile-only floating action button (≤768 px) that expands to
 * reveal Send, Receive, and Swap shortcuts.
 *
 * Accessibility contract:
 * - The FAB has `aria-expanded` and `aria-controls` referencing the action list.
 * - The action list has `role="list"` and each item has an accessible label.
 * - Pressing Escape closes the menu and returns focus to the FAB.
 * - Focus is trapped inside the open menu (Tab / Shift+Tab cycle within it).
 * - The whole widget is wrapped in a `<nav>` with an accessible name so screen
 *   reader users can skip or navigate to it easily.
 */
export default function SpeedDial({ actions = DEFAULT_ACTIONS }: SpeedDialProps) {
  const [isOpen, setIsOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const navigate = useNavigate()

  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  /* Close on Escape, move focus back to FAB */
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        fabRef.current?.focus()
      }

      /* Basic Tab-trap: keep Tab / Shift+Tab inside the open list + FAB */
      if (e.key === 'Tab' && listRef.current) {
        const focusable = Array.from(
          listRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])'
          )
        )
        if (!focusable.length) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === fabRef.current) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            fabRef.current?.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close])

  /* Close when clicking outside */
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent) => {
      const fab = fabRef.current
      const list = listRef.current
      if (
        fab &&
        list &&
        !fab.contains(e.target as Node) &&
        !list.contains(e.target as Node)
      ) {
        close()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, close])

  /* Move focus into the list when it opens */
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const firstAction = listRef.current.querySelector<HTMLElement>(
      'a[href], button:not(:disabled)'
    )
    firstAction?.focus()
  }, [isOpen])

  const handleActionClick = useCallback(
    (to: string) => {
      close()
      navigate(to)
    },
    [close, navigate]
  )

  const listId = 'speed-dial-actions'

  return (
    <nav className="speedDial" aria-label="Quick actions">
      {/* Action list – rendered first in DOM so FAB (order:2) sits on top */}
      <ul
        id={listId}
        ref={listRef}
        className={`speedDial__actions${isOpen ? ' speedDial__actions--open' : ''}`}
        role="list"
        aria-label="Quick action menu"
      >
        {actions.map((action) => (
          <li key={action.id} className="speedDial__item">
            <span className="speedDial__label" aria-hidden="true">
              {action.label}
            </span>
            <button
              type="button"
              className="speedDial__action"
              aria-label={action.ariaLabel ?? action.label}
              tabIndex={isOpen ? 0 : -1}
              onClick={() => handleActionClick(action.to)}
            >
              {action.icon}
            </button>
          </li>
        ))}
      </ul>

      {/* FAB toggle */}
      <button
        ref={fabRef}
        type="button"
        className={`speedDial__fab${isOpen ? ' speedDial__fab--open' : ''}`}
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={toggle}
      >
        <span className="speedDial__fabIcon">
          <PlusIcon />
        </span>
      </button>
    </nav>
  )
}

export { DEFAULT_ACTIONS as SPEED_DIAL_DEFAULT_ACTIONS }
