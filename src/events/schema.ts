/**
 * Centralized Event Schema Registry
 *
 * Single source of truth for all event names, constants, payload interfaces,
 * serializers, and deserializers across the Credence Frontend application.
 */

/** Schema Version identifier for tracking event format updates. */
export const EVENT_SCHEMA_VERSION = '1.0.0'

/**
 * Standard Browser / DOM Event Names used in listeners and dispatches.
 */
export const DOM_EVENTS = {
  BEFORE_INSTALL_PROMPT: 'beforeinstallprompt',
  VISIBILITY_CHANGE: 'visibilitychange',
  MOUSE_MOVE: 'mousemove',
  KEY_DOWN: 'keydown',
  MOUSE_DOWN: 'mousedown',
  TOUCH_START: 'touchstart',
  SCROLL: 'scroll',
  WHEEL: 'wheel',
  ONLINE: 'online',
  OFFLINE: 'offline',
  BEFORE_UNLOAD: 'beforeunload',
  FOCUS: 'focus',
  CHANGE: 'change',
  POINTER_DOWN: 'pointerdown',
  LANGUAGE_CHANGED: 'languageChanged',
} as const

export type DomEventName = (typeof DOM_EVENTS)[keyof typeof DOM_EVENTS]

/**
 * Attestation Domain Event Constants & Types
 */
export const ATTESTATION_EVENTS = {
  SUBMITTED: 'attestation:submitted',
  TYPES: {
    IDENTITY: 'identity',
    PEER_VOUCH: 'peer-vouch',
    CREDENTIAL: 'credential',
  },
} as const

export type AttestationType =
  (typeof ATTESTATION_EVENTS.TYPES)[keyof typeof ATTESTATION_EVENTS.TYPES] | string

export interface AttestationPayload {
  subject: string
  type: AttestationType
  evidence: string
}

/**
 * Transaction Domain Event Constants & Types
 */
export const TRANSACTION_EVENTS = {
  TYPES: {
    BOND: 'bond',
    WITHDRAW: 'withdraw',
    ATTESTATION: 'attestation',
  },
  STATUSES: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    FAILED: 'failed',
  },
} as const

export type TransactionType =
  (typeof TRANSACTION_EVENTS.TYPES)[keyof typeof TRANSACTION_EVENTS.TYPES]
export type TransactionStatus =
  (typeof TRANSACTION_EVENTS.STATUSES)[keyof typeof TRANSACTION_EVENTS.STATUSES]

export interface TransactionEventPayload {
  id: string
  type: TransactionType
  amountUsdc?: number
  timestamp: string
  status: TransactionStatus
  hash: string
}

/**
 * Bond Lifecycle Event Constants & Types
 */
export const BOND_EVENTS = {
  STATUSES: {
    ACTIVE: 'active',
    PENDING: 'pending',
    SETTLED: 'settled',
    SLASHED: 'slashed',
    CANCELLED: 'cancelled',
  },
} as const

export type BondStatus = (typeof BOND_EVENTS.STATUSES)[keyof typeof BOND_EVENTS.STATUSES]

export interface BondEventPayload {
  id: string
  borrower: string
  lender?: string
  amount: string
  asset: string
  status: BondStatus
  createdAt: string
  maturesAt?: string
}

/**
 * Activity Feed Event Constants & Types
 */
export const ACTIVITY_EVENTS = {
  TONES: {
    SUCCESS: 'success',
    WARNING: 'warning',
    INFO: 'info',
  },
} as const

export type ActivityTone = (typeof ACTIVITY_EVENTS.TONES)[keyof typeof ACTIVITY_EVENTS.TONES]

export interface ActivityEventPayload {
  id: string
  timestamp: string
  title: string
  description: string
  actor: string
  statusLabel: string
  tone: ActivityTone
  meta: string
}

/** Alias for backward-compatibility with component prop definitions */
export type ActivityItem = ActivityEventPayload

/**
 * Toast / Notification Event Constants & Types
 */
export const TOAST_EVENTS = {
  SEVERITIES: {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    DANGER: 'danger',
  },
} as const

export type ToastSeverity = (typeof TOAST_EVENTS.SEVERITIES)[keyof typeof TOAST_EVENTS.SEVERITIES]

export interface ToastEventPayload {
  id: string
  severity: ToastSeverity
  message: string
  durationMs?: number
  txHash?: string
  network?: string
}

/** Alias for backward-compatibility with Toast component */
export type ToastData = ToastEventPayload

/**
 * Wallet Connection Event Constants & Types
 */
export const WALLET_EVENTS = {
  STATUSES: {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    NETWORK_MISMATCH: 'network_mismatch',
  },
} as const

export type WalletStatus = (typeof WALLET_EVENTS.STATUSES)[keyof typeof WALLET_EVENTS.STATUSES]

export interface WalletEventPayload {
  address: string | null
  isConnected: boolean
  network: string
}

/**
 * User Settings & Preference Event Constants & Types
 */
export const SETTINGS_EVENTS = {
  UPDATED: 'settings:updated',
} as const

export interface SettingsEventPayload {
  themeMode: 'system' | 'light' | 'dark'
  network: 'public' | 'test'
  addressDisplay: 'full' | 'short' | 'friendly'
  toastsEnabled: boolean
  autoDismiss: 'off' | '3s' | '5s' | '8s'
  reauthThresholdMinutes: number
  reauthThresholdMin?: number
}

/** Alias for backward-compatibility with SettingsContext payload definitions */
export type SettingsPayload = SettingsEventPayload

/**
 * Event Serializers, Deserializers & Utility Helpers
 */

/**
 * Serializes an event payload into a deterministic JSON string.
 */
export function serializeEventPayload<T>(payload: T): string {
  return JSON.stringify(payload)
}

/**
 * Deserializes a JSON string back into a typed event payload.
 */
export function deserializeEventPayload<T>(jsonString: string): T {
  return JSON.parse(jsonString) as T
}

/**
 * Helper to construct a strongly-typed CustomEvent for browser dispatch.
 */
export function createTypedCustomEvent<T>(
  eventName: string,
  detail: T,
  options?: Omit<CustomEventInit<T>, 'detail'>
): CustomEvent<T> {
  return new CustomEvent<T>(eventName, {
    detail,
    bubbles: options?.bubbles ?? true,
    cancelable: options?.cancelable ?? true,
    ...options,
  })
}
