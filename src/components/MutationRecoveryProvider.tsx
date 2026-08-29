/**
 * @file MutationRecoveryProvider.tsx
 * @description React context provider for mutation recovery system integration.
 *
 * This provider manages the lifecycle of the mutation system and provides
 * a React-friendly interface for components to interact with mutation
 * recovery, tracking, and status monitoring.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  initializeMutationSystem,
  shutdownMutationSystem,
  getMutationSystemStatus,
  type SystemStatus,
  type MutationSystemConfig,
} from '../lib/mutationSystemInitializer'
import {
  getMutationOperations,
  type MutationOperation,
  type MutationType,
} from '../lib/mutationStorage'
import { mutationRecoveryEngine } from '../lib/mutationRecovery'
import { logInfo, logWarn, logError } from '../lib/log'

// ═══════════════════════════════════════════════════════════════════════════
// Context Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MutationRecoveryContextValue {
  // System status
  isInitialized: boolean
  isInitializing: boolean
  systemStatus: SystemStatus | null

  // Operations
  activeOperations: MutationOperation[]
  recentOperations: MutationOperation[]

  // Actions
  refreshOperations: () => void
  getOperationsByType: (type: MutationType) => MutationOperation[]

  // System management
  reinitialize: (config?: MutationSystemConfig) => Promise<boolean>
  performHealthCheck: () => Promise<boolean>
}

// ═══════════════════════════════════════════════════════════════════════════
// Context Creation
// ═══════════════════════════════════════════════════════════════════════════

const MutationRecoveryContext = createContext<MutationRecoveryContextValue | null>(null)

export interface MutationRecoveryProviderProps {
  children: React.ReactNode
  config?: MutationSystemConfig
  /** Whether to automatically initialize on mount */
  autoInitialize?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// Provider Implementation
// ═══════════════════════════════════════════════════════════════════════════

