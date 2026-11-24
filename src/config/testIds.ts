export const TEST_IDS = {
  PRIMARY_CTA: 'primary-cta',
  /**
   * Bulk-actions row selectors for the Transactions page (Issue #560).
   * Centralizing these keeps tests stable when CSS class names change.
   */
  TX_SELECT_ALL_CHECKBOX: 'transactions-select-all-checkbox',
  TX_BULK_ACTIONS_BAR: 'transactions-bulk-actions-bar',
  TX_BULK_DELETE_BUTTON: 'transactions-bulk-delete-button',
  TX_BULK_EXPORT_BUTTON: 'transactions-bulk-export-button',
  TX_BULK_CLEAR_BUTTON: 'transactions-bulk-clear-button',
  FILE_PICKER_DROPZONE: 'file-picker-dropzone',
  FILE_PICKER_INPUT: 'file-picker-input',
  FILE_PICKER_FILE_LIST: 'file-picker-file-list',
  FILE_PICKER_REMOVE_BUTTON: 'file-picker-remove-button',
} as const
