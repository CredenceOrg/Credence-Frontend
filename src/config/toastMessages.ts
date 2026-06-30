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
