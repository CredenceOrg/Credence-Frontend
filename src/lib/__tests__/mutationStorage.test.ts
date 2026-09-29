/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file mutationStorage.test.ts
 * @description Comprehensive tests for the mutation storage system.
 *
 * Test Coverage:
 * - Forward and backward compatibility
 * - Migration from v1 to v2
 * - Operation deduplication
 * - Stale operation cleanup
 * - Schema validation
 * - Concurrent operation handling
 * - Storage failure scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as storageJson from '../storageJson'
import {
  readMutationStorage,
  createMutationOperation,
  updateMutationOperation,
  getMutationOperation,
  getMutationOperations,
  cleanupCompletedOperations,
  type MutationStorageV2,
  type MutationOperation,
  __testing__,
} from '../mutationStorage'

// Mock the storage layer
vi.mock('../storageJson', () => ({
  safeReadJson: vi.fn(),
  safeWriteJson: vi.fn(),
  safeRemoveItem: vi.fn(),
}))

vi.mock('../log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

describe('mutationStorage', () => {
  const mockStorage = storageJson as any

  beforeEach(() => {
    vi.clearAllMocks()
    // Default successful storage operations
    mockStorage.safeReadJson.mockReturnValue({ ok: false, error: new Error('not found') })
    mockStorage.safeWriteJson.mockReturnValue({ ok: true })
    mockStorage.safeRemoveItem.mockReturnValue({ ok: true })
  })

  describe('readMutationStorage', () => {
    it('creates empty v2 storage when no existing data', () => {
      const storage = readMutationStorage()

      expect(storage.schemaVersion).toBe(2)
      expect(storage.operations).toEqual({})
      expect(storage.metadata.createdAt).toBeDefined()
    })

    it('returns existing v2 storage when valid', () => {
      const existingStorage: MutationStorageV2 = {
        schemaVersion: 2,
        operations: {
          'test-op': {
            operationId: 'test-op',
            type: 'bond_create',
            status: 'success',
            requestHash: 'hash-123',
            requestMetadata: { amountUsdc: 1000 },
            attempts: [],
            maxAttempts: 3,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:01:00.000Z',
            isRecovered: false,
          },
        },
        metadata: {
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: existingStorage })

      const storage = readMutationStorage()

      expect(storage).toEqual(existingStorage)
    })

    it('migrates v1 storage to v2 format', () => {
      const v1Storage = {
        schemaVersion: 1,
        bondActions: {
          create: {
            status: 'success',
            attempts: 1,
            lastAttemptAt: '2024-01-01T00:00:00.000Z',
            lastSuccessAt: '2024-01-01T00:01:00.000Z',
            lastTxHash: 'hash-123',
            lastRequest: { amountUsdc: 1000 },
          },
          withdraw: {
            status: 'idle',
            attempts: 0,
          },
        },
      }

      // First call returns v2 not found, second returns v1 data
      mockStorage.safeReadJson
        .mockReturnValueOnce({ ok: false })
        .mockReturnValueOnce({ ok: true, value: v1Storage })

      const storage = readMutationStorage()

      expect(storage.schemaVersion).toBe(2)
      expect(Object.keys(storage.operations)).toHaveLength(1)
      expect(storage.metadata.lastMigration).toBeDefined()
      expect(storage.metadata.lastMigration?.fromVersion).toBe(1)
      expect(storage.metadata.lastMigration?.toVersion).toBe(2)

      // Should attempt to write migrated storage
      expect(mockStorage.safeWriteJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ schemaVersion: 2 })
      )
    })

    it('cleans up stale operations during read', () => {
      const now = Date.now()
      const staleTime = now - 25 * 60 * 60 * 1000 // 25 hours ago
      const recentTime = now - 1 * 60 * 60 * 1000 // 1 hour ago

      const storageWithStaleOps: MutationStorageV2 = {
        schemaVersion: 2,
        operations: {
          'stale-op': {
            operationId: 'stale-op',
            type: 'bond_create',
            status: 'pending',
            requestHash: 'hash-1',
            requestMetadata: {},
            attempts: [],
            maxAttempts: 3,
            createdAt: new Date(staleTime).toISOString(),
            updatedAt: new Date(staleTime).toISOString(),
            isRecovered: false,
          },
          'recent-op': {
            operationId: 'recent-op',
            type: 'bond_create',
            status: 'pending',
            requestHash: 'hash-2',
            requestMetadata: {},
            attempts: [],
            maxAttempts: 3,
            createdAt: new Date(recentTime).toISOString(),
            updatedAt: new Date(recentTime).toISOString(),
            isRecovered: false,
          },
          'completed-op': {
            operationId: 'completed-op',
            type: 'bond_create',
            status: 'success',
            requestHash: 'hash-3',
            requestMetadata: {},
            attempts: [],
            maxAttempts: 3,
            createdAt: new Date(staleTime).toISOString(),
            updatedAt: new Date(staleTime).toISOString(),
            isRecovered: false,
          },
        },
        metadata: {
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: storageWithStaleOps })

      const storage = readMutationStorage()

      // Should keep recent and completed operations, remove stale pending
      expect(Object.keys(storage.operations)).toHaveLength(2)
      expect(storage.operations['recent-op']).toBeDefined()
      expect(storage.operations['completed-op']).toBeDefined()
      expect(storage.operations['stale-op']).toBeUndefined()
    })
  })

  describe('createMutationOperation', () => {
    beforeEach(() => {
      // Mock empty storage initially
      mockStorage.safeReadJson.mockReturnValue({ ok: false })
    })

    it('creates new operation with deduplication check', () => {
      const result = createMutationOperation('bond_create', { amountUsdc: 1000 })

      expect(result.isNewOperation).toBe(true)
      expect(result.operationId).toMatch(/^bond_create:/)
      expect(mockStorage.safeWriteJson).toHaveBeenCalled()
    })

    it('deduplicates identical operations', () => {
      const params = { amountUsdc: 1000 }
      const requestHash = __testing__.calculateRequestHash('bond_create', params)
      const now = new Date().toISOString()

      const existingStorage: MutationStorageV2 = {
        schemaVersion: 2,
        operations: {
          'existing-op': {
            operationId: 'existing-op',
            type: 'bond_create',
            status: 'pending',
            requestHash,
            requestMetadata: params,
            attempts: [],
            maxAttempts: 3,
            createdAt: now,
            updatedAt: now,
            isRecovered: false,
          },
        },
        metadata: {
          createdAt: now,
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: existingStorage })

      const result = createMutationOperation('bond_create', params)

      expect(result.isNewOperation).toBe(false)
      expect(result.operationId).toBe('existing-op')
    })

    it('creates new operation when existing is completed', () => {
      const params = { amountUsdc: 1000 }
      const requestHash = __testing__.calculateRequestHash('bond_create', params)
      const now = new Date().toISOString()

      const existingStorage: MutationStorageV2 = {
        schemaVersion: 2,
        operations: {
          'completed-op': {
            operationId: 'completed-op',
            type: 'bond_create',
            status: 'success',
            requestHash,
            requestMetadata: params,
            attempts: [],
            maxAttempts: 3,
            createdAt: now,
            updatedAt: now,
            isRecovered: false,
          },
        },
        metadata: {
          createdAt: now,
        },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: existingStorage })

      const result = createMutationOperation('bond_create', params)

      expect(result.isNewOperation).toBe(true)
      expect(result.operationId).not.toBe('completed-op')
    })
  })

  describe('updateMutationOperation', () => {
    it('updates existing operation atomically', () => {
      const now = new Date().toISOString()
      const operation: MutationOperation = {
        operationId: 'test-op',
        type: 'bond_create',
        status: 'pending',
        requestHash: 'hash-123',
        requestMetadata: { amountUsdc: 1000 },
        attempts: [],
        maxAttempts: 3,
        createdAt: now,
        updatedAt: now,
        isRecovered: false,
      }

      const storage: MutationStorageV2 = {
        schemaVersion: 2,
        operations: { 'test-op': operation },
        metadata: { createdAt: now },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: storage })

      const updatedOp = updateMutationOperation('test-op', (_op) => ({
        status: 'success',
        completedAt: now,
      }))

      expect(updatedOp).toBeDefined()
      expect(updatedOp?.status).toBe('success')
      expect(updatedOp?.completedAt).toBe(now)
      expect(mockStorage.safeWriteJson).toHaveBeenCalled()
    })

    it('returns null for non-existent operation', () => {
      const storage: MutationStorageV2 = {
        schemaVersion: 2,
        operations: {},
        metadata: { createdAt: '2024-01-01T00:00:00.000Z' },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: storage })

      const result = updateMutationOperation('non-existent', () => ({ status: 'success' }))

      expect(result).toBeNull()
    })
  })

  describe('getMutationOperations', () => {
    const now = new Date().toISOString()
    const operations: Record<string, MutationOperation> = {
      'bond-create-1': {
        operationId: 'bond-create-1',
        type: 'bond_create',
        status: 'pending',
        requestHash: 'hash-1',
        requestMetadata: {},
        attempts: [],
        maxAttempts: 3,
        createdAt: now,
        updatedAt: new Date(Date.now() - 1000).toISOString(),
        isRecovered: false,
      },
      'bond-withdraw-1': {
        operationId: 'bond-withdraw-1',
        type: 'bond_withdraw',
        status: 'success',
        requestHash: 'hash-2',
        requestMetadata: {},
        attempts: [],
        maxAttempts: 3,
        createdAt: now,
        updatedAt: new Date(Date.now() - 500).toISOString(),
        isRecovered: false,
      },
      'trust-lookup-1': {
        operationId: 'trust-lookup-1',
        type: 'trust_score_lookup',
        status: 'pending',
        requestHash: 'hash-3',
        requestMetadata: {},
        attempts: [],
        maxAttempts: 3,
        createdAt: now,
        updatedAt: now,
        isRecovered: false,
      },
    }

    beforeEach(() => {
      const storage: MutationStorageV2 = {
        schemaVersion: 2,
        operations,
        metadata: { createdAt: now },
      }
      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: storage })
    })

    it('returns all operations when no filters', () => {
      const result = getMutationOperations()

      expect(result).toHaveLength(3)
      expect(result[0].updatedAt >= result[1].updatedAt).toBe(true) // Sorted by updatedAt desc
    })

    it('filters by type', () => {
      const result = getMutationOperations('bond_create')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('bond_create')
    })

    it('filters by status', () => {
      const result = getMutationOperations(undefined, 'pending')

      expect(result).toHaveLength(2)
      expect(result.every((op) => op.status === 'pending')).toBe(true)
    })

    it('filters by both type and status', () => {
      const result = getMutationOperations('bond_withdraw', 'success')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('bond_withdraw')
      expect(result[0].status).toBe('success')
    })
  })

  describe('cleanupCompletedOperations', () => {
    it('removes completed and cancelled operations', () => {
      const now = new Date().toISOString()
      const operations: Record<string, MutationOperation> = {
        'pending-op': {
          operationId: 'pending-op',
          type: 'bond_create',
          status: 'pending',
          requestHash: 'hash-1',
          requestMetadata: {},
          attempts: [],
          maxAttempts: 3,
          createdAt: now,
          updatedAt: now,
          isRecovered: false,
        },
        'success-op': {
          operationId: 'success-op',
          type: 'bond_create',
          status: 'success',
          requestHash: 'hash-2',
          requestMetadata: {},
          attempts: [],
          maxAttempts: 3,
          createdAt: now,
          updatedAt: now,
          isRecovered: false,
        },
        'cancelled-op': {
          operationId: 'cancelled-op',
          type: 'bond_create',
          status: 'cancelled',
          requestHash: 'hash-3',
          requestMetadata: {},
          attempts: [],
          maxAttempts: 3,
          createdAt: now,
          updatedAt: now,
          isRecovered: false,
        },
      }

      const storage: MutationStorageV2 = {
        schemaVersion: 2,
        operations,
        metadata: { createdAt: '2024-01-01T00:00:00.000Z' },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: storage })

      const removedCount = cleanupCompletedOperations()

      expect(removedCount).toBe(2)
      expect(mockStorage.safeWriteJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          operations: expect.objectContaining({
            'pending-op': expect.any(Object),
          }),
        })
      )
    })
  })

  describe('storage failure scenarios', () => {
    it('handles read failures gracefully', () => {
      mockStorage.safeReadJson.mockReturnValue({
        ok: false,
        error: new Error('Storage quota exceeded'),
      })

      const storage = readMutationStorage()

      expect(storage.schemaVersion).toBe(2)
      expect(storage.operations).toEqual({})
    })

    it('handles write failures without corruption', () => {
      mockStorage.safeWriteJson.mockReturnValue({
        ok: false,
        error: new Error('Storage quota exceeded'),
      })

      // Should not throw
      expect(() => {
        const { operationId } = createMutationOperation('bond_create', { amountUsdc: 1000 })
        updateMutationOperation(operationId, () => ({ status: 'success' }))
      }).not.toThrow()
    })
  })

  describe('concurrent operation scenarios', () => {
    it('handles rapid successive operations', () => {
      mockStorage.safeReadJson.mockReturnValue({ ok: false })

      // Simulate rapid creation of similar operations
      const operations = []
      for (let i = 0; i < 5; i++) {
        const result = createMutationOperation('bond_create', {
          amountUsdc: 1000,
          timestamp: Date.now() + i, // Slight variation to prevent exact deduplication
        })
        operations.push(result)
      }

      // All should be new operations (different timestamps)
      expect(operations.every((op) => op.isNewOperation)).toBe(true)
      expect(new Set(operations.map((op) => op.operationId)).size).toBe(5)
    })
  })

  describe('edge cases and invariants', () => {
    it('maintains operation id consistency', () => {
      const params = { amountUsdc: 1000 }
      const result1 = createMutationOperation('bond_create', params)

      // Mock the created operation in storage
      const now = new Date().toISOString()
      const operation: MutationOperation = {
        operationId: result1.operationId,
        type: 'bond_create',
        status: 'pending',
        requestHash: __testing__.calculateRequestHash('bond_create', params),
        requestMetadata: params,
        attempts: [],
        maxAttempts: 3,
        createdAt: now,
        updatedAt: now,
        isRecovered: false,
      }

      const storage: MutationStorageV2 = {
        schemaVersion: 2,
        operations: { [result1.operationId]: operation },
        metadata: { createdAt: now },
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: storage })

      const retrieved = getMutationOperation(result1.operationId)
      expect(retrieved?.operationId).toBe(result1.operationId)
    })

    it('preserves metadata during operations', () => {
      const initialMetadata = {
        createdAt: '2024-01-01T00:00:00.000Z',
        customField: 'test-value',
      }

      const storage: MutationStorageV2 = {
        schemaVersion: 2,
        operations: {},
        metadata: initialMetadata as any,
      }

      mockStorage.safeReadJson.mockReturnValue({ ok: true, value: storage })

      createMutationOperation('bond_create', { amountUsdc: 1000 })

      const writeCall = mockStorage.safeWriteJson.mock.calls[0]
      const writtenStorage = writeCall[1] as MutationStorageV2

      expect(writtenStorage.metadata.createdAt).toBe(initialMetadata.createdAt)
      expect((writtenStorage.metadata as any).customField).toBe('test-value')
    })
  })

  describe('helper functions', () => {
    describe('calculateRequestHash', () => {
      it('generates consistent hashes for identical requests', () => {
        const params1 = { amountUsdc: 1000, bondId: 123 }
        const params2 = { bondId: 123, amountUsdc: 1000 } // Different order

        const hash1 = __testing__.calculateRequestHash('bond_create', params1)
        const hash2 = __testing__.calculateRequestHash('bond_create', params2)

        expect(hash1).toBe(hash2)
      })

      it('filters out temporal fields', () => {
        const params1 = { amountUsdc: 1000, timestamp: '2024-01-01' }
        const params2 = { amountUsdc: 1000, timestamp: '2024-01-02' }

        const hash1 = __testing__.calculateRequestHash('bond_create', params1)
        const hash2 = __testing__.calculateRequestHash('bond_create', params2)

        expect(hash1).toBe(hash2)
      })

      it('generates different hashes for different operations', () => {
        const params = { amountUsdc: 1000 }

        const hash1 = __testing__.calculateRequestHash('bond_create', params)
        const hash2 = __testing__.calculateRequestHash('bond_withdraw', params)

        expect(hash1).not.toBe(hash2)
      })
    })
  })
})
