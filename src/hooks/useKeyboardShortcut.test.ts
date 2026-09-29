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
