import { useState, useRef, useEffect } from 'react'

/**
 * Options for `useCopyToClipboard`.
 */
export interface UseCopyOptions {
  /** How long (ms) the `copied` flag should remain true. Defaults to 2000. */
  timeoutMs?: number
  /** Injectable `setTimeout` for tests or alternate runtimes. */
  setTimeoutImpl?: typeof setTimeout
  /** Injectable `clearTimeout` for tests or alternate runtimes. */
  clearTimeoutImpl?: typeof clearTimeout
}

/**
 * Hook to copy text to the clipboard with a transient `copied` flag.
 *
 * - Returns `{ copy(text): Promise<boolean>, copied: boolean, reset() }`.
 * - Gracefully falls back to a hidden textarea + `document.execCommand('copy')`
 *   when `navigator.clipboard` is not available.
 * - Auto-resets `copied` after `timeoutMs` and cleans up timers on unmount.
 */
export default function useCopyToClipboard(options?: UseCopyOptions) {
  const { timeoutMs = 2000, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = options || {}

  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        try {
          clearTimeoutImpl(timeoutRef.current)
        } catch {
          // ignore
        }
      }
    }
  }, [clearTimeoutImpl])

  const reset = () => {
    setCopied(false)
    if (timeoutRef.current != null) {
      try {
        clearTimeoutImpl(timeoutRef.current)
      } catch {
        // ignore
      }
      timeoutRef.current = null
    }
  }

  const fallbackCopy = (text: string) => {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textarea)
      try {
        const sel = document.getSelection()
        if (sel) sel.removeAllRanges()
      } catch {
        // ignore
      }
      return successful
    } catch {
      return false
    }
  }

  const triggerCopied = () => {
    setCopied(true)
    if (timeoutRef.current != null) {
      try { clearTimeoutImpl(timeoutRef.current) } catch { }
    }
    timeoutRef.current = setTimeoutImpl(() => {
      setCopied(false)
      timeoutRef.current = null
    }, timeoutMs)
  }

  const copy = async (text: string): Promise<boolean> => {
    if (!text) return false

    // Try modern clipboard API first
    try {
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text)
      } else {
        const ok = fallbackCopy(text)
        if (!ok) return false
      }

      triggerCopied()
      return true
    } catch {
      // Try fallback path if the API fails
      try {
        const ok = fallbackCopy(text)
        if (!ok) return false
        triggerCopied()
        return true
      } catch {
        return false
      }
    }
  }

  return { copy, copied, reset }
}
