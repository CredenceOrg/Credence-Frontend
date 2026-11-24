import type { CredenceNetwork } from './networkLabels'

export type CrossTabMessageType = 'disconnect' | 'idle-lock' | 'network-change'

export interface CrossTabMessage {
  version: 1
  type: CrossTabMessageType
  tabId: string
  correlationId: string
  timestamp: number
  network?: CredenceNetwork
}

interface MessageChannelLike {
  onmessage: ((event: MessageEvent<CrossTabMessage>) => void) | null
  postMessage: (message: CrossTabMessage) => void
  close: () => void
}

interface CrossTabBusOptions {
  channel?: MessageChannelLike | null
  storage?: Pick<Storage, 'setItem'> | null
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  tabId?: string
}

const CHANNEL_NAME = 'credence:wallet-session'
const STORAGE_EVENT_KEY = 'credence:wallet-session:event'

function createTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createChannel(): MessageChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
}

function isCrossTabMessage(value: unknown): value is CrossTabMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<CrossTabMessage>
  return (
    message.version === 1 &&
    (message.type === 'disconnect' ||
      message.type === 'idle-lock' ||
      message.type === 'network-change') &&
    typeof message.tabId === 'string' &&
    typeof message.correlationId === 'string' &&
    typeof message.timestamp === 'number' &&
    (message.network === undefined || message.network === 'public' || message.network === 'test')
  )
}

/**
 * Creates a per-tab wallet-session message bus. BroadcastChannel is preferred;
 * browsers without it use the cross-document storage event as a fallback.
 */
export function createCrossTabBus(
  onMessage: (message: CrossTabMessage) => void,
  options: CrossTabBusOptions = {}
) {
  const tabId = options.tabId ?? createTabId()
  const eventTarget =
    options.eventTarget ?? (typeof window === 'undefined' ? undefined : window)
  let storage = options.storage
  if (storage === undefined && typeof window !== 'undefined') {
    try {
      storage = window.localStorage
    } catch {
      storage = null
    }
  }

  const channel = options.channel === undefined ? createChannel() : options.channel
  const receive = (value: unknown) => {
    if (!isCrossTabMessage(value) || value.tabId === tabId) return
    onMessage(value)
  }

  const handleChannelMessage = (event: MessageEvent<CrossTabMessage>) => receive(event.data)
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_EVENT_KEY || !event.newValue) return
    try {
      receive(JSON.parse(event.newValue))
    } catch {
      // Ignore malformed or stale storage payloads.
    }
  }

  if (channel) {
    channel.onmessage = handleChannelMessage
  } else {
    eventTarget?.addEventListener('storage', handleStorage)
  }

  return {
    tabId,
    publish(type: CrossTabMessageType, payload: { correlationId?: string; network?: CredenceNetwork } = {}) {
      const message: CrossTabMessage = {
        version: 1,
        type,
        tabId,
        correlationId:
          payload.correlationId ??
          `cross-tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        ...(payload.network ? { network: payload.network } : {}),
      }

      if (channel) {
        channel.postMessage(message)
      } else {
        try {
          storage?.setItem(STORAGE_EVENT_KEY, JSON.stringify(message))
        } catch {
          // Storage may be disabled or full; this tab still completes its local action.
        }
      }
      return message
    },
    close() {
      if (channel) {
        channel.onmessage = null
        channel.close()
      } else {
        eventTarget?.removeEventListener('storage', handleStorage)
      }
    },
  }
}

export const CROSS_TAB_STORAGE_EVENT_KEY = STORAGE_EVENT_KEY
