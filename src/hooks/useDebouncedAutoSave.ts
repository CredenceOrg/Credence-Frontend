import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUTO_SAVE_DEFAULTS } from '../config/autoSave'

/**
 * Per-widget-ish status enum for the auto-save lifecycle.
 *
 *  idle     – no value supplied; nothing scheduled, no fetches in flight
 *  pending  – value changed and is waiting out the debounce window
 *  saving   – debounce settled; the supplied `save()` promise is in flight
 *  saved    – most recent save() resolved; `lastSavedAt` is set
 *  error    – most recent save() rejected; `error` is set, `lastSavedValue`
 *             is preserved so a retry isn't a step backward in correctness
 */
export type AutoSaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error'

export interface UseDebouncedAutoSaveOptions<T> {
  /**
   * Current value to mirror to the backend. Passing `undefined` parks the
   * hook in `idle` and clears any pending / in-flight save.
   */
  value: T | undefined
  /**
   * Async function called after the debounce settles (or immediately when
   * `saveNow()` is invoked). The hook owns the AbortController for the
   * in-flight save; pass `signal` to your fetch helper so cancellation
   * propagates to the network layer.
   */
  save: (value: T, signal: AbortSignal) => Promise<unknown> | unknown
  /** Override default debounce delay (`AUTO_SAVE_DEFAULTS.DEBOUNCE_MS`). */
  delayMs?: number
  /**
   * Equality function used to detect value changes. Defaults to `Object.is`,
   * which works only for primitives and stable references. **Object/array
   * payloads MUST supply a structural comparator** (e.g. `(a, b) => a.x === b.x && a.y === b.y`).
   * The hook deliberately avoids deep cloning or `JSON.stringify` on the
   * hot path — perf traps with large payloads.
   */
  isEqual?: (prev: T, next: T) => boolean
  /** Master switch. When `false`, the hook is a no-op (no timers, no fetches). */
  enabled?: boolean
  /** Called on successful save (after `lastSavedAt` is updated). */
  onSaved?: (value: T) => void
  /** Called on failed save (after `error` is updated). */
  onError?: (err: Error, value: T) => void
}

export interface UseDebouncedAutoSaveResult {
  status: AutoSaveStatus
  /** Unix-ms timestamp of the most recent successful save; `null` until then. */
  lastSavedAt: number | null
  /** Error from the most recent failed save; cleared on the next success. */
  error: Error | null
  /** `true` when the current `value` differs from the last saved value. */
  isDirty: boolean
  /** Flush any pending debounce immediately and run the save. */
  saveNow: () => Promise<void>
  /** Cancel any pending debounce AND abort any in-flight save. */
  cancel: () => void
}

const DEFAULT_DELAY_MS = AUTO_SAVE_DEFAULTS.DEBOUNCE_MS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultEquals = (a: any, b: any): boolean => Object.is(a, b)

/**
 * Debounced auto-save lifecycle hook for the Settings page (closes #564).
 *
 * Skips a full-page PATCH per keystroke by waiting for `delayMs` of value
 * stability, then calling the supplied async save fn once.
 *
 * Cancellation: the hook owns one `AbortController` per in-flight save. If
 * the value changes mid-save (or the component unmounts), the previous
 * fetch is aborted; callers should pass `signal` to their fetch helper so
 * the network request is actually cancelled, not just discarded.
 *
 * Equality: defaults to `Object.is`. For object payloads, callers must
 * provide `isEqual` — see `UseDebouncedAutoSaveOptions.isEqual`.
 */
export function useDebouncedAutoSave<T>(
  options: UseDebouncedAutoSaveOptions<T>) : UseDebouncedAutoSaveResult {
  const {
    value,
    save,
    delayMs = DEFAULT_DELAY_MS,
    isEqual = defaultEquals,
    enabled = true,
    onSaved,
    onError,
  } = options

  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSavedValue, setLastSavedValue] = useState<T | undefined>(undefined)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Stash the latest user callbacks in refs so the timer / abort effect
  // can read them without churning identity on every render.
  const saveRef = useRef(save)
  saveRef.current = save
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  // One AbortController per in-flight save; superseded on the next runSave.
  const inflightRef = useRef<AbortController | null>(null)

  // Single pending debounce timer; cleared on supersede or cancel.
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPending = useCallback(() => {
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
  }, [])

  const abortInflight = useCallback(() => {
    if (inflightRef.current) {
      inflightRef.current.abort('superseded')
      inflightRef.current = null
    }
  }, [])

  // Save runner used by both the debounce-timer firing path and `saveNow()`.
  const runSave = useCallback(
    async (valueToSave: T) => {
      abortInflight()
      const controller = new AbortController()
      inflightRef.current = controller
      setStatus('saving')
      setError(null)
      try {
        await saveRef.current(valueToSave, controller.signal)
        if (controller.signal.aborted) return
        setLastSavedValue(valueToSave)
        setLastSavedAt(Date.now())
        setStatus('saved')
        onSavedRef.current?.(valueToSave)
      } catch (err) {
        // If we were aborted (superseded by a newer save, or component unmounted)
        // we intentionally swallow the error: the next runSave owns the
        // observable state. The throw is for diagnostics only.
        if (controller.signal.aborted) return
        const wrapped = err instanceof Error ? err : new Error(String(err))
        setError(wrapped)
        setStatus('error')
        onErrorRef.current?.(wrapped, valueToSave)
      } finally {
        if (inflightRef.current === controller) {
          inflightRef.current = null
        }
      }
    },
    [abortInflight]
  )

  // Debounce effect — runs on value/delay/enabled/isEqual changes.
  // `lastSavedValue` is included so a just-saved value that the parent
  // re-renders with doesn't trigger another spurious debounce cycle; the
  // early return when `isEqual(lastSavedValue, value)` is true handles that.
  useEffect(() => {
    if (!enabled) {
      clearPending()
      abortInflight()
      setStatus((prev) => (prev === 'saving' || prev === 'pending' ? 'idle' : prev))
      return
    }

    if (value === undefined) {
      clearPending()
      abortInflight()
      setStatus('idle')
      return
    }

    if (lastSavedValue !== undefined && isEqual(lastSavedValue, value)) {
      // The current value has already been saved; do not trigger another cycle.
      return
    }

    clearPending()
    setStatus('pending')

    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null
      void runSave(value)
    }, delayMs)

    return () => {
      clearPending()
    }
  }, [value, delayMs, enabled, isEqual, clearPending, abortInflight, runSave, lastSavedValue])

  const isDirty = useMemo(() => {
    if (value === undefined) return false
    if (lastSavedValue === undefined) return true
    return !isEqual(lastSavedValue, value)
  }, [value, lastSavedValue, isEqual])

  const saveNow = useCallback(async () => {
    if (value === undefined) return
    clearPending()
    await runSave(value)
  }, [value, clearPending, runSave])

  const cancel = useCallback(() => {
    clearPending()
    abortInflight()
    setStatus(lastSavedValue !== undefined ? 'saved' : 'idle')
  }, [clearPending, abortInflight, lastSavedValue])

  // Cleanup on unmount: cancel the debounce timer and abort any in-flight save.
  useEffect(() => {
    return () => {
      clearPending()
      abortInflight()
    }
  }, [clearPending, abortInflight])

  return { status, lastSavedAt, error, isDirty, saveNow, cancel }
}
