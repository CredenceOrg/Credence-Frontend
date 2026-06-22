import { useCallback, useEffect, useRef, useState } from 'react'

export const DEFAULT_COPY_RESET_DELAY = 2000

export interface UseCopyToClipboardOptions {
  resetDelay?: number
}

export interface UseCopyToClipboardResult {
  copied: boolean
  error: Error | null
  copyToClipboard: (text: string) => Promise<boolean>
  reset: () => void
}

function createClipboardError(message: string): Error {
  return new Error(message)
}

function normalizeClipboardError(caughtError: unknown): Error {
  if (caughtError instanceof Error) {
    return caughtError
  }

  if (
    typeof caughtError === 'object' &&
    caughtError !== null &&
    'message' in caughtError &&
    typeof caughtError.message === 'string'
  ) {
    return createClipboardError(caughtError.message)
  }

  return createClipboardError('Clipboard copy failed.')
}

export function useCopyToClipboard({
  resetDelay = DEFAULT_COPY_RESET_DELAY,
}: UseCopyToClipboardOptions = {}): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearResetTimer()
    setCopied(false)
    setError(null)
  }, [clearResetTimer])

  const copyToClipboard = useCallback(
    async (text: string) => {
      clearResetTimer()

      if (
        typeof navigator === 'undefined' ||
        typeof navigator.clipboard?.writeText !== 'function'
      ) {
        setCopied(false)
        setError(createClipboardError('Clipboard copy is not available in this browser.'))
        return false
      }

      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setError(null)

        if (resetDelay > 0) {
          resetTimerRef.current = setTimeout(() => {
            setCopied(false)
            resetTimerRef.current = null
          }, resetDelay)
        }

        return true
      } catch (caughtError) {
        setCopied(false)
        setError(normalizeClipboardError(caughtError))
        return false
      }
    },
    [clearResetTimer, resetDelay]
  )

  useEffect(() => clearResetTimer, [clearResetTimer])

  return {
    copied,
    error,
    copyToClipboard,
    reset,
  }
}
