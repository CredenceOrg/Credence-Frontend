import type { CredenceNetwork } from './networkLabels'

export type WalletSessionEventType =
  | 'session_connecting'
  | 'session_connected'
  | 'session_disconnected'
  | 'session_expired'
  | 'session_reconnected'
  | 'session_failed'
  | 'account_changed'
  | 'network_changed'
  | 'action_attempted'
  | 'action_succeeded'
  | 'action_failed'

export interface WalletSessionEvent {
  /** Event schema version (semver / integer for deterministic parsing) */
  version: 1
  /** Monotonically increasing sequence number per event stream */
  sequence: number
  /** Deterministic event classification */
  type: WalletSessionEventType
  /** Correlation identifier linking related actions or multi-step flows */
  correlationId: string
  /** ISO 8601 UTC timestamp of occurrence */
  timestamp: string
  /** Verified Stellar address associated with this event (or null if unauthenticated) */
  address: string | null
  /** Active Stellar network associated with this event */
  network: CredenceNetwork | null
  /** Detailed metadata / transition specifics */
  metadata?: Record<string, unknown>
}

export interface WalletSessionStateSnapshot {
  address: string | null
  network: CredenceNetwork | null
  isConnected: boolean
  lastSequence: number
  lastCorrelationId: string | null
}

type EventListener = (event: WalletSessionEvent) => void

let sequenceCounter = 0
const auditTrail: WalletSessionEvent[] = []
const listeners = new Set<EventListener>()

/**
 * Generate a unique correlation ID for tracing an operation end-to-end.
 */
export function generateCorrelationId(prefix: string = 'corr'): string {
  const time = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return prefix + '-' + time + '-' + random
}

/**
 * Record and emit a versioned wallet session audit event for committed transitions.
 */
export function emitWalletSessionEvent(
  type: WalletSessionEventType,
  payload: {
    address: string | null
    network: CredenceNetwork | null
    correlationId?: string
    metadata?: Record<string, unknown>
  }
): WalletSessionEvent {
  sequenceCounter += 1
  const event: WalletSessionEvent = {
    version: 1,
    sequence: sequenceCounter,
    type,
    correlationId: payload.correlationId || generateCorrelationId(),
    timestamp: new Date().toISOString(),
    address: payload.address,
    network: payload.network,
    metadata: payload.metadata,
  }

  auditTrail.push(Object.freeze(event))

  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // Prevent listener errors from interfering with event audit pipeline
    }
  }

  return event
}

/**
 * Get a readonly copy of all recorded audit events.
 */
export function getWalletAuditTrail(): readonly WalletSessionEvent[] {
  return [...auditTrail]
}

/**
 * Retrieve the latest committed wallet session state derived from the audit trail.
 */
export function getCommittedWalletSessionSnapshot(): WalletSessionStateSnapshot {
  let address: string | null = null
  let network: CredenceNetwork | null = null
  let isConnected = false
  let lastSequence = 0
  let lastCorrelationId: string | null = null

  for (const event of auditTrail) {
    lastSequence = event.sequence
    lastCorrelationId = event.correlationId

    switch (event.type) {
      case 'session_connected':
      case 'session_reconnected':
        address = event.address
        network = event.network
        isConnected = Boolean(event.address)
        break
      case 'session_disconnected':
      case 'session_expired':
        address = null
        network = null
        isConnected = false
        break
      case 'account_changed':
        address = event.address
        isConnected = Boolean(event.address)
        break
      case 'network_changed':
        network = event.network
        break
      case 'session_failed':
        if (!isConnected) {
          address = null
          network = null
        }
        break
      default:
        break
    }
  }

  return {
    address,
    network,
    isConnected,
    lastSequence,
    lastCorrelationId,
  }
}

/**
 * Subscribe to emitted wallet session events.
 * Returns an unsubscribe function.
 */
export function subscribeWalletSessionEvents(listener: EventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Clears the audit trail and resets sequence counters (primarily for testing and rollback).
 */
export function resetWalletAuditTrail(): void {
  sequenceCounter = 0
  auditTrail.length = 0
  listeners.clear()
}
