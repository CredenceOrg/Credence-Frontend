import { describe, it, expect } from 'vitest'
import {
  EVENT_SCHEMA_VERSION,
  DOM_EVENTS,
  ATTESTATION_EVENTS,
  TRANSACTION_EVENTS,
  BOND_EVENTS,
  ACTIVITY_EVENTS,
  TOAST_EVENTS,
  WALLET_EVENTS,
  SETTINGS_EVENTS,
  serializeEventPayload,
  deserializeEventPayload,
  createTypedCustomEvent,
  type AttestationPayload,
  type TransactionEventPayload,
  type BondEventPayload,
  type ActivityEventPayload,
  type ToastEventPayload,
  type WalletEventPayload,
  type SettingsEventPayload,
} from './index'

describe('Centralized Event Schema Registry', () => {
  it('exposes a valid schema version identifier', () => {
    expect(EVENT_SCHEMA_VERSION).toBe('1.0.0')
  })

  it('exposes DOM event name constants', () => {
    expect(DOM_EVENTS.BEFORE_INSTALL_PROMPT).toBe('beforeinstallprompt')
    expect(DOM_EVENTS.VISIBILITY_CHANGE).toBe('visibilitychange')
    expect(DOM_EVENTS.MOUSE_MOVE).toBe('mousemove')
    expect(DOM_EVENTS.KEY_DOWN).toBe('keydown')
    expect(DOM_EVENTS.MOUSE_DOWN).toBe('mousedown')
    expect(DOM_EVENTS.TOUCH_START).toBe('touchstart')
    expect(DOM_EVENTS.SCROLL).toBe('scroll')
    expect(DOM_EVENTS.WHEEL).toBe('wheel')
    expect(DOM_EVENTS.ONLINE).toBe('online')
    expect(DOM_EVENTS.OFFLINE).toBe('offline')
    expect(DOM_EVENTS.BEFORE_UNLOAD).toBe('beforeunload')
    expect(DOM_EVENTS.FOCUS).toBe('focus')
    expect(DOM_EVENTS.CHANGE).toBe('change')
    expect(DOM_EVENTS.POINTER_DOWN).toBe('pointerdown')
    expect(DOM_EVENTS.LANGUAGE_CHANGED).toBe('languageChanged')
  })

  it('exposes domain event constants', () => {
    expect(ATTESTATION_EVENTS.TYPES.IDENTITY).toBe('identity')
    expect(ATTESTATION_EVENTS.TYPES.PEER_VOUCH).toBe('peer-vouch')
    expect(ATTESTATION_EVENTS.TYPES.CREDENTIAL).toBe('credential')

    expect(TRANSACTION_EVENTS.TYPES.BOND).toBe('bond')
    expect(TRANSACTION_EVENTS.TYPES.WITHDRAW).toBe('withdraw')
    expect(TRANSACTION_EVENTS.TYPES.ATTESTATION).toBe('attestation')

    expect(TRANSACTION_EVENTS.STATUSES.PENDING).toBe('pending')
    expect(TRANSACTION_EVENTS.STATUSES.CONFIRMED).toBe('confirmed')
    expect(TRANSACTION_EVENTS.STATUSES.FAILED).toBe('failed')

    expect(BOND_EVENTS.STATUSES.ACTIVE).toBe('active')
    expect(BOND_EVENTS.STATUSES.PENDING).toBe('pending')
    expect(BOND_EVENTS.STATUSES.SETTLED).toBe('settled')
    expect(BOND_EVENTS.STATUSES.SLASHED).toBe('slashed')
    expect(BOND_EVENTS.STATUSES.CANCELLED).toBe('cancelled')

    expect(ACTIVITY_EVENTS.TONES.SUCCESS).toBe('success')
    expect(ACTIVITY_EVENTS.TONES.WARNING).toBe('warning')
    expect(ACTIVITY_EVENTS.TONES.INFO).toBe('info')

    expect(TOAST_EVENTS.SEVERITIES.INFO).toBe('info')
    expect(TOAST_EVENTS.SEVERITIES.SUCCESS).toBe('success')
    expect(TOAST_EVENTS.SEVERITIES.WARNING).toBe('warning')
    expect(TOAST_EVENTS.SEVERITIES.DANGER).toBe('danger')

    expect(WALLET_EVENTS.STATUSES.CONNECTED).toBe('connected')
    expect(WALLET_EVENTS.STATUSES.DISCONNECTED).toBe('disconnected')
    expect(WALLET_EVENTS.STATUSES.CONNECTING).toBe('connecting')
    expect(WALLET_EVENTS.STATUSES.NETWORK_MISMATCH).toBe('network_mismatch')

    expect(SETTINGS_EVENTS.UPDATED).toBe('settings:updated')
  })

  describe('Event Serialization and Deserialization', () => {
    it('serializes and deserializes AttestationPayload deterministically', () => {
      const payload: AttestationPayload = {
        subject: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        type: ATTESTATION_EVENTS.TYPES.IDENTITY,
        evidence: 'Proof document hash',
      }
      const serialized = serializeEventPayload(payload)
      expect(typeof serialized).toBe('string')
      expect(deserializeEventPayload<AttestationPayload>(serialized)).toEqual(payload)
    })

    it('serializes and deserializes TransactionEventPayload deterministically', () => {
      const payload: TransactionEventPayload = {
        id: 'tx-001',
        type: TRANSACTION_EVENTS.TYPES.BOND,
        amountUsdc: 100,
        timestamp: '2026-07-24T12:00:00Z',
        status: TRANSACTION_EVENTS.STATUSES.CONFIRMED,
        hash: '0x123abc',
      }
      const serialized = serializeEventPayload(payload)
      expect(deserializeEventPayload<TransactionEventPayload>(serialized)).toEqual(payload)
    })

    it('serializes and deserializes BondEventPayload deterministically', () => {
      const payload: BondEventPayload = {
        id: 'bond-100',
        borrower: 'GBORROWER',
        amount: '500.00',
        asset: 'USDC',
        status: BOND_EVENTS.STATUSES.ACTIVE,
        createdAt: '2026-07-24T00:00:00Z',
      }
      const serialized = serializeEventPayload(payload)
      expect(deserializeEventPayload<BondEventPayload>(serialized)).toEqual(payload)
    })

    it('serializes and deserializes ToastEventPayload deterministically', () => {
      const payload: ToastEventPayload = {
        id: 'toast-1',
        severity: TOAST_EVENTS.SEVERITIES.SUCCESS,
        message: 'Action completed successfully',
        durationMs: 5000,
      }
      const serialized = serializeEventPayload(payload)
      expect(deserializeEventPayload<ToastEventPayload>(serialized)).toEqual(payload)
    })

    it('serializes and deserializes WalletEventPayload deterministically', () => {
      const payload: WalletEventPayload = {
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        isConnected: true,
        network: 'testnet',
      }
      const serialized = serializeEventPayload(payload)
      expect(deserializeEventPayload<WalletEventPayload>(serialized)).toEqual(payload)
    })

    it('serializes and deserializes SettingsEventPayload deterministically', () => {
      const payload: SettingsEventPayload = {
        themeMode: 'dark',
        network: 'test',
        addressDisplay: 'short',
        toastsEnabled: true,
        autoDismiss: '5s',
        reauthThresholdMinutes: 15,
        reauthThresholdMin: 15,
      }
      const serialized = serializeEventPayload(payload)
      expect(deserializeEventPayload<SettingsEventPayload>(serialized)).toEqual(payload)
    })
  })

  describe('createTypedCustomEvent helper', () => {
    it('creates a CustomEvent instance with attached detail', () => {
      const detail: ActivityEventPayload = {
        id: 'evt-01',
        timestamp: '2026-07-24T12:00:00Z',
        title: 'Attestation submitted',
        description: 'New attestation proof',
        actor: 'User A',
        statusLabel: 'Submitted',
        tone: ACTIVITY_EVENTS.TONES.SUCCESS,
        meta: 'Meta data',
      }

      const event = createTypedCustomEvent(ATTESTATION_EVENTS.SUBMITTED, detail)
      expect(event).toBeInstanceOf(CustomEvent)
      expect(event.type).toBe(ATTESTATION_EVENTS.SUBMITTED)
      expect(event.detail).toEqual(detail)
      expect(event.bubbles).toBe(true)
      expect(event.cancelable).toBe(true)
    })

    it('allows consumers to receive custom events typed with shared schemas', () => {
      let receivedDetail: SettingsEventPayload | null = null
      const listener = (event: Event) => {
        const customEvt = event as CustomEvent<SettingsEventPayload>
        receivedDetail = customEvt.detail
      }

      window.addEventListener(SETTINGS_EVENTS.UPDATED, listener)

      const payload: SettingsEventPayload = {
        themeMode: 'dark',
        network: 'public',
        addressDisplay: 'short',
        toastsEnabled: true,
        autoDismiss: '5s',
        reauthThresholdMinutes: 15,
      }

      window.dispatchEvent(createTypedCustomEvent(SETTINGS_EVENTS.UPDATED, payload))

      expect(receivedDetail).toEqual(payload)
      window.removeEventListener(SETTINGS_EVENTS.UPDATED, listener)
    })
  })
})
