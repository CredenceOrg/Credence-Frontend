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
  | (typeof ATTESTATION_EVENTS.TYPES)[keyof typeof ATTESTATION_EVENTS.TYPES]
  | string

export interface AttestationPayload {
  subject: string
  type: AttestationType
  evidence: string
}

/**
 * Activity Feed Event Constants & Types
 *
 * Tone is the *visual severity* token the timeline renders (color of the
 * rail node, badge variant, etc.). Status is the user-facing filterable
 * state on the Attestations page; mappers in the next block convert
 * one to the other.
 */
export const ACTIVITY_EVENTS = {
  TONES: {
    SUCCESS: 'success',
    WARNING: 'warning',
    INFO: 'info',
  },
} as const

export type ActivityTone = (typeof ACTIVITY_EVENTS.TONES)[keyof typeof ACTIVITY_EVENTS.TONES]

/**
 * Attestation Status Vocabulary
 *
 * A status is the user-facing *filterable* state of an attestation
 * (accepted / needs-update / in-review). Internally it maps to the
 * `ActivityTone` vocabulary used for visual severity so we don't grow
 * a parallel render token. `statusToTone` and `toneToStatus` are the
 * only authorized converters.
 *
 * See docs/ATTESTATIONS_VIEW_DESIGN.md, §2 — "Status vocabulary".
 */
export const ATTESTATION_STATUSES = {
  ACCEPTED: 'accepted',
  NEEDS_UPDATE: 'needs-update',
  IN_REVIEW: 'in-review',
} as const

export type AttestationStatus =
  (typeof ATTESTATION_STATUSES)[keyof typeof ATTESTATION_STATUSES]

/** Status that means "no filter applied" — kept as a separate string
 *  so it cannot collide with a real attestation status value. */
export const ATTESTATION_STATUS_ALL = 'all' as const

/** Canonical status → ActivityTone mapping. */
export function statusToTone(status: AttestationStatus): ActivityTone {
  const mapping: Record<AttestationStatus, ActivityTone> = {
    [ATTESTATION_STATUSES.ACCEPTED]: ACTIVITY_EVENTS.TONES.SUCCESS,
    [ATTESTATION_STATUSES.NEEDS_UPDATE]: ACTIVITY_EVENTS.TONES.WARNING,
    [ATTESTATION_STATUSES.IN_REVIEW]: ACTIVITY_EVENTS.TONES.INFO,
  }
  return mapping[status]
}

/** Inverse of `statusToTone`. Tone that does not correspond to a known
 *  status returns `null` so callers can guard explicitly. */
export function toneToStatus(tone: ActivityTone): AttestationStatus | null {
  const mapping: Record<ActivityTone, AttestationStatus | null> = {
    [ACTIVITY_EVENTS.TONES.SUCCESS]: ATTESTATION_STATUSES.ACCEPTED,
    [ACTIVITY_EVENTS.TONES.WARNING]: ATTESTATION_STATUSES.NEEDS_UPDATE,
    [ACTIVITY_EVENTS.TONES.INFO]: ATTESTATION_STATUSES.IN_REVIEW,
  }
  return mapping[tone]
}

export interface ActivityEventPayload {
  id: string
  timestamp: string
  title: string
  description: string
  /** The validator / process that produced this attestation event.
   *  In the Attestations detail drawer this is surfaced as "Validator". */
  actor: string
  statusLabel: string
  tone: ActivityTone
  meta: string
  /** Optional explicit attestation status. When present it is the
   *  user-facing filterable value (accepted / needs-update / in-review).
   *  Falls back to `toneToStatus(tone)` for legacy items. */
  status?: AttestationStatus
  /** Event schema version for forward-compatibility (e.g. "1.0"). */
  eventVersion?: string
  /** Correlation identifier that ties a logical action across multiple
   *  emitted events and enables audit-parity verification. */
  correlationId?: string
  /** Optional USDC amount associated with the event (e.g. bond deposits).
   *  Rendered via `formatAmount`; absent when the event has no monetary value. */
  amountUsdc?: number
}

