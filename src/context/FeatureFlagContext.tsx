import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getFeatureFlags, type FeatureFlagName, type FeatureFlags } from '../config/featureFlags'

const FeatureFlagContext = createContext<FeatureFlags | null>(null)

export interface FeatureFlagProviderProps {
  children: ReactNode
}

export function FeatureFlagProvider({ children }: FeatureFlagProviderProps) {
  const { search } = useLocation()
  const flags = useMemo(() => getFeatureFlags(search), [search])

  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>
}

function useFeatureFlagContext(): FeatureFlags {
  const flags = useContext(FeatureFlagContext)
  if (!flags) {
    throw new Error('Feature flags must be used within a FeatureFlagProvider')
  }
  return flags
}

export function useFeatureFlag(name: FeatureFlagName): boolean {
  return useFeatureFlagContext()[name]
}

export function useFeatureFlags(): FeatureFlags {
  return useFeatureFlagContext()
}
