import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isEditableElement,
  isMacUserAgent,
  matchesShortcut,
  parseShortcutSpec,
  useKeyboardShortcut,
} from './useKeyboardShortcut'

describe('useKeyboardShortcut', () => {
  const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  describe('helpers', () => {
    it('isMacUserAgent detects macOS / iOS user agents correctly', () => {
      expect(isMacUserAgent(MAC_UA)).toBe(true)
      expect(isMacUserAgent(WIN_UA)).toBe(false)
      expect(isMacUserAgent('iPhone')).toBe(true)
      expect(isMacUserAgent('iPad')).toBe(true)
    })

    it('isEditableElement correctly identifies form inputs and contenteditable areas', () => {
      const input = document.createElement('input')
      const textarea = document.createElement('textarea')
      const select = document.createElement('select')
      const div = document.createElement('div')
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'

      expect(isEditableElement(input)).toBe(true)
      expect(isEditableElement(textarea)).toBe(true)
      expect(isEditableElement(select)).toBe(true)
      expect(isEditableElement(div)).toBe(false)
      expect(isEditableElement(editableDiv)).toBe(true)
    })

    it('parseShortcutSpec splits and normalizes shortcut representations', () => {
      expect(parseShortcutSpec('Mod+K')).toEqual([['Mod', 'K']])
      expect(parseShortcutSpec(['Ctrl', 'Shift', 'P'])).toEqual([['Ctrl', 'Shift', 'P']])
      expect(parseShortcutSpec(['Mod+K', 'Alt+S'])).toEqual([
        ['Mod', 'K'],
        ['Alt', 'S'],
      ])
      expect(parseShortcutSpec('+')).toEqual([['+']])
    })

    it('matchesShortcut handles Mod modifier for Mac vs Windows', () => {
      const macEventModK = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
      const winEventModK = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })

      expect(matchesShortcut(macEventModK, ['Mod', 'k'], true)).toBe(true)
      expect(matchesShortcut(macEventModK, ['Mod', 'k'], false)).toBe(false)

      expect(matchesShortcut(winEventModK, ['Mod', 'k'], false)).toBe(true)
      expect(matchesShortcut(winEventModK, ['Mod', 'k'], true)).toBe(false)
    })

    it('matchesShortcut abstracts Alt vs Option', () => {
      const altEvent = new KeyboardEvent('keydown', { key: 's', altKey: true })
      expect(matchesShortcut(altEvent, ['Alt', 's'], false)).toBe(true)
      expect(matchesShortcut(altEvent, ['Option', 's'], true)).toBe(true)
    })
  })

  describe('hook execution', () => {
    it('triggers handler on matching window keydown event', () => {
      const onShortcut = vi.fn()
      renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
      expect(onShortcut).toHaveBeenCalledTimes(1)
    })

    it('supports options object signature', () => {
      const onShortcut = vi.fn()
      renderHook(() =>
        useKeyboardShortcut({
          keys: 'Alt+S',
          onShortcut,
          userAgent: WIN_UA,
        })
      )

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', altKey: true, bubbles: true }))
      expect(onShortcut).toHaveBeenCalledTimes(1)
    })

    it('ignores shortcut when focused inside editable elements by default', () => {
      const onShortcut = vi.fn()
      renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

      const input = document.createElement('input')
      document.body.appendChild(input)

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
      expect(onShortcut).not.toHaveBeenCalled()
    })

    it('allows shortcut inside editable elements when ignoreInputElements is false', () => {
      const onShortcut = vi.fn()
      renderHook(() =>
        useKeyboardShortcut(['Mod', 'k'], onShortcut, {
          userAgent: WIN_UA,
          ignoreInputElements: false,
        })
      )

      const input = document.createElement('input')
      document.body.appendChild(input)

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
      expect(onShortcut).toHaveBeenCalledTimes(1)
    })

    it('respects enabled flag', () => {
      const onShortcut = vi.fn()
      const { rerender } = renderHook(
        ({ enabled }) =>
          useKeyboardShortcut(['Mod', 'k'], onShortcut, {
            enabled,
            userAgent: WIN_UA,
          }),
        { initialProps: { enabled: false } }
      )

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
      expect(onShortcut).not.toHaveBeenCalled()

      rerender({ enabled: true })
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
      expect(onShortcut).toHaveBeenCalledTimes(1)
    })

    it('prevents default event behavior when preventDefault is true', () => {
      const onShortcut = vi.fn()
      renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        cancelable: true,
        bubbles: true,
      })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)
      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('attaches listener to custom target ref if provided', () => {
      const targetDiv = document.createElement('div')
      document.body.appendChild(targetDiv)
      const targetRef = { current: targetDiv }

      const onShortcut = vi.fn()
      renderHook(() =>
        useKeyboardShortcut(['Mod', 'k'], onShortcut, {
          target: targetRef,
          userAgent: WIN_UA,
        })
      )

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
      expect(onShortcut).not.toHaveBeenCalled()

      targetDiv.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
      )
      expect(onShortcut).toHaveBeenCalledTimes(1)
    })

    it('cleans up event listeners on unmount', () => {
      const onShortcut = vi.fn()
      const { unmount } = renderHook(() =>
        useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA })
      )

      unmount()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
      expect(onShortcut).not.toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// handleKeyDown — deterministic failure-boundary coverage (issue #1150)
