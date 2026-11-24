import { tryParseAmount } from './amount'
import { ApiResponseShapeError, type ApiResponseShapeIssue } from './client'
import type { Transaction, TransactionList, TrustScore, TrustTier } from './types'

const TRUST_TIERS: ReadonlySet<string> = new Set<TrustTier>([
  'bronze',
  'silver',
  'gold',
  'platinum',
])

const TRANSACTION_TYPES: ReadonlySet<string> = new Set<Transaction['type']>([
  'bond',
  'withdraw',
  'attestation',
])

const TRANSACTION_STATUSES: ReadonlySet<string> = new Set<Transaction['status']>([
  'pending',
  'confirmed',
  'failed',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoDateTimeString(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value))
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function formatShapeError(schemaName: string, issues: readonly ApiResponseShapeIssue[]): string {
  const summary = issues
    .slice(0, 3)
    .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
    .join('; ')
  return `Invalid ${schemaName} response: ${summary}`
}

/**
 * Validates an untrusted API payload against the OpenAPI `TrustScore` schema.
 *
 * Required fields:
 * - `address`: non-empty string
 * - `score`: non-negative integer
 * - `tier`: one of `'bronze' | 'silver' | 'gold' | 'platinum'`
 * - `attestations`: non-negative integer
 * - `updatedAt`: valid ISO 8601 date-time string
 *
 * @throws {ApiResponseShapeError} when the payload does not match the schema.
 */
export function validateTrustScore(payload: unknown): TrustScore {
  if (!isPlainObject(payload)) {
    const issues: ApiResponseShapeIssue[] = [{ path: '', message: 'expected an object' }]
    throw new ApiResponseShapeError(formatShapeError('TrustScore', issues), issues, payload)
  }

  const issues: ApiResponseShapeIssue[] = []

  if (!isNonEmptyString(payload.address)) {
    issues.push({ path: 'address', message: 'expected a non-empty string' })
  }

  if (!isNonNegativeInteger(payload.score)) {
    issues.push({ path: 'score', message: 'expected a non-negative integer' })
  }

  if (typeof payload.tier !== 'string' || !TRUST_TIERS.has(payload.tier)) {
    issues.push({
      path: 'tier',
      message: 'expected one of bronze, silver, gold, platinum',
    })
  }

  if (!isNonNegativeInteger(payload.attestations)) {
    issues.push({ path: 'attestations', message: 'expected a non-negative integer' })
  }

  if (!isIsoDateTimeString(payload.updatedAt)) {
    issues.push({ path: 'updatedAt', message: 'expected a valid ISO 8601 date-time string' })
  }

  if (issues.length > 0) {
    throw new ApiResponseShapeError(formatShapeError('TrustScore', issues), issues, payload)
  }

  return {
    address: payload.address as string,
    score: payload.score as number,
    tier: payload.tier as TrustTier,
    attestations: payload.attestations as number,
    updatedAt: payload.updatedAt as string,
  }
}

function validateTransactionRecord(
  raw: unknown,
  pathPrefix: string,
  issues: ApiResponseShapeIssue[]
): Transaction | null {
  if (!isPlainObject(raw)) {
    issues.push({ path: pathPrefix, message: 'expected an object' })
    return null
  }

  const startCount = issues.length

  if (!isNonEmptyString(raw.id)) {
    issues.push({ path: `${pathPrefix}.id`, message: 'expected a non-empty string' })
  }

  if (typeof raw.type !== 'string' || !TRANSACTION_TYPES.has(raw.type)) {
    issues.push({
      path: `${pathPrefix}.type`,
      message: 'expected one of bond, withdraw, attestation',
    })
  }

  if (raw.amountUsdc !== undefined) {
    if (typeof raw.amountUsdc !== 'number') {
      issues.push({
        path: `${pathPrefix}.amountUsdc`,
        message: 'expected a finite non-negative number',
      })
    } else {
      const parsed = tryParseAmount(raw.amountUsdc)
      if (!parsed.ok) {
        issues.push({
          path: `${pathPrefix}.amountUsdc`,
          message: parsed.error.message,
        })
      }
    }
  }

  if (!isIsoDateTimeString(raw.timestamp)) {
    issues.push({
      path: `${pathPrefix}.timestamp`,
      message: 'expected a valid ISO 8601 date-time string',
    })
  }

  if (typeof raw.status !== 'string' || !TRANSACTION_STATUSES.has(raw.status)) {
    issues.push({
      path: `${pathPrefix}.status`,
      message: 'expected one of pending, confirmed, failed',
    })
  }

  if (!isNonEmptyString(raw.hash)) {
    issues.push({ path: `${pathPrefix}.hash`, message: 'expected a non-empty string' })
  }

  if (issues.length > startCount) {
    return null
  }

  const tx: Transaction = {
    id: raw.id as string,
    type: raw.type as Transaction['type'],
    timestamp: raw.timestamp as string,
    status: raw.status as Transaction['status'],
    hash: raw.hash as string,
  }

  if (raw.amountUsdc !== undefined) {
    tx.amountUsdc = raw.amountUsdc as number
  }

  return tx
}

/**
 * Validates an untrusted API payload against the OpenAPI `TransactionList` schema.
 *
 * Required fields:
 * - `items`: array of valid `Transaction` objects (`amountUsdc`, when present,
 *   must be a number satisfying the exact-decimal rules in `src/api/amount.ts`)
 * - `nextCursor`: optional non-empty string
 *
 * @throws {ApiResponseShapeError} when the payload does not match the schema.
 */
export function validateTransactionList(payload: unknown): TransactionList {
  if (!isPlainObject(payload)) {
    const issues: ApiResponseShapeIssue[] = [{ path: '', message: 'expected an object' }]
    throw new ApiResponseShapeError(formatShapeError('TransactionList', issues), issues, payload)
  }

  const issues: ApiResponseShapeIssue[] = []
  const items: Transaction[] = []

  if (!Array.isArray(payload.items)) {
    issues.push({ path: 'items', message: 'expected an array' })
  } else {
    for (let index = 0; index < payload.items.length; index += 1) {
      const validated = validateTransactionRecord(payload.items[index], `items[${index}]`, issues)
      if (validated) {
        items.push(validated)
      }
    }
  }

  if (payload.nextCursor !== undefined && !isNonEmptyString(payload.nextCursor)) {
    issues.push({ path: 'nextCursor', message: 'expected a non-empty string when present' })
  }

  if (issues.length > 0) {
    throw new ApiResponseShapeError(formatShapeError('TransactionList', issues), issues, payload)
  }

  const result: TransactionList = { items }
  if (payload.nextCursor !== undefined) {
    result.nextCursor = payload.nextCursor as string
  }
  return result
}