/** Alias for backward-compatibility with component prop definitions */
export type ActivityItem = ActivityEventPayload

// ---------------------------------------------------------------------------
// State-Transition Invariants
// ---------------------------------------------------------------------------

/**
 * Legal transition matrix for `AttestationStatus`.
 *
 * Each key is the *from* state; the array lists every *to* state that is
 * permitted from it.  A transition that does not appear here is illegal
 * and must be rejected at the entry point before any state is mutated.
 *
 * Design rationale
 * ─────────────────
 * - `in-review`   is the canonical entry state for a newly submitted attestation.
 * - `accepted`    is a terminal success state; no further transitions are allowed.
 * - `needs-update` is a recoverable failure state; the submitter may re-submit,
 *   which moves the item back to `in-review`.
 *
 * Rejected / stale / out-of-order transitions leave the object untouched.
 * See docs/ATTESTATIONS_VIEW_DESIGN.md §2 and QE-2026-08 for the full rationale.
 */
export const LEGAL_TRANSITIONS: Readonly<Record<AttestationStatus, readonly AttestationStatus[]>> =
  {
    [ATTESTATION_STATUSES.IN_REVIEW]: [
      ATTESTATION_STATUSES.ACCEPTED,
      ATTESTATION_STATUSES.NEEDS_UPDATE,
    ],
    [ATTESTATION_STATUSES.NEEDS_UPDATE]: [ATTESTATION_STATUSES.IN_REVIEW],
    // accepted is terminal — no outbound transitions.
    [ATTESTATION_STATUSES.ACCEPTED]: [],
  } as const

/**
 * Returns `true` when transitioning from `from` to `to` is legal per
 * `LEGAL_TRANSITIONS`, and `false` otherwise.
 *
 * Prefer `assertLegalTransition` at mutation entry points where an illegal
 * transition should hard-fail.  Use `isLegalTransition` when you need a
 * predicate without throwing (e.g. filtering, UI guards).
 */
export function isLegalTransition(from: AttestationStatus, to: AttestationStatus): boolean {
  const targets = LEGAL_TRANSITIONS[from] as readonly AttestationStatus[] | undefined
  return targets !== undefined && targets.includes(to)
}

/**
 * Asserts that the `from → to` transition is legal.
 *
 * Throws a `RangeError` if:
 * - `from` or `to` is not a recognised `AttestationStatus`, or
 * - the transition is not listed in `LEGAL_TRANSITIONS`.
 *
 * Call this at every mutation entry point (form submit handler, API
 * response handler, optimistic-update path) *before* writing new state.
 * Because the throw happens prior to any `setState` / store update, a
 * rejected transition can never leave an object in a partial or
 * unauthorised state.
 *
 * @example
 * assertLegalTransition(currentItem.status, 'accepted')
 * setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'accepted' } : i))
 */
export function assertLegalTransition(from: AttestationStatus, to: AttestationStatus): void {
  const knownStatuses = Object.values(ATTESTATION_STATUSES) as AttestationStatus[]

  if (!knownStatuses.includes(from)) {
    throw new RangeError(
      `assertLegalTransition: unknown source status "${from}". ` +
      `Valid values: ${knownStatuses.join(', ')}.`
    )
  }
  if (!knownStatuses.includes(to)) {
    throw new RangeError(
      `assertLegalTransition: unknown target status "${to}". ` +
      `Valid values: ${knownStatuses.join(', ')}.`
    )
  }
  if (!isLegalTransition(from, to)) {
    throw new RangeError(
      `assertLegalTransition: illegal transition "${from}" → "${to}". ` +
      `Legal targets from "${from}": [${LEGAL_TRANSITIONS[from].join(', ') || 'none'}].`
    )
  }
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
