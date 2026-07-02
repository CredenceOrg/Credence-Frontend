/**
 * Public type surface for the Credence API.
 *
 * All types are derived from the OpenAPI spec at `/openapi.yaml`.
 * Run `npm run generate:api` to regenerate `generated.ts` after spec changes,
 * then re-run `npm run build` to catch any drift between the spec and this file.
 */

import type { components } from './generated'

// Re-export the raw generated interfaces so callers that need path/operation
// metadata can import them directly from here.
export type { components, operations, paths } from './generated'

// ── Named type aliases (backwards-compatible public surface) ────────────────

export type BondStatus = components['schemas']['BondStatus']
export type TrustTier = components['schemas']['TrustTier']
export type TrustScore = components['schemas']['TrustScore']
export type Bond = components['schemas']['Bond']
export type Transaction = components['schemas']['Transaction']
export type ApiMessageResponse = components['schemas']['ApiMessageResponse']

/**
 * Cursor-paginated list envelope.
 *
 * OpenAPI does not support generics, so the spec defines a concrete
 * `TransactionList` schema. This generic alias lets the rest of the codebase
 * work with any item type while remaining structurally identical to the
 * generated schema.
 */
export type ApiListResponse<T> = { items: T[]; nextCursor?: string }

// ── Operation-level helpers ─────────────────────────────────────────────────

/**
 * Extracts the `application/json` response body type for the HTTP 200 case
 * of a given named operation.
 *
 * @example
 * ```ts
 * import { apiFetch } from './client'
 * import type { operations, ApiResponse } from './types'
 *
 * // Type is inferred from the spec — no manual annotation needed.
 * const score = await apiFetch<ApiResponse<operations['getTrustScore']>>(
 *   `/trust-score/${address}`
 * )
 * ```
 */
export type ApiResponse<
  Op extends { responses: { 200: { content: { 'application/json': unknown } } } },
> = Op['responses'][200]['content']['application/json']
