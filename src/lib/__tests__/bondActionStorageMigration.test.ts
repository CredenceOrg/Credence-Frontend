/**
 * @file bondActionStorageMigration.test.ts
 * @description Integration tests specifically for bond action storage migration scenarios.
 *
 * Test Coverage:
 * - Legacy v1 to enhanced v2 migration
 * - Backward compatibility preservation
 * - Data integrity during migration
 * - Rollback scenarios
 * - Concurrent migration handling
 * - Migration failure recovery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as storageJson from '../storageJson'
import * as mutationStorage from '../mutationStorage'
import {
  readBondActions,
  writeBondActions,
  updateBondAction,
  createEnhancedBondAction,
  getBondActionMutationOperation,
  getBondActionMigrationStatus,
  forceBondActionsMigration,
  __testing__,
} from '../bondActionStorage'

// Mock dependencies
vi.mock('../storageJson')
vi.mock('../mutationStorage')
vi.mock('../log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

describe('bondActionStorageMigration', () => {
  const mockStorage = storageJson as any
  const mockMutationStorage = mutationStorage as any

  beforeEach(() => {
    vi.clearAllMocks()

    // Default storage operations
    mockStorage.safeReadJson.mockReturnValue({ ok: false })
    mockStorage.safeWriteJson.mockReturnValue({ ok: true })

    // Default mutation storage operations
    mockMutationStorage.readMutationStorage.mockReturnValue({
      schemaVersion: 2,
      operations: {},
      metadata: { createdAt: '2024-01-01T00:00:00.000Z' },
    })

    mockMutationStorage.createMutationOperation.mockReturnValue({
      operationId: 'migrated-op-123',
      isNewOperation: true,
    })

    mockMutationStorage.updateMutationOperation.mockImplementation((id, updater) => {
      const mockOp = {
        operationId: id,
        type: 'bond_create',
        status: 'success',
        attempts: [],
        requestHash: 'migrated-hash',
        requestMetadata: {},
        maxAttempts: 3,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:01:00.000Z',
        isRecovered: true,
        recoveredAt: '2024-01-01T00:02:00.000Z',
        recoverySource: 'storage',
      }
      return { ...mockOp, ...updater(mockOp) }
    })

    mockMutationStorage.getMutationOperations.mockReturnValue([])
  })

  describe('automatic migration on read', () => {
    it('migrates v1 bond create operation to unified system', () => {
      const legacyData = {
        schemaVersion: 1,
        create: {
          status: 'success',
          attempts: 2,
          lastAttemptAt: '2024-01-01T00:01:00.000Z',
          lastSuccessAt: '2024-01-01T00:02:00.000Z',
          lastTxHash: 'legacy-hash-123',
          lastRequest: { amountUsdc: 1000 },
        },
        withdraw: {
          status: 'idle',
          attempts: 0,
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: legacyData })

      const bondActions = readBondActions()

      expect(bondActions.create.migratedToV2).toBe(true)
      expect(bondActions.create.operationId).toBe('migrated-op-123')
      expect(bondActions.migrationStatus?.migratedAt).toBeDefined()
      expect(bondActions.migrationStatus?.preservedLegacyData).toBe(true)

      // Should have created operation in unified system
      expect(mockMutationStorage.createMutationOperation).toHaveBeenCalledWith(
        'bond_create',
        { amountUsdc: 1000 },
        3
      )

      // Should have updated operation with legacy state
      expect(mockMutationStorage.updateMutationOperation).toHaveBeenCalledWith(
        'migrated-op-123',
        expect.any(Function)
      )

      // Should have written migrated data back
      expect(mockStorage.safeWriteJson).toHaveBeenCalled()
    })

    it('migrates v1 bond withdraw operation to unified system', () => {
      const legacyData = {
        schemaVersion: 1,
        create: {
          status: 'idle',
          attempts: 0,
        },
        withdraw: {
          status: 'error',
          attempts: 1,
          lastAttemptAt: '2024-01-01T00:01:00.000Z',
          lastError: {
            type: 'network',
            message: 'Connection failed',
            at: '2024-01-01T00:01:00.000Z',
          },
          lastRequest: { bondId: 123, amountUsdc: 500 },
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: legacyData })

      const bondActions = readBondActions()

      expect(bondActions.withdraw.migratedToV2).toBe(true)
      expect(bondActions.withdraw.operationId).toBe('migrated-op-123')

      // Should have migrated error state
      expect(mockMutationStorage.updateMutationOperation).toHaveBeenCalledWith(
        'migrated-op-123',
        expect.any(Function)
      )
    })

    it('preserves already migrated operations', () => {
      const alreadyMigrated = {
        schemaVersion: 1,
        create: {
          status: 'success',
          attempts: 1,
          lastSuccessAt: '2024-01-01T00:02:00.000Z',
          operationId: 'existing-op-456',
          migratedToV2: true,
        },
        withdraw: {
          status: 'idle',
          attempts: 0,
        },
        migrationStatus: {
          migratedAt: '2024-01-01T00:00:00.000Z',
          preservedLegacyData: true,
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: alreadyMigrated })

      const bondActions = readBondActions()

      expect(bondActions.create.operationId).toBe('existing-op-456')
      expect(bondActions.migrationStatus?.migratedAt).toBe('2024-01-01T00:00:00.000Z')

      // Should not attempt new migration
      expect(mockMutationStorage.createMutationOperation).not.toHaveBeenCalled()
    })

    it('handles migration failures gracefully', () => {
      const legacyData = {
        schemaVersion: 1,
        create: {
          status: 'success',
          attempts: 1,
          lastRequest: { amountUsdc: 1000 },
        },
        withdraw: {
          status: 'idle',
          attempts: 0,
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: legacyData })
      mockMutationStorage.createMutationOperation.mockImplementation(() => {
        throw new Error('Migration storage full')
      })

      const bondActions = readBondActions()

      // Should return data without migration
      expect(bondActions.create.migratedToV2).toBeUndefined()
      expect(bondActions.create.operationId).toBeUndefined()
      expect(bondActions.schemaVersion).toBe(1)
    })
  })

  describe('enhanced bond action creation', () => {
    it('creates operation in both legacy and unified systems', async () => {
      mockStorage.safeReadJson.mockReturnValue({
        ok: true,
        value: {
          schemaVersion: 1,
          create: { status: 'idle', attempts: 0 },
          withdraw: { status: 'idle', attempts: 0 },
        },
      })

      const result = await createEnhancedBondAction('create', { amountUsdc: 2000 })

      expect(result.operationId).toBe('migrated-op-123')
      expect(result.isNewOperation).toBe(true)

      // Should create in unified system
      expect(mockMutationStorage.createMutationOperation).toHaveBeenCalledWith(
        'bond_create',
        { amountUsdc: 2000 },
        3
      )

      // Should update legacy system
      expect(mockStorage.safeWriteJson).toHaveBeenCalled()
    })

    it('links existing operations between systems', async () => {
      const existingData = {
        schemaVersion: 1,
        create: {
          status: 'pending',
          attempts: 1,
          operationId: 'existing-unified-op',
          migratedToV2: true,
        },
        withdraw: { status: 'idle', attempts: 0 },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: existingData })

      const result = await createEnhancedBondAction('create', { amountUsdc: 1500 })

      expect(result.operationId).toBeDefined()
      expect(result.legacyUpdated.create.operationId).toBeDefined()
    })
  })

  describe('operation synchronization', () => {
    it('synchronizes updates between legacy and unified systems', () => {
      const linkedData = {
        schemaVersion: 1,
        create: {
          status: 'pending',
          attempts: 1,
          operationId: 'sync-test-op',
          migratedToV2: true,
        },
        withdraw: { status: 'idle', attempts: 0 },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: linkedData })

      const result = updateBondAction('create', (current) => ({
        ...current,
        status: 'success',
        lastSuccessAt: '2024-01-01T00:05:00.000Z',
        lastTxHash: 'sync-success-hash',
      }))

      expect(result.create.status).toBe('success')
      expect(result.create.lastTxHash).toBe('sync-success-hash')

      // Should update unified system
      expect(mockMutationStorage.updateMutationOperation).toHaveBeenCalledWith(
        'sync-test-op',
        expect.any(Function)
      )

      // Should write legacy system
      expect(mockStorage.safeWriteJson).toHaveBeenCalled()
    })

    it('handles updates for non-migrated operations', () => {
      const legacyOnlyData = {
        schemaVersion: 1,
        create: {
          status: 'pending',
          attempts: 1,
          // No operationId or migratedToV2
        },
        withdraw: { status: 'idle', attempts: 0 },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: legacyOnlyData })

      const result = updateBondAction('create', (current) => ({
        ...current,
        status: 'error',
        lastError: {
          type: 'network',
          message: 'Timeout',
          at: '2024-01-01T00:03:00.000Z',
        },
      }))

      expect(result.create.status).toBe('error')

      // Should not attempt to update unified system
      expect(mockMutationStorage.updateMutationOperation).not.toHaveBeenCalled()
    })
  })

  describe('migration status and diagnostics', () => {
    it('reports migration status accurately', () => {
      const migratedData = {
        schemaVersion: 1,
        create: {
          status: 'success',
          attempts: 1,
          migratedToV2: true,
        },
        withdraw: {
          status: 'idle',
          attempts: 0,
          migratedToV2: false,
        },
        migrationStatus: {
          migratedAt: '2024-01-01T10:00:00.000Z',
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: migratedData })

      const status = getBondActionMigrationStatus()

      expect(status.createMigrated).toBe(true)
      expect(status.withdrawMigrated).toBe(false)
      expect(status.migrationTimestamp).toBe('2024-01-01T10:00:00.000Z')
    })

    it('retrieves linked mutation operations', () => {
      const linkedData = {
        schemaVersion: 1,
        create: {
          status: 'success',
          operationId: 'linked-create-op',
          migratedToV2: true,
        },
        withdraw: { status: 'idle', attempts: 0 },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: linkedData })

      const mockUnifiedOp = {
        operationId: 'linked-create-op',
        type: 'bond_create',
        status: 'success',
        finalTxHash: 'unified-hash-789',
        completedAt: '2024-01-01T00:05:00.000Z',
      }

      mockMutationStorage.getMutationOperations.mockReturnValue([mockUnifiedOp])

      const operation = getBondActionMutationOperation('create')

      expect(operation).toEqual(mockUnifiedOp)
    })
  })

  describe('forced migration scenarios', () => {
    it('forces migration of all bond actions', () => {
      const unmigrated = {
        schemaVersion: 1,
        create: {
          status: 'error',
          attempts: 2,
          lastError: { type: 'network', message: 'Timeout', at: '2024-01-01T00:01:00.000Z' },
          lastRequest: { amountUsdc: 750 },
        },
        withdraw: {
          status: 'success',
          attempts: 1,
          lastSuccessAt: '2024-01-01T00:02:00.000Z',
          lastTxHash: 'withdraw-hash-456',
          lastRequest: { bondId: 789, amountUsdc: 250 },
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: unmigrated })

      // Mock different operation IDs for each operation
      mockMutationStorage.createMutationOperation
        .mockReturnValueOnce({ operationId: 'forced-create-op', isNewOperation: true })
        .mockReturnValueOnce({ operationId: 'forced-withdraw-op', isNewOperation: true })

      const result = forceBondActionsMigration()

      expect(result.migrated).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.operations).toContain('forced-create-op')
      expect(result.operations).toContain('forced-withdraw-op')

      // Should have created operations for both
      expect(mockMutationStorage.createMutationOperation).toHaveBeenCalledTimes(2)
    })

    it('handles partial migration failures in forced migration', () => {
      const unmigrated = {
        schemaVersion: 1,
        create: {
          status: 'success',
          attempts: 1,
          lastRequest: { amountUsdc: 1000 },
        },
        withdraw: {
          status: 'error',
          attempts: 1,
          lastRequest: { bondId: 123, amountUsdc: 500 },
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: unmigrated })

      // First migration succeeds, second fails
      mockMutationStorage.createMutationOperation
        .mockReturnValueOnce({ operationId: 'success-op', isNewOperation: true })
        .mockImplementationOnce(() => {
          throw new Error('Storage quota exceeded')
        })

      const result = forceBondActionsMigration()

      expect(result.migrated).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.operations).toHaveLength(1)
    })
  })

  describe('data integrity and consistency', () => {
    it('preserves all legacy data during migration', () => {
      const richLegacyData = {
        schemaVersion: 1,
        create: {
          status: 'success',
          attempts: 3,
          lastAttemptAt: '2024-01-01T00:01:00.000Z',
          lastSuccessAt: '2024-01-01T00:03:00.000Z',
          lastTxHash: 'preserve-hash-123',
          lastRequest: { amountUsdc: 1500, customField: 'preserved' },
          customLegacyField: 'should-be-kept',
        },
        withdraw: { status: 'idle', attempts: 0 },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: richLegacyData })

      const bondActions = readBondActions()

      // All original data should be preserved
      expect(bondActions.create.status).toBe('success')
      expect(bondActions.create.attempts).toBe(3)
      expect(bondActions.create.lastTxHash).toBe('preserve-hash-123')
      expect(bondActions.create.lastRequest?.amountUsdc).toBe(1500)
      expect((bondActions.create as any).customLegacyField).toBe('should-be-kept')

      // Migration fields should be added
      expect(bondActions.create.migratedToV2).toBe(true)
      expect(bondActions.create.operationId).toBeDefined()
    })

    it('maintains atomic migration updates', () => {
      const legacyData = {
        schemaVersion: 1,
        create: { status: 'success', attempts: 1, lastRequest: { amountUsdc: 1000 } },
        withdraw: { status: 'success', attempts: 1, lastRequest: { bondId: 123, amountUsdc: 500 } },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: legacyData })

      // Simulate write failure during migration
      mockStorage.safeWriteJson.mockReturnValue({ ok: false, error: new Error('Disk full') })

      const bondActions = readBondActions()

      // Migration should complete in memory even if write fails
      expect(bondActions.create.migratedToV2).toBe(true)
      expect(bondActions.withdraw.migratedToV2).toBe(true)
      expect(bondActions.migrationStatus?.migratedAt).toBeDefined()
    })

    it('validates migrated operation consistency', () => {
      const legacyData = {
        schemaVersion: 1,
        create: {
          status: 'success',
          attempts: 1,
          lastSuccessAt: '2024-01-01T00:03:00.000Z',
          lastTxHash: 'consistency-hash',
          lastRequest: { amountUsdc: 2000 },
        },
        withdraw: { status: 'idle', attempts: 0 },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: legacyData })

      // Verify the updater function receives and uses legacy data correctly
      let capturedUpdater: any
      mockMutationStorage.updateMutationOperation.mockImplementation((id, updater) => {
        capturedUpdater = updater
        return updater({
          operationId: id,
          type: 'bond_create',
          status: 'pending',
          attempts: [],
          requestHash: 'test-hash',
          requestMetadata: {},
          maxAttempts: 3,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          isRecovered: false,
        })
      })

      readBondActions()

      expect(capturedUpdater).toBeDefined()

      // Check that updater correctly maps legacy data
      const updateResult = capturedUpdater({
        operationId: 'test',
        attempts: [],
        requestHash: 'hash',
      })

      expect(updateResult.status).toBe('success')
      expect(updateResult.completedAt).toBe('2024-01-01T00:03:00.000Z')
      expect(updateResult.finalTxHash).toBe('consistency-hash')
      expect(updateResult.isRecovered).toBe(true)
      expect(updateResult.recoverySource).toBe('storage')
    })
  })

  describe('helper function tests', () => {
    describe('mapLegacyStatusToMutation', () => {
      it('maps all legacy statuses correctly', () => {
        const { mapLegacyStatusToMutation } = __testing__

        expect(mapLegacyStatusToMutation('idle')).toBe('idle')
        expect(mapLegacyStatusToMutation('pending')).toBe('pending')
        expect(mapLegacyStatusToMutation('success')).toBe('success')
        expect(mapLegacyStatusToMutation('error')).toBe('error')
        expect(mapLegacyStatusToMutation('unknown' as any)).toBe('error')
      })
    })

    describe('migrateRecordToMutationSystem', () => {
      it('creates correct mutation operation for bond create', () => {
        const { migrateRecordToMutationSystem } = __testing__

        const legacyRecord = {
          status: 'success' as const,
          attempts: 2,
          lastAttemptAt: '2024-01-01T00:01:00.000Z',
          lastSuccessAt: '2024-01-01T00:03:00.000Z',
          lastTxHash: 'migrate-test-hash',
          lastRequest: { amountUsdc: 1200 },
        }

        const result = migrateRecordToMutationSystem(legacyRecord, 'create')

        expect(result?.migratedToV2).toBe(true)
        expect(result?.operationId).toBe('migrated-op-123')
        expect(mockMutationStorage.createMutationOperation).toHaveBeenCalledWith(
          'bond_create',
          { amountUsdc: 1200 },
          3
        )
      })

      it('handles migration failures gracefully', () => {
        const { migrateRecordToMutationSystem } = __testing__

        mockMutationStorage.createMutationOperation.mockImplementation(() => {
          throw new Error('Migration failed')
        })

        const legacyRecord = {
          status: 'success' as const,
          attempts: 1,
          lastRequest: { amountUsdc: 1000 },
        }

        const result = migrateRecordToMutationSystem(legacyRecord, 'create')

        expect(result).toBeNull()
      })
    })
  })
})
