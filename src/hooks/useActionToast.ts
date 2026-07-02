import { useCallback } from 'react'
import { useToast } from '../components/ToastProvider'
import { ACTION_TOASTS, type ToastAction } from '../config/toastMessages'

/**
 * A specialized hook for wrapping irreversible actions (sign, send, approve, delete)
 * with standardized success and failure toasts.
 */
export function useActionToast() {
  const { addToast } = useToast()

  const withToast = useCallback(
    async <T>(
      action: ToastAction,
      promise: Promise<T> | (() => Promise<T>)
    ): Promise<T> => {
      try {
        const result = typeof promise === 'function' ? await promise() : await promise
        addToast('success', ACTION_TOASTS[action].success)
        return result
      } catch (err) {
        // We do not swallow the error; we rethrow so the component can manage its own loading/error state
        addToast('danger', ACTION_TOASTS[action].error)
        throw err
      }
    },
    [addToast]
  )

  return { withToast }
}
