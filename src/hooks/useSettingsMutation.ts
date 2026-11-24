import { useApiMutation, type UseApiMutationResult } from './useApiMutation'
import { updateSettings } from '../api/settings'
import type { SettingsBlob } from '../lib/settingsSchema'

/** Typed mutation for saving the complete settings payload. */
export function useSettingsMutation(): UseApiMutationResult<void, SettingsBlob> {
  return useApiMutation<void, SettingsBlob>({ mutationFn: updateSettings })
}
