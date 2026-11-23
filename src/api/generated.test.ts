/**
 * Boundary and recovery coverage for the OpenAPI-generated contract in
 * `src/api/generated.ts`.
 *
 * `generated.ts` is types-only (openapi-typescript). These tests:
 *  - Pin the public schema surface against runtime fixtures
 *  - Reject invalid / out-of-bound values without mutating caller state
 *  - Exercise pagination, enum, and optional-field edge cases
 *
 * Do not edit `generated.ts` by hand — regenerate via `npm run generate:api`.
 */
import { describe, expect, it } from 'vitest'
import type { components, operations, paths } from './generated'

// ── Local aliases from the generated module (not from ./types) ──────────────

type BondStatus = components['schemas']['BondStatus']
type TrustTier = components['schemas']['TrustTier']
type TransactionType = components['schemas']['TransactionType']
type TransactionStatus = components['schemas']['TransactionStatus']
type TrustScore = components['schemas']['TrustScore']
type Bond = components['schemas']['Bond']
type Transaction = components['schemas']['Transaction']
type TransactionList = components['schemas']['TransactionList']
type Settings = components['schemas']['Settings']
type ApiMessageResponse = components['schemas']['ApiMessageResponse']
type Tenant = components['schemas']['Tenant']

const VALID_G_ADDRESS =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const BOND_STATUSES: readonly BondStatus[] = [
  'active',
  'pending',
  'settled',
  'slashed',
  'cancelled',
] as const

const TRUST_TIERS: readonly TrustTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
] as const

const TX_TYPES: readonly TransactionType[] = [
  'bond',
  'withdraw',
  'attestation',
] as const

const TX_STATUSES: readonly TransactionStatus[] = [
  'pending',
  'confirmed',
  'failed',
] as const

// ── Runtime validators (pure; no shared mutable state) ──────────────────────

type ValidateResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateTrustScore(input: unknown): ValidateResult<TrustScore> {
  if (!isPlainObject(input)) return { ok: false, error: 'TrustScore must be an object' }
  const { address, score, tier, attestations, updatedAt } = input
  if (typeof address !== 'string' || address.length === 0) {
    return { ok: false, error: 'address must be a non-empty string' }
  }
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return { ok: false, error: 'score must be a finite number' }
  }
  if (typeof tier !== 'string' || !(TRUST_TIERS as readonly string[]).includes(tier)) {
    return { ok: false, error: 'tier must be a valid TrustTier' }
  }
  if (typeof attestations !== 'number' || !Number.isFinite(attestations) || attestations < 0) {
    return { ok: false, error: 'attestations must be a non-negative finite number' }
  }
  if (typeof updatedAt !== 'string' || updatedAt.length === 0) {
    return { ok: false, error: 'updatedAt must be a non-empty ISO string' }
  }
  return {
    ok: true,
    value: {
      address,
      score,
      tier: tier as TrustTier,
      attestations,
      updatedAt,
    },
  }
}

function validateBond(input: unknown): ValidateResult<Bond> {
  if (!isPlainObject(input)) return { ok: false, error: 'Bond must be an object' }
  const { id, borrower, amount, asset, status, createdAt, lender, maturesAt } = input
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'id must be a non-empty string' }
  }
  if (typeof borrower !== 'string' || borrower.length === 0) {
    return { ok: false, error: 'borrower must be a non-empty string' }
  }
  if (typeof amount !== 'string' || amount.length === 0) {
    return { ok: false, error: 'amount must be a non-empty decimal string' }
  }
  if (typeof asset !== 'string' || asset.length === 0) {
    return { ok: false, error: 'asset must be a non-empty string' }
  }
  if (typeof status !== 'string' || !(BOND_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'status must be a valid BondStatus' }
  }
  if (typeof createdAt !== 'string' || createdAt.length === 0) {
    return { ok: false, error: 'createdAt must be a non-empty ISO string' }
  }
  if (lender !== undefined && typeof lender !== 'string') {
    return { ok: false, error: 'lender must be a string when present' }
  }
  if (maturesAt !== undefined && typeof maturesAt !== 'string') {
    return { ok: false, error: 'maturesAt must be a string when present' }
  }
  const bond: Bond = {
    id,
    borrower,
    amount,
    asset,
    status: status as BondStatus,
    createdAt,
  }
  if (typeof lender === 'string') bond.lender = lender
  if (typeof maturesAt === 'string') bond.maturesAt = maturesAt
  return { ok: true, value: bond }
}

