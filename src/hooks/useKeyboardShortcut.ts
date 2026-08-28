import { useEffect, useRef } from 'react'

export type KeySpec = string | string[]
export type ShortcutKeys = KeySpec | KeySpec[]
export type ShortcutCallback = (event: KeyboardEvent) => void

export interface UseKeyboardShortcutOptions {
  /**
   * Whether the shortcut listener is currently active.
   * @default true
   */
  enabled?: boolean

  /**
   * Whether to call `event.preventDefault()` when the shortcut is matched.
   * @default true
   */
  preventDefault?: boolean

  /**
   * Whether to call `event.stopPropagation()` when the shortcut is matched.
   * @default false
   */
  stopPropagation?: boolean

  /**
   * Whether to ignore key events originating inside editable form controls
   * (`<input>`, `<textarea>`, `<select>`, `[contenteditable="true"]`).
   * @default true
   */
  ignoreInputElements?: boolean

  /**
   * Element or target ref to attach the keydown listener to.
   * If omitted or null/undefined, attaches to `window`.
   */
  target?: React.RefObject<HTMLElement | null> | Window | Document | null

  /**
   * User agent string for platform detection (macOS vs Windows/Linux).
   * Defaults to `navigator.userAgent` in browser environments.
   */
  userAgent?: string
}

export interface UseKeyboardShortcutConfig extends UseKeyboardShortcutOptions {
  /** The key combination(s) to match. */
  keys: ShortcutKeys
  /** Handler function invoked when the shortcut is pressed. */
  onShortcut: ShortcutCallback
}

/** Determines whether a user agent represents a Mac environment. */
export function isMacUserAgent(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return /Mac|iPod|iPhone|iPad/i.test(ua)
}

/** Determines whether an element is an editable form control or contenteditable area. */
export function isEditableElement(element: Element | null): boolean {
  if (!element) return false
  const tagName = element.tagName
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true
  }
  const htmlEl = element as HTMLElement
  if (htmlEl.isContentEditable || htmlEl.contentEditable === 'true') {
    return true
  }
  if (element.getAttribute && element.getAttribute('contenteditable') === 'true') {
    return true
  }
  if (element.closest && element.closest('[contenteditable="true"]') !== null) {
    return true
  }
  return false
}

/** Parses a shortcut specification into normalized token lists. */
export function parseShortcutSpec(spec: ShortcutKeys): string[][] {
  if (typeof spec === 'string') {
    return [parseSingleShortcutString(spec)]
  }

  if (Array.isArray(spec)) {
    if (spec.length === 0) return []

    // If array of arrays (e.g. [['Mod', 'K'], ['Alt', 'S']])
    if (Array.isArray(spec[0])) {
      return (spec as string[][]).map((s) => s.map((k) => k.trim()).filter(Boolean))
    }

    const stringArray = spec as string[]

    // If any item contains a '+', treat array as multiple shortcut strings (e.g. ['Mod+K', 'Alt+S'])
    const hasPlusCombo = stringArray.some(
      (s) => typeof s === 'string' && s.includes('+') && s.trim() !== '+'
    )
    if (hasPlusCombo) {
      return stringArray.map((s) => parseSingleShortcutString(s))
    }

    // Otherwise treat string array as key tokens of a single shortcut (e.g. ['Mod', 'K'])
    return [stringArray.map((k) => k.trim()).filter(Boolean)]
  }

  return []
}

function parseSingleShortcutString(str: string): string[] {
  const trimmed = str.trim()
  if (trimmed === '+') return ['+']
  return trimmed
    .split(/\+(?=[^+]|\b)/)
    .map((k) => k.trim())
    .filter(Boolean)
}

/** Normalizes key names for comparisons (e.g. Esc -> Escape, Option -> Alt). */
function normalizeKeyName(key: string): string {
  const lower = key.toLowerCase()
  switch (lower) {
    case 'esc':
      return 'escape'
    case 'space':
    case 'spacebar':
      return ' '
    case 'up':
      return 'arrowup'
    case 'down':
      return 'arrowdown'
    case 'left':
      return 'arrowleft'
    case 'right':
      return 'arrowright'
    case 'option':
      return 'alt'
    case 'cmd':
    case 'command':
      return 'meta'
    case 'control':
      return 'ctrl'
    default:
      return lower
  }
}

