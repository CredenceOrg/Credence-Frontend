import { useEffect, useRef } from 'react'

export interface UseIdleTimeoutOptions {
  timeoutMs: number
  onIdle: () => void
  setTimeoutImpl?: typeof setTimeout
  clearTimeoutImpl?: typeof clearTimeout
}

export function useIdleTimeout({
  timeoutMs,
  onIdle,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}: UseIdleTimeoutOptions): void {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

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
      startTimer()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startTimer()
      }
    }

    startTimer()

    window.addEventListener('mousemove', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimer()
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [timeoutMs, setTimeoutImpl, clearTimeoutImpl])
}