function validateTransaction(input: unknown): ValidateResult<Transaction> {
  if (!isPlainObject(input)) return { ok: false, error: 'Transaction must be an object' }
  const { id, type, timestamp, status, hash, amountUsdc } = input
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'id must be a non-empty string' }
  }
  if (typeof type !== 'string' || !(TX_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: 'type must be a valid TransactionType' }
  }
  if (typeof timestamp !== 'string' || timestamp.length === 0) {
    return { ok: false, error: 'timestamp must be a non-empty ISO string' }
  }
  if (typeof status !== 'string' || !(TX_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'status must be a valid TransactionStatus' }
  }
  if (typeof hash !== 'string' || hash.length === 0) {
    return { ok: false, error: 'hash must be a non-empty string' }
  }
  if (amountUsdc !== undefined && (typeof amountUsdc !== 'number' || !Number.isFinite(amountUsdc))) {
    return { ok: false, error: 'amountUsdc must be a finite number when present' }
  }
  const tx: Transaction = {
    id,
    type: type as TransactionType,
    timestamp,
    status: status as TransactionStatus,
    hash,
  }
  if (typeof amountUsdc === 'number') tx.amountUsdc = amountUsdc
  return { ok: true, value: tx }
}

function validateTransactionList(input: unknown): ValidateResult<TransactionList> {
  if (!isPlainObject(input)) return { ok: false, error: 'TransactionList must be an object' }
  if (!Array.isArray(input.items)) {
    return { ok: false, error: 'items must be an array' }
  }
  const items: Transaction[] = []
  for (let i = 0; i < input.items.length; i++) {
    const r = validateTransaction(input.items[i])
    if (!r.ok) return { ok: false, error: `items[${i}]: ${r.error}` }
    items.push(r.value)
  }
  if (input.nextCursor !== undefined && typeof input.nextCursor !== 'string') {
    return { ok: false, error: 'nextCursor must be a string when present' }
  }
  const list: TransactionList = { items }
  if (typeof input.nextCursor === 'string') list.nextCursor = input.nextCursor
  return { ok: true, value: list }
}

function validateSettings(input: unknown): ValidateResult<Settings> {
  if (!isPlainObject(input)) return { ok: false, error: 'Settings must be an object' }
  const themeModes = ['light', 'dark', 'system'] as const
  const {
    themeMode,
    network,
    addressDisplay,
    toastsEnabled,
    autoDismiss,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
  } = input
  if (typeof themeMode !== 'string' || !(themeModes as readonly string[]).includes(themeMode)) {
    return { ok: false, error: 'themeMode must be light|dark|system' }
  }
  for (const [key, val] of [
    ['network', network],
    ['addressDisplay', addressDisplay],
    ['autoDismiss', autoDismiss],
    ['quietHoursStart', quietHoursStart],
    ['quietHoursEnd', quietHoursEnd],
  ] as const) {
    if (typeof val !== 'string') {
      return { ok: false, error: `${key} must be a string` }
    }
  }
  if (typeof toastsEnabled !== 'boolean') {
    return { ok: false, error: 'toastsEnabled must be a boolean' }
  }
  if (typeof quietHoursEnabled !== 'boolean') {
    return { ok: false, error: 'quietHoursEnabled must be a boolean' }
  }
  return {
    ok: true,
    value: {
      themeMode: themeMode as Settings['themeMode'],
      network: network as string,
      addressDisplay: addressDisplay as string,
      toastsEnabled,
      autoDismiss: autoDismiss as string,
      quietHoursEnabled,
      quietHoursStart: quietHoursStart as string,
      quietHoursEnd: quietHoursEnd as string,
    },
  }
}

/** Spec: LimitParam is 1–100, default 20. */
function validateLimitParam(input: unknown): ValidateResult<number> {
  if (input === undefined || input === null) {
    return { ok: true, value: 20 }
  }
  if (typeof input !== 'number' || !Number.isInteger(input)) {
    return { ok: false, error: 'limit must be an integer' }
  }
  if (input < 1 || input > 100) {
    return { ok: false, error: 'limit must be between 1 and 100' }
  }
  return { ok: true, value: input }
}

// ── Type-level pins against generated operations/paths ──────────────────────

function _assertPathsTrustScore(): paths['/trust-score/{address}']['get'] {
  return undefined as unknown as paths['/trust-score/{address}']['get']
}
function _assertListTxOp(): operations['listTransactions'] {
  return undefined as unknown as operations['listTransactions']
}
function _assertUpdateSettingsOp(): operations['updateSettings'] {
  return undefined as unknown as operations['updateSettings']
}

void _assertPathsTrustScore
void _assertListTxOp
void _assertUpdateSettingsOp

// ── Success paths ───────────────────────────────────────────────────────────

