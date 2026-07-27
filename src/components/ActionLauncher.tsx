import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useLocalStorage } from '../hooks/useLocalStorage'
import Button from './Button'
import VirtualizedList from './VirtualizedList'
import {
  ACTION_LAUNCHER_ITEMS,
  ACTION_LAUNCHER_RECENT_ACTIONS_KEY,
  type ActionLauncherItem,
} from '../config/navigation'
import './ActionLauncher.css'

const MAX_RECENT_ACTIONS = 5

function fuzzyScore(text: string, query: string): number | null {
  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return 0

  let score = 0
  let index = 0

  for (const char of normalizedQuery) {
    const found = normalizedText.indexOf(char, index)
    if (found === -1) return null

    score += 1
    if (found === index) score += 2
    if (found === 0) score += 3
    index = found + 1
  }

  score -= normalizedText.length * 0.01
  return score
}

function getItemScore(item: ActionLauncherItem, query: string): number | null {
  const haystack = `${item.label} ${item.description}`
  return fuzzyScore(haystack, query)
}

function sortResults(items: ActionLauncherItem[], query: string, recentOrder: string[]) {
  return [...items].sort((left, right) => {
    const leftRecent = recentOrder.indexOf(left.id)
    const rightRecent = recentOrder.indexOf(right.id)

    if (leftRecent !== rightRecent) {
      if (leftRecent === -1) return 1
      if (rightRecent === -1) return -1
      return leftRecent - rightRecent
    }

    const leftScore = getItemScore(left, query) ?? 0
    const rightScore = getItemScore(right, query) ?? 0
    if (leftScore !== rightScore) return rightScore - leftScore

    return left.label.localeCompare(right.label)
  })
}

function filterResults(items: ActionLauncherItem[], query: string) {
  const trimmed = query.trim()
  if (!trimmed) return items
  return items.filter((item) => getItemScore(item, trimmed) !== null)
}

function clampRecentActions(recent: string[]) {
  return recent.slice(0, MAX_RECENT_ACTIONS)
}

export interface ActionLauncherProps {
  open: boolean
  onClose: () => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
  onOpenKeyboardShortcuts: () => void
}

export default function ActionLauncher({
  open,
  onClose,
  returnFocusRef,
  onOpenKeyboardShortcuts,
}: ActionLauncherProps) {
  const [query, setQuery] = useState('')
  const [recentActionIds, setRecentActionIds] = useLocalStorage<string[]>(
    ACTION_LAUNCHER_RECENT_ACTIONS_KEY,
    []
  )
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    setQuery('')
  }, [open])

  const results = useMemo(() => {
    const filtered = filterResults(ACTION_LAUNCHER_ITEMS, query)
    return sortResults(filtered, query, recentActionIds)
  }, [query, recentActionIds])

  const recentActions = useMemo(
    () =>
      recentActionIds
        .map((id) => ACTION_LAUNCHER_ITEMS.find((item) => item.id === id))
        .filter((item): item is ActionLauncherItem => Boolean(item))
        .filter(
          (item, index, self) => self.findIndex((candidate) => candidate.id === item.id) === index
        )
        .slice(0, MAX_RECENT_ACTIONS),
    [recentActionIds]
  )

  const updateRecent = useCallback(
    (id: string) => {
      setRecentActionIds(
        clampRecentActions([id, ...recentActionIds.filter((existing: string) => existing !== id)])
      )
    },
    [recentActionIds, setRecentActionIds]
  )

  const handleSelect = useCallback(
    (item: ActionLauncherItem) => {
      onClose()
      updateRecent(item.id)

      if (item.action === 'open-keyboard-shortcuts') {
        onOpenKeyboardShortcuts()
        return
      }
      if (item.to) {
        navigate(item.to)
      }
    },
    [navigate, onClose, onOpenKeyboardShortcuts, updateRecent]
  )

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  useFocusTrap({
    containerRef: dialogRef,
    isActive: open,
    initialFocusRef: inputRef,
    returnFocusRef,
    onEscape: onClose,
  })

  if (!open) return null

  return createPortal(
    <div className="action-launcher__backdrop" onClick={handleBackdropClick} aria-hidden={false}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="action-launcher"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="action-launcher__header">
          <div>
            <h2 id={titleId} className="action-launcher__title">
              Command launcher
            </h2>
            <p id={descId} className="action-launcher__description">
              Navigate instantly with fuzzy search.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="action-launcher__close"
            aria-label="Close command launcher"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </Button>
        </header>

        <div className="action-launcher__body">
          <label htmlFor="action-launcher-search" className="sr-only">
            Search actions
          </label>
          <input
            ref={inputRef}
            id="action-launcher-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and actions…"
            className="action-launcher__input"
          />

          {query.trim() === '' && recentActions.length > 0 && (
            <section className="action-launcher__section">
              <h3 className="action-launcher__section-heading">Recent actions</h3>
              <VirtualizedList
                items={recentActions}
                itemHeight={72}
                height={240}
                className="action-launcher__list"
                containerClassName="action-launcher__list-container"
                getKey={(item) => item.id}
                renderItem={(item) => (
                  <button
                    type="button"
                    className="action-launcher__item"
                    onClick={() => handleSelect(item)}
                  >
                    <span className="action-launcher__item-label">{item.label}</span>
                    <span className="action-launcher__item-description">{item.description}</span>
                  </button>
                )}
                emptyMessage={<p className="action-launcher__empty">No recent actions</p>}
              />
            </section>
          )}

          <section className="action-launcher__section">
            <h3 className="action-launcher__section-heading">Actions</h3>
            {results.length > 0 ? (
              <VirtualizedList
                items={results}
                itemHeight={72}
                height={320}
                className="action-launcher__list"
                containerClassName="action-launcher__list-container"
                getKey={(item) => item.id}
                renderItem={(item) => (
                  <button
                    type="button"
                    className="action-launcher__item"
                    onClick={() => handleSelect(item)}
                  >
                    <span className="action-launcher__item-label">{item.label}</span>
                    <span className="action-launcher__item-description">{item.description}</span>
                  </button>
                )}
                emptyMessage={<p className="action-launcher__empty">No matching actions</p>}
              />
            ) : (
              <p className="action-launcher__empty">No matching actions</p>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  )
}
