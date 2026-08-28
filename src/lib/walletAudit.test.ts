import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emitWalletSessionEvent,
  generateCorrelationId,
  getCommittedWalletSessionSnapshot,
  getWalletAuditTrail,
  resetWalletAuditTrail,
  subscribeWalletSessionEvents,
} from './walletAudit'

const TEST_ADDRESS_1 = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
const TEST_ADDRESS_2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

describe('walletAudit event and audit parity', () => {
  beforeEach(() => {
    resetWalletAuditTrail()
  })

  it('generates unique correlation IDs with optional prefix', () => {
    const id1 = generateCorrelationId('test')
    const id2 = generateCorrelationId('test')
    expect(id1).toMatch(/^test-/)
    expect(id2).toMatch(/^test-/)
    expect(id1).not.toBe(id2)
  })

  it('records committed transitions in monotonically increasing sequence with correlation IDs', () => {
    const corrId = generateCorrelationId('conn')
    const event1 = emitWalletSessionEvent('session_connecting', {
      address: null,
      network: null,
      correlationId: corrId,
    })

    const event2 = emitWalletSessionEvent('session_connected', {
      address: TEST_ADDRESS_1,
      network: 'public',
      correlationId: corrId,
    })

    expect(event1.sequence).toBe(1)
    expect(event1.version).toBe(1)
    expect(event1.correlationId).toBe(corrId)

    expect(event2.sequence).toBe(2)
    expect(event2.version).toBe(1)
    expect(event2.correlationId).toBe(corrId)
    expect(event2.address).toBe(TEST_ADDRESS_1)
    expect(event2.network).toBe('public')

    const trail = getWalletAuditTrail()
    expect(trail).toHaveLength(2)
    expect(trail[0]).toBe(event1)
    expect(trail[1]).toBe(event2)
  })

  it('maintains strict audit parity between event history and derived state across connect -> disconnect -> reconnect', () => {
    expect(getCommittedWalletSessionSnapshot()).toEqual({
      address: null,
      network: null,
      isConnected: false,
      lastSequence: 0,
      lastCorrelationId: null,
    })

    // 1. Connect
    const connCorr = generateCorrelationId('conn')
    emitWalletSessionEvent('session_connected', {
      address: TEST_ADDRESS_1,
      network: 'public',
      correlationId: connCorr,
    })

    let snapshot = getCommittedWalletSessionSnapshot()
    expect(snapshot.isConnected).toBe(true)
    expect(snapshot.address).toBe(TEST_ADDRESS_1)
    expect(snapshot.network).toBe('public')
    expect(snapshot.lastSequence).toBe(1)
    expect(snapshot.lastCorrelationId).toBe(connCorr)

    // 2. Disconnect
    const discCorr = generateCorrelationId('disc')
    emitWalletSessionEvent('session_disconnected', {
      address: null,
      network: null,
      correlationId: discCorr,
    })

    snapshot = getCommittedWalletSessionSnapshot()
    expect(snapshot.isConnected).toBe(false)
    expect(snapshot.address).toBeNull()
    expect(snapshot.network).toBeNull()
    expect(snapshot.lastSequence).toBe(2)
    expect(snapshot.lastCorrelationId).toBe(discCorr)

    // 3. Reconnect
    const reconCorr = generateCorrelationId('recon')
    emitWalletSessionEvent('session_reconnected', {
      address: TEST_ADDRESS_2,
      network: 'test',
      correlationId: reconCorr,
    })

    snapshot = getCommittedWalletSessionSnapshot()
    expect(snapshot.isConnected).toBe(true)
    expect(snapshot.address).toBe(TEST_ADDRESS_2)
    expect(snapshot.network).toBe('test')
    expect(snapshot.lastSequence).toBe(3)
    expect(snapshot.lastCorrelationId).toBe(reconCorr)
  })

  it('handles idle session expiry leaving clean zeroed state', () => {
    emitWalletSessionEvent('session_connected', {
      address: TEST_ADDRESS_1,
      network: 'public',
    })
    expect(getCommittedWalletSessionSnapshot().isConnected).toBe(true)

    emitWalletSessionEvent('session_expired', {
      address: null,
      network: null,
      metadata: { reason: 'inactivity' },
    })

    const snapshot = getCommittedWalletSessionSnapshot()
    expect(snapshot.isConnected).toBe(false)
    expect(snapshot.address).toBeNull()
    expect(snapshot.network).toBeNull()
  })

  it('leaves no partial or unauthorized state on rejected / failed connection attempts', () => {
    const failCorr = generateCorrelationId('fail')
    emitWalletSessionEvent('session_connecting', {
      address: null,
      network: null,
      correlationId: failCorr,
    })
    emitWalletSessionEvent('session_failed', {
      address: null,
      network: null,
      correlationId: failCorr,
      metadata: { code: 'rejected', message: 'User denied' },
    })

    const snapshot = getCommittedWalletSessionSnapshot()
    expect(snapshot.isConnected).toBe(false)
    expect(snapshot.address).toBeNull()
    expect(snapshot.network).toBeNull()
    expect(snapshot.lastCorrelationId).toBe(failCorr)
  })

  it('notifies subscribers synchronously upon event emission', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeWalletSessionEvents(listener)

    const event = emitWalletSessionEvent('session_connected', {
      address: TEST_ADDRESS_1,
      network: 'public',
    })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(event)

    unsubscribe()
    emitWalletSessionEvent('session_disconnected', {
      address: null,
      network: null,
    })

    expect(listener).toHaveBeenCalledOnce()
  })

  it('handles account and network switch transitions', () => {
    emitWalletSessionEvent('session_connected', {
      address: TEST_ADDRESS_1,
      network: 'public',
    })

    emitWalletSessionEvent('account_changed', {
      address: TEST_ADDRESS_2,
      network: 'public',
      metadata: { previousAddress: TEST_ADDRESS_1 },
    })

    let snapshot = getCommittedWalletSessionSnapshot()
    expect(snapshot.address).toBe(TEST_ADDRESS_2)
    expect(snapshot.network).toBe('public')

    emitWalletSessionEvent('network_changed', {
      address: TEST_ADDRESS_2,
      network: 'test',
      metadata: { previousNetwork: 'public' },
    })

    snapshot = getCommittedWalletSessionSnapshot()
    expect(snapshot.address).toBe(TEST_ADDRESS_2)
    expect(snapshot.network).toBe('test')
  })
})