export function MutationRecoveryProvider({
  children,
  config = {},
  autoInitialize = true,
}: MutationRecoveryProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [activeOperations, setActiveOperations] = useState<MutationOperation[]>([])
  const [recentOperations, setRecentOperations] = useState<MutationOperation[]>([])

  // ═══════════════════════════════════════════════════════════════════════════
  // System Initialization
  // ═══════════════════════════════════════════════════════════════════════════

  const initializeSystem = useCallback(
    async (initConfig?: MutationSystemConfig) => {
      if (isInitializing) return false

      setIsInitializing(true)

      try {
        logInfo('mutation_recovery_provider_initializing')

        const result = await initializeMutationSystem({
          enableAutoRecovery: true,
          cleanupCompleted: false,
          verboseLogging: process.env.NODE_ENV === 'development',
          ...config,
          ...initConfig,
        })

        setIsInitialized(result.success)

        if (result.success) {
          logInfo('mutation_recovery_provider_initialized', {
            migrationCount: result.migrationResults?.bondActionsMigrated ?? 0,
            recoveredCount: result.migrationResults?.operationsRecovered ?? 0,
            cleanupCount: result.cleanupResults?.operationsRemoved ?? 0,
          })

          refreshOperations()
          updateSystemStatus()
        } else {
          logError('mutation_recovery_provider_initialization_failed', {
            errorCount: result.errors?.length ?? 0,
            warningCount: result.warnings?.length ?? 0,
            firstError: result.errors?.[0] ?? 'Unknown error',
          })
        }

        return result.success
      } catch (error) {
        logError('mutation_recovery_provider_initialization_error', {
          error: error instanceof Error ? error.message : String(error),
        })
        setIsInitialized(false)
        return false
      } finally {
        setIsInitializing(false)
      }
    },
    [isInitializing, config]
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // Operations Management
  // ═══════════════════════════════════════════════════════════════════════════

  const refreshOperations = useCallback(() => {
    try {
      const allOperations = getMutationOperations()

      // Filter active operations (pending, submitting)
      const active = allOperations.filter(
        (op) => op.status === 'pending' || op.status === 'submitting'
      )

      // Filter recent operations (last 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      const recent = allOperations
        .filter((op) => new Date(op.updatedAt).getTime() > oneDayAgo)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10) // Keep last 10 recent operations

      setActiveOperations(active)
      setRecentOperations(recent)

      logInfo('mutation_recovery_provider_operations_refreshed', {
        activeCount: active.length,
        recentCount: recent.length,
      })
    } catch (error) {
      logWarn('mutation_recovery_provider_refresh_failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  const getOperationsByType = useCallback((type: MutationType): MutationOperation[] => {
    return getMutationOperations(type)
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // System Status Management
  // ═══════════════════════════════════════════════════════════════════════════

  const updateSystemStatus = useCallback(() => {
    try {
      const status = getMutationSystemStatus()
      setSystemStatus(status)
    } catch (error) {
      logWarn('mutation_recovery_provider_status_update_failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // Public Actions
  // ═══════════════════════════════════════════════════════════════════════════

  const reinitialize = useCallback(
    async (reinitConfig?: MutationSystemConfig): Promise<boolean> => {
      logInfo('mutation_recovery_provider_reinitializing')

      try {
        await shutdownMutationSystem()
        setIsInitialized(false)
        return await initializeSystem(reinitConfig)
      } catch (error) {
        logError('mutation_recovery_provider_reinitialization_failed', {
          error: error instanceof Error ? error.message : String(error),
        })
        return false
      }
    },
    [initializeSystem]
  )

  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      updateSystemStatus()
      refreshOperations()

      const recoveryStatus = mutationRecoveryEngine.getRecoveryStatus()
      const isHealthy = systemStatus?.isHealthy && recoveryStatus.failed === 0

      logInfo('mutation_recovery_provider_health_check', {
        isHealthy,
        systemStatus: systemStatus?.isHealthy,
        recoveryStatusSummary: {
          activeCount: recoveryStatus.active.length,
          pendingCount: recoveryStatus.pending,
          failedCount: recoveryStatus.failed,
        },
      })

      return isHealthy || false
    } catch (error) {
      logWarn('mutation_recovery_provider_health_check_failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }, [systemStatus?.isHealthy, updateSystemStatus, refreshOperations])

  // ═══════════════════════════════════════════════════════════════════════════
  // Effects
  // ═══════════════════════════════════════════════════════════════════════════

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isInitializing) {
      void initializeSystem()
    }
  }, [autoInitialize, isInitialized, isInitializing, initializeSystem])

  // Periodic operations refresh for active operations
  useEffect(() => {
    if (!isInitialized) return

    const interval = setInterval(() => {
      refreshOperations()
      updateSystemStatus()
    }, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [isInitialized, refreshOperations, updateSystemStatus])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInitialized) {
        void shutdownMutationSystem().catch((error) =>
          logWarn('mutation_recovery_provider_shutdown_failed', {
            error: error instanceof Error ? error.message : String(error),
          })
        )
      }
    }
  }, [isInitialized])

  // ═══════════════════════════════════════════════════════════════════════════
  // Context Value
  // ═══════════════════════════════════════════════════════════════════════════

  const contextValue: MutationRecoveryContextValue = {
    isInitialized,
    isInitializing,
    systemStatus,
    activeOperations,
    recentOperations,
    refreshOperations,
    getOperationsByType,
    reinitialize,
    performHealthCheck,
  }

  return (
    <MutationRecoveryContext.Provider value={contextValue}>
      {children}
    </MutationRecoveryContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook for consuming context
// ═══════════════════════════════════════════════════════════════════════════

export function useMutationRecovery(): MutationRecoveryContextValue {
  const context = useContext(MutationRecoveryContext)

  if (!context) {
    throw new Error('useMutationRecovery must be used within a MutationRecoveryProvider')
  }

  return context
}

// ═══════════════════════════════════════════════════════════════════════════
// Specialized hooks for common use cases
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook for monitoring active operations across the entire application.
 */
export function useActiveOperations(): {
  operations: MutationOperation[]
  hasActive: boolean
  bondOperations: MutationOperation[]
  trustScoreOperations: MutationOperation[]
} {
  const { activeOperations, getOperationsByType } = useMutationRecovery()

  const bondOperations = activeOperations.filter(
    (op) => op.type === 'bond_create' || op.type === 'bond_withdraw'
  )

  const trustScoreOperations = getOperationsByType('trust_score_lookup').filter(
    (op) => op.status === 'pending' || op.status === 'submitting'
  )

  return {
    operations: activeOperations,
    hasActive: activeOperations.length > 0,
    bondOperations,
    trustScoreOperations,
  }
}

/**
 * Hook for system health monitoring and diagnostics.
 */
export function useSystemHealth(): {
  isHealthy: boolean
  status: SystemStatus | null
  issues: string[]
  performHealthCheck: () => Promise<boolean>
} {
  const { systemStatus, performHealthCheck } = useMutationRecovery()

  return {
    isHealthy: systemStatus?.isHealthy || false,
    status: systemStatus,
    issues: systemStatus?.issues || [],
    performHealthCheck,
  }
}