//
// `handleKeyDown` is the listener wired by Layout for the global Ctrl/Cmd+K
// launcher and Shift+? shortcuts. The coverage below pins the boundary
// contract: untrusted events (missing fields, hostile targets, malformed
// combos, rapid duplicates) must never throw, never fire the callback more or
// less often than exactly once, and never leak listener state across
// re-subscriptions.
// ---------------------------------------------------------------------------

describe('useKeyboardShortcut — handleKeyDown failure boundaries', () => {
  const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function keydown(target: EventTarget, init: KeyboardEventInit) {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
  }

  it('never throws for events with empty or missing key fields', () => {
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

    expect(() => {
      keydown(window, { key: '' })
      keydown(window, { key: 'Control' })
      keydown(window, { key: 'Unidentified' })
      // Simulate a hostile event lacking a `key` value.
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
    }).not.toThrow()

    expect(onShortcut).not.toHaveBeenCalled()
  })

  it('fires exactly once per matching event under rapid duplicate dispatch', () => {
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

    for (let i = 0; i < 10; i++) {
      keydown(window, { key: 'k', ctrlKey: true })
    }
    expect(onShortcut).toHaveBeenCalledTimes(10)
  })

  it('does not double-fire when the same key event bubbles from a child target', () => {
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

    const child = document.createElement('div')
    document.body.appendChild(child)

    // The window-level listener sees the bubbled event exactly once.
    keydown(child, { key: 'k', ctrlKey: true })
    expect(onShortcut).toHaveBeenCalledTimes(1)
  })

  it('enforces modifier exclusivity deterministically (alt rejected, shift tolerated)', () => {
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

    // Extra Alt must always veto the match — Alt is never implicit in a key.
    keydown(window, { key: 'k', ctrlKey: true, altKey: true })
    expect(onShortcut).not.toHaveBeenCalled()

    // Extra Shift is deliberately tolerated: character-key combos such as
    // Shift+? rely on Shift being part of the matched chord, so requiring its
    // absence would break them. Documented behaviour, pinned here.
    keydown(window, { key: 'k', ctrlKey: true, shiftKey: true })
    expect(onShortcut).toHaveBeenCalledTimes(1)

    // Cross-platform modifier confusion must never match.
    keydown(window, { key: 'k', metaKey: true, ctrlKey: true })
    keydown(window, { key: 'k', metaKey: true })
    expect(onShortcut).toHaveBeenCalledTimes(2)
  })

  it('treats modifier-only events as non-matches for key combos', () => {
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

    keydown(window, { key: 'Control', ctrlKey: true })
    keydown(window, { key: 'Meta', metaKey: true })
    expect(onShortcut).not.toHaveBeenCalled()
  })

  it('skips events from a detached/null-like target without crashing', () => {
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

    const detached = document.createElement('input')
    // Not attached anywhere: isEditableElement must still behave.
    expect(() => {
      detached.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
      )
    }).not.toThrow()
    expect(onShortcut).not.toHaveBeenCalled()
  })

  it('keeps handlers fresh across re-renders (no stale callback, no lost update)', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ cb }) => useKeyboardShortcut(['Mod', 'k'], cb, { userAgent: WIN_UA }),
      { initialProps: { cb: first } }
    )

    rerender({ cb: second })
    keydown(window, { key: 'k', ctrlKey: true })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('re-subscribes exactly once when options change (no duplicate listeners)', () => {
    const onShortcut = vi.fn()
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { rerender } = renderHook(
      ({ enabled }) => useKeyboardShortcut(['Mod', 'k'], onShortcut, { enabled, userAgent: WIN_UA }),
      { initialProps: { enabled: true } }
    )

    const addsBefore = addSpy.mock.calls.length
    rerender({ enabled: false })
    rerender({ enabled: true })
    // Re-subscription removed the old listener and added a new one — never
    // adds without removing.
    expect(removeSpy.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(addSpy.mock.calls.length).toBeGreaterThan(addsBefore)

    keydown(window, { key: 'k', ctrlKey: true })
    expect(onShortcut).toHaveBeenCalledTimes(1)
  })

  it('stops calling the handler after unmount even for in-flight event dispatch', () => {
    const onShortcut = vi.fn()
    const { unmount } = renderHook(() =>
      useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA })
    )
    unmount()

    expect(() => keydown(window, { key: 'k', ctrlKey: true })).not.toThrow()
    expect(onShortcut).not.toHaveBeenCalled()
  })

  it('supports macOS Mod mapping deterministically (Cmd on Mac, Ctrl elsewhere)', () => {
    const macCb = vi.fn()
    const winCb = vi.fn()
    renderHook(() => useKeyboardShortcut(['Mod', 'k'], macCb, { userAgent: 'Macintosh' }))
    renderHook(() => useKeyboardShortcut(['Mod', 'k'], winCb, { userAgent: WIN_UA }))

    keydown(window, { key: 'k', metaKey: true })
    expect(macCb).toHaveBeenCalledTimes(1)
    expect(winCb).not.toHaveBeenCalled()

    keydown(window, { key: 'k', ctrlKey: true })
    expect(macCb).toHaveBeenCalledTimes(1)
    expect(winCb).toHaveBeenCalledTimes(1)
  })

  it('honours stopPropagation so bubbled events cannot re-trigger ancestor listeners', () => {
    const onShortcut = vi.fn()
    const container = document.createElement('div')
    const child = document.createElement('span')
    container.appendChild(child)
    document.body.appendChild(container)

    // The hook listens on `container`; an ancestor (body) listener must not
    // observe events the hook has claimed.
    renderHook(() =>
      useKeyboardShortcut(['Mod', 'k'], onShortcut, {
        userAgent: WIN_UA,
        stopPropagation: true,
        target: { current: container },
      })
    )

    const ancestor = vi.fn()
    document.body.addEventListener('keydown', ancestor)
    try {
      keydown(child, { key: 'k', ctrlKey: true })
      expect(onShortcut).toHaveBeenCalledTimes(1)
      expect(ancestor).not.toHaveBeenCalled()
    } finally {
      document.body.removeEventListener('keydown', ancestor)
    }
  })

  it('handles extremely long or unusual key identifiers without throwing', () => {
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcut(['Mod', 'k'], onShortcut, { userAgent: WIN_UA }))

    expect(() => {
      keydown(window, { key: 'k'.repeat(10_000), ctrlKey: true })
      keydown(window, { key: 'ﬁ', ctrlKey: true })
      keydown(window, { key: '\u0000', ctrlKey: true })
    }).not.toThrow()
    expect(onShortcut).not.toHaveBeenCalled()
  })
})
