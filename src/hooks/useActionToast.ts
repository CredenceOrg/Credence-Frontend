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
    async <T>(action: ToastAction, promise: Promise<T> | (() => Promise<T>)): Promise<T> => {
      // Resolve the message contract before invoking a thunk. TypeScript callers are constrained by
      // ToastAction, but this guard keeps runtime/JavaScript misuse deterministic and prevents an
      // unsupported action from triggering an irreversible thunk before failing on message lookup.
      const messages = ACTION_TOASTS[action]
      if (!messages) {
        throw new Error('Unsupported action toast type.')
      }

      try {
        const result = typeof promise === 'function' ? await promise() : await promise
        addToast('success', messages.success)
        return result
      } catch (err) {
        // Each invocation is isolated: surface a standardized error toast, then preserve the
        // original rejection so callers retain ownership of loading, retry, and recovery state.
        addToast('danger', messages.error)
        throw err
      }
    },
    [addToast]
  )

  return { withToast }
}
