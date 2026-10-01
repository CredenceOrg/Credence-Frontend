/**
 * Deterministic toast message catalog for user-facing action feedback.
 *
 * Invariants:
 * - Every action exposes exactly one `success` and one `error` message.
 * - Messages are static, non-interpolated strings so failures cannot leak
 *   sensitive data (addresses, payloads, server internals) into the UI.
 * - The catalog is the single source of truth for `useToast` callers; adding
 *   an action here automatically widens `ToastAction`.
 */
export const ACTION_TOASTS = {
  sign: {
    success: 'Signed successfully.',
    error: 'Failed to sign.',
  },
  send: {
    success: 'Sent successfully.',
    error: 'Failed to send.',
  },
  approve: {
    success: 'Approved successfully.',
    error: 'Failed to approve.',
  },
  delete: {
    success: 'Deleted successfully.',
    error: 'Failed to delete.',
  },
} as const

export type ToastAction = keyof typeof ACTION_TOASTS

/**
 * Runtime guard for untrusted/unknown action keys (e.g. from URL params,
 * persisted state, or cross-window messages).
 *
 * Returns `true` only for keys present in `ACTION_TOASTS`, so callers can
 * fail closed instead of rendering `undefined` messages.
 */
export function isToastAction(value: unknown): value is ToastAction {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACTION_TOASTS, value)
}

/**
 * Deterministically resolves a toast message for a given action and outcome.
 *
 * - Valid action + valid outcome -> the catalog message.
 * - Unknown action or outcome -> `null` (caller decides how to surface the
 *   failure) rather than throwing or returning a misleading message.
 */
export function getToastMessage(
  action: unknown,
  outcome: unknown,
): string | null {
  if (!isToastAction(action)) {
    return null
  }
  if (outcome !== 'success' && outcome !== 'error') {
    return null
  }
  return ACTION_TOASTS[action][outcome]
}
