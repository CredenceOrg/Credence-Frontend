import type { TrustScore } from '../api/types'
import { normalizeScore, resolveTier } from './tiers'

/**
 * Normalise an untrusted `TrustScore` payload into a render-safe value.
 *
 * The OpenAPI type describes the *expected* shape but nothing validates the
 * response at runtime, so a malformed or hostile payload can otherwise reach
 * the page and throw during render (for example an unknown `tier` indexing
 * `TIER_CONFIG`). This function is the single boundary where that is made
 * safe.
 *
 * Rules:
 * - Returns `null` when the payload is not an object or a required identity
 *   field (`address`, `updatedAt`) is missing, so the caller can surface a
 *   clean error instead of rendering a half-populated card.
 * - `score` is clamped to `[0, MAX_SCORE]` and rounded to an integer;
 *   non-finite values become `0`.
 * - `tier` is validated against the known tier union. Unknown or missing
 *   values are derived from the normalised score.
 * - `attestations` is coerced to a non-negative integer.
 */
export function normalizeTrustScore(raw: unknown): TrustScore | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null
  }

  const record = raw as Record<string, unknown>

  const address = record.address
  if (typeof address !== 'string' || address.trim() === '') {
    return null
  }

  const updatedAt = record.updatedAt
  if (typeof updatedAt !== 'string' || updatedAt.trim() === '') {
    return null
  }

  const rawScore = record.score
  const score = typeof rawScore === 'number' ? Math.round(normalizeScore(rawScore)) : 0

  const rawAttestations = record.attestations
  const attestations =
    typeof rawAttestations === 'number' && Number.isFinite(rawAttestations)
      ? Math.max(0, Math.floor(rawAttestations))
      : 0

  return {
    address,
    score,
    tier: resolveTier(record.tier, score),
    attestations,
    updatedAt,
  }
}
