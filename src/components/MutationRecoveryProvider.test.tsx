import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  MutationRecoveryProvider,
  useMutationRecovery,
} from './MutationRecoveryProvider'
import {
  initializeMutationSystem,
  shutdownMutationSystem,
  getMutationSystemStatus,
  type InitializationResult,
  type SystemStatus,
} from '../lib/mutationSystemInitializer'

vi.mock('../lib/mutationSystemInitializer', () => ({
  initializeMutationSystem: vi.fn(),
  shutdownMutationSystem: vi.fn(),
  getMutationSystemStatus: vi.fn(),
}))

vi.mock('../lib/mutationStorage', () => ({
  getMutationOperations: vi.fn(() => []),
  paginateMutationOperations: vi.fn(() => ({
    items: [],
    hasNextPage: false,
    totalCount: 0,
  })),
}))

vi.mock('../lib/log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

const mockInitSuccess: InitializationResult = {
  success: true,
  migrationResults: {
    bondActionsMigrated: 0,
    operationsRecovered: 0,
  },
  cleanupResults: {
    operationsRemoved: 0,
  },
  errors: [],
  warnings: [],
  duration: 5,
}

const mockHealthyStatus: SystemStatus = {
  isInitialized: true,
  isHealthy: true,
  storage: {
    schemaVersion: 2,
    operationCount: 0,
  },
  recovery: {
    active: 0,
    pending: 0,
    failed: 0,
  },
  issues: [],
}

function StatusConsumer() {
  const { isInitialized, isInitializing, systemStatus } = useMutationRecovery()
  return (
    <div>
      <span data-testid="initialized">{String(isInitialized)}</span>
      <span data-testid="initializing">{String(isInitializing)}</span>
      <span data-testid="healthy">{String(systemStatus?.isHealthy ?? false)}</span>
    </div>
  )
}

describe('MutationRecoveryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(initializeMutationSystem).mockResolvedValue(mockInitSuccess)
    vi.mocked(shutdownMutationSystem).mockResolvedValue(undefined)
    vi.mocked(getMutationSystemStatus).mockReturnValue(mockHealthyStatus)
  })

  it('renders children and initializes the mutation system once on mount', async () => {
    render(
      <MutationRecoveryProvider>
        <div data-testid="child">App Content</div>
        <StatusConsumer />
      </MutationRecoveryProvider>
    )

    expect(screen.getByTestId('child')).toHaveTextContent('App Content')

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true')
    })

    expect(initializeMutationSystem).toHaveBeenCalledTimes(1)
    expect(initializeMutationSystem).toHaveBeenCalledWith(
      expect.objectContaining({
        enableAutoRecovery: true,
        cleanupCompleted: false,
      })
    )
    expect(getMutationSystemStatus).toHaveBeenCalled()
    expect(screen.getByTestId('healthy')).toHaveTextContent('true')
  })

  it('forwards custom config options to initializeMutationSystem', async () => {
    render(
      <MutationRecoveryProvider config={{ forceMigration: true, cleanupCompleted: true }}>
        <StatusConsumer />
      </MutationRecoveryProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true')
    })

    expect(initializeMutationSystem).toHaveBeenCalledTimes(1)
    expect(initializeMutationSystem).toHaveBeenCalledWith(
      expect.objectContaining({
        forceMigration: true,
        cleanupCompleted: true,
        enableAutoRecovery: true,
      })
    )
  })

  it('does not initialize on mount when autoInitialize is false', () => {
    render(
      <MutationRecoveryProvider autoInitialize={false}>
        <div data-testid="child">App Content</div>
        <StatusConsumer />
      </MutationRecoveryProvider>
    )

    expect(screen.getByTestId('child')).toHaveTextContent('App Content')
    expect(initializeMutationSystem).not.toHaveBeenCalled()
    expect(screen.getByTestId('initialized')).toHaveTextContent('false')
  })

  it('shuts down the mutation system on unmount after initialization', async () => {
    const { unmount } = render(
      <MutationRecoveryProvider>
        <StatusConsumer />
      </MutationRecoveryProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true')
    })

    expect(shutdownMutationSystem).not.toHaveBeenCalled()

    unmount()

    expect(shutdownMutationSystem).toHaveBeenCalledTimes(1)
  })

  it('does not crash when shutdownMutationSystem rejects on unmount', async () => {
    vi.mocked(shutdownMutationSystem).mockRejectedValueOnce(new Error('Shutdown failed'))

    const { unmount } = render(
      <MutationRecoveryProvider>
        <StatusConsumer />
      </MutationRecoveryProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true')
    })

    expect(() => unmount()).not.toThrow()
    expect(shutdownMutationSystem).toHaveBeenCalledTimes(1)
  })

  it('does not crash children when initializeMutationSystem throws', async () => {
    vi.mocked(initializeMutationSystem)
      .mockRejectedValueOnce(new Error('Recovery init boom'))
      .mockReturnValue(new Promise(() => {}))

    render(
      <MutationRecoveryProvider>
        <div data-testid="child">Still Rendered</div>
        <StatusConsumer />
      </MutationRecoveryProvider>
    )

    await waitFor(() => {
      expect(initializeMutationSystem).toHaveBeenCalled()
    })

    expect(screen.getByTestId('child')).toHaveTextContent('Still Rendered')
    expect(screen.getByTestId('initialized')).toHaveTextContent('false')
  })

  it('does not crash children when initializeMutationSystem returns failure result', async () => {
    vi.mocked(initializeMutationSystem)
      .mockResolvedValueOnce({
        success: false,
        errors: ['Storage corrupted'],
        warnings: [],
        duration: 2,
      })
      .mockReturnValue(new Promise(() => {}))

    render(
      <MutationRecoveryProvider>
        <div data-testid="child">Still Rendered</div>
        <StatusConsumer />
      </MutationRecoveryProvider>
    )

    await waitFor(() => {
      expect(initializeMutationSystem).toHaveBeenCalled()
    })

    expect(screen.getByTestId('child')).toHaveTextContent('Still Rendered')
    expect(screen.getByTestId('initialized')).toHaveTextContent('false')
  })

  it('throws when useMutationRecovery is called outside MutationRecoveryProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<StatusConsumer />)).toThrow(
      'useMutationRecovery must be used within a MutationRecoveryProvider'
    )

    consoleErrorSpy.mockRestore()
  })
})
