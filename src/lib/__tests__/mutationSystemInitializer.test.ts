/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file mutationSystemInitializer.test.ts
 * @description Integration tests for the mutation system initializer.
 *
 * Test Coverage:
 * - System initialization and shutdown
 * - Migration processes
 * - Health checks and diagnostics
 * - Configuration handling
 * - Error recovery scenarios
 * - System state validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  initializeMutationSystem,
  shutdownMutationSystem,
  getMutationSystemStatus,
  performMutationSystemHealthCheck,
  isMutationSystemReady,
  ensureMutationSystemReady,
  type MutationSystemConfig,
} from '../mutationSystemInitializer'
import * as mutationStorage from '../mutationStorage'
import * as mutationRecovery from '../mutationRecovery'
import * as bondActionStorage from '../bondActionStorage'

// Mock dependencies
vi.mock('../mutationStorage')
vi.mock('../mutationRecovery')
vi.mock('../bondActionStorage')
vi.mock('../log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

describe('mutationSystemInitializer', () => {
  const mockMutationStorage = mutationStorage as any
  const mockMutationRecovery = mutationRecovery as any
  const mockBondActionStorage = bondActionStorage as any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Mock successful storage operations
    mockMutationStorage.readMutationStorage.mockReturnValue({
      schemaVersion: 2,
      operations: {},
      metadata: { createdAt: '2024-01-01T00:00:00.000Z' },
    })

    mockMutationStorage.writeMutationStorage.mockImplementation(() => {})
    mockMutationStorage.cleanupCompletedOperations.mockReturnValue(0)

    // Mock successful recovery operations
    mockMutationRecovery.initializeMutationRecovery.mockResolvedValue()
    mockMutationRecovery.shutdownMutationRecovery.mockImplementation(() => {})
    mockMutationRecovery.mutationRecoveryEngine = {
      getRecoveryStatus: vi.fn().mockReturnValue({
        active: [],
        pending: 0,
        failed: 0,
      }),
    }

    // Mock successful bond action operations
    mockBondActionStorage.forceBondActionsMigration.mockReturnValue({
      migrated: 0,
      failed: 0,
      operations: [],
    })

    try {
      await shutdownMutationSystem()
    } catch {
      // ignore
    }
  })

  describe('initializeMutationSystem', () => {
    it('initializes system with default configuration', async () => {
      const result = await initializeMutationSystem()

      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.duration).toBeGreaterThan(0)

      expect(mockMutationStorage.readMutationStorage).toHaveBeenCalled()
      expect(mockMutationRecovery.initializeMutationRecovery).toHaveBeenCalled()
    })

    it('applies custom configuration', async () => {
      const config: MutationSystemConfig = {
        forceMigration: true,
        cleanupCompleted: true,
        enableAutoRecovery: false,
        verboseLogging: true,
      }

      const result = await initializeMutationSystem(config)

      expect(result.success).toBe(true)
      expect(mockBondActionStorage.forceBondActionsMigration).toHaveBeenCalled()
      expect(mockMutationStorage.cleanupCompletedOperations).toHaveBeenCalled()
      expect(mockMutationRecovery.initializeMutationRecovery).not.toHaveBeenCalled()
    })

    it('performs migrations when forceMigration is enabled', async () => {
      mockBondActionStorage.forceBondActionsMigration.mockReturnValue({
        migrated: 2,
        failed: 1,
        operations: ['op-1', 'op-2'],
      })

      const result = await initializeMutationSystem({ forceMigration: true })

      expect(result.success).toBe(true)
      expect(result.migrationResults?.bondActionsMigrated).toBe(2)
      expect(result.warnings).toContain('1 bond actions failed to migrate')
      expect(mockBondActionStorage.forceBondActionsMigration).toHaveBeenCalled()
    })

    it('performs cleanup when cleanupCompleted is enabled', async () => {
      mockMutationStorage.cleanupCompletedOperations.mockReturnValue(5)

      const result = await initializeMutationSystem({ cleanupCompleted: true })

      expect(result.success).toBe(true)
      expect(result.cleanupResults?.operationsRemoved).toBe(5)
      expect(mockMutationStorage.cleanupCompletedOperations).toHaveBeenCalled()
    })

    it('initializes recovery system when enableAutoRecovery is true', async () => {
      mockMutationRecovery.mutationRecoveryEngine.getRecoveryStatus.mockReturnValue({
        active: [],
        pending: 3,
        failed: 1,
      })

      const result = await initializeMutationSystem({ enableAutoRecovery: true })

      expect(result.success).toBe(true)
      expect(result.migrationResults?.operationsRecovered).toBe(3)
      expect(mockMutationRecovery.initializeMutationRecovery).toHaveBeenCalled()
    })

    it('handles storage validation errors', async () => {
      mockMutationStorage.readMutationStorage.mockReturnValue({
        schemaVersion: 1, // Wrong version
        operations: {},
        metadata: { createdAt: '2024-01-01T00:00:00.000Z' },
      })

      const result = await initializeMutationSystem()

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Invalid storage schema version: 1')
    })

    it('handles migration failures gracefully', async () => {
      mockBondActionStorage.forceBondActionsMigration.mockImplementation(() => {
        throw new Error('Migration database locked')
      })

      const result = await initializeMutationSystem({ forceMigration: true })

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Migration failed: Migration database locked')
    })

    it('handles recovery initialization failures', async () => {
      mockMutationRecovery.initializeMutationRecovery.mockRejectedValue(
        new Error('Recovery system unavailable')
      )

      const result = await initializeMutationSystem({ enableAutoRecovery: true })

      expect(result.success).toBe(false)
      expect(result.errors).toContain(
        'Recovery system initialization failed: Recovery system unavailable'
      )
    })

    it('detects inconsistent operation states', async () => {
      mockMutationStorage.readMutationStorage.mockReturnValue({
        schemaVersion: 2,
        operations: {
          'inconsistent-op': {
            operationId: 'inconsistent-op',
            type: 'bond_create',
            status: 'success',
            attempts: [], // No attempts but status is success
            requestHash: 'hash',
            requestMetadata: {},
            maxAttempts: 3,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            isRecovered: false,
          },
        },
        metadata: { createdAt: '2024-01-01T00:00:00.000Z' },
      })

      const result = await initializeMutationSystem()

      expect(result.success).toBe(true) // Still succeeds but with warnings
      expect(result.warnings).toContain('1 operations have inconsistent state')
    })

    it('returns same promise for concurrent initialization attempts', async () => {
      const promise1 = initializeMutationSystem()
      const promise2 = initializeMutationSystem()

      expect(promise1).toBe(promise2)

      const [result1, result2] = await Promise.all([promise1, promise2])
      expect(result1).toBe(result2)
    })
  })

  describe('shutdownMutationSystem', () => {
    it('shuts down system gracefully', async () => {
      // Initialize first
      await initializeMutationSystem()

      await shutdownMutationSystem()

      expect(mockMutationRecovery.shutdownMutationRecovery).toHaveBeenCalled()
      expect(mockMutationStorage.writeMutationStorage).toHaveBeenCalled()
    })

    it('handles shutdown failures gracefully', async () => {
      await initializeMutationSystem()

      mockMutationRecovery.shutdownMutationRecovery.mockImplementation(() => {
        throw new Error('Recovery shutdown failed')
      })

      await expect(shutdownMutationSystem()).rejects.toThrow('Recovery shutdown failed')
    })

    it('allows reinitialization after shutdown', async () => {
      // Initialize, shutdown, then initialize again
      await initializeMutationSystem()
      await shutdownMutationSystem()

      const result = await initializeMutationSystem()
      expect(result.success).toBe(true)
    })
  })

  describe('getMutationSystemStatus', () => {
    it('returns status when system is not initialized', () => {
      const status = getMutationSystemStatus()

      expect(status.isInitialized).toBe(false)
      expect(status.isHealthy).toBe(false)
      expect(status.issues).toContain('System not initialized')
    })

    it('returns healthy status after successful initialization', async () => {
      await initializeMutationSystem()

      const status = getMutationSystemStatus()

      expect(status.isInitialized).toBe(true)
      expect(status.isHealthy).toBe(true)
      expect(status.storage.schemaVersion).toBe(2)
      expect(status.issues).toHaveLength(0)
    })

    it('detects unhealthy conditions', async () => {
      await initializeMutationSystem()

      // Mock unhealthy recovery status
      mockMutationRecovery.mutationRecoveryEngine.getRecoveryStatus.mockReturnValue({
        active: [],
        pending: 0,
        failed: 5,
      })

      const status = getMutationSystemStatus()

      expect(status.isHealthy).toBe(false)
      expect(status.issues).toContain('5 operations failed recovery')
    })

    it('handles status check failures', () => {
      mockMutationStorage.readMutationStorage.mockImplementation(() => {
        throw new Error('Storage unavailable')
      })

      const status = getMutationSystemStatus()

      expect(status.isHealthy).toBe(false)
      expect(status.issues).toContain('Status check failed: Storage unavailable')
    })
  })

  describe('performMutationSystemHealthCheck', () => {
    it('returns healthy result for well-functioning system', async () => {
      await initializeMutationSystem()

      const healthCheck = await performMutationSystemHealthCheck()

      expect(healthCheck.healthy).toBe(true)
      expect(healthCheck.status.isHealthy).toBe(true)
      expect(healthCheck.recommendations).toHaveLength(0)
    })

    it('provides recommendations for uninitialized system', async () => {
      const healthCheck = await performMutationSystemHealthCheck()

      expect(healthCheck.healthy).toBe(false)
      expect(healthCheck.recommendations).toContain('Initialize the mutation system')
    })

    it('recommends cleanup for excessive pending operations', async () => {
      await initializeMutationSystem()

      mockMutationRecovery.mutationRecoveryEngine.getRecoveryStatus.mockReturnValue({
        active: [],
        pending: 15, // Above threshold
        failed: 0,
      })

      const healthCheck = await performMutationSystemHealthCheck()

      expect(healthCheck.healthy).toBe(false)
      expect(healthCheck.recommendations).toContain('Consider cleaning up old pending operations')
    })

    it('recommends review for failed operations', async () => {
      await initializeMutationSystem()

      mockMutationRecovery.mutationRecoveryEngine.getRecoveryStatus.mockReturnValue({
        active: [],
        pending: 0,
        failed: 3,
      })

      const healthCheck = await performMutationSystemHealthCheck()

      expect(healthCheck.healthy).toBe(false)
      expect(healthCheck.recommendations).toContain('Review and retry failed operations')
    })
  })

  describe('utility functions', () => {
    describe('isMutationSystemReady', () => {
      it('returns false before initialization', () => {
        expect(isMutationSystemReady()).toBe(false)
      })

      it('returns true after successful initialization', async () => {
        await initializeMutationSystem()
        expect(isMutationSystemReady()).toBe(true)
      })

      it('returns false after shutdown', async () => {
        await initializeMutationSystem()
        await shutdownMutationSystem()
        expect(isMutationSystemReady()).toBe(false)
      })
    })

    describe('ensureMutationSystemReady', () => {
      it('succeeds when system is already initialized', async () => {
        await initializeMutationSystem()
        await expect(ensureMutationSystemReady()).resolves.toBeUndefined()
      })

      it('initializes system if not ready', async () => {
        await expect(ensureMutationSystemReady()).resolves.toBeUndefined()
        expect(isMutationSystemReady()).toBe(true)
      })

      it('throws on initialization failure', async () => {
        mockMutationStorage.readMutationStorage.mockReturnValue({
          schemaVersion: -1, // Invalid version
          operations: {},
          metadata: {},
        })

        await expect(ensureMutationSystemReady()).rejects.toThrow(
          'Mutation system initialization failed'
        )
      })

      it('applies custom configuration during initialization', async () => {
        const config = { forceMigration: true, verboseLogging: true }

        await ensureMutationSystemReady(config)

        expect(mockBondActionStorage.forceBondActionsMigration).toHaveBeenCalled()
      })
    })
  })

  describe('error recovery scenarios', () => {
    it('recovers from partial initialization failures', async () => {
      // First attempt fails at migration
      mockBondActionStorage.forceBondActionsMigration
        .mockImplementationOnce(() => {
          throw new Error('Temporary migration failure')
        })
        .mockReturnValue({
          migrated: 1,
          failed: 0,
          operations: ['recovered-op'],
        })

      // First attempt should fail
      const result1 = await initializeMutationSystem({ forceMigration: true })
      expect(result1.success).toBe(false)

      // Reset state for retry
      await shutdownMutationSystem()

      // Second attempt should succeed
      const result2 = await initializeMutationSystem({ forceMigration: true })
      expect(result2.success).toBe(true)
      expect(result2.migrationResults?.bondActionsMigrated).toBe(1)
    })

    it('handles storage corruption during initialization', async () => {
      mockMutationStorage.readMutationStorage.mockReturnValue({
        schemaVersion: 2,
        operations: {
          'corrupt-op': {
            // Missing required fields
            operationId: 'corrupt-op',
          },
        },
        metadata: { createdAt: '2024-01-01T00:00:00.000Z' },
      })

      const result = await initializeMutationSystem()

      expect(result.success).toBe(true) // Should continue despite corruption
      expect(result.warnings.some((w) => w.includes('Invalid operation found'))).toBe(true)
    })
  })

  describe('performance and concurrency', () => {
    it('handles rapid sequential initialization calls', async () => {
      const promises = Array.from({ length: 10 }, () => initializeMutationSystem())
      const results = await Promise.all(promises)

      // All should return the same result
      const firstResult = results[0]
      results.forEach((result) => {
        expect(result).toBe(firstResult)
      })

      // Storage should only be read once during initialization
      expect(mockMutationStorage.readMutationStorage.mock.calls.length).toBeLessThan(5)
    })

    it('completes initialization within reasonable time', async () => {
      const startTime = Date.now()
      await initializeMutationSystem()
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})