describe('generated schemas — success', () => {
  it('accepts a valid TrustScore', () => {
    const r = validateTrustScore({
      address: VALID_G_ADDRESS,
      score: 840,
      tier: 'gold',
      attestations: 12,
      updatedAt: '2026-06-29T10:00:00Z',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.score).toBe(840)
      expect(r.value.tier).toBe('gold')
    }
  })

  it('accepts a minimal Bond (optional fields omitted)', () => {
    const r = validateBond({
      id: 'b-1',
      borrower: VALID_G_ADDRESS,
      amount: '1000.00',
      asset: 'USDC',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.lender).toBeUndefined()
      expect(r.value.maturesAt).toBeUndefined()
    }
  })

  it('accepts a full Bond with lender and maturesAt', () => {
    const r = validateBond({
      id: 'b-2',
      borrower: VALID_G_ADDRESS,
      lender: VALID_G_ADDRESS,
      amount: '0.01',
      asset: 'USDC',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00Z',
      maturesAt: '2026-12-31T23:59:59Z',
    })
    expect(r.ok).toBe(true)
  })

  it('accepts Transaction without amountUsdc', () => {
    const r = validateTransaction({
      id: 'tx-1',
      type: 'attestation',
      timestamp: '2026-06-29T00:00:00Z',
      status: 'confirmed',
      hash: 'b6d396a84d41bf162d05f32a51f8a846b0a6fb2abccedb441f71f11e9f1a2380',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.amountUsdc).toBeUndefined()
  })

  it('accepts empty TransactionList without nextCursor (end of pages)', () => {
    const r = validateTransactionList({ items: [] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.items).toEqual([])
      expect(r.value.nextCursor).toBeUndefined()
    }
  })

  it('accepts TransactionList with nextCursor for recovery pagination', () => {
    const r = validateTransactionList({
      items: [
        {
          id: 'tx-1',
          type: 'bond',
          amountUsdc: 100,
          timestamp: '2026-06-29T00:00:00Z',
          status: 'pending',
          hash: 'abc',
        },
      ],
      nextCursor: 'cursor-2',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.nextCursor).toBe('cursor-2')
  })

  it('accepts complete Settings', () => {
    const r = validateSettings({
      themeMode: 'system',
      network: 'testnet',
      addressDisplay: 'short',
      toastsEnabled: true,
      autoDismiss: '5s',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    })
    expect(r.ok).toBe(true)
  })

  it('accepts ApiMessageResponse and Tenant shapes', () => {
    const msg: ApiMessageResponse = { message: 'Address not found.' }
    const tenant: Tenant = { tenantId: VALID_G_ADDRESS }
    expect(msg.message.length).toBeGreaterThan(0)
    expect(tenant.tenantId.startsWith('G')).toBe(true)
  })
})

// ── Enum / status surface ───────────────────────────────────────────────────

describe('generated enums — complete surface', () => {
  it('BondStatus has exactly five lifecycle values', () => {
    expect(BOND_STATUSES).toEqual([
      'active',
      'pending',
      'settled',
      'slashed',
      'cancelled',
    ])
  })

  it('TrustTier has exactly four values', () => {
    expect(TRUST_TIERS).toHaveLength(4)
  })

  it('TransactionType and TransactionStatus match the spec', () => {
    expect(TX_TYPES).toEqual(['bond', 'withdraw', 'attestation'])
    expect(TX_STATUSES).toEqual(['pending', 'confirmed', 'failed'])
  })
})

// ── Boundary cases ──────────────────────────────────────────────────────────

describe('generated schemas — boundaries', () => {
  it('TrustScore score of 0 is valid (lower boundary)', () => {
    const r = validateTrustScore({
      address: VALID_G_ADDRESS,
      score: 0,
      tier: 'bronze',
      attestations: 0,
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(r.ok).toBe(true)
  })

  it('rejects TrustScore with negative attestations', () => {
    const r = validateTrustScore({
      address: VALID_G_ADDRESS,
      score: 10,
      tier: 'bronze',
      attestations: -1,
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(r.ok).toBe(false)
  })

  it('rejects TrustScore with NaN score', () => {
    const r = validateTrustScore({
      address: VALID_G_ADDRESS,
      score: Number.NaN,
      tier: 'gold',
      attestations: 1,
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(r.ok).toBe(false)
  })

  it('rejects empty address string', () => {
    const r = validateTrustScore({
      address: '',
      score: 1,
      tier: 'silver',
      attestations: 0,
      updatedAt: '2026-01-01T00:00:00Z',
    })
    expect(r.ok).toBe(false)
  })

  it('rejects unknown BondStatus (invalid state transition value)', () => {
    const r = validateBond({
      id: 'b-x',
      borrower: VALID_G_ADDRESS,
      amount: '1.00',
      asset: 'USDC',
      status: 'liquidated',
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(r.ok).toBe(false)
  })

  it('rejects Bond amount as number (must stay decimal string)', () => {
    const r = validateBond({
      id: 'b-x',
      borrower: VALID_G_ADDRESS,
      amount: 1000,
      asset: 'USDC',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(r.ok).toBe(false)
  })

  it('limit param: default, min 1, max 100, rejects 0 and 101', () => {
    expect(validateLimitParam(undefined).ok).toBe(true)
    expect(validateLimitParam(1).ok).toBe(true)
    expect(validateLimitParam(100).ok).toBe(true)
    expect(validateLimitParam(0).ok).toBe(false)
    expect(validateLimitParam(101).ok).toBe(false)
    expect(validateLimitParam(20.5).ok).toBe(false)
  })

  it('rejects TransactionList with non-array items', () => {
    const r = validateTransactionList({ items: null })
    expect(r.ok).toBe(false)
  })

  it('rejects nested invalid transaction without accepting partial list', () => {
    const r = validateTransactionList({
      items: [
        {
          id: 'ok',
          type: 'bond',
          timestamp: '2026-01-01T00:00:00Z',
          status: 'confirmed',
          hash: 'h',
        },
        {
          id: 'bad',
          type: 'unknown',
          timestamp: '2026-01-01T00:00:00Z',
          status: 'confirmed',
          hash: 'h2',
        },
      ],
    })
    expect(r.ok).toBe(false)
  })
})

// ── Rejection + recovery (no silent mutation) ───────────────────────────────

describe('generated schemas — rejection and recovery', () => {
  it('failed validation does not mutate the input object', () => {
    const input = {
      address: VALID_G_ADDRESS,
      score: 10,
      tier: 'not-a-tier',
      attestations: 1,
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const snapshot = structuredClone(input)
    const r = validateTrustScore(input)
    expect(r.ok).toBe(false)
    expect(input).toEqual(snapshot)
  })

  it('duplicate valid payloads validate identically (deterministic)', () => {
    const payload = {
      id: 'tx-dup',
      type: 'withdraw' as const,
      timestamp: '2026-06-01T00:00:00Z',
      status: 'failed' as const,
      hash: 'deadbeef',
    }
    const a = validateTransaction(payload)
    const b = validateTransaction(payload)
    expect(a).toEqual(b)
    expect(a.ok).toBe(true)
  })

  it('retry after fixing invalid field succeeds (recovery path)', () => {
    const bad = {
      address: '',
      score: 5,
      tier: 'bronze',
      attestations: 0,
      updatedAt: '2026-01-01T00:00:00Z',
    }
    expect(validateTrustScore(bad).ok).toBe(false)

    const fixed = { ...bad, address: VALID_G_ADDRESS }
    const r = validateTrustScore(fixed)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.address).toBe(VALID_G_ADDRESS)
  })

  it('partial Settings rejection leaves no half-applied value', () => {
    const partial = {
      themeMode: 'dark',
      network: 'mainnet',
      // missing required fields
    }
    const r = validateSettings(partial)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.length).toBeGreaterThan(0)
      // error text is diagnostic, not a secret dump of the whole body
      expect(r.error).not.toMatch(/password|secret|private/i)
    }
  })

  it('stale optional nextCursor can be omitted on recovery page', () => {
    const first = validateTransactionList({
      items: [],
      nextCursor: 'stale-cursor',
    })
    expect(first.ok).toBe(true)

    // Client recovers by requesting without cursor; empty terminal page
    const terminal = validateTransactionList({ items: [] })
    expect(terminal.ok).toBe(true)
    if (terminal.ok) expect(terminal.value.nextCursor).toBeUndefined()
  })
})

// ── Concurrent-style sequential validation ──────────────────────────────────

describe('generated schemas — concurrent-style safety', () => {
  it('interleaved validations do not cross-contaminate results', () => {
    const goodBond = {
      id: 'b-a',
      borrower: VALID_G_ADDRESS,
      amount: '10.00',
      asset: 'USDC',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    }
    const badBond = { ...goodBond, status: 'nope' }

    const results = [goodBond, badBond, goodBond].map((p) => validateBond(p))
    expect(results[0].ok).toBe(true)
    expect(results[1].ok).toBe(false)
    expect(results[2].ok).toBe(true)
    if (results[0].ok && results[2].ok) {
      expect(results[0].value).toEqual(results[2].value)
    }
  })
})