/** Evaluates whether a KeyboardEvent matches a parsed shortcut token array. */
export function matchesShortcut(event: KeyboardEvent, tokens: string[], isMac: boolean): boolean {
  let reqMod = false
  let reqCtrl = false
  let reqCmd = false
  let reqAlt = false
  let reqShift = false

  const mainKeys: string[] = []

  for (const rawToken of tokens) {
    const norm = normalizeKeyName(rawToken)
    if (norm === 'mod' || norm === 'cmdorctrl' || norm === 'ctrlorcmd') {
      reqMod = true
    } else if (norm === 'ctrl') {
      reqCtrl = true
    } else if (norm === 'meta') {
      reqCmd = true
    } else if (norm === 'alt') {
      reqAlt = true
    } else if (norm === 'shift') {
      reqShift = true
    } else {
      mainKeys.push(norm)
    }
  }

  // Modifier evaluation
  if (reqMod) {
    if (isMac) {
      if (!event.metaKey) return false
    } else {
      if (!event.ctrlKey) return false
    }
  }

  if (reqCtrl) {
    if (isMac) {
      if (!event.ctrlKey && !event.metaKey) return false
    } else {
      if (!event.ctrlKey) return false
    }
  }

  if (reqCmd) {
    if (!event.metaKey) return false
  }

  if (reqAlt) {
    if (!event.altKey) return false
  }

  if (reqShift) {
    if (!event.shiftKey) return false
  }

  // Ensure unrequested modifiers are not pressed (except Shift when implicit in character keys)
  if (!reqMod && !reqCtrl && !reqCmd) {
    if (isMac) {
      if (event.metaKey || event.ctrlKey) return false
    } else {
      if (event.ctrlKey || event.metaKey) return false
    }
  }

  if (!reqAlt && event.altKey) {
    return false
  }

  // Main key evaluation
  const eventKeyNorm = normalizeKeyName(event.key)
  const eventCodeNorm = event.code ? normalizeKeyName(event.code.replace(/^Key|^Digit/, '')) : ''

  if (mainKeys.length === 0) {
    // Modifier-only shortcut (if explicitly desired)
    return true
  }

  return mainKeys.some((targetKey) => {
    if (eventKeyNorm === targetKey) return true
    if (eventCodeNorm && eventCodeNorm === targetKey) return true
    return false
  })
}

/**
 * Custom React hook for platform-aware keyboard shortcut handling.
 *
 * Abstract platform key differences (Alt/Option, Ctrl/Cmd, Mod) and enforces
 * WCAG 2.1 AA accessibility guidelines (ignoring global shortcuts inside editable inputs).
 *
 * @example
 * ```tsx
 * // Using overload syntax:
 * useKeyboardShortcut(['Mod', 'K'], () => setOpen(true))
 *
 * // Using options object syntax:
 * useKeyboardShortcut({
 *   keys: 'Alt+S',
 *   onShortcut: () => handleSave(),
 *   preventDefault: true,
 * })
 * ```
 */
export function useKeyboardShortcut(
  keysOrConfig: ShortcutKeys | UseKeyboardShortcutConfig,
  callback?: ShortcutCallback,
  options?: UseKeyboardShortcutOptions
): void {
  let keys: ShortcutKeys
  let onShortcut: ShortcutCallback
  let configOpts: UseKeyboardShortcutOptions

  if (
    typeof keysOrConfig === 'object' &&
    !Array.isArray(keysOrConfig) &&
    'keys' in keysOrConfig &&
    'onShortcut' in keysOrConfig
  ) {
    const { keys: k, onShortcut: cb, ...rest } = keysOrConfig as UseKeyboardShortcutConfig
    keys = k
    onShortcut = cb
    configOpts = rest
  } else {
    keys = keysOrConfig as ShortcutKeys
    onShortcut = callback as ShortcutCallback
    configOpts = options ?? {}
  }

  const {
    enabled = true,
    preventDefault = true,
    stopPropagation = false,
    ignoreInputElements = true,
    target,
    userAgent,
  } = configOpts

  const callbackRef = useRef<ShortcutCallback>(onShortcut)
  useEffect(() => {
    callbackRef.current = onShortcut
  }, [onShortcut])

  useEffect(() => {
    if (!enabled) return

    const parsedCombos = parseShortcutSpec(keys)
    const isMac = isMacUserAgent(userAgent)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (ignoreInputElements && isEditableElement(event.target as Element)) {
        return
      }

      const isMatch = parsedCombos.some((tokens) => matchesShortcut(event, tokens, isMac))
      if (isMatch) {
        if (preventDefault) {
          event.preventDefault()
        }
        if (stopPropagation) {
          event.stopPropagation()
        }
        callbackRef.current(event)
      }
    }

    let targetElement: EventTarget | null = null

    if (target) {
      if ('current' in target) {
        targetElement = target.current
      } else {
        targetElement = target
      }
    } else if (typeof window !== 'undefined') {
      targetElement = window
    }

    if (!targetElement) return

    targetElement.addEventListener('keydown', handleKeyDown as EventListener)
    return () => {
      targetElement?.removeEventListener('keydown', handleKeyDown as EventListener)
    }
  }, [keys, enabled, preventDefault, stopPropagation, ignoreInputElements, target, userAgent])
}
