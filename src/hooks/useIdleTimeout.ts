import { useEffect, useRef } from 'react'
import { DOM_EVENTS } from '../events'

export interface UseIdleTimeoutOptions {
  timeoutMs: number
  onIdle: () => void
  onActivity?: () => void
  setTimeoutImpl?: typeof setTimeout
  clearTimeoutImpl?: typeof clearTimeout
}

/**
 * Hook that triggers a callback after a period of inactivity.
 * Resets on mouse movement, keyboard input, clicks, touches, and scrolls.
 */
export function useIdleTimeout({
  timeoutMs,
  onIdle,
  onActivity,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}: UseIdleTimeoutOptions): void {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || timeoutMs <= 0) return

    const clearTimer = () => {
      if (timerRef.current !== null) {
        clearTimeoutImpl(timerRef.current)
        timerRef.current = null
      }
    }

    const startTimer = () => {
      clearTimer()
      timerRef.current = setTimeoutImpl(() => {
        onIdleRef.current()
      }, timeoutMs)
    }

    const handleActivity = () => {
      onActivityRef.current?.()
      startTimer()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleActivity()
      }
    }

    startTimer()

    const events: string[] = [
      DOM_EVENTS.MOUSE_MOVE,
      DOM_EVENTS.KEY_DOWN,
      DOM_EVENTS.MOUSE_DOWN,
      DOM_EVENTS.TOUCH_START,
      DOM_EVENTS.SCROLL,
      DOM_EVENTS.WHEEL,
    ]
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })
    document.addEventListener(DOM_EVENTS.VISIBILITY_CHANGE, handleVisibilityChange)

    return () => {
      clearTimer()
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      document.removeEventListener(DOM_EVENTS.VISIBILITY_CHANGE, handleVisibilityChange)
    }
  }, [timeoutMs, setTimeoutImpl, clearTimeoutImpl])
}
